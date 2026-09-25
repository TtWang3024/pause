const urlEl = document.getElementById("current-url");
const groupSelect = document.getElementById("group-select");
const blockDomainBtn = document.getElementById("block-domain");
const blockSectionBtn = document.getElementById("block-section");
const domainTargetEl = document.getElementById("domain-target");
const sectionInput = document.getElementById("section-input");
const statusEl = document.getElementById("status");
const settingsBtn = document.getElementById("open-settings");

let currentTab = null;
let settings = null;
let domainRule = null;
let suggestedSection = null;

settingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

function deriveRules(urlString) {
  try {
    const u = new URL(urlString);
    if (!/^https?:$/.test(u.protocol)) return { domain: null, section: null };
    const hostname = u.hostname.toLowerCase();
    const segments = (u.pathname || "/").split("/").filter(Boolean);
    let sectionPath;
    if (segments.length === 0) sectionPath = null;
    else if (segments.length === 1) sectionPath = "/" + segments[0];
    else sectionPath = "/" + segments.slice(0, 2).join("/");
    return {
      domain: hostname,
      section: sectionPath ? hostname + sectionPath : null
    };
  } catch {
    return { domain: null, section: null };
  }
}

function populateGroups(preferredId) {
  groupSelect.innerHTML = "";
  for (const g of settings.groups) {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name || "Untitled";
    groupSelect.appendChild(opt);
  }
  if (preferredId && settings.groups.some((g) => g.id === preferredId)) {
    groupSelect.value = preferredId;
  }
}

function ruleExists(rule) {
  if (!rule) return false;
  const groupId = groupSelect.value;
  const group = settings.groups.find((g) => g.id === groupId);
  if (!group) return false;
  return group.sites.some((s) => s.trim().toLowerCase() === rule.trim().toLowerCase());
}

function refreshButtons() {
  if (domainRule) {
    domainTargetEl.textContent = domainRule;
    blockDomainBtn.disabled = ruleExists(domainRule);
  } else {
    domainTargetEl.textContent = "(unavailable)";
    blockDomainBtn.disabled = true;
  }

  const sectionVal = sectionInput.value.trim();
  const sameAsDomain = sectionVal && domainRule && sectionVal.toLowerCase() === domainRule;
  if (!sectionVal || sameAsDomain) {
    blockSectionBtn.disabled = true;
  } else {
    blockSectionBtn.disabled = ruleExists(sectionVal);
  }
}

async function addRule(rule) {
  const groupId = groupSelect.value;
  const group = settings.groups.find((g) => g.id === groupId);
  if (!group) return;
  const normalized = rule.trim().toLowerCase();
  if (!normalized) return;
  if (group.sites.some((s) => s.trim().toLowerCase() === normalized)) return;
  group.sites.push(normalized);
  await chrome.storage.sync.set({ settings });
  await chrome.storage.local.set({ lastUsedGroupId: groupId });
  statusEl.textContent = "Added to " + (group.name || "group");
  refreshButtons();
}

blockDomainBtn.addEventListener("click", () => domainRule && addRule(domainRule));
blockSectionBtn.addEventListener("click", () => {
  const val = sectionInput.value.trim();
  if (val) addRule(val);
});
groupSelect.addEventListener("change", refreshButtons);
sectionInput.addEventListener("input", refreshButtons);

// ---------- the back door: pause blocking for an hour ----------
const snoozeIdle = document.getElementById("snooze-idle");
const snoozeConfirm = document.getElementById("snooze-confirm");
const snoozeOn = document.getElementById("snooze-on");
const snoozeLeft = document.getElementById("snooze-left");
const snoozeToday = document.getElementById("snooze-today");
let snoozeTimer = null;

function ordinal(n) {
  const t = n % 100;
  if (t >= 11 && t <= 13) return n + "th";
  return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
}
function hm(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? h + " h" + (m ? " " + m + " min" : "") : m + " min";
}
function hhmm(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function showSnooze(view) {
  snoozeIdle.hidden = view !== "idle";
  snoozeConfirm.hidden = view !== "confirm";
  snoozeOn.hidden = view !== "on";
}
function paintSnoozeOn(until, today) {
  if (snoozeTimer) clearInterval(snoozeTimer);
  const paint = () => {
    const left = until - Date.now();
    if (left <= 0) { clearInterval(snoozeTimer); refreshSnooze(); return; }
    const mins = Math.ceil(left / 60000);
    snoozeLeft.textContent = "Blocking is off until " + hhmm(until) + " (" + mins + " min left).";
  };
  snoozeToday.textContent = !today ? "" :   // a pause that began before midnight
    today === 1 ? "Paused once today." : today === 2 ? "Paused twice today." : "Paused " + today + " times today.";
  paint();
  snoozeTimer = setInterval(paint, 1000);
  showSnooze("on");
}
async function refreshSnooze() {
  let s = null;
  try { s = await chrome.runtime.sendMessage({ type: "snoozeStatus" }); } catch (e) {}
  if (s && s.until) paintSnoozeOn(s.until, s.today);
  else showSnooze("idle");
}

// ---- the confirm view: the count you can't skim, then two steps through the body ----
const szOrdinal = document.getElementById("sz-ordinal");
const szDots = document.getElementById("sz-dots");
const szCost = document.getElementById("sz-cost");
const szBreath = document.getElementById("sz-breath");
const szBall = document.getElementById("sz-ball");
const szCue = document.getElementById("sz-breath-cue");
const szBreathCount = document.getElementById("sz-breath-count");
const szFeet = document.getElementById("sz-feet");
const szFeetHold = document.getElementById("sz-feet-hold");
const szFeetFill = document.getElementById("sz-feet-fill");
const szFeetLabel = document.getElementById("sz-feet-label");
const snoozeYes = document.getElementById("snooze-yes");
const BREATH_HALF_MS = 4000;   // 4 s in, 4 s out, like the urge window's ball
const BREATHS = 2;             // always two: the step is a pause to take, not a penalty
const FEET_HOLD_MS = 5000;
let breathTimer = null, feetTimer = null, feetStart = 0;

function paintCount(s) {
  const n = (s ? s.today : 0) + 1;                 // the pause this would be
  szOrdinal.textContent = ordinal(n);
  szOrdinal.classList.toggle("many", n >= 3);
  szDots.innerHTML = "";
  for (const ts of (s && s.times) || []) {
    const d = document.createElement("span");
    d.className = "sz-dot";
    d.innerHTML = "<i></i>" + hhmm(ts);
    szDots.appendChild(d);
  }
  const now = document.createElement("span");
  now.className = "sz-dot now";
  now.innerHTML = "<i></i>now";
  szDots.appendChild(now);
  const mins = s ? s.minutes : 0;
  szCost.innerHTML = mins
    ? "<strong>" + hm(mins) + "</strong> unblocked today. This makes <strong>" + hm(mins + 60) + "</strong>."
    : "Nothing unblocked today yet. This makes <strong>1 h</strong>.";
}

function stopSteps() {
  if (breathTimer) clearTimeout(breathTimer);
  if (feetTimer) cancelAnimationFrame(feetTimer);
  breathTimer = null; feetTimer = null;
}

function runBreaths(total) {
  szBreath.classList.remove("done");
  szFeet.hidden = true;
  snoozeYes.disabled = true;
  let i = 0;
  const step = (inhale) => {
    szBall.classList.toggle("in", inhale);
    szCue.textContent = inhale ? "Breathe in…" : "Breathe out…";
    szBreathCount.textContent = "breath " + (i + 1) + " of " + total;
    breathTimer = setTimeout(() => {
      if (inhale) { step(false); return; }
      i += 1;
      if (i < total) { step(true); return; }
      szCue.textContent = "Well breathed.";
      szBreathCount.textContent = total + (total === 1 ? " breath" : " breaths");
      szBreath.classList.add("done");
      startFeet();
    }, BREATH_HALF_MS);
  };
  szBall.classList.remove("in");
  void szBall.offsetWidth;                         // start from the small ball
  step(true);
}

function paintFeet(ms) {
  szFeetFill.style.width = Math.min(100, (ms / FEET_HOLD_MS) * 100) + "%";
  szFeetLabel.textContent = ms > 0 ? "Feel them… " + Math.max(1, Math.ceil((FEET_HOLD_MS - ms) / 1000)) : "Hold while you feel them";
}
function startFeet() {
  szFeet.hidden = false;
  szFeet.classList.remove("done");
  paintFeet(0);
}
function feetDown(e) {
  if (szFeet.classList.contains("done")) return;
  e.preventDefault();
  feetStart = performance.now();
  const tick = (t) => {
    const ms = t - feetStart;
    if (ms >= FEET_HOLD_MS) {
      feetTimer = null;
      szFeet.classList.add("done");
      szFeetFill.style.width = "100%";
      szFeetLabel.textContent = "✓ Feet on the floor";
      snoozeYes.disabled = false;
      return;
    }
    paintFeet(ms);
    feetTimer = requestAnimationFrame(tick);
  };
  feetTimer = requestAnimationFrame(tick);
}
function feetUp() {                                // letting go starts the hold again
  if (!feetTimer) return;
  cancelAnimationFrame(feetTimer);
  feetTimer = null;
  paintFeet(0);
}
szFeetHold.addEventListener("pointerdown", feetDown);
szFeetHold.addEventListener("pointerup", feetUp);
szFeetHold.addEventListener("pointerleave", feetUp);
szFeetHold.addEventListener("pointercancel", feetUp);

// First tap: the count and the cost, then the body steps. Nothing is off yet.
document.getElementById("snooze-ask").addEventListener("click", async () => {
  let s = null;
  try { s = await chrome.runtime.sendMessage({ type: "snoozeStatus" }); } catch (e) {}
  paintCount(s);
  showSnooze("confirm");
  stopSteps();
  runBreaths(BREATHS);
});
document.getElementById("snooze-cancel").addEventListener("click", () => { stopSteps(); showSnooze("idle"); });
// Second tap: off for an hour.
document.getElementById("snooze-yes").addEventListener("click", async () => {
  if (snoozeYes.disabled) return;
  stopSteps();
  let s = null;
  try { s = await chrome.runtime.sendMessage({ type: "snoozeStart" }); } catch (e) {}
  if (s && s.until) paintSnoozeOn(s.until, s.today);
});
document.getElementById("snooze-off").addEventListener("click", async () => {
  try { await chrome.runtime.sendMessage({ type: "snoozeEnd" }); } catch (e) {}
  if (snoozeTimer) clearInterval(snoozeTimer);
  showSnooze("idle");
});

refreshSnooze();

(async function init() {
  const [tabs, settingsResult, localResult] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.runtime.sendMessage({ type: "getSettings" }),
    chrome.storage.local.get("lastUsedGroupId")
  ]);
  currentTab = tabs[0];
  settings = settingsResult;
  // Caught binge-watching sites are not saved groups: keep them out of the
  // picker and out of the settings this popup writes back.
  if (settings && Array.isArray(settings.groups)) settings.groups = settings.groups.filter((g) => !g.binge);
  const lastUsedGroupId = localResult?.lastUsedGroupId;

  if (currentTab?.url) {
    urlEl.textContent = currentTab.url;
    const { domain, section } = deriveRules(currentTab.url);
    domainRule = domain;
    suggestedSection = section;
    sectionInput.value = section || (domain || "");
  } else {
    urlEl.textContent = "(no active tab)";
  }

  if (!settings) {
    statusEl.textContent = "Could not load settings.";
    return;
  }
  populateGroups(lastUsedGroupId);
  refreshButtons();
})();
