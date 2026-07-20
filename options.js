const DEFAULT_SCHEDULE = { days: [0, 1, 2, 3, 4, 5, 6], startTime: null, endTime: null };

const DEFAULT_SETTINGS = {
  groups: [
    { id: "default", name: "Default", sites: [], pauseSeconds: 10, schedule: { ...DEFAULT_SCHEDULE } }
  ],
  background: { type: "preset", value: "black" },
  allowanceMinutes: 5,
  resetOnRelease: false,
  forceBreak: false,
  magicStars: true,
  breakMessage: "Step away from the screen. Stretch. Breathe.",
  breakBackdoor: true,
  backdoorLockMin: 3,
  backdoorHoldSec: 20
};

const groupsEl = document.getElementById("groups");
const groupTabsEl = document.getElementById("group-tabs");
let activeGroupId = null;
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");
const allowanceEl = document.getElementById("allowance");
const bgCustomEl = document.getElementById("bg-custom");
const resetOnReleaseEl = document.getElementById("reset-on-release");
const forceBreakEl = document.getElementById("force-break");
const magicStarsEl = document.getElementById("magic-stars");
const breakMessageEl = document.getElementById("break-message");
const backdoorEnabledEl = document.getElementById("backdoor-enabled");
const backdoorLockEl = document.getElementById("backdoor-lock");
const backdoorHoldEl = document.getElementById("backdoor-hold");
const breakOptionsEl = document.getElementById("break-message-section");
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
  node.querySelector(".group-name").addEventListener("input", renderGroupTabs);   // live tab label
  node.querySelector(".delete-group").addEventListener("click", () => {
    const wasActive = node.dataset.id === activeGroupId;
    node.remove();
    renderGroupTabs();
    if (wasActive) activateGroup(groupsEl.querySelector(".group")?.dataset.id || null);
  });

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

// Groups are a horizontal segmented control — one editor visible at a time.
function renderGroupTabs() {
  groupTabsEl.innerHTML = "";
  for (const card of groupsEl.querySelectorAll(".group")) {
    const id = card.dataset.id;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "group-tab" + (id === activeGroupId ? " active" : "");
    tab.textContent = card.querySelector(".group-name").value.trim() || "Untitled";
    tab.dataset.id = id;
    tab.addEventListener("click", () => activateGroup(id));
    groupTabsEl.appendChild(tab);
  }
  const add = document.createElement("button");
  add.type = "button"; add.className = "group-tab-add"; add.title = "New group"; add.textContent = "+";
  add.addEventListener("click", addGroup);
  groupTabsEl.appendChild(add);
}
function activateGroup(id) {
  activeGroupId = id;
  groupsEl.querySelectorAll(".group").forEach((card) => {
    card.classList.toggle("group-hidden", card.dataset.id !== id);
  });
  groupTabsEl.querySelectorAll(".group-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.id === id);
  });
}
function addGroup() {
  const g = { id: uuid(), name: "", pauseSeconds: 10, sites: [], schedule: { ...DEFAULT_SCHEDULE } };
  renderGroup(g);
  renderGroupTabs();
  activateGroup(g.id);
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

forceBreakEl.addEventListener("change", syncBreakVisibility);

saveBtn.addEventListener("click", async () => {
  const settings = {
    groups: readGroups(),
    background: readBackground(),
    allowanceMinutes: clampInt(allowanceEl.value, 3, 25, 5),
    resetOnRelease: resetOnReleaseEl.checked,
    forceBreak: forceBreakEl.checked,
    magicStars: magicStarsEl.checked,
    breakMessage: breakMessageEl.value.trim() || DEFAULT_SETTINGS.breakMessage,
    breakBackdoor: backdoorEnabledEl.checked,
    backdoorLockMin: clampInt(backdoorLockEl.value, 0, 15, 3),
    backdoorHoldSec: clampInt(backdoorHoldEl.value, 5, 60, 20)
  };
  await chrome.storage.sync.set({ settings });
  statusEl.textContent = "Saved.";
  setTimeout(() => (statusEl.textContent = ""), 1500);
});

(async function init() {
  const { settings } = await chrome.storage.sync.get("settings");
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  s.groups.forEach(renderGroup);
  renderGroupTabs();
  activateGroup(groupsEl.querySelector(".group")?.dataset.id || null);
  applyBackgroundUI(s.background);
  allowanceEl.value = Math.min(25, Math.max(3, s.allowanceMinutes ?? 5));
  resetOnReleaseEl.checked = !!s.resetOnRelease;
  forceBreakEl.checked = !!s.forceBreak;
  magicStarsEl.checked = s.magicStars !== false;
  breakMessageEl.value = s.breakMessage ?? DEFAULT_SETTINGS.breakMessage;
  backdoorEnabledEl.checked = s.breakBackdoor !== false;
  backdoorLockEl.value = s.backdoorLockMin ?? 3;
  backdoorHoldEl.value = s.backdoorHoldSec ?? 20;
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
          <button class="act-save" title="Save"><img class="btn-icon" src="images/save.png" alt="save" /></button>
          <button class="act-cancel" title="Cancel"><img class="btn-icon" src="images/cancel.png" alt="cancel" /></button>`;
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
          <button class="act-edit" title="Edit"><img class="btn-icon" src="images/edit.svg" alt="edit" /></button>
          <button class="act-delete" title="Delete"><img class="btn-icon" src="images/delete.svg" alt="delete" /></button>`;
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
            <button class="break-add-btn add-icon-btn" title="Add"><img src="images/add.png" alt="add" /></button>
            <button class="break-save act-save" title="Done"><img class="btn-icon" src="images/save.png" alt="done" /></button>
            <button class="break-cancel act-cancel" title="Cancel"><img class="btn-icon" src="images/cancel.png" alt="cancel" /></button>
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
        row.querySelector(".break-cancel").addEventListener("click", () => {
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
          <button class="break-edit" title="Edit"><img class="btn-icon" src="images/edit.svg" alt="edit" /></button>
          <button class="break-delete" title="Delete"><img class="btn-icon" src="images/delete.svg" alt="delete" /></button>`;
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

// ===== Reflections (history, mood palette, star-map window) =====
(function reflectionsModule() {
  const winButtons = document.querySelectorAll(".rwin-btn");
  const reduceMotionBox = document.getElementById("reduce-motion");
  const starmapBgBox = document.getElementById("starmap-bg");
  const feelingsEditor = document.getElementById("feelings-editor");
  const reflectionsList = document.getElementById("reflections-list");
  const reflectionsCount = document.getElementById("reflections-count");

  reduceMotionBox.addEventListener("change", () => saveReduceMotion(reduceMotionBox.checked));
  starmapBgBox.addEventListener("change", () => saveStarmapBg(starmapBgBox.value));
  loadStarmapBg().then((hex) => { starmapBgBox.value = hex; });

  // Each title reads: (arousal icon) high/low arousal · (valence icon) positive/negative
  const Q_PARTS = {
    tl: { arousalIcon: "sun",  arousalWord: "high arousal", valenceIcon: "cactus", valenceWord: "negative" },
    tr: { arousalIcon: "sun",  arousalWord: "high arousal", valenceIcon: "lily",   valenceWord: "positive" },
    bl: { arousalIcon: "moon", arousalWord: "low arousal",  valenceIcon: "cactus", valenceWord: "negative" },
    br: { arousalIcon: "moon", arousalWord: "low arousal",  valenceIcon: "lily",   valenceWord: "positive" }
  };

  let feelings = {};
  let log = [];
  let windowMonths = 1;

  function paintWindow() {
    winButtons.forEach((b) => b.classList.toggle("on", parseInt(b.dataset.m, 10) === windowMonths));
  }
  winButtons.forEach((b) => b.addEventListener("click", async () => {
    windowMonths = parseInt(b.dataset.m, 10);
    await saveWindowMonths(windowMonths);
    paintWindow();
  }));

  function renderFeelings() {
    feelingsEditor.innerHTML = "";
    for (const q of ["tl", "tr", "bl", "br"]) {
      const meta = QUADRANT_META[q];
      const block = document.createElement("div");
      block.className = "feel-block";
      block.style.background = meta.cell;
      block.style.borderColor = meta.border;

      const h = document.createElement("div");
      h.className = "feel-q-label"; h.style.color = meta.text;
      const p = Q_PARTS[q];
      const mkIco = (name) => {
        const i = document.createElement("img");
        i.className = "feel-q-ico"; i.src = "images/" + name + ".png"; i.alt = "";
        return i;
      };
      h.appendChild(mkIco(p.arousalIcon));
      h.appendChild(document.createTextNode(p.arousalWord + " · "));
      h.appendChild(mkIco(p.valenceIcon));
      h.appendChild(document.createTextNode(p.valenceWord));
      block.appendChild(h);

      const chips = document.createElement("div");
      chips.className = "feel-chips";
      (feelings[q] || []).forEach((name, i) => {
        const pill = document.createElement("span");
        pill.className = "feel-pill";
        pill.style.color = meta.text; pill.style.borderColor = meta.border;
        pill.append(document.createTextNode(name));
        const x = document.createElement("button");
        x.className = "x"; x.type = "button"; x.textContent = "×";
        x.addEventListener("click", async () => { feelings[q].splice(i, 1); await saveFeelings(feelings); renderFeelings(); });
        pill.appendChild(x);
        chips.appendChild(pill);
      });
      block.appendChild(chips);

      const row = document.createElement("div");
      row.className = "feel-add";
      const input = document.createElement("input");
      input.type = "text"; input.placeholder = "add a feeling…";
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "add-icon-btn"; btn.title = "Add";
      const addImg = document.createElement("img"); addImg.src = "images/add.png"; addImg.alt = "add";
      btn.appendChild(addImg);
      const add = async () => {
        const v = input.value.trim();
        if (!v) { input.focus(); return; }
        if (!feelings[q]) feelings[q] = [];
        if (!feelings[q].includes(v)) feelings[q].push(v);
        await saveFeelings(feelings);
        renderFeelings();
      };
      btn.addEventListener("click", add);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
      row.appendChild(input); row.appendChild(btn);
      block.appendChild(row);

      feelingsEditor.appendChild(block);
    }
  }

  function renderReflections() {
    reflectionsCount.textContent = log.length + " logged";
    reflectionsList.innerHTML = "";
    if (!log.length) {
      const p = document.createElement("p");
      p.className = "help"; p.style.margin = "0"; p.textContent = "No reflections yet.";
      reflectionsList.appendChild(p);
      return;
    }
    log.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "reflect-row";
      const when = document.createElement("span");
      when.className = "reflect-when"; when.textContent = formatDateTime(entry.ts);
      const body = document.createElement("div");
      body.className = "reflect-body";
      const lines = [];
      if ((entry.thoughts || []).length) lines.push(`<div class="rb-line"><span class="rb-tag">thoughts</span>${escapeHtml(entry.thoughts.join(" · "))}</div>`);
      const bodyItems = Array.isArray(entry.body)
        ? entry.body
        : (entry.body ? [{ part: "", note: entry.body }] : []);
      const bodyTxt = bodyItems
        .map((b) => (b.part ? (b.note ? `${b.part}: ${b.note}` : b.part) : (b.note || "")))
        .filter(Boolean).join(" · ");
      if (bodyTxt) lines.push(`<div class="rb-line"><span class="rb-tag">body</span>${escapeHtml(bodyTxt)}</div>`);
      const moods = Array.isArray(entry.mood) ? entry.mood : (entry.mood ? [entry.mood] : []);
      if (moods.length) lines.push(`<div class="rb-line"><span class="rb-tag">mood</span>${escapeHtml(moods.join(" · "))}</div>`);
      body.innerHTML = lines.join("") || '<div class="rb-line">(empty)</div>';
      const del = document.createElement("button");
      del.className = "break-delete"; del.title = "Delete";
      del.innerHTML = '<img class="btn-icon" src="images/delete.svg" alt="delete" />';
      del.addEventListener("click", async () => {
        log = log.filter((x) => x.id !== entry.id);
        await saveReflectionLog(log);
        renderReflections();
      });
      row.appendChild(when); row.appendChild(body); row.appendChild(del);
      reflectionsList.appendChild(row);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.reflectionLog) {
      log = Array.isArray(changes.reflectionLog.newValue) ? changes.reflectionLog.newValue : [];
      renderReflections();
    }
    if (area === "sync" && changes.reflectionFeelings) {
      const v = changes.reflectionFeelings.newValue;
      feelings = (v && typeof v === "object") ? v : {};
      renderFeelings();
    }
  });

  (async function initReflections() {
    feelings = await ensureSeededFeelings();
    log = await loadReflectionLog();
    windowMonths = await loadWindowMonths();
    paintWindow();
    reduceMotionBox.checked = await loadReduceMotion();
    renderFeelings();
    renderReflections();
  })();
})();

// ===== Left-nav: switch between Pause / Break / Magic stars panels =====
(function settingsNav() {
  const NAV_KEY = "settingsActivePanel";
  const buttons = Array.from(document.querySelectorAll(".nav-btn"));
  const panels = Array.from(document.querySelectorAll(".settings-panel"));
  if (!buttons.length || !panels.length) return;

  function show(name) {
    buttons.forEach((b) => b.classList.toggle("active", b.dataset.panel === name));
    panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === name));
    try { localStorage.setItem(NAV_KEY, name); } catch (e) {}
  }

  buttons.forEach((b) => b.addEventListener("click", () => {
    show(b.dataset.panel);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));

  let initial = "pause";
  try {
    const saved = localStorage.getItem(NAV_KEY);
    if (saved && panels.some((p) => p.dataset.panel === saved)) initial = saved;
  } catch (e) {}
  show(initial);
})();
