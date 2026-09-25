const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const groupId = params.get("group");

const timerEl = document.getElementById("timer");
const hintEl = document.getElementById("hint");
const targetEl = document.getElementById("target");

let totalMs = 10000;
let remainingMs = totalMs;
let holding = false;
let lastTick = 0;
let rafId = null;
let resetOnRelease = false;

function applyBackground(bg) {
  if (!bg) return;
  if (bg.type === "preset") {
    if (bg.value === "white") {
      document.body.classList.add("theme-white");
    } else {
      document.body.classList.remove("theme-white");
    }
  } else if (bg.type === "custom" && bg.value) {
    document.body.style.background = bg.value;
    const isLight = isLightColor(bg.value);
    document.body.style.color = isLight ? "#000" : "#fff";
  }
}

function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff, g = (v >> 8) & 0xff, b = v & 0xff;
  // Perceived luminance
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}

function renderTime() {
  timerEl.setAttribute("aria-label", remainingMs <= 0 ? "Pause complete" : "Pause in progress");
}

function tick(now) {
  if (!holding) { rafId = null; return; }
  const dt = now - lastTick;
  lastTick = now;
  remainingMs -= dt;
  renderTime();
  if (remainingMs <= 0) {
    holding = false;
    rafId = null;
    onComplete();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

function startHold() {
  if (holding || remainingMs <= 0) return;
  holding = true;
  timerEl.classList.add("holding", "gentle-wait");
  timerEl.classList.remove("idle");
  lastTick = performance.now();
  rafId = requestAnimationFrame(tick);
}

function stopHold() {
  if (!holding) return;
  holding = false;
  timerEl.classList.remove("holding", "gentle-wait");
  timerEl.classList.add("idle");
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (resetOnRelease) {
    remainingMs = totalMs;
    renderTime();
  }
}

async function onComplete() {
  // The hold is done. Two questions before it opens: what set this off, what you hope to get.
  hintEl.textContent = "Two quick questions…";
  location.replace(
    chrome.runtime.getURL("intent.html") +
    "?url=" + encodeURIComponent(targetUrl) +
    "&group=" + encodeURIComponent(groupId)
  );
}

// Only count left-button drags
window.addEventListener("mousedown", (e) => {
  if (e.button === 0) startHold();
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) stopHold();
});
window.addEventListener("mouseleave", stopHold);
window.addEventListener("blur", stopHold);
// Touch support
window.addEventListener("touchstart", startHold, { passive: true });
window.addEventListener("touchend", stopHold);
window.addEventListener("touchcancel", stopHold);
// Prevent context menu / drag oddities
window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("dragstart", (e) => e.preventDefault());

(async function init() {
  if (!targetUrl) {
    timerEl.textContent = "—";
    hintEl.textContent = "No target URL. Open settings from the extensions menu.";
    return;
  }
  try {
    targetEl.textContent = new URL(targetUrl).hostname;
  } catch {}

  const settings = await chrome.runtime.sendMessage({ type: "getSettings" });
  if (settings) {
    applyBackground(settings.background);
    resetOnRelease = !!settings.resetOnRelease;
    const group = settings.groups.find((g) => g.id === groupId);
    const secs = group?.pauseSeconds ?? 10;
    totalMs = secs * 1000;
    remainingMs = totalMs;
  }
  const { reflectReduceMotion } = await chrome.storage.sync.get("reflectReduceMotion");
  if (reflectReduceMotion) document.body.classList.add("reduce-motion");
  timerEl.classList.add("idle");
  renderTime();
})();
