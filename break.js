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
const pickHintEl = document.getElementById("pick-hint");
const doneBtn = document.getElementById("done-btn");
const customName = document.getElementById("custom-name");
const customTag = document.getElementById("custom-tag");
const customAdd = document.getElementById("custom-add");

const MAX_PICK = 3;
let settings = null;
let activities = [];
const selected = new Map(); // id -> { id, name, tag }
let unlocked = false;
let durationMin = 0;
let totalMs = 0;
let hintTimer = null;
let ratingValue = null;   // -1 / 0 / +1 once tapped; stays null if skipped

function applyBackground(bg) {
  if (!bg) return;
  if (bg.type === "preset") {
    if (bg.value === "white") document.body.classList.add("theme-white");
    else document.body.classList.remove("theme-white");
  } else if (bg.type === "custom" && bg.value) {
    document.body.style.background = bg.value;
    document.body.style.color = isLightColor(bg.value) ? "#000" : "#fff";
  }
}

function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff, g = (v >> 8) & 0xff, b = v & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}

function format(ms) {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function updateHint() {
  pickHintEl.textContent = `Pick up to ${MAX_PICK} things to do  (${selected.size}/${MAX_PICK})`;
}

function flashHint(msg) {
  pickHintEl.textContent = msg;
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(updateHint, 1600);
}

function renderChips() {
  listEl.innerHTML = "";
  if (!activities.length) {
    const empty = document.createElement("p");
    empty.className = "list-empty";
    empty.textContent = "No saved activities yet. Add one below.";
    listEl.appendChild(empty);
    return;
  }
  for (const a of activities) {
    const c = tagColor(a.tag);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "activity-chip" + (selected.has(a.id) ? " selected" : "");
    chip.style.borderLeftColor = c.border;

    const check = document.createElement("span");
    check.className = "chip-check";
    check.textContent = selected.has(a.id) ? "✓" : "";
    chip.appendChild(check);

    const name = document.createElement("span");
    name.className = "chip-name";
    name.textContent = a.name;
    chip.appendChild(name);

    if (a.tag) {
      const tag = document.createElement("span");
      tag.className = "chip-tag";
      tag.textContent = "#" + a.tag;
      tag.style.background = c.bg;
      tag.style.borderColor = c.border;
      chip.appendChild(tag);
    }
    chip.addEventListener("click", () => toggleSelect(a));
    listEl.appendChild(chip);
  }
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
  renderChips();
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

// ---- the urge wave rides through the break: same reflection entry, same curve ----
const uwEl = document.getElementById("urge-wave");
const uwGrid = document.getElementById("uw-grid");
const uwNow = document.getElementById("uw-now");
const uwPath = document.getElementById("uw-path");
const uwDots = document.getElementById("uw-dots");
const UW_COLORS = { 10: "#123a66", 8: "#1d4f86", 6: "#2f6cb8", 4: "#5b96f5", 2: "#9cc7ee", 0: "#c7dff5" };
const UW_X0 = 10, UW_X1 = 392, UW_Y0 = 130, UW_YSPAN = 118;
const UW_MIN_SPAN = 60000;
let urgeEntry = null;       // the reflection entry whose wave this break extends
let uwSaving = false;

function uwY(v) { return UW_Y0 - (v / 10) * UW_YSPAN; }
function uwX(ts, now) {
  const pts = urgeEntry.wave;
  const t0 = pts.length ? pts[0].ts : urgeEntry.ts;
  const span = Math.max(UW_MIN_SPAN, now - t0);
  return UW_X0 + Math.min(1, (ts - t0) / span) * (UW_X1 - UW_X0);
}
function uwRender() {
  if (!urgeEntry) return;
  const pts = urgeEntry.wave;
  const now = Date.now();
  uwDots.innerHTML = "";
  for (const p of pts) {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", uwX(p.ts, now).toFixed(1));
    c.setAttribute("cy", uwY(p.v).toFixed(1));
    c.setAttribute("r", "3.5");
    c.setAttribute("fill", UW_COLORS[p.v] || "#5b96f5");
    uwDots.appendChild(c);
  }
  const nx = uwX(now, now).toFixed(1);
  uwNow.setAttribute("x1", nx); uwNow.setAttribute("x2", nx);
  if (pts.length < 2) { uwPath.setAttribute("d", ""); return; }
  const P = pts.map((p) => [uwX(p.ts, now), uwY(p.v)]);
  let d = "M" + P[0][0].toFixed(1) + "," + P[0][1].toFixed(1);
  for (let i = 0; i < P.length - 1; i++) {   // catmull-rom → cubic bezier, kink-free
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    d += "C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + "," + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) +
         " " + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + "," + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) +
         " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
  }
  uwPath.setAttribute("d", d);
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
      log[i] = urgeEntry;
      await saveReflectionLog(log);
    } catch (e) { break; }
  }
  uwSaving = false;
}
async function initUrgeWave() {
  try {
    const { activeUrge } = await chrome.storage.local.get("activeUrge");
    if (!activeUrge || activeUrge.group !== groupId) return;
    if (Date.now() - activeUrge.ts > 6 * 60 * 60 * 1000) return;   // a stale session, leave it be
    const log = await loadReflectionLog();
    const entry = log.find((r) => r.id === activeUrge.refId);
    if (!entry) return;
    if (!Array.isArray(entry.wave)) entry.wave = [];
    urgeEntry = entry;
  } catch (e) { return; }
  [0, 2, 4, 6, 8, 10].forEach((v) => {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", UW_X0); l.setAttribute("x2", UW_X1);
    l.setAttribute("y1", uwY(v)); l.setAttribute("y2", uwY(v));
    l.setAttribute("class", "uw-grid-line");
    uwGrid.appendChild(l);
  });
  uwEl.classList.remove("hidden");
  document.querySelectorAll(".uw-lvl").forEach((b) => {
    b.addEventListener("click", () => {
      urgeEntry.wave.push({ ts: Date.now(), v: parseInt(b.dataset.v, 10) });
      uwRender();
      uwPersist();
    });
  });
  uwRender();
  setInterval(() => { if (urgeEntry && urgeEntry.wave.length) uwRender(); }, 1000);
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
  const remaining = breakEnd - Date.now();
  timeLeftEl.textContent = format(remaining);
  if (totalMs > 0) {
    const frac = Math.max(0, Math.min(1, (totalMs - remaining) / totalMs));
    progressFillEl.style.width = (frac * 100).toFixed(1) + "%";
  }
  if (remaining <= 0) {
    timeLeftEl.textContent = "00:00";
    progressFillEl.style.width = "100%";
    unlock();
    return;
  }
  if (!holding) paintBackdoor();   // the hold interval paints while held
  setTimeout(tick, 250);
}

function unlock() {
  unlocked = true;
  doneBtn.disabled = false;
  doneBtn.classList.add("ready");
  doneBtn.textContent = "I'm done →";
  returnBtn.classList.add("hidden");     // the break finished by itself
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
let returned = false;

function backdoorLocked() {
  return (breakEnd - totalMs) + LOCK_MS - Date.now() > 0;
}

function paintBackdoor() {
  if (returned || returnBtn.classList.contains("hidden")) return;
  const lockedLeft = (breakEnd - totalMs) + LOCK_MS - Date.now();
  if (lockedLeft > 0) {
    returnBtn.classList.add("locked");
    returnBtn.textContent = "I choose to return (in " + format(lockedLeft) + ")";
    return;
  }
  returnBtn.classList.remove("locked");
  const secs = Math.max(1, Math.ceil(holdLeft / 1000));
  returnBtn.textContent =
    holding ? "Keep holding… " + secs :
    holdLeft < HOLD_MS ? "I choose to return · " + secs + "s left" :
    "I choose to return";
}

async function completeReturn() {
  if (returned) return;
  returned = true;
  holding = false;
  if (holdTimer) clearInterval(holdTimer);
  returnBtn.disabled = true;
  returnBtn.textContent = "Saving…";
  // The entry records the real minutes rested, never the promised length.
  const actualMin = Math.min(durationMin,
    Math.max(1, Math.round((totalMs - (breakEnd - Date.now())) / 60000)));
  const log = await loadBreakLog();
  log.unshift({
    id: genId("b"),
    ts: Date.now(),
    durationMin: actualMin,
    activities: Array.from(selected.values()),
    ...(ratingValue !== null ? { rating: ratingValue, group: groupId } : {})
  });
  await saveBreakLog(log);
  await clearActiveUrge();
  if (solo) { closeThisTab(); return; }      // a standalone break ends quietly, nothing to unlock
  await chrome.runtime.sendMessage({ type: "endBreakEarly", groupId });
  const entry = (settings?.magicStars !== false) ? "reflect.html" : "pause.html";
  location.replace(chrome.runtime.getURL(entry) +
    "?url=" + encodeURIComponent(targetUrl) +
    "&group=" + encodeURIComponent(groupId));
}

function startHold() {
  if (returned || unlocked || backdoorLocked()) return;
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

async function onDone() {
  if (!unlocked) return;
  doneBtn.disabled = true;
  doneBtn.textContent = "Saving…";
  const log = await loadBreakLog();
  log.unshift({
    id: genId("b"),
    ts: Date.now(),
    durationMin,
    activities: Array.from(selected.values()),
    ...(ratingValue !== null ? { rating: ratingValue, group: groupId } : {})
  });
  await saveBreakLog(log);
  await clearActiveUrge();
  if (solo) { closeThisTab(); return; }      // a standalone break ends quietly, nothing to unlock
  // Restart the cycle: re-enter via the reflection screen when Magic Stars is on
  // (its countdown then leads to commit), otherwise the plain hold-to-pause page.
  const entry = (settings?.magicStars !== false) ? "reflect.html" : "pause.html";
  const nextUrl = chrome.runtime.getURL(entry) +
    "?url=" + encodeURIComponent(targetUrl) +
    "&group=" + encodeURIComponent(groupId);
  location.replace(nextUrl);
}

doneBtn.addEventListener("click", onDone);
customAdd.addEventListener("click", onCustomAdd);
customName.addEventListener("keydown", (e) => { if (e.key === "Enter") onCustomAdd(); });
customTag.addEventListener("keydown", (e) => { if (e.key === "Enter") onCustomAdd(); });

(async function init() {
  settings = await chrome.runtime.sendMessage({ type: "getSettings" });
  if (settings) {
    applyBackground(settings.background);
    messageEl.textContent = settings.breakMessage || "Take a break.";
  }
  // The committed length comes from the URL; fall back to the max if absent.
  durationMin = Number.isFinite(minsParam) ? minsParam : 30;
  totalMs = durationMin * 60 * 1000;
  breakLenEl.textContent = durationMin > 0 ? `${durationMin}-minute break` : "break";
  const gname = (settings && settings.groups ? (settings.groups.find((g) => g.id === groupId) || {}).name : "") || "";
  const gLabel = (!gname.trim() || gname.trim().toLowerCase() === "default") ? "this group" : gname.trim();
  if (solo) ratingEl.style.display = "none";   // nothing was unlocked, so there is nothing to rate
  else bindRating(gLabel);
  initUrgeWave();
  activities = await ensureSeededActivities();
  updateHint();
  renderChips();

  if (!breakEnd || isNaN(breakEnd)) {
    timeLeftEl.textContent = "00:00";
    progressFillEl.style.width = "100%";
    unlock();
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
    paintBackdoor();
  }
  tick();
})();
