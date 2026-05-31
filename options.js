const DEFAULT_SCHEDULE = { days: [0, 1, 2, 3, 4, 5, 6], startTime: null, endTime: null };

const DEFAULT_SETTINGS = {
  groups: [
    { id: "default", name: "Default", sites: [], pauseSeconds: 10, schedule: { ...DEFAULT_SCHEDULE } }
  ],
  background: { type: "preset", value: "black" },
  allowanceMinutes: 5,
  resetOnRelease: false,
  forceBreak: false,
  breakMinutes: 3,
  breakMessage: "Step away from the screen. Stretch. Breathe."
};

const groupsEl = document.getElementById("groups");
const addGroupBtn = document.getElementById("add-group");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");
const allowanceEl = document.getElementById("allowance");
const bgCustomEl = document.getElementById("bg-custom");
const resetOnReleaseEl = document.getElementById("reset-on-release");
const forceBreakEl = document.getElementById("force-break");
const breakMinutesEl = document.getElementById("break-minutes");
const breakMessageEl = document.getElementById("break-message");
const breakOptionsEl = document.getElementById("break-options");
const tpl = document.getElementById("group-template");

function uuid() {
  return "g_" + Math.random().toString(36).slice(2, 10);
}

function renderGroup(group) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = group.id;
  node.querySelector(".group-name").value = group.name || "";
  node.querySelector(".group-seconds").value = group.pauseSeconds ?? 10;
  node.querySelector(".group-sites").value = (group.sites || []).join("\n");
  node.querySelector(".delete-group").addEventListener("click", () => node.remove());

  const schedule = group.schedule || DEFAULT_SCHEDULE;
  const activeDays = new Set(schedule.days || DEFAULT_SCHEDULE.days);
  node.querySelectorAll(".day-btn").forEach((btn) => {
    const day = parseInt(btn.dataset.day, 10);
    if (activeDays.has(day)) btn.classList.add("on");
    btn.addEventListener("click", () => btn.classList.toggle("on"));
  });

  const startEl = node.querySelector(".time-start");
  const endEl = node.querySelector(".time-end");
  startEl.value = schedule.startTime || "";
  endEl.value = schedule.endTime || "";
  node.querySelector(".time-clear").addEventListener("click", () => {
    startEl.value = "";
    endEl.value = "";
  });

  groupsEl.appendChild(node);
}

function readGroups() {
  return Array.from(groupsEl.querySelectorAll(".group")).map((node) => {
    const sites = node.querySelector(".group-sites").value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const days = Array.from(node.querySelectorAll(".day-btn.on"))
      .map((btn) => parseInt(btn.dataset.day, 10))
      .sort((a, b) => a - b);
    const startTime = node.querySelector(".time-start").value || null;
    const endTime = node.querySelector(".time-end").value || null;
    return {
      id: node.dataset.id || uuid(),
      name: node.querySelector(".group-name").value.trim() || "Untitled",
      pauseSeconds: clampInt(node.querySelector(".group-seconds").value, 1, 600, 10),
      sites,
      schedule: {
        days: days.length ? days : [...DEFAULT_SCHEDULE.days],
        startTime: validTime(startTime) ? startTime : null,
        endTime: validTime(endTime) ? endTime : null
      }
    };
  });
}

function validTime(s) {
  return typeof s === "string" && /^\d{1,2}:\d{2}$/.test(s);
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readBackground() {
  const checked = document.querySelector('input[name="bg"]:checked')?.value || "black";
  if (checked === "custom") return { type: "custom", value: bgCustomEl.value };
  return { type: "preset", value: checked };
}

function applyBackgroundUI(bg) {
  const value = bg?.type === "custom" ? "custom" : (bg?.value || "black");
  const radio = document.querySelector(`input[name="bg"][value="${value}"]`);
  if (radio) radio.checked = true;
  if (bg?.type === "custom" && bg.value) bgCustomEl.value = bg.value;
}

function syncBreakVisibility() {
  breakOptionsEl.classList.toggle("hidden", !forceBreakEl.checked);
}

addGroupBtn.addEventListener("click", () => {
  renderGroup({ id: uuid(), name: "", pauseSeconds: 10, sites: [], schedule: { ...DEFAULT_SCHEDULE } });
});

forceBreakEl.addEventListener("change", syncBreakVisibility);

saveBtn.addEventListener("click", async () => {
  const settings = {
    groups: readGroups(),
    background: readBackground(),
    allowanceMinutes: clampInt(allowanceEl.value, 5, 25, 5),
    resetOnRelease: resetOnReleaseEl.checked,
    forceBreak: forceBreakEl.checked,
    breakMinutes: clampInt(breakMinutesEl.value, 1, 10, 3),
    breakMessage: breakMessageEl.value.trim() || DEFAULT_SETTINGS.breakMessage
  };
  await chrome.storage.sync.set({ settings });
  statusEl.textContent = "Saved.";
  setTimeout(() => (statusEl.textContent = ""), 1500);
});

(async function init() {
  const { settings } = await chrome.storage.sync.get("settings");
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  s.groups.forEach(renderGroup);
  applyBackgroundUI(s.background);
  allowanceEl.value = Math.min(25, Math.max(5, s.allowanceMinutes ?? 5));
  resetOnReleaseEl.checked = !!s.resetOnRelease;
  forceBreakEl.checked = !!s.forceBreak;
  breakMinutesEl.value = Math.min(10, Math.max(1, s.breakMinutes ?? 3));
  breakMessageEl.value = s.breakMessage ?? DEFAULT_SETTINGS.breakMessage;
  syncBreakVisibility();
})();
