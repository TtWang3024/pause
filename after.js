// When the session's time is up: did it give you what you hoped for, and what
// now. A break goes to the break screen (its length is picked there), "what
// matters" closes the tab, "again" returns to the sky for a fresh start.
const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const groupId = params.get("group") || "";

const checkEl = document.getElementById("check");
const nextEl = document.getElementById("next");
const noteEl = document.getElementById("next-note");
let check = null;
let leaving = false;
let settings = null;

function paintNext() {
  nextEl.querySelectorAll(".choice").forEach((b) => { b.disabled = !check || leaving; });
  noteEl.textContent = check ? "" : "Answer the question above first.";
}

checkEl.addEventListener("click", (e) => {
  const b = e.target.closest(".choice");
  if (!b || leaving) return;
  check = b.dataset.v;
  checkEl.querySelectorAll(".choice").forEach((x) => x.classList.toggle("on", x === b));
  paintNext();
});

function closeThisTab() {
  try {
    chrome.tabs.getCurrent((tab) => {
      if (tab && tab.id != null) chrome.tabs.remove(tab.id);
      else location.replace("about:blank");
    });
  } catch (e) { location.replace("about:blank"); }
}

nextEl.addEventListener("click", async (e) => {
  const b = e.target.closest(".choice");
  if (!b || !check || leaving) return;
  leaving = true;
  paintNext();
  const next = b.dataset.v;
  try { await chrome.runtime.sendMessage({ type: "sessionEnd", groupId, check, next }); } catch (e) {}
  if (next === "break") {
    location.replace(chrome.runtime.getURL("break.html") + "?url=" + encodeURIComponent(targetUrl || "") +
      "&group=" + encodeURIComponent(groupId) + "&pick=1");
  } else if (next === "matters") {
    closeThisTab();
  } else {
    const page = (settings && settings.magicStars === false) ? "pause.html" : "reflect.html";
    location.replace(chrome.runtime.getURL(page) + "?url=" + encodeURIComponent(targetUrl || "") + "&group=" + encodeURIComponent(groupId));
  }
});

(async function init() {
  document.getElementById("site").textContent = siteName(targetUrl);
  document.getElementById("target").textContent = targetUrl ? siteName(targetUrl) : "";
  try { settings = await chrome.runtime.sendMessage({ type: "getSettings" }); } catch (e) {}
  if (settings) applyBackground(settings.background);
  let info = null;
  try { info = await chrome.runtime.sendMessage({ type: "sessionAfter", groupId }); } catch (e) {}
  const s = info && info.session;
  const echo = document.getElementById("hope-echo");
  if (s && s.hope) {
    echo.textContent = "You hoped for: " + s.hope + (s.mid ? "  ·  halfway you said: " + s.mid : "");
  } else {
    echo.textContent = "";
  }
  paintNext();
})();
