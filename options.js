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

// ===== Break activities, stats, and history =====
// These save immediately (independent of the main Save button).
(function breaksModule() {
  const MAX_PICK = 3;
  const actListEl = document.getElementById("activities-list");
  const newName = document.getElementById("new-activity-name");
  const newTag = document.getElementById("new-activity-tag");
  const addActivityBtn = document.getElementById("add-activity");
  const favEl = document.getElementById("stats-favourites");
  const leastEl = document.getElementById("stats-least");
  const pieEl = document.getElementById("stats-pie");
  const breaksListEl = document.getElementById("breaks-list");
  const breaksCountEl = document.getElementById("breaks-count");

  let activities = [];
  let log = [];
  let editingId = null;        // activity being edited
  let editingBreakId = null;   // history entry being edited
  let dragIndex = null;

  function renderAll() {
    renderActivities();
    renderStats();
    renderBreaks();
  }

  // --- Activities list ---
  function renderActivities() {
    const { count, last } = deriveActivityStats(log);
    actListEl.innerHTML = "";

    activities.forEach((a, idx) => {
      const color = tagColor(a.tag);
      const row = document.createElement("div");
      row.className = "activity-row";
      row.style.borderLeftColor = color.border;

      if (editingId === a.id) {
        row.innerHTML = `
          <span class="drag-handle">⠿</span>
          <input class="edit-name" />
          <input class="edit-tag" placeholder="tag" />
          <button class="act-save">save</button>
          <button class="act-cancel">cancel</button>`;
        const nameInput = row.querySelector(".edit-name");
        const tagInput = row.querySelector(".edit-tag");
        nameInput.value = a.name;
        tagInput.value = a.tag || "";
        row.querySelector(".act-save").addEventListener("click", async () => {
          const nm = nameInput.value.trim();
          if (nm) a.name = nm;
          a.tag = tagInput.value.trim().replace(/^#/, "");
          editingId = null;
          await saveBreakActivities(activities);
          renderAll();
        });
        row.querySelector(".act-cancel").addEventListener("click", () => {
          editingId = null;
          renderActivities();
        });
      } else {
        row.draggable = true;
        row.innerHTML = `
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <span class="act-name"></span>
          <span class="act-count"></span>
          <span class="act-date"></span>
          <span class="act-tag"></span>
          <button class="act-edit">edit</button>
          <button class="act-delete" title="Delete">×</button>`;
        row.querySelector(".act-name").textContent = a.name;
        row.querySelector(".act-count").textContent = (count[a.id] || 0) + "×";
        row.querySelector(".act-date").textContent = last[a.id] ? formatShortDate(last[a.id]) : "—";
        const tagEl = row.querySelector(".act-tag");
        if (a.tag) {
          tagEl.textContent = "#" + a.tag;
          tagEl.style.background = color.bg;
          tagEl.style.borderColor = color.border;
        }
        row.querySelector(".act-edit").addEventListener("click", () => {
          editingId = a.id;
          renderActivities();
        });
        row.querySelector(".act-delete").addEventListener("click", async () => {
          activities = activities.filter((x) => x.id !== a.id);
          await saveBreakActivities(activities);
          renderAll();
        });
        row.addEventListener("dragstart", () => { dragIndex = idx; row.classList.add("dragging"); });
        row.addEventListener("dragend", () => { dragIndex = null; row.classList.remove("dragging"); });
        row.addEventListener("dragover", (e) => e.preventDefault());
        row.addEventListener("drop", async (e) => {
          e.preventDefault();
          if (dragIndex === null || dragIndex === idx) return;
          const [moved] = activities.splice(dragIndex, 1);
          activities.splice(idx, 0, moved);
          await saveBreakActivities(activities);
          renderActivities();
        });
      }
      actListEl.appendChild(row);
    });

    if (!activities.length) {
      const empty = document.createElement("p");
      empty.className = "help";
      empty.style.margin = "0";
      empty.textContent = "No activities yet. Add your first below.";
      actListEl.appendChild(empty);
    }
  }

  async function addActivity() {
    const name = newName.value.trim();
    if (!name) { newName.focus(); return; }
    const tag = newTag.value.trim().replace(/^#/, "");
    activities.push({ id: genId("a"), name, tag });
    await saveBreakActivities(activities);
    newName.value = "";
    newTag.value = "";
    renderAll();
    newName.focus();
  }
  addActivityBtn.addEventListener("click", addActivity);
  newName.addEventListener("keydown", (e) => { if (e.key === "Enter") addActivity(); });
  newTag.addEventListener("keydown", (e) => { if (e.key === "Enter") addActivity(); });

  // --- Stats ---
  function renderStats() {
    const { count } = deriveActivityStats(log);
    const withCounts = activities.map((a) => ({ a, c: count[a.id] || 0 }));
    const favs = withCounts.filter((x) => x.c > 0).sort((x, y) => y.c - x.c).slice(0, 3);
    const least = withCounts.slice().sort((x, y) => x.c - y.c).slice(0, 3);

    favEl.innerHTML = favs.length
      ? favs.map((x) => `<div class="stat-line">${escapeHtml(x.a.name)} <span class="stat-num">${x.c}×</span></div>`).join("")
      : `<div class="stat-empty">Nothing chosen yet.</div>`;

    leastEl.innerHTML = least.length
      ? least.map((x) => `<div class="stat-line muted">${escapeHtml(x.a.name)} <span class="stat-num">${x.c}×</span></div>`).join("")
      : `<div class="stat-empty">—</div>`;

    const totals = deriveTagTotals(log);
    const tags = Object.keys(totals).filter((t) => totals[t] > 0);
    if (!tags.length) {
      pieEl.innerHTML = `<div class="stat-empty">No data yet.</div>`;
      return;
    }
    const grand = tags.reduce((s, t) => s + totals[t], 0);
    const slices = tags
      .sort((a, b) => totals[b] - totals[a])
      .map((t) => {
        const c = tagColor(t);
        return { value: totals[t], color: c.bg, border: c.border, tag: t };
      });
    const svg = buildPieSVG(slices, 150);
    const legend = slices.map((s) =>
      `<div class="legend-row"><span class="swatch" style="background:${s.color};border-color:${s.border}"></span>` +
      `${escapeHtml(s.tag)} <span class="stat-num">${s.value} (${Math.round(s.value / grand * 100)}%)</span></div>`
    ).join("");
    pieEl.innerHTML = `<div class="pie-wrap">${svg}<div class="legend">${legend}</div></div>`;
  }

  // --- History ---
  function renderBreaks() {
    breaksCountEl.textContent = log.length + " logged";
    breaksListEl.innerHTML = "";

    if (!log.length) {
      const empty = document.createElement("p");
      empty.className = "help";
      empty.style.margin = "0";
      empty.textContent = "No breaks logged yet.";
      breaksListEl.appendChild(empty);
      return;
    }

    log.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "break-row";

      if (editingBreakId === entry.id) {
        row.classList.add("editing");
        const chips = (entry.activities || []).map((a, i) =>
          `<span class="break-chip">${escapeHtml(a.name)}` +
          `${a.tag ? ` <span class="ct">/ ${escapeHtml(a.tag)}</span>` : ""}` +
          ` <button class="chip-x" data-i="${i}" title="Remove">×</button></span>`
        ).join("");
        const options = activities.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
        row.innerHTML = `
          <div class="break-meta">${escapeHtml(formatDateTime(entry.ts))} · ${entry.durationMin}m</div>
          <div class="break-chips">${chips || '<span class="stat-empty">no activities</span>'}</div>
          <div class="break-edit-add">
            <select class="break-add-select">${options || '<option value="">(no saved activities)</option>'}</select>
            <button class="break-add-btn">+ add</button>
            <button class="break-save act-save">done</button>
          </div>`;

        row.querySelectorAll(".chip-x").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const i = parseInt(btn.dataset.i, 10);
            entry.activities.splice(i, 1);
            await saveBreakLog(log);
            renderActivities();
            renderStats();
            renderBreaks();
          });
        });
        const select = row.querySelector(".break-add-select");
        row.querySelector(".break-add-btn").addEventListener("click", async () => {
          if (!select.value) return;
          if ((entry.activities || []).length >= MAX_PICK) return;
          const a = activities.find((x) => x.id === select.value);
          if (!a) return;
          if (!entry.activities) entry.activities = [];
          if (entry.activities.some((x) => x.id === a.id)) return;
          entry.activities.push({ id: a.id, name: a.name, tag: a.tag || "" });
          await saveBreakLog(log);
          renderActivities();
          renderStats();
          renderBreaks();
        });
        row.querySelector(".break-save").addEventListener("click", () => {
          editingBreakId = null;
          renderBreaks();
        });
      } else {
        const acts = (entry.activities || [])
          .map((a) => escapeHtml(a.name) + (a.tag ? " / " + escapeHtml(a.tag) : ""))
          .join(", ") || "—";
        row.innerHTML = `
          <span class="break-when">${escapeHtml(formatDateTime(entry.ts))}</span>
          <span class="break-dur">${entry.durationMin}m</span>
          <span class="break-acts"></span>
          <button class="break-edit">edit</button>
          <button class="break-delete" title="Delete">×</button>`;
        row.querySelector(".break-acts").textContent = acts;
        row.querySelector(".break-edit").addEventListener("click", () => {
          editingBreakId = entry.id;
          renderBreaks();
        });
        row.querySelector(".break-delete").addEventListener("click", async () => {
          log = log.filter((x) => x.id !== entry.id);
          await saveBreakLog(log);
          renderAll();
        });
      }
      breaksListEl.appendChild(row);
    });
  }

  // Live-refresh if a break is logged (e.g. from the break page) while options is open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.breakLog) {
      log = Array.isArray(changes.breakLog.newValue) ? changes.breakLog.newValue : [];
      renderAll();
    }
    if (area === "sync" && changes.breakActivities) {
      activities = Array.isArray(changes.breakActivities.newValue) ? changes.breakActivities.newValue : [];
      renderAll();
    }
  });

  (async function initBreaks() {
    activities = await ensureSeededActivities();
    log = await loadBreakLog();
    renderAll();
  })();
})();
