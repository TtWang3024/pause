const DEFAULT_GROUP_SCHEDULE = {
  // days: 0=Sun, 1=Mon, ..., 6=Sat. Defaults to every day.
  days: [0, 1, 2, 3, 4, 5, 6],
  // Optional HH:MM time window. Null = all day.
  startTime: null,
  endTime: null
};

const DEFAULT_SETTINGS = {
  groups: [
    {
      id: "default",
      name: "Default",
      sites: [],
      pauseSeconds: 10,
      schedule: { ...DEFAULT_GROUP_SCHEDULE }
    }
  ],
  background: { type: "preset", value: "black" },
  allowanceMinutes: 5,
  resetOnRelease: false,
  forceBreak: false,
  breakMessage: "Step away from the screen. Stretch. Breathe."
};

const BREAK_MIN = 1;
const BREAK_MAX = 30;

const REFLECT_PAGE = chrome.runtime.getURL("reflect.html");
const COMMIT_PAGE = chrome.runtime.getURL("commit.html");
const PAUSE_PAGE = chrome.runtime.getURL("pause.html");
const BREAK_PAGE = chrome.runtime.getURL("break.html");

function clampBreakMinutes(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return null;
  return Math.max(BREAK_MIN, Math.min(BREAK_MAX, n));
}

const ALLOW_MIN = 3;
const ALLOW_MAX = 25;
function clampAllowanceMinutes(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return null;
  return Math.max(ALLOW_MIN, Math.min(ALLOW_MAX, n));
}

// The screen that starts the gate: when a break is enforced, the reflection
// screen (→ commitment → pause); otherwise straight to the pause page.
function entryUrl(targetUrl, groupId, forceBreak) {
  const base = forceBreak ? REFLECT_PAGE : PAUSE_PAGE;
  return base +
    "?url=" + encodeURIComponent(targetUrl) +
    "&group=" + encodeURIComponent(groupId);
}

async function getSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  // Ensure each group has a schedule (migrate older saves).
  merged.groups = merged.groups.map((g) => ({
    ...g,
    schedule: g.schedule || { ...DEFAULT_GROUP_SCHEDULE }
  }));
  return merged;
}

// A rule is either "domain.com" or "domain.com/path/prefix".
// hostname matches: equal or subdomain. Path matches: URL path starts with the rule's path.
function urlMatchesRule(url, rule) {
  const s = rule.trim().toLowerCase().replace(/^https?:\/\//, "");
  if (!s) return false;
  const slashIdx = s.indexOf("/");
  const ruleHost = slashIdx === -1 ? s : s.slice(0, slashIdx);
  const rulePath = slashIdx === -1 ? "" : s.slice(slashIdx); // includes leading "/"
  let urlObj;
  try { urlObj = new URL(url); } catch { return false; }
  const host = urlObj.hostname.toLowerCase();
  const hostMatches = host === ruleHost || host.endsWith("." + ruleHost);
  if (!hostMatches) return false;
  if (!rulePath) return true;
  const path = urlObj.pathname || "/";
  // Match path prefix, but make sure we don't half-match a segment:
  // rule /r/fun should not match /r/funny — require boundary (end or /).
  if (path === rulePath) return true;
  if (path.startsWith(rulePath + "/")) return true;
  return false;
}

function findGroupForUrl(url, groups) {
  for (const group of groups) {
    for (const site of group.sites) {
      if (urlMatchesRule(url, site)) return group;
    }
  }
  return null;
}

function scheduleActiveNow(schedule, now = new Date()) {
  if (!schedule) return true;
  const day = now.getDay();
  if (Array.isArray(schedule.days) && schedule.days.length > 0 && !schedule.days.includes(day)) {
    return false;
  }
  const start = parseHM(schedule.startTime);
  const end = parseHM(schedule.endTime);
  if (start == null || end == null) return true; // no window = all day
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true; // 24h
  if (start < end) {
    return minutes >= start && minutes < end;
  }
  // Wraps midnight, e.g. 22:00 → 06:00
  return minutes >= start || minutes < end;
}

function parseHM(s) {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10), mm = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

// State per GROUP (shared by all sites in the group): { allowanceEnd, breakEnd, breakMinutes }
async function getGroupState(groupId) {
  const { groupStates = {} } = await chrome.storage.local.get("groupStates");
  return groupStates[groupId] || null;
}

async function setGroupState(groupId, state) {
  const { groupStates = {} } = await chrome.storage.local.get("groupStates");
  if (state) groupStates[groupId] = state;
  else delete groupStates[groupId];
  await chrome.storage.local.set({ groupStates });
}

// breakMinutesOverride is the per-session value committed on the commitment
// screen; falls back to the settings default when absent.
async function grantAllowance(groupId, settings, breakMinutesOverride, allowanceMinutesOverride) {
  const now = Date.now();
  const allow = clampAllowanceMinutes(allowanceMinutesOverride);
  const allowanceMinutes = allow != null ? allow : settings.allowanceMinutes;
  const allowanceEnd = now + allowanceMinutes * 60 * 1000;
  const committed = clampBreakMinutes(breakMinutesOverride);
  const breakMinutes = committed != null ? committed : BREAK_MAX;
  const breakEnd = settings.forceBreak
    ? allowanceEnd + breakMinutes * 60 * 1000
    : allowanceEnd;
  await setGroupState(groupId, { allowanceEnd, breakEnd, breakMinutes });
  // Wake up at allowanceEnd to actively re-block the whole group's open tabs.
  await scheduleExpireAlarm(groupId);
}

// Schedules the next "this group's state changes" alarm.
async function scheduleExpireAlarm(groupId) {
  const state = await getGroupState(groupId);
  if (!state) {
    await chrome.alarms.clear("expire:" + groupId);
    return;
  }
  const now = Date.now();
  let when;
  if (now < state.allowanceEnd) when = state.allowanceEnd;
  else if (now < state.breakEnd) when = state.breakEnd;
  else { await chrome.alarms.clear("expire:" + groupId); return; }
  await chrome.alarms.create("expire:" + groupId, { when });
}

// Find every open http(s) tab whose URL matches any site rule in the group
// and redirect them — so the whole group blocks (or unblocks) together.
async function redirectTabsInGroup(group, makeRedirectUrl) {
  if (!group) return;
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (!tab.url) continue;
    if (group.sites.some((site) => urlMatchesRule(tab.url, site))) {
      chrome.tabs.update(tab.id, { url: makeRedirectUrl(tab.url) });
    }
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("expire:")) return;
  const groupId = alarm.name.slice("expire:".length);
  const state = await getGroupState(groupId);
  if (!state) {
    await chrome.alarms.clear("expire:" + groupId);
    return;
  }
  const now = Date.now();
  const settings = await getSettings();
  const group = settings.groups.find((g) => g.id === groupId);
  if (!group) {
    // Group was deleted — clean up.
    await setGroupState(groupId, null);
    await chrome.alarms.clear("expire:" + groupId);
    return;
  }

  if (now < state.allowanceEnd) {
    // Fired too early (clock skew or fast-forward); just reschedule.
    await scheduleExpireAlarm(groupId);
    return;
  }
  if (now < state.breakEnd) {
    // Allowance just ended → kick the whole group into the break page, then schedule the break-end alarm.
    await redirectTabsInGroup(group, (url) =>
      BREAK_PAGE + "?url=" + encodeURIComponent(url) +
      "&end=" + state.breakEnd +
      "&group=" + encodeURIComponent(groupId) +
      "&mins=" + (state.breakMinutes || "")
    );
    await chrome.alarms.create("expire:" + groupId, { when: state.breakEnd });
    return;
  }
  // Break is over (or there was none) → kick the whole group back to the entry
  // screen (commitment screen when a break is enforced, else the pause page).
  await redirectTabsInGroup(group, (url) => entryUrl(url, groupId, settings.forceBreak));
  await setGroupState(groupId, null);
  await chrome.alarms.clear("expire:" + groupId);
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;
  if (url.startsWith(REFLECT_PAGE) || url.startsWith(COMMIT_PAGE) || url.startsWith(PAUSE_PAGE) || url.startsWith(BREAK_PAGE)) return;

  const settings = await getSettings();
  const group = findGroupForUrl(url, settings.groups);
  if (!group) return;
  if (!scheduleActiveNow(group.schedule)) return;

  const state = await getGroupState(group.id);
  const now = Date.now();

  if (state && now < state.allowanceEnd) return;
  if (state && now < state.breakEnd) {
    const redirect = BREAK_PAGE +
      "?url=" + encodeURIComponent(url) +
      "&end=" + state.breakEnd +
      "&group=" + encodeURIComponent(group.id) +
      "&mins=" + (state.breakMinutes || "");
    chrome.tabs.update(details.tabId, { url: redirect });
    return;
  }
  chrome.tabs.update(details.tabId, { url: entryUrl(url, group.id, settings.forceBreak) });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "grantAllowance" && msg.groupId) {
    getSettings().then(async (settings) => {
      await grantAllowance(msg.groupId, settings, msg.breakMinutes, msg.allowanceMinutes);
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg?.type === "getSettings") {
    getSettings().then((s) => sendResponse(s));
    return true;
  }
  // Content script asks whether to show the on-site reflect wand: only while
  // this page's group has an active allowance (free-browsing window).
  if (msg?.type === "reflectIconCheck") {
    (async () => {
      try {
        const settings = await getSettings();
        const url = msg.url || (sender.tab && sender.tab.url) || "";
        const group = findGroupForUrl(url, settings.groups);
        if (!group) return sendResponse({ show: false });
        const state = await getGroupState(group.id);
        sendResponse({ show: !!(state && Date.now() < state.allowanceEnd) });
      } catch (e) {
        sendResponse({ show: false });
      }
    })();
    return true;
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.sync.get("settings");
  if (!settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    chrome.runtime.openOptionsPage();
  }
});
