const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const breakEnd = parseInt(params.get("end"), 10);
const groupId = params.get("group") || "";

const messageEl = document.getElementById("message");
const cornerEl = document.getElementById("corner-timer");
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
let hintTimer = null;

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
    empty.textContent = "No saved activities yet — add one below.";
    listEl.appendChild(empty);
    return;
  }
  for (const a of activities) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "activity-chip" + (selected.has(a.id) ? " selected" : "");
    const name = document.createElement("span");
    name.className = "chip-name";
    name.textContent = a.name;
    chip.appendChild(name);
    if (a.tag) {
      const tag = document.createElement("span");
      tag.className = "chip-tag";
      tag.textContent = "#" + a.tag;
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
      flashHint(`That's ${MAX_PICK} already — tap one to deselect first`);
      return;
    }
    selected.set(a.id, { id: a.id, name: a.name, tag: a.tag || "" });
  }
  updateHint();
  renderChips();
}

async function onCustomAdd() {
  const name = customName.value.trim();
  if (!name) { customName.focus(); return; }
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

function tick() {
  const remaining = breakEnd - Date.now();
  cornerEl.textContent = format(remaining);
  if (remaining <= 0) {
    cornerEl.textContent = "00:00";
    unlock();
    return;
  }
  doneBtn.textContent = "Wait " + format(remaining);
  setTimeout(tick, 250);
}

function unlock() {
  unlocked = true;
  doneBtn.disabled = false;
  doneBtn.classList.add("ready");
  doneBtn.textContent = "I'm done →";
}

async function onDone() {
  if (!unlocked) return;
  doneBtn.disabled = true;
  doneBtn.textContent = "Saving…";
  const log = await loadBreakLog();
  log.unshift({
    id: genId("b"),
    ts: Date.now(),
    durationMin,
    activities: Array.from(selected.values())
  });
  await saveBreakLog(log);
  const pauseUrl = chrome.runtime.getURL("pause.html") +
    "?url=" + encodeURIComponent(targetUrl) +
    "&group=" + encodeURIComponent(groupId);
  location.replace(pauseUrl);
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
    durationMin = settings.breakMinutes || 0;
  }
  activities = await loadBreakActivities();
  updateHint();
  renderChips();

  if (!breakEnd || isNaN(breakEnd)) {
    cornerEl.textContent = "—";
    unlock();
    return;
  }
  tick();
})();
