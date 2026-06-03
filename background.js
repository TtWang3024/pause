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
  breakMinutes: 3,
  breakMessage: "Step away from the screen. Stretch. Breathe."
};

const PAUSE_PAGE = chrome.runtime.getURL("pause.html");
const BREAK_PAGE = chrome.runtime.getURL("break.html");

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

// State per hostname: { allowanceEnd, breakEnd }
async function getHostState(hostname) {
  const { hostStates = {} } = await chrome.storage.local.get("hostStates");
  return hostStates[hostname] || null;
}

async function setHostState(hostname, state) {
  const { hostStates = {} } = await chrome.storage.local.get("hostStates");
  if (state) hostStates[hostname] = state;
  else delete hostStates[hostname];
  await chrome.storage.local.set({ hostStates });
}

async function grantAllowance(hostname, settings) {
  const now = Date.now();
  const allowanceEnd = now + settings.allowanceMinutes * 60 * 1000;
  const breakEnd = settings.forceBreak
    ? allowanceEnd + settings.breakMinutes * 60 * 1000
    : allowanceEnd;
  await setHostState(hostname, { allowanceEnd, breakEnd });
  // Wake up at allowanceEnd to actively re-block any open tabs.
  await scheduleExpireAlarm(hostname);
}

// Schedules the next "this hostname's state changes" alarm.
async function scheduleExpireAlarm(hostname) {
  const state = await getHostState(hostname);
  if (!state) {
    await chrome.alarms.clear("expire:" + hostname);
    return;
  }
  const now = Date.now();
  let when;
  if (now < state.allowanceEnd) when = state.allowanceEnd;
  else if (now < state.breakEnd) when = state.breakEnd;
  else { await chrome.alarms.clear("expire:" + hostname); return; }
  await chrome.alarms.create("expire:" + hostname, { when });
}

// Find every open http(s) tab on this exact hostname and redirect them.
async function redirectTabsOnHost(hostname, makeRedirectUrl) {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    try {
      const u = new URL(tab.url);
      if (u.hostname.toLowerCase() === hostname) {
        chrome.tabs.update(tab.id, { url: makeRedirectUrl(tab.url) });
      }
    } catch {}
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("expire:")) return;
  const hostname = alarm.name.slice("expire:".length);
  const state = await getHostState(hostname);
  if (!state) return;
  const now = Date.now();
  const settings = await getSettings();

  if (now < state.allowanceEnd) {
    // Fired too early (clock skew or fast-forward); just reschedule.
    await scheduleExpireAlarm(hostname);
    return;
  }
  if (now < state.breakEnd) {
    // Allowance just ended → kick tabs into the break page, then schedule the break-end alarm.
    const bg = findGroupForUrl("https://" + hostname + "/", settings.groups);
    const bgId = bg ? bg.id : "";
    await redirectTabsOnHost(hostname, (url) =>
      BREAK_PAGE + "?url=" + encodeURIComponent(url) +
      "&end=" + state.breakEnd +
      "&group=" + encodeURIComponent(bgId)
    );
    await chrome.alarms.create("expire:" + hostname, { when: state.breakEnd });
    return;
  }
  // Break is over (or there was none) → kick tabs back through the pause page.
  // We pass an empty group id; pause.js falls back to the global default seconds.
  const group = findGroupForUrl("https://" + hostname + "/", settings.groups);
  const groupId = group ? group.id : "";
  await redirectTabsOnHost(hostname, (url) =>
    PAUSE_PAGE + "?url=" + encodeURIComponent(url) + "&group=" + encodeURIComponent(groupId)
  );
  await setHostState(hostname, null);
  await chrome.alarms.clear("expire:" + hostname);
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;
  if (url.startsWith(PAUSE_PAGE) || url.startsWith(BREAK_PAGE)) return;

  const settings = await getSettings();
  const group = findGroupForUrl(url, settings.groups);
  if (!group) return;
  if (!scheduleActiveNow(group.schedule)) return;

  const hostname = new URL(url).hostname.toLowerCase();
  const state = await getHostState(hostname);
  const now = Date.now();

  if (state && now < state.allowanceEnd) return;
  if (state && now < state.breakEnd) {
    const redirect = BREAK_PAGE +
      "?url=" + encodeURIComponent(url) +
      "&end=" + state.breakEnd +
      "&group=" + encodeURIComponent(group.id);
    chrome.tabs.update(details.tabId, { url: redirect });
    return;
  }
  const redirect = PAUSE_PAGE +
    "?url=" + encodeURIComponent(url) +
    "&group=" + encodeURIComponent(group.id);
  chrome.tabs.update(details.tabId, { url: redirect });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "grantAllowance" && msg.hostname) {
    getSettings().then(async (settings) => {
      await grantAllowance(msg.hostname, settings);
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg?.type === "getSettings") {
    getSettings().then((s) => sendResponse(s));
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
