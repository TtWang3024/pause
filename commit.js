const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const groupId = params.get("group") || "";

const stageEl = document.getElementById("stage");
const sessionEl = document.getElementById("session");
const minsEl = document.getElementById("mins");
const trackEl = document.getElementById("track");
const fillEl = document.getElementById("fill");
const handleEl = document.getElementById("handle");
const ticksEl = document.getElementById("ticks");
const scaleEl = document.getElementById("scale");
const continueBtn = document.getElementById("continue-btn");
const hintEl = document.getElementById("hint");
const targetEl = document.getElementById("target");

// Break length: discrete levels. Drag and scroll snap to these; typing / arrow
// keys stay free (any 1 to 30) for precision.
const LEVELS = [1, 3, 5, 10, 15, 20, 25, 30];
const MIN = LEVELS[0];
const MAX = LEVELS[LEVELS.length - 1];
const STEP_PX = 100;    // pixels of accumulated scroll per level step (lower = more sensitive)
const SCROLL_GAP = 400; // ms; a pause this long drops leftover scroll distance
let value = MAX;
let wheelAccum = 0;
let lastWheelAt = -100000;
let lastWheelDir = 0;
let dragging = false;

// Session (allowance) length: typed only, defaults to the settings allowance.
const SESSION_MIN = 3;
const SESSION_MAX = 25;
let sessionValue = SESSION_MAX;

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

function nearestLevel(v) {
  let best = LEVELS[0];
  for (const L of LEVELS) if (Math.abs(L - v) < Math.abs(best - v)) best = L;
  return best;
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

// Scroll moves to the next / previous discrete level.
function scrollStep(dir) {
  if (dir > 0) {
    const next = LEVELS.find((L) => L > value);
    setValue(next != null ? next : MAX);
  } else {
    const below = [...LEVELS].reverse().find((L) => L < value);
    setValue(below != null ? below : MIN);
  }
}

function buildScale() {
  for (const L of LEVELS) {
    const pct = (L / MAX) * 100;
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = pct + "%";
    ticksEl.appendChild(tick);
    if (L !== MIN) { // skip the 1-min label — it sits at the very edge
      const label = document.createElement("span");
      label.className = "scale-label";
      label.style.left = pct + "%";
      label.textContent = String(L);
      scaleEl.appendChild(label);
    }
  }
}

// Drag snaps to the nearest level.
function valueFromClientX(clientX) {
  const rect = trackEl.getBoundingClientRect();
  let frac = (clientX - rect.left) / rect.width;
  frac = Math.max(0, Math.min(1, frac));
  return nearestLevel(clamp(frac * MAX));
}

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

// Proportional scroll anywhere on the screen — momentum welcome: a fast flick
// dumps a large total distance and sweeps the range, while a slow scroll moves
// proportional to how far you drag. Each STEP_PX of distance = one level step.
stageEl.addEventListener("wheel", (e) => {
  e.preventDefault();
  const now = e.timeStamp;
  const horizontal = Math.abs(e.deltaX) >= Math.abs(e.deltaY);
  // Scroll left/down → shorter, scroll right/up → longer.
  const delta = horizontal ? -e.deltaX : e.deltaY;
  const dir = delta > 0 ? 1 : (delta < 0 ? -1 : 0);

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

// --- Session length (typed only) ---
function clampSession(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return sessionValue;
  return Math.max(SESSION_MIN, Math.min(SESSION_MAX, n));
}
function setSession(n) {
  sessionValue = clampSession(n);
  sessionEl.value = String(sessionValue);
}
sessionEl.addEventListener("input", () => {
  const digits = sessionEl.value.replace(/\D/g, "").slice(0, 2);
  if (sessionEl.value !== digits) sessionEl.value = digits;
  const n = parseInt(digits, 10);
  if (Number.isFinite(n)) sessionValue = n; // clamp on blur, not mid-type
});
sessionEl.addEventListener("blur", () => setSession(parseInt(sessionEl.value, 10)));
sessionEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); sessionEl.blur(); proceed(); }
});

continueBtn.addEventListener("click", proceed);
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && document.activeElement !== minsEl && document.activeElement !== sessionEl) proceed();
});

async function proceed() {
  if (!targetUrl) return;
  setValue(parseInt(minsEl.value, 10));
  setSession(parseInt(sessionEl.value, 10));
  // The hold-to-countdown already happened — commit is the last step, so unlock now
  // with the committed break length + session (shared across the whole group).
  try {
    await chrome.runtime.sendMessage({
      type: "grantAllowance", groupId, breakMinutes: value, allowanceMinutes: sessionValue
    });
  } catch (e) {}
  location.replace(targetUrl);
}

// Mirror the user's own past ratings for this group back as one faint line. Needs >= 3
// rated visits in the last 14 days; stays silent when the signal is mixed. Never gates.
async function showRatingEcho(settings) {
  const echoEl = document.getElementById("rating-echo");
  if (!echoEl || !groupId) return;
  let log = [];
  try { log = await loadBreakLog(); } catch (e) { return; }
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const rated = log.filter((e) => e && e.group === groupId && typeof e.rating === "number" && e.ts >= cutoff);
  if (rated.length < 3) return;
  const mean = rated.reduce((s, e) => s + e.rating, 0) / rated.length;
  if (mean > -0.34 && mean < 0.34) return;   // mixed signal → stay silent
  const gnameRaw = (settings && settings.groups ? (settings.groups.find((g) => g.id === groupId) || {}).name : "") || "";
  const gname = gnameRaw.trim();
  const gLabel = (!gname || gname.toLowerCase() === "default") ? "this group" : gname;
  echoEl.textContent = mean <= -0.34
    ? `Lately, ${gLabel} mostly hasn't given you what you came for.`
    : `Lately, ${gLabel} has been landing.`;
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
  setValue(MAX); // break always opens at the maximum — no setting, no memory
  setSession(settings?.allowanceMinutes ?? SESSION_MAX); // session defaults to the settings allowance
  showRatingEcho(settings);
})();
