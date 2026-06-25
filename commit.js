const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const groupId = params.get("group") || "";

const stageEl = document.getElementById("stage");
const minsEl = document.getElementById("mins");
const trackEl = document.getElementById("track");
const fillEl = document.getElementById("fill");
const handleEl = document.getElementById("handle");
const ticksEl = document.getElementById("ticks");
const scaleEl = document.getElementById("scale");
const continueBtn = document.getElementById("continue-btn");
const hintEl = document.getElementById("hint");
const targetEl = document.getElementById("target");

const MIN = 1;
const MAX = 30;
const SCROLL_INTERVAL = 5; // scroll snaps to 5-minute marks
const STEP_PX = 100;       // pixels of accumulated scroll per 5-min interval (lower = more sensitive)
const SCROLL_GAP = 400;    // ms; a pause this long drops leftover scroll distance
let value = MAX;
let wheelAccum = 0;
let lastWheelAt = -100000;
let lastWheelDir = 0;
let dragging = false;

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

function clamp(n) {
  n = Math.round(n);
  if (!Number.isFinite(n)) return value;
  return Math.max(MIN, Math.min(MAX, n));
}

// Bar length is proportional to minutes (full track = MAX).
function paint() {
  const pct = (value / MAX) * 100;
  fillEl.style.width = pct + "%";
  handleEl.style.left = pct + "%";
}

function render() {
  paint();
  // Safe to always sync: live typing goes through the "input" handler, which
  // never calls render(), so this won't fight the user mid-type.
  minsEl.value = String(value);
}

function setValue(n) {
  value = clamp(n);
  render();
}

function nudge(delta) {
  const cur = parseInt(minsEl.value, 10);
  setValue((Number.isFinite(cur) ? cur : value) + delta);
}

// Scroll jumps to the next / previous 5-minute mark (drag and type stay 1-min).
function scrollStep(dir) {
  const cur = parseInt(minsEl.value, 10);
  const v = Number.isFinite(cur) ? cur : value;
  const next = dir > 0
    ? Math.floor(v / SCROLL_INTERVAL) * SCROLL_INTERVAL + SCROLL_INTERVAL
    : Math.ceil(v / SCROLL_INTERVAL) * SCROLL_INTERVAL - SCROLL_INTERVAL;
  setValue(next);
}

function buildScale() {
  for (let m = 5; m <= MAX; m += 5) {
    const pct = (m / MAX) * 100;
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = pct + "%";
    ticksEl.appendChild(tick);

    const label = document.createElement("span");
    label.className = "scale-label";
    label.style.left = pct + "%";
    label.textContent = String(m);
    scaleEl.appendChild(label);
  }
}

function valueFromClientX(clientX) {
  const rect = trackEl.getBoundingClientRect();
  let frac = (clientX - rect.left) / rect.width;
  frac = Math.max(0, Math.min(1, frac));
  return clamp(frac * MAX);
}

// Drag anywhere on the track to set the length.
trackEl.addEventListener("pointerdown", (e) => {
  dragging = true;
  try { trackEl.setPointerCapture(e.pointerId); } catch {}
  setValue(valueFromClientX(e.clientX));
});
trackEl.addEventListener("pointermove", (e) => {
  if (dragging) setValue(valueFromClientX(e.clientX));
});
trackEl.addEventListener("pointerup", (e) => {
  dragging = false;
  try { trackEl.releasePointerCapture(e.pointerId); } catch {}
});
trackEl.addEventListener("pointercancel", () => { dragging = false; });

// Dampened scroll anywhere on the screen: right = longer, left = shorter
// (vertical wheel falls back, up = longer).
stageEl.addEventListener("wheel", (e) => {
  e.preventDefault();
  const now = e.timeStamp;
  const horizontal = Math.abs(e.deltaX) >= Math.abs(e.deltaY);
  // Scroll left/down → shorter, scroll right/up → longer.
  const delta = horizontal ? -e.deltaX : e.deltaY;
  const dir = delta > 0 ? 1 : (delta < 0 ? -1 : 0);

  // Drop leftover distance after a real pause or a direction reversal so it
  // doesn't bleed across gestures. Otherwise just accumulate — momentum is the
  // feature: a fast flick dumps a large total distance and sweeps to the end,
  // while a slow scroll moves proportional to how far you drag.
  if (now - lastWheelAt > SCROLL_GAP || (dir !== 0 && dir !== lastWheelDir)) wheelAccum = 0;
  lastWheelAt = now;
  if (dir !== 0) lastWheelDir = dir;

  wheelAccum += delta;
  while (wheelAccum >= STEP_PX) { scrollStep(1); wheelAccum -= STEP_PX; }
  while (wheelAccum <= -STEP_PX) { scrollStep(-1); wheelAccum += STEP_PX; }
}, { passive: false });

minsEl.addEventListener("input", () => {
  const digits = minsEl.value.replace(/\D/g, "").slice(0, 2);
  if (minsEl.value !== digits) minsEl.value = digits;
  const n = parseInt(digits, 10);
  if (Number.isFinite(n)) { value = clamp(n); paint(); }
});
minsEl.addEventListener("blur", () => setValue(value));
minsEl.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") { e.preventDefault(); nudge(1); }
  else if (e.key === "ArrowDown") { e.preventDefault(); nudge(-1); }
  else if (e.key === "Enter") { e.preventDefault(); proceed(); }
});

continueBtn.addEventListener("click", proceed);
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && document.activeElement !== minsEl) proceed();
});

function proceed() {
  if (!targetUrl) return;
  setValue(parseInt(minsEl.value, 10));
  const url = chrome.runtime.getURL("pause.html") +
    "?url=" + encodeURIComponent(targetUrl) +
    "&group=" + encodeURIComponent(groupId) +
    "&break=" + value;
  location.replace(url);
}

(async function init() {
  buildScale();
  if (!targetUrl) {
    hintEl.textContent = "No target URL. Open settings from the extensions menu.";
    continueBtn.disabled = true;
  } else {
    try { targetEl.textContent = new URL(targetUrl).hostname; } catch {}
  }

  let settings = null;
  try {
    settings = await chrome.runtime.sendMessage({ type: "getSettings" });
  } catch (e) {}
  if (settings) applyBackground(settings.background);
  setValue(MAX); // always opens at the maximum — no setting, no memory
})();
