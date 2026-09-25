const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const breakEnd = parseInt(params.get("end"), 10);
const groupId = params.get("group") || "";
const minsParam = parseInt(params.get("mins"), 10);
const solo = params.get("solo") === "1";   // "Relax my body first": a standalone break, nothing unlocks after

const messageEl = document.getElementById("message");
const timeLeftEl = document.getElementById("time-left");
const breakLenEl = document.getElementById("break-len");
const progressFillEl = document.getElementById("progress-fill");
const ratingEl = document.getElementById("rating");
const ratingPromptEl = document.getElementById("rating-prompt");
const listEl = document.getElementById("activity-list");
const tagBarEl = document.getElementById("tag-bar");
const spentLineEl = document.getElementById("spent-line");
const pickHintEl = document.getElementById("pick-hint");
const customName = document.getElementById("custom-name");
const customTag = document.getElementById("custom-tag");
const customAdd = document.getElementById("custom-add");

const MAX_PICK = 3;
let settings = null;
let activities = [];
const selected = new Map(); // id -> { id, name, tag }
const tagFilter = new Set(); // area keys to show; empty shows every area
let boardFullHeight = 0;     // the unfiltered field's height, held while filtering so the page never jumps
let finished = false;        // the break has ended (at 00:00 or through the back door); nothing runs twice
let durationMin = 0;
let totalMs = 0;
let hintTimer = null;
let ratingValue = null;   // -1 / 0 / +1 once tapped; stays null if skipped
let reduceMotion = false; // e-ink / reduced motion: the star appears without its pop

function applyBackground(bg) {
  if (!bg) return;
  if (bg.type === "preset") {
    if (bg.value === "white") document.body.classList.add("theme-white");
    else document.body.classList.remove("theme-white");
  } else if (bg.type === "custom" && bg.value) {
    document.body.style.background = bg.value;
    document.body.style.color = isLightColor(bg.value) ? "#000" : "#fff";
    // a light custom colour takes the light text variants too (the inline colours above still win)
    document.body.classList.toggle("theme-white", isLightColor(bg.value));
  }
}

function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff, g = (v >> 8) & 0xff, b = v & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}


function updateHint() {
  pickHintEl.textContent = `Pick up to ${MAX_PICK} things to do  (${selected.size}/${MAX_PICK})`;
}

function flashHint(msg) {
  pickHintEl.textContent = msg;
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(updateHint, 1600);
}

// Areas in the order they first appear among the activities.
function boardTags() {
  const seen = new Map();   // key -> label as typed
  for (const a of activities) {
    const key = tagKey(a.tag);
    if (key && !seen.has(key)) seen.set(key, String(a.tag).trim().replace(/^#/, ""));
  }
  return seen;
}

function renderTagBar() {
  const tags = boardTags();
  for (const key of [...tagFilter]) if (!tags.has(key)) tagFilter.delete(key);
  tagBarEl.innerHTML = "";
  if (tags.size < 2) { tagBarEl.classList.add("hidden"); return; }   // one area has nothing to filter
  tagBarEl.classList.remove("hidden");

  const all = document.createElement("button");
  all.type = "button";
  all.className = "tag-pill tag-all" + (tagFilter.size === 0 ? " on" : "");
  all.textContent = "All";
  all.addEventListener("click", () => { tagFilter.clear(); renderTagBar(); renderChips(); });
  tagBarEl.appendChild(all);

  for (const [key, label] of tags) {
    const c = tagColor(label);
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "tag-pill" + (tagFilter.has(key) ? " on" : "");
    pill.style.background = c.bg;
    pill.style.borderColor = c.border;
    pill.style.setProperty("--ring", c.border);
    pill.textContent = "#" + label;
    pill.setAttribute("aria-pressed", tagFilter.has(key) ? "true" : "false");
    pill.addEventListener("click", () => {
      if (tagFilter.has(key)) tagFilter.delete(key); else tagFilter.add(key);
      renderTagBar();
      renderChips();
    });
    tagBarEl.appendChild(pill);
  }
}

function renderChips() {
  listEl.innerHTML = "";
  if (!activities.length) {
    const empty = document.createElement("p");
    empty.className = "list-empty";
    empty.textContent = "No saved activities yet. Add one with the pill above.";
    listEl.appendChild(empty);
    return;
  }
  for (const a of activities) {
    const on = selected.has(a.id);
    // A picked pill stays in view whatever the filter, so a choice never disappears.
    if (tagFilter.size && !on && !tagFilter.has(tagKey(a.tag))) continue;
    const c = tagColor(a.tag);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "activity-pill" + (on ? " selected" : "");
    chip.style.background = c.bg;
    chip.style.borderColor = c.border;
    if (a.tag) chip.title = "#" + String(a.tag).replace(/^#/, "");

    const check = document.createElement("span");
    check.className = "pill-check";
    check.textContent = "✓";
    chip.appendChild(check);

    const name = document.createElement("span");
    name.className = "pill-name";
    name.textContent = a.name;
    chip.appendChild(name);

    chip.addEventListener("click", () => toggleSelect(a));
    listEl.appendChild(chip);
  }
  if (!tagFilter.size) { listEl.style.minHeight = ""; boardFullHeight = listEl.offsetHeight; }
  else if (boardFullHeight) listEl.style.minHeight = boardFullHeight + "px";
}

async function recolourBoard() {
  await ensureTagColors(activities.map((a) => a.tag));
  renderTagBar();
  renderChips();
}

function toggleSelect(a) {
  if (selected.has(a.id)) {
    selected.delete(a.id);
  } else {
    if (selected.size >= MAX_PICK) {
      flashHint(`That's ${MAX_PICK} already, tap one to deselect first`);
      return;
    }
    selected.set(a.id, { id: a.id, name: a.name, tag: a.tag || "" });
  }
  updateHint();
  renderChips();
}

// The add line lives behind a pill (the Android pattern): the pill reveals
// the inputs; "+" with an empty name simply folds them away again.
const addReveal = document.getElementById("add-reveal");
const addCustom = document.getElementById("add-custom");

function foldAddLine() {
  addCustom.classList.add("hidden");
  addReveal.classList.remove("hidden");
}

addReveal.addEventListener("click", () => {
  addReveal.classList.add("hidden");
  addCustom.classList.remove("hidden");
  customName.focus();
});

async function onCustomAdd() {
  const name = customName.value.trim();
  if (!name) { foldAddLine(); return; }
  const tag = customTag.value.trim().replace(/^#/, "");
  const a = { id: genId("a"), name, tag };
  activities.push(a);
  await saveBreakActivities(activities);
  customName.value = "";
  customTag.value = "";
  if (selected.size < MAX_PICK) selected.set(a.id, { id: a.id, name, tag });
  updateHint();
  await recolourBoard();
  customName.focus();
}

// One quiet tap: "Did {group} give you what you came for?" Last tap wins; skipping stays null.
function bindRating(groupLabel) {
  const ask = `Did ${groupLabel} give you what you came for?`;
  ratingPromptEl.textContent = ask;
  const opts = ratingEl.querySelectorAll(".rate-opt");
  opts.forEach((b) => {
    b.addEventListener("click", () => {
      const v = parseInt(b.dataset.v, 10);
      if (ratingValue === v) {                 // tap the chosen one again → back to skipped
        ratingValue = null;
        b.classList.remove("on");
        ratingEl.classList.remove("rated");
        ratingPromptEl.textContent = ask;
        return;
      }
      ratingValue = v;
      opts.forEach((o) => o.classList.toggle("on", o === b));
      ratingEl.classList.add("rated");
      ratingPromptEl.textContent =
        ratingValue < 0 ? "Noted. Good to know." :
        ratingValue > 0 ? "Noted. Rest easy." : "Noted.";
    });
  });
}

// ---- the bedtime card ----
// Late in the evening it works out when you would wake if you went to bed now.
// Arithmetic, not an alarm: no sound, nothing to dismiss.
// How long today went on the site behind this break (a solo break has none).
function formatSpent(ms) {
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return m + " min";
  return m ? h + " h " + m + " min" : h + " h";
}

async function paintSpentLine() {
  if (!targetUrl) return;
  let res = null;
  try { res = await chrome.runtime.sendMessage({ type: "siteTimeToday", url: targetUrl }); } catch (e) {}
  if (!res || !res.site || res.ms < 60000) return;
  spentLineEl.textContent = "You've spent " + formatSpent(res.ms) + " on " + res.site + " today.";
  spentLineEl.classList.remove("hidden");
}

const sleepCardEl = document.getElementById("sleep-card");
const sleepLineEl = document.getElementById("sleep-line");

function hhmm(d) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function tidyHours(h) {
  return (Math.round(h * 10) % 10 === 0) ? String(Math.round(h)) : String(h);
}
function paintSleepCard() {
  if (!settings || settings.sleepReminder === false) return;
  const from = Number.isFinite(settings.sleepFromHour) ? settings.sleepFromHour : 21;
  const hours = Number.isFinite(settings.sleepHours) ? settings.sleepHours : 7.5;
  const now = new Date();
  const h = now.getHours();
  // the evening window runs from the chosen hour until the small hours
  if (!(h >= from || h < 5)) return;
  const wake = new Date(now.getTime() + hours * 60 * 60 * 1000);
  sleepLineEl.innerHTML = "Go to bed now and you'll wake at <strong>" + hhmm(wake) +
    "</strong> after " + tidyHours(hours) + " hours.";
  sleepCardEl.classList.remove("hidden");
}

// ---- the urge wave rides through the break: same reflection entry, same curve ----
const uwEl = document.getElementById("urge-wave");
const uwGrid = document.getElementById("uw-grid");
const uwPath = document.getElementById("uw-path");
const uwDots = document.getElementById("uw-dots");
const UW_COLORS = { 10: "#123a66", 8: "#1d4f86", 6: "#2f6cb8", 4: "#5b96f5", 2: "#9cc7ee", 0: "#c7dff5" };
const UW_X0 = 10, UW_Y0 = 130, UW_YSPAN = 118;
const UW_STEP = 38;         // the same roomy step as the reflection window, in pixels
const UW_SHOW = 20;         // at least the last 20 points, or every point of the last 4 hours
const uwChart = document.getElementById("uw-chart");
let uwPast = [];            // earlier sessions' points on this site, drawn faded
let urgeEntry = null;       // the reflection entry whose wave this break extends
let uwSaving = false;
let uwFrozen = false;       // set when the break ends: no more points, no more redraws

function uwY(v) { return UW_Y0 - (v / 10) * UW_YSPAN; }
// Same layout as the reflection window, one even step per tap, on a chart as
// wide as its box: the viewBox follows the box's pixel width, so nothing is
// letterboxed and a wide screen simply holds more points at the roomy step.
function uwRender() {
  if (!urgeEntry) return;
  const W = Math.max(200, Math.round(uwChart.clientWidth || 400));
  const UW_X1 = W - 10;
  uwChart.setAttribute("viewBox", "0 0 " + W + " 140");
  uwGrid.innerHTML = "";
  [0, 2, 4, 6, 8, 10].forEach((v) => {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", UW_X0); l.setAttribute("x2", UW_X1);
    l.setAttribute("y1", uwY(v)); l.setAttribute("y2", uwY(v));
    l.setAttribute("class", "uw-grid-line");
    uwGrid.appendChild(l);
  });
  const pts = waveToShow(uwPast, urgeEntry.wave, Date.now(), UW_SHOW, true);
  const { step, x } = waveLayout(pts.length, UW_X0, UW_X1, UW_STEP);
  const r = waveDotR(step, 3.5);
  uwDots.innerHTML = "";
  pts.forEach((p, i) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", x(i).toFixed(1));
    c.setAttribute("cy", uwY(p.v).toFixed(1));
    c.setAttribute("r", r.toFixed(1));
    c.setAttribute("fill", UW_COLORS[p.v] || "#5b96f5");
    if (p.past) c.setAttribute("opacity", "0.45");   // an earlier session on this site
    uwDots.appendChild(c);
  });
  uwPath.setAttribute("d", wavePathD(pts.map((p, i) => [x(i), uwY(p.v)])));
}
let uwDirty = false;
async function uwPersist() {
  uwDirty = true;
  if (uwSaving) return;                      // the running pass loops again for us
  uwSaving = true;
  while (uwDirty) {
    uwDirty = false;
    try {
      const log = await loadReflectionLog();
      const i = log.findIndex((r) => r.id === urgeEntry.id);
      if (i < 0) break;
      // merge with whatever another screen may have written; ts + level identifies a tap
      const stored = Array.isArray(log[i].wave) ? log[i].wave : [];
      const seen = new Set(urgeEntry.wave.map((p) => p.ts + ":" + p.v));
      for (const p of stored) if (!seen.has(p.ts + ":" + p.v)) urgeEntry.wave.push(p);
      urgeEntry.wave.sort((a, b) => a.ts - b.ts);
      log[i].wave = urgeEntry.wave.slice();   // only the wave: a star another tab has lit stays lit
      await saveReflectionLog(log);
    } catch (e) { break; }
  }
  uwSaving = false;
}
const URGE_STALE_MS = 6 * 60 * 60 * 1000;   // an activeUrge older than this belongs to an abandoned session
async function initUrgeWave() {
  try {
    const { activeUrge } = await chrome.storage.local.get("activeUrge");
    if (!activeUrge || activeUrge.group !== groupId) return;
    if (Date.now() - activeUrge.ts > URGE_STALE_MS) return;   // a stale session, leave it be
    const log = await loadReflectionLog();
    const entry = log.find((r) => r.id === activeUrge.refId);
    if (!entry) return;
    if (!Array.isArray(entry.wave)) entry.wave = [];
    urgeEntry = entry;
    let site = entry.urge || "";
    if (!site) { try { site = new URL(targetUrl).hostname.replace(/^www\./, ""); } catch (e) {} }
    uwPast = siteWaveHistory(log, site, entry.id);
  } catch (e) { return; }
  uwEl.classList.remove("hidden");
  window.addEventListener("resize", uwRender);
  document.querySelectorAll(".uw-lvl").forEach((b) => {
    b.addEventListener("click", () => {
      if (uwFrozen) return;
      urgeEntry.wave.push({ ts: Date.now(), v: parseInt(b.dataset.v, 10) });
      uwRender();
      uwPersist();
    });
  });
  uwRender();
}
// The break is ending: freeze the wave so a late tap cannot race the finalize
// below, then let any write already on its way land before the log is read again.
async function settleUrgeWave() {
  uwFrozen = true;
  document.querySelectorAll(".uw-lvl").forEach((b) => { b.disabled = true; });
  while (uwSaving) await new Promise((r) => setTimeout(r, 50));
}
async function clearActiveUrge() {
  try {
    const { activeUrge } = await chrome.storage.local.get("activeUrge");
    if (activeUrge && activeUrge.group === groupId) await chrome.storage.local.remove("activeUrge");
  } catch (e) {}
}
function closeThisTab() {
  try {
    chrome.tabs.getCurrent((tab) => {
      if (tab && tab.id != null) chrome.tabs.remove(tab.id);
      else location.replace("about:blank");
    });
  } catch (e) { location.replace("about:blank"); }
}

function tick() {
  if (finished) return;            // the back door ended it first
  const remaining = breakEnd - Date.now();
  if (totalMs > 0) {
    const frac = Math.max(0, Math.min(1, (totalMs - remaining) / totalMs));
    progressFillEl.style.width = (frac * 100).toFixed(1) + "%";
  }
  if (remaining <= 0) {
    progressFillEl.style.width = "100%";
    finishBreak("done", durationMin);    // the break ends by itself: the whole length was rested
    return;
  }
  if (!holding) paintBackdoor();   // the hold interval paints while held
  setTimeout(tick, 250);
}

// ---- the back door (ported from the Android app) ----
// On every break: visible from the start, locked for the
// first 3 minutes, then hold for 20 s. Releasing keeps the progress; the log
// records the minutes actually rested. No blame words anywhere.
const returnBtn = document.getElementById("return-btn");
let HOLD_MS = 20 * 1000;          // both are settable in Options
let LOCK_MS = 3 * 60 * 1000;
let holdLeft = HOLD_MS;
let holding = false;
let holdTimer = null;
let holdLast = 0;

function backdoorLocked() {
  return (breakEnd - totalMs) + LOCK_MS - Date.now() > 0;
}

function paintBackdoor() {
  if (finished || returnBtn.classList.contains("hidden")) return;
  const lockedLeft = (breakEnd - totalMs) + LOCK_MS - Date.now();
  const locked = lockedLeft > 0;
  returnBtn.classList.toggle("locked", locked);
  returnBtn.setAttribute("aria-disabled", String(locked));
  returnBtn.textContent = locked ? "Rest a little first" : holding ? "Keep holding…" : "Hold to return";
  const fraction = locked
    ? 1 - lockedLeft / Math.max(LOCK_MS, 1)
    : 1 - holdLeft / Math.max(HOLD_MS, 1);
  document.getElementById("return-progress-fill").style.width = (Math.max(0, Math.min(1, fraction)) * 100) + "%";
  document.getElementById("return-progress").setAttribute("aria-label", locked ? "Rest before returning" : "Hold progress");
}

function completeReturn() {
  if (finished) return;
  // The entry records the real minutes rested, never the promised length.
  const actualMin = Math.min(durationMin,
    Math.max(1, Math.round((totalMs - (breakEnd - Date.now())) / 60000)));
  returnBtn.textContent = "Saving…";
  finishBreak("early", actualMin);
}

function startHold() {
  if (finished || backdoorLocked()) return;
  if (holding) return;
  holding = true;
  holdLast = Date.now();
  returnBtn.classList.add("holding");
  holdTimer = setInterval(() => {
    const t = Date.now();
    holdLeft = Math.max(0, holdLeft - (t - holdLast));
    holdLast = t;
    paintBackdoor();
    if (holdLeft <= 0) completeReturn();
  }, 100);
}

function stopHold() {
  if (!holding) return;
  holding = false;                        // progress is kept, not reset
  returnBtn.classList.remove("holding");
  if (holdTimer) clearInterval(holdTimer);
  paintBackdoor();
}

returnBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); startHold(); });
returnBtn.addEventListener("pointerup", stopHold);
returnBtn.addEventListener("pointercancel", stopHold);
returnBtn.addEventListener("pointerleave", stopHold);

// ---- the end of a break: log it and move on without a star award ----
// Both endings come through here: 00:00 ("done", the whole length) and the back
// door ("early", the real minutes). The guard means nothing below runs twice.
async function finishBreak(kind, minutes) {
  if (finished) return;
  finished = true;
  const early = kind === "early";
  holding = false;
  if (holdTimer) clearInterval(holdTimer);
  returnBtn.disabled = true;
  document.body.classList.add("finished");
  stageEl.inert = true;                            // no taps or tabbing into the page beneath the star
  await settleUrgeWave();
  // One tab logs the break; every other tab on this same
  // break (or a reload after 00:00) just moves on.
  let first = true;
  try {
    const r = await chrome.runtime.sendMessage({ type: "claimBreakEnd", groupId, end: breakEnd });
    if (r && r.first === false) first = false;
  } catch (e) {}
  if (!first) { moveOn(); return; }
  if (early && !solo) {                            // the group's break state ends now, not at breakEnd
    try { await chrome.runtime.sendMessage({ type: "endBreakEarly", groupId }); } catch (e) {}
  }
  const acts = Array.from(selected.values());
  const log = await loadBreakLog();
  log.unshift({
    id: genId("b"),
    ts: Date.now(),
    durationMin: minutes,
    activities: acts,
    ...(ratingValue !== null ? { rating: ratingValue, group: groupId } : {})
  });
  await saveBreakLog(log);
  await clearActiveUrge();
  moveOn();
}

const stageEl = document.getElementById("stage");
let movedOn = false;

// Where the sky returns: a standalone break just closes; otherwise the cycle
// restarts on the reflection screen when Magic stars is on (its window then
// leads to commit), or the plain hold-to-pause page when it is off.
function moveOn() {
  if (movedOn) return;
  movedOn = true;
  if (solo) { closeThisTab(); return; }            // a standalone break ends quietly, nothing to unlock
  const page = (settings?.magicStars !== false) ? "reflect.html" : "pause.html";
  location.replace(chrome.runtime.getURL(page) +
    "?url=" + encodeURIComponent(targetUrl) +
    "&group=" + encodeURIComponent(groupId));
}

customAdd.addEventListener("click", onCustomAdd);
customName.addEventListener("keydown", (e) => { if (e.key === "Enter") onCustomAdd(); });
customTag.addEventListener("keydown", (e) => { if (e.key === "Enter") onCustomAdd(); });

(async function init() {
  settings = await chrome.runtime.sendMessage({ type: "getSettings" });
  if (settings) {
    applyBackground(settings.background);
    messageEl.textContent = settings.breakMessage || "Take a break.";
  }
  reduceMotion = (await loadReduceMotion()) ||
    !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduceMotion) document.body.classList.add("reduce-motion");
  // The committed length comes from the URL; fall back to the max if absent.
  durationMin = Number.isFinite(minsParam) ? minsParam : 30;
  totalMs = durationMin * 60 * 1000;
  const gname = (settings && settings.groups ? (settings.groups.find((g) => g.id === groupId) || {}).name : "") || "";
  let gLabel = (!gname.trim() || gname.trim().toLowerCase() === "default") ? "this group" : gname.trim();
  if (groupId.startsWith("binge:")) gLabel = groupId.slice("binge:".length);   // a caught site: name the site
  if (solo) ratingEl.style.display = "none";   // nothing was unlocked, so there is nothing to rate
  else bindRating(gLabel);
  initUrgeWave();
  paintSleepCard();
  // Keep exact time totals in history, not on the break screen.
  activities = await ensureSeededActivities();
  updateHint();
  await recolourBoard();

  if (!breakEnd || isNaN(breakEnd)) {       // no end to wait for: the break is over as soon as it opens
    timeLeftEl.textContent = "00:00";
    progressFillEl.style.width = "100%";
    finishBreak("done", durationMin);
    return;
  }
  // The back door rides every break when Options allows it; its lock and
  // hold lengths come from Options too.
  if (settings && Number.isFinite(settings.backdoorHoldSec)) {
    HOLD_MS = settings.backdoorHoldSec * 1000;
    holdLeft = HOLD_MS;
  }
  if (settings && Number.isFinite(settings.backdoorLockMin)) {
    LOCK_MS = settings.backdoorLockMin * 60 * 1000;
  }
  if (settings?.breakBackdoor !== false && Date.now() < breakEnd) {
    returnBtn.classList.remove("hidden");
    document.getElementById("return-progress").classList.remove("hidden");
    paintBackdoor();
  }
  tick();
})();
