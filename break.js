const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const breakEnd = parseInt(params.get("end"), 10);

const messageEl = document.getElementById("message");
const cornerEl = document.getElementById("corner-timer");

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

function tick() {
  const remaining = breakEnd - Date.now();
  cornerEl.textContent = format(remaining);
  if (remaining <= 0) {
    onComplete();
    return;
  }
  setTimeout(tick, 250);
}

function onComplete() {
  cornerEl.textContent = "00:00";
  // Send back through the pause page (cycle restarts).
  if (targetUrl) {
    location.replace(
      chrome.runtime.getURL("pause.html") +
        "?url=" + encodeURIComponent(targetUrl) +
        "&group=__break_return__"
    );
  }
}

(async function init() {
  const settings = await chrome.runtime.sendMessage({ type: "getSettings" });
  if (settings) {
    applyBackground(settings.background);
    messageEl.textContent = settings.breakMessage || "Take a break.";
  }
  if (!breakEnd || isNaN(breakEnd)) {
    cornerEl.textContent = "—";
    return;
  }
  tick();
})();
