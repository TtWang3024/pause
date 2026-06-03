// Shared helpers for break activities, history log, stats, and tag colors.
// Loaded as a plain script (not a module) before break.js / options.js,
// so these become globals on those pages.

const BREAK_PALETTE = [
  { bg: "#f8d4d4", border: "#e7a8a8" }, // pink
  { bg: "#f3e0cf", border: "#e0c2a0" }, // peach
  { bg: "#cdebd2", border: "#a3d6ad" }, // green
  { bg: "#cfeae0", border: "#a3d6c4" }, // teal
  { bg: "#eef0c4", border: "#d8dc98" }, // yellow
  { bg: "#d8ecc4", border: "#b6d698" }, // light green
  { bg: "#cdece8", border: "#9fd6cf" }, // cyan
  { bg: "#ccd9f0", border: "#9fb6e0" }, // blue
  { bg: "#d6cdee", border: "#b09fe0" }, // purple
  { bg: "#f0d4e6", border: "#e0a3cb" }  // magenta
];

function hashString(s) {
  let h = 0;
  const str = (s || "").toLowerCase();
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function tagColor(tag) {
  if (!tag) return { bg: "#ececec", border: "#cfcfcf" };
  return BREAK_PALETTE[hashString(tag) % BREAK_PALETTE.length];
}

function genId(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadBreakActivities() {
  const { breakActivities } = await chrome.storage.sync.get("breakActivities");
  return Array.isArray(breakActivities) ? breakActivities : [];
}
async function saveBreakActivities(list) {
  await chrome.storage.sync.set({ breakActivities: list });
}
async function loadBreakLog() {
  const { breakLog } = await chrome.storage.local.get("breakLog");
  return Array.isArray(breakLog) ? breakLog : [];
}
async function saveBreakLog(list) {
  await chrome.storage.local.set({ breakLog: list });
}

// Per-activity usage count and last-chosen timestamp, derived from the log.
function deriveActivityStats(log) {
  const count = {};
  const last = {};
  for (const entry of log) {
    for (const a of entry.activities || []) {
      if (!a.id) continue;
      count[a.id] = (count[a.id] || 0) + 1;
      if (!last[a.id] || entry.ts > last[a.id]) last[a.id] = entry.ts;
    }
  }
  return { count, last };
}

// Total chosen counts grouped by tag (for the pie chart).
function deriveTagTotals(log) {
  const totals = {};
  for (const entry of log) {
    for (const a of entry.activities || []) {
      const tag = a.tag || "untagged";
      totals[tag] = (totals[tag] || 0) + 1;
    }
  }
  return totals;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatShortDate(ts) {
  const d = new Date(ts);
  return d.getDate() + " " + MONTHS[d.getMonth()];
}
function formatDateTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return d.getDate() + " " + MONTHS[d.getMonth()] + " " + hh + ":" + mm;
}

// Build an SVG pie chart. slices: [{value, color, border}]. Returns an SVG string.
function buildPieSVG(slices, size) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return "";
  const r = size / 2, cx = r, cy = r;
  if (slices.length === 1) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="${slices[0].color}" stroke="${slices[0].border}" stroke-width="1.5"/></svg>`;
  }
  let angle = -Math.PI / 2;
  let paths = "";
  for (const slice of slices) {
    const frac = slice.value / total;
    const end = angle + frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const large = frac > 0.5 ? 1 : 0;
    paths += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} ` +
      `A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" ` +
      `fill="${slice.color}" stroke="#fff" stroke-width="1.5"/>`;
    angle = end;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;
}
