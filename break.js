const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const breakEnd = parseInt(params.get("end"), 10);
const groupId = params.get("group") || "";
const minsParam = parseInt(params.get("mins"), 10);

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
  bindRating(gLabel);
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
