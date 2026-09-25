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
  magicStars: true,
  breakMessage: "Step away from the screen. Stretch. Breathe.",
  breakBackdoor: true,
  backdoorLockMin: 3,
  backdoorHoldSec: 20,
  holdToContinue: true,
  sleepReminder: true,
  sleepHours: 7.5,
  sleepFromHour: 21,
  starSeconds: 3,
  bingeEnabled: true,
  bingeHours: 2,
  bingeNever: []
};

// Sites caught by the daily time limit live in storage.local ("bingeSites"),
// not in the saved groups, so the Options Save button never overwrites them.
// Each caught site becomes its own group, so one site's session never unlocks
// another's.
const BINGE_PREFIX = "binge:";
const BINGE_PAUSE_SEC = 30;
const TRACK_ALARM = "track";
const TRACK_GAP_MS = 90 * 1000;   // a longer gap means the worker or machine slept: count nothing

const BREAK_MIN = 1;
const BREAK_MAX = 30;

const REFLECT_PAGE = chrome.runtime.getURL("reflect.html");
const INTENT_PAGE = chrome.runtime.getURL("intent.html");   // the two questions before a site opens
const AFTER_PAGE = chrome.runtime.getURL("after.html");     // the two questions when the session ends
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

// The screen that starts the gate. When Magic Stars is on, the reflection screen
// (whose built-in countdown replaces the separate hold page); otherwise the plain
// hold-to-pause page.
function entryUrl(targetUrl, groupId, useReflect) {
  const base = useReflect ? REFLECT_PAGE : PAUSE_PAGE;
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
  // Caught sites go last, so a site the user also put in a group keeps that group.
  const { bingeSites = [] } = await chrome.storage.local.get("bingeSites");
  for (const site of bingeSites) merged.groups.push(bingeGroup(site));
  return merged;
}

function bingeGroup(site) {
  return {
    id: BINGE_PREFIX + site,
    name: "Binge-watching",
    binge: true,
    sites: [site],
    pauseSeconds: BINGE_PAUSE_SEC,
    schedule: { ...DEFAULT_GROUP_SCHEDULE }
  };
}

// One key per site: the hostname without "www." or "m.", so the phone and
// desktop versions add up together.
function siteKeyOf(url) {
  let host;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    host = u.hostname.toLowerCase();
  } catch { return null; }
  return host.replace(/^(www\.|m\.)/, "") || null;
}

function localDay(now = new Date()) {
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}

// { day, totals: { site: ms }, grace: { site: ms } }; a new day starts empty.
// grace holds the total at the moment a caught site was taken out of the list,
// so taking it out gives a fresh allowance of hours instead of an instant re-catch.
async function getSiteTime() {
  const { siteTime } = await chrome.storage.local.get("siteTime");
  const day = localDay();
  if (!siteTime || siteTime.day !== day) return { day, totals: {}, grace: {} };
  return { day, totals: siteTime.totals || {}, grace: siteTime.grace || {} };
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

// A session: the Settings allowance, then the end-of-session questions. A break
// is chosen there, not committed up front, so breakEnd starts equal to allowanceEnd.
async function grantAllowance(groupId, settings, sessionId) {
  const now = Date.now();
  const allowanceMinutes = clampAllowanceMinutes(settings.allowanceMinutes) || 5;
  const allowanceEnd = now + allowanceMinutes * 60 * 1000;
  await setGroupState(groupId, { sessionStart: now, allowanceEnd, breakEnd: allowanceEnd, breakMinutes: null, ...(sessionId ? { sessionId } : {}) });
  // Wake up at allowanceEnd to actively re-block the whole group's open tabs.
  await scheduleExpireAlarm(groupId);
}

// ---------- sessions: what set it off, what you hope for, and how it went ----------
// sessionLog (storage.local, newest first): { id, ts, group, site, trigger, hope,
// mid, end, next, endedAt }. The group state carries the live session's id.
const SESSION_KEEP = 500;

async function loadSessions() {
  const { sessionLog = [] } = await chrome.storage.local.get("sessionLog");
  return Array.isArray(sessionLog) ? sessionLog : [];
}
async function updateSession(id, fn) {
  const log = await loadSessions();
  const s = log.find((x) => x && x.id === id);
  if (!s) return null;
  fn(s);
  await chrome.storage.local.set({ sessionLog: log });
  return s;
}

async function startSession(groupId, targetUrl, trigger, hope) {
  const settings = await getSettings();
  const id = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const log = await loadSessions();
  log.unshift({ id, ts: Date.now(), group: groupId, site: siteKeyOf(targetUrl) || "", trigger, hope, mid: null, end: null, next: null });
  await chrome.storage.local.set({ sessionLog: log.slice(0, SESSION_KEEP) });
  await grantAllowance(groupId, settings, id);
  return id;
}

// The live session behind a URL, for the halfway check and the end screen.
async function sessionFor(groupId) {
  const state = await getGroupState(groupId);
  if (!state || !state.sessionId) return { state, session: null };
  const session = (await loadSessions()).find((s) => s && s.id === state.sessionId) || null;
  return { state, session };
}

// The session's time is up: every tab of the group goes to the end-of-session
// questions, and stays gated there (state.after) until they are answered.
async function endAllowance(group, state, paused) {
  await setGroupState(group.id, { ...state, after: true });
  if (!paused) await redirectTabsInGroup(group, (url) => afterUrl(url, group.id));
}

function afterUrl(url, groupId) {
  return AFTER_PAGE + "?url=" + encodeURIComponent(url) + "&group=" + encodeURIComponent(groupId);
}
function pickBreakUrl(url, groupId) {
  return BREAK_PAGE + "?url=" + encodeURIComponent(url) + "&group=" + encodeURIComponent(groupId) + "&pick=1";
}

// "Take a break" chosen: the length is picked on the break screen itself.
async function startBreak(groupId, minutes) {
  const mins = clampBreakMinutes(minutes) || 3;
  const now = Date.now();
  const breakEnd = now + mins * 60 * 1000;
  await setGroupState(groupId, { allowanceEnd: now, breakEnd, breakMinutes: mins });
  await chrome.alarms.create("expire:" + groupId, { when: breakEnd });
  return breakEnd;
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

// ---------- daily time per site, and the binge-watching catch ----------
// Every 30 s: the front tab of the focused window counts, and so does any tab
// playing sound (a video in the background). Nothing counts while the screen
// is locked. Input idle still counts, because watching is idle.
async function trackTick() {
  const now = Date.now();
  const { trackLastAt = 0 } = await chrome.storage.local.get("trackLastAt");
  await chrome.storage.local.set({ trackLastAt: now });
  const delta = now - trackLastAt;
  if (!trackLastAt || delta <= 0 || delta > TRACK_GAP_MS) return;

  const settings = await getSettings();
  if (settings.bingeEnabled === false) return;
  let idleState = "active";
  try { idleState = await chrome.idle.queryState(15); } catch (e) {}
  if (idleState === "locked") return;

  const urls = [];
  try {
    const win = await chrome.windows.getLastFocused();
    if (win && win.focused) {
      const [front] = await chrome.tabs.query({ active: true, windowId: win.id });
      if (front && front.url) urls.push(front.url);
    }
  } catch (e) {}
  try {
    for (const t of await chrome.tabs.query({ audible: true })) if (t.url) urls.push(t.url);
  } catch (e) {}

  const never = Array.isArray(settings.bingeNever) ? settings.bingeNever : [];
  const sites = new Map();   // site -> one of its urls, for the group lookup
  for (const url of urls) {
    if (never.some((rule) => urlMatchesRule(url, rule))) continue;
    const site = siteKeyOf(url);
    if (site && !sites.has(site)) sites.set(site, url);
  }
  if (!sites.size) return;

  const st = await getSiteTime();
  for (const site of sites.keys()) st.totals[site] = (st.totals[site] || 0) + delta;
  await chrome.storage.local.set({ siteTime: st });

  const hours = Number.isFinite(settings.bingeHours) ? settings.bingeHours : DEFAULT_SETTINGS.bingeHours;
  const limitMs = hours * 60 * 60 * 1000;
  const caught = [];
  for (const [site, url] of sites) {
    // Already gated: by one of the user's groups, or by an earlier catch.
    if (findGroupForUrl(url, settings.groups)) continue;
    if (st.totals[site] - (st.grace[site] || 0) < limitMs) continue;
    caught.push(site);
  }
  if (!caught.length) return;
  if (await snoozeUntil()) return;                 // caught later, once the pause is over

  const { bingeSites = [] } = await chrome.storage.local.get("bingeSites");
  await chrome.storage.local.set({ bingeSites: bingeSites.concat(caught.filter((s) => !bingeSites.includes(s))) });
  // Blocked now, not on the next visit: every open tab of the site goes to the gate.
  const useReflect = settings.magicStars !== false;
  for (const site of caught) {
    const group = bingeGroup(site);
    await redirectTabsInGroup(group, (url) => entryUrl(url, group.id, useReflect));
  }
}

async function removeBingeSite(site) {
  const { bingeSites = [] } = await chrome.storage.local.get("bingeSites");
  await chrome.storage.local.set({ bingeSites: bingeSites.filter((s) => s !== site) });
  await setGroupState(BINGE_PREFIX + site, null);
  await chrome.alarms.clear("expire:" + BINGE_PREFIX + site);
  const st = await getSiteTime();
  st.grace[site] = st.totals[site] || 0;
  await chrome.storage.local.set({ siteTime: st });
}

async function ensureTrackAlarm() {
  const existing = await chrome.alarms.get(TRACK_ALARM);
  if (!existing) await chrome.alarms.create(TRACK_ALARM, { periodInMinutes: 0.5 });
}
ensureTrackAlarm();
chrome.runtime.onStartup.addListener(ensureTrackAlarm);

function breakUrl(url, groupId, state) {
  return BREAK_PAGE + "?url=" + encodeURIComponent(url) +
    "&end=" + state.breakEnd +
    "&group=" + encodeURIComponent(groupId) +
    "&mins=" + (state.breakMinutes || "");
}

// ---------- the back door: switch blocking off for an hour ----------
// Only the blocking pauses: no gate, no redirect at the end of a session, no
// binge catch. Time per site keeps counting and open break tabs are left alone.
// When the hour ends (or "Turn back on now"), every open tab on a blocked site
// goes back to where the rules say it belongs.
const SNOOZE_MS = 60 * 60 * 1000;
const SNOOZE_ALARM = "snooze-end";
const SNOOZE_KEEP_MS = 60 * 24 * 60 * 60 * 1000;   // keep 60 days of pause times

async function snoozeUntil() {
  const { snooze } = await chrome.storage.local.get("snooze");
  return snooze && snooze.until > Date.now() ? snooze.until : 0;
}

// snoozeLog: [{ start, end }] (end is the planned end, moved earlier when you
// turn it back on). Older saves hold bare start times, read as a full hour.
function snoozeSpan(e) {
  return typeof e === "number" ? { start: e, end: e + SNOOZE_MS } : e;
}

// Today's pauses: how many, when each began, and the minutes they left sites open.
async function snoozeToday() {
  const { snoozeLog = [] } = await chrome.storage.local.get("snoozeLog");
  const now = Date.now();
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const dayStart = d.getTime();
  const times = [];
  let ms = 0;
  for (const raw of snoozeLog) {
    const e = snoozeSpan(raw);
    if (!e || !Number.isFinite(e.start)) continue;
    if (e.start >= dayStart) times.push(e.start);
    ms += Math.max(0, Math.min(e.end, now) - Math.max(e.start, dayStart));
  }
  return { today: times.length, times: times.sort((a, b) => a - b), minutes: Math.round(ms / 60000) };
}

function paintSnoozeBadge(on) {
  try {
    chrome.action.setBadgeText({ text: on ? "off" : "" });
    if (on) chrome.action.setBadgeBackgroundColor({ color: "#8a8f99" });
  } catch (e) {}
}

async function startSnooze() {
  const now = Date.now();
  const until = now + SNOOZE_MS;
  const { snoozeLog = [] } = await chrome.storage.local.get("snoozeLog");
  const log = snoozeLog.map(snoozeSpan).filter((e) => e && now - e.start < SNOOZE_KEEP_MS);
  log.push({ start: now, end: until });
  await chrome.storage.local.set({ snooze: { until }, snoozeLog: log });
  await chrome.alarms.create(SNOOZE_ALARM, { when: until });
  paintSnoozeBadge(true);
  // A tab waiting on a gate (pause, reflection or commit screen) goes on to its site.
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const u = tab.url || "";
    if (!(u.startsWith(REFLECT_PAGE) || u.startsWith(PAUSE_PAGE) || u.startsWith(INTENT_PAGE))) continue;
    let target = null;
    try { target = new URL(u).searchParams.get("url"); } catch (e) {}
    if (target && /^https?:/.test(target)) chrome.tabs.update(tab.id, { url: target });
  }
  return until;
}

async function endSnooze() {
  const now = Date.now();
  const { snoozeLog = [] } = await chrome.storage.local.get("snoozeLog");
  const log = snoozeLog.map(snoozeSpan);
  const last = log[log.length - 1];
  if (last && last.end > now) { last.end = now; await chrome.storage.local.set({ snoozeLog: log }); }   // back on early: only the time it was really off counts
  await chrome.storage.local.remove("snooze");
  await chrome.alarms.clear(SNOOZE_ALARM);
  paintSnoozeBadge(false);
  await reblockAll();
}

// Put every open tab on a blocked site where it belongs right now: free during
// an allowance, the break page during a break, otherwise the gate.
async function reblockAll() {
  const settings = await getSettings();
  const useReflect = settings.magicStars !== false;
  const { groupStates = {} } = await chrome.storage.local.get("groupStates");
  const now = Date.now();
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (!tab.url) continue;
    const group = findGroupForUrl(tab.url, settings.groups);
    if (!group || !scheduleActiveNow(group.schedule)) continue;
    const state = groupStates[group.id];
    const where = placeFor(tab.url, group.id, state, now, useReflect);
    if (where) chrome.tabs.update(tab.id, { url: where });
  }
}

// A browser restart clears the badge; an hour that ran out while it was closed
// ends the pause now.
async function restoreSnooze() {
  const { snooze } = await chrome.storage.local.get("snooze");
  if (!snooze) return;
  if (snooze.until > Date.now()) {
    paintSnoozeBadge(true);
    await chrome.alarms.create(SNOOZE_ALARM, { when: snooze.until });
  } else {
    await endSnooze();
  }
}
chrome.runtime.onStartup.addListener(restoreSnooze);

// Where a tab on a blocked site belongs right now, or null when it may stay.
function placeFor(url, groupId, state, now, useReflect) {
  if (state && state.after) return afterUrl(url, groupId);                  // the session's questions wait
  if (state && state.pickBreak) return pickBreakUrl(url, groupId);          // a break was chosen, its length not yet
  if (state && now < state.allowanceEnd) return null;
  if (state && now < state.breakEnd) return breakUrl(url, groupId, state);
  return entryUrl(url, groupId, useReflect);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TRACK_ALARM) { await trackTick(); return; }
  if (alarm.name === SNOOZE_ALARM) { await endSnooze(); return; }
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
  // While the back door is open the state still moves on, but no tab is moved;
  // the end of the pause puts every tab where it belongs.
  const paused = (await snoozeUntil()) > 0;
  if (state.after || state.pickBreak) { await chrome.alarms.clear("expire:" + groupId); return; }   // waiting on a choice, not on time
  if (state.sessionId && state.breakEnd <= state.allowanceEnd) {
    // The session's time is up → the end-of-session questions decide what comes next.
    await endAllowance(group, state, paused);
    await chrome.alarms.clear("expire:" + groupId);
    return;
  }
  if (now < state.breakEnd) {
    // Allowance just ended → kick the whole group into the break page, then schedule the break-end alarm.
    if (!paused) await redirectTabsInGroup(group, (url) => breakUrl(url, groupId, state));
    await chrome.alarms.create("expire:" + groupId, { when: state.breakEnd });
    return;
  }
  // Break is over (or there was none) → kick the whole group back to the entry
  // screen (commitment screen when a break is enforced, else the pause page).
  if (!paused) await redirectTabsInGroup(group, (url) => entryUrl(url, groupId, settings.magicStars !== false));
  await setGroupState(groupId, null);
  await chrome.alarms.clear("expire:" + groupId);
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;
  if (url.startsWith(REFLECT_PAGE) || url.startsWith(INTENT_PAGE) || url.startsWith(AFTER_PAGE) || url.startsWith(PAUSE_PAGE) || url.startsWith(BREAK_PAGE)) return;
  if (await snoozeUntil()) return;                 // the back door is open

  const settings = await getSettings();
  const group = findGroupForUrl(url, settings.groups);
  if (!group) return;
  if (!scheduleActiveNow(group.schedule)) return;

  const state = await getGroupState(group.id);
  const where = placeFor(url, group.id, state, Date.now(), settings.magicStars !== false);
  if (where) chrome.tabs.update(details.tabId, { url: where });
});

const claimedBreaks = new Set();   // break ends claimed during this worker's life (storage keeps the rest)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "grantAllowance" && msg.groupId) {
    getSettings().then(async (settings) => {
      await grantAllowance(msg.groupId, settings, null);
      sendResponse({ ok: true });
    });
    return true;
  }
  // The two questions before a site opens: answered → the session starts.
  if (msg?.type === "startSession" && msg.groupId) {
    (async () => {
      const id = await startSession(msg.groupId, msg.url || "", String(msg.trigger || "").trim(), String(msg.hope || "").trim());
      sendResponse({ ok: true, id });
    })();
    return true;
  }
  // The site's halfway check asks what it is, and reports the answer.
  if (msg?.type === "sessionInfo") {
    (async () => {
      try {
        const settings = await getSettings();
        const url = msg.url || (sender.tab && sender.tab.url) || "";
        const group = findGroupForUrl(url, settings.groups);
        if (!group) return sendResponse({ session: null });
        const { state, session } = await sessionFor(group.id);
        if (!state || !session || Date.now() >= state.allowanceEnd) return sendResponse({ session: null });
        sendResponse({ session: { id: session.id, group: group.id, start: state.sessionStart || (state.allowanceEnd - 5 * 60000), end: state.allowanceEnd, hope: session.hope, trigger: session.trigger, mid: session.mid } });
      } catch (e) { sendResponse({ session: null }); }
    })();
    return true;
  }
  if (msg?.type === "sessionMid" && msg.id) {
    updateSession(msg.id, (s) => { s.mid = msg.value; s.midTs = Date.now(); }).then(() => sendResponse({ ok: true }));
    return true;
  }
  // The end screen asks for its session, then reports the answers and the choice.
  if (msg?.type === "sessionAfter" && msg.groupId) {
    (async () => {
      const { state, session } = await sessionFor(msg.groupId);
      sendResponse({ waiting: !!(state && state.after), session });
    })();
    return true;
  }
  if (msg?.type === "sessionEnd" && msg.groupId) {
    (async () => {
      const state = await getGroupState(msg.groupId);
      if (state && state.sessionId) await updateSession(state.sessionId, (s) => { s.end = msg.check ?? null; s.next = msg.next; s.endedAt = Date.now(); });
      if (msg.next === "break") await setGroupState(msg.groupId, { pickBreak: true, allowanceEnd: 0, breakEnd: 0 });
      else { await setGroupState(msg.groupId, null); await chrome.alarms.clear("expire:" + msg.groupId); }
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (msg?.type === "startBreak" && msg.groupId) {
    startBreak(msg.groupId, msg.minutes).then((end) => sendResponse({ ok: true, end }));
    return true;
  }
  if (msg?.type === "getSettings") {
    getSettings().then((s) => sendResponse(s));
    return true;
  }
  // The break page's back door: the break ends now by choice. Clearing the
  // group state means the next visit pays the normal entry ritual again.
  if (msg?.type === "endBreakEarly" && msg.groupId) {
    (async () => {
      await setGroupState(msg.groupId, null);
      await chrome.alarms.clear("expire:" + msg.groupId);
      sendResponse({ ok: true });
    })();
    return true;
  }
  // A break is logged and its star lit exactly once, however many tabs sit on
  // the break page (every tab of the group lands there) and however often one
  // reloads after 00:00. The first tab to ask wins; the others just move on.
  if (msg?.type === "claimBreakEnd" && msg.groupId) {
    const key = msg.groupId + ":" + (msg.end || "none");
    const fresh = !claimedBreaks.has(key);         // decided before any await, so two asks cannot both win
    claimedBreaks.add(key);
    (async () => {
      const { breakDone = {} } = await chrome.storage.local.get("breakDone");
      const first = fresh && breakDone[msg.groupId] !== key;
      if (first) { breakDone[msg.groupId] = key; await chrome.storage.local.set({ breakDone }); }
      sendResponse({ first });
    })();
    return true;
  }
  // The popup's back door.
  if (msg?.type === "snoozeStatus") {
    (async () => sendResponse({ until: await snoozeUntil(), ...(await snoozeToday()) }))();
    return true;
  }
  if (msg?.type === "snoozeStart") {
    (async () => {
      const until = (await snoozeUntil()) || await startSnooze();
      sendResponse({ until, ...(await snoozeToday()) });
    })();
    return true;
  }
  if (msg?.type === "snoozeEnd") {
    endSnooze().then(() => sendResponse({ ok: true }));
    return true;
  }
  // Break page: time spent today on the site behind this break.
  if (msg?.type === "siteTimeToday") {
    (async () => {
      const site = siteKeyOf(msg.url || "");
      if (!site) return sendResponse({ site: null, ms: 0 });
      const st = await getSiteTime();
      sendResponse({ site, ms: st.totals[site] || 0 });
    })();
    return true;
  }
  // Options: the caught sites with today's time on each.
  if (msg?.type === "bingeList") {
    (async () => {
      const { bingeSites = [] } = await chrome.storage.local.get("bingeSites");
      const st = await getSiteTime();
      sendResponse({ sites: bingeSites.map((site) => ({ site, ms: st.totals[site] || 0 })) });
    })();
    return true;
  }
  if (msg?.type === "bingeRemove" && msg.site) {
    removeBingeSite(msg.site).then(() => sendResponse({ ok: true }));
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
  await ensureTrackAlarm();
  const { settings } = await chrome.storage.sync.get("settings");
  if (!settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    chrome.runtime.openOptionsPage();
  }
});

// Voluntary small experiments share existing session limits.
importScripts("experiment-background.js");
