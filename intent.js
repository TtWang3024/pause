// Before a site opens: what set this off, and what you hope to get. Both answered,
// the session starts at once (the Settings length); no timer to set, no break yet.
const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const groupId = params.get("group") || "";

const triggerEl = document.getElementById("trigger");
const hopeEl = document.getElementById("hope");
const openBtn = document.getElementById("open-btn");
const hintEl = document.getElementById("hint");
let leaving = false;

function ready() {
  return !!(triggerEl.value.trim() && hopeEl.value.trim());
}
function paint() {
  openBtn.disabled = !ready() || leaving;
}

async function open() {
  if (!targetUrl || !ready() || leaving) return;
  leaving = true;
  paint();
  hintEl.textContent = "Opening…";
  try {
    await chrome.runtime.sendMessage({ type: "startSession", groupId, url: targetUrl, trigger: triggerEl.value.trim(), hope: hopeEl.value.trim() });
  } catch (e) {}
  location.replace(targetUrl);
}

[triggerEl, hopeEl].forEach((el) => {
  el.addEventListener("input", paint);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {        // Enter moves on; Shift+Enter makes a new line
      e.preventDefault();
      if (el === triggerEl) hopeEl.focus(); else open();
    }
  });
});
openBtn.addEventListener("click", open);

(async function init() {
  document.getElementById("site").textContent = siteName(targetUrl);
  document.getElementById("target").textContent = targetUrl ? siteName(targetUrl) : "";
  if (!targetUrl) hintEl.textContent = "No target URL. Open settings from the extensions menu.";
  let settings = null;
  try { settings = await chrome.runtime.sendMessage({ type: "getSettings" }); } catch (e) {}
  if (settings) applyBackground(settings.background);
  triggerEl.focus();
  paint();
})();
