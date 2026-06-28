// Shared helpers for the "magic power" reflection feature.
// Loaded AFTER breaks-common.js (reuses hashString, genId, escapeHtml, formatDateTime).

const REFLECT_MIN_MONTHS = 1;
const REFLECT_MAX_MONTHS = 6;

// --- storage ---
async function loadReflectionLog() {
  const { reflectionLog } = await chrome.storage.local.get("reflectionLog");
  return Array.isArray(reflectionLog) ? reflectionLog : [];
}
async function saveReflectionLog(list) {
  await chrome.storage.local.set({ reflectionLog: list });
}

// ---- Mood = Russell circumplex (valence × arousal), four colour-coded quadrants ----
// tr = pleasant + high arousal (yellow); tl = unpleasant + high (orange);
// bl = unpleasant + low (blue); br = pleasant + low (green).
const QUADRANTS = ["tl", "tr", "bl", "br"];
const QUADRANT_META = {
  tl: { cell: "#FAECE7", border: "#F0997B", text: "#712B13" }, // orange
  tr: { cell: "#FAEEDA", border: "#FAC775", text: "#633806" }, // yellow
  bl: { cell: "#E6F1FB", border: "#B5D4F4", text: "#0C447C" }, // blue
  br: { cell: "#EAF3DE", border: "#C0DD97", text: "#27500A" }  // green
};
const DEFAULT_FEELINGS = {
  tl: ["terror / panic", "anger / rage", "tension / nervousness", "distress / vexation"],
  tr: ["surprise / amazement", "excitement", "joy / gladness", "delight / pleasure"],
  bl: ["sadness", "dejection / frustration", "fatigue / exhaustion"],
  br: ["reassurance / peace of mind", "ease & comfort", "contentment", "serenity / tranquility", "relaxation"]
};

async function ensureSeededFeelings() {
  const stored = await chrome.storage.sync.get("reflectionFeelings");
  let f = stored.reflectionFeelings;
  if (!f || typeof f !== "object") {
    f = JSON.parse(JSON.stringify(DEFAULT_FEELINGS));
    await chrome.storage.sync.set({ reflectionFeelings: f });
    return f;
  }
  for (const q of QUADRANTS) if (!Array.isArray(f[q])) f[q] = [];
  return f;
}
async function saveFeelings(f) {
  await chrome.storage.sync.set({ reflectionFeelings: f });
}

async function loadWindowMonths() {
  const { reflectWindowMonths } = await chrome.storage.sync.get("reflectWindowMonths");
  const n = parseInt(reflectWindowMonths, 10);
  return n === REFLECT_MAX_MONTHS ? REFLECT_MAX_MONTHS : REFLECT_MIN_MONTHS;
}
async function saveWindowMonths(n) {
  await chrome.storage.sync.set({ reflectWindowMonths: n === REFLECT_MAX_MONTHS ? REFLECT_MAX_MONTHS : REFLECT_MIN_MONTHS });
}

// Reduced-motion / e-ink mode: turn off the wand trail, sparkles, and twinkle.
async function loadReduceMotion() {
  const { reflectReduceMotion } = await chrome.storage.sync.get("reflectReduceMotion");
  return !!reflectReduceMotion;
}
async function saveReduceMotion(on) {
  await chrome.storage.sync.set({ reflectReduceMotion: !!on });
}

// User-defined star-map background colour (the reflection screen adapts its ink to it).
async function loadStarmapBg() {
  const { reflectStarmapBg } = await chrome.storage.sync.get("reflectStarmapBg");
  return reflectStarmapBg || "#04040a";
}
async function saveStarmapBg(hex) {
  await chrome.storage.sync.set({ reflectStarmapBg: hex || "#04040a" });
}

// --- star derivation ---
// Flatten the log into one star per thought / body / mood within the window.
// One headline string for a reflection's star: the top (first) thought; else all
// moods joined by a dot; else the body feelings. (mood/body may be legacy formats.)
function reflectionStarText(entry) {
  if (!entry) return "";
  const thoughts = (entry.thoughts || []).map((t) => (t || "").trim()).filter(Boolean);
  if (thoughts.length) return thoughts[0];
  const moods = Array.isArray(entry.mood) ? entry.mood.filter(Boolean) : (entry.mood ? [entry.mood] : []);
  if (moods.length) return moods.join(" · ");
  const bodyItems = Array.isArray(entry.body) ? entry.body : (entry.body ? [{ part: "", note: entry.body }] : []);
  return bodyItems
    .map((b) => (b.part ? (b.note ? b.part + ": " + b.note : b.part) : (b.note || "")))
    .filter(Boolean).join(" · ");
}

// Each reflection is ONE star within the window.
function reflectionStars(log, windowMonths, nowTs) {
  const windowMs = windowMonths * 30 * 24 * 60 * 60 * 1000;
  const start = nowTs - windowMs;
  const stars = [];
  for (const entry of log) {
    if (!entry || entry.ts < start) continue;
    const text = reflectionStarText(entry);
    if (!text) continue;                 // nothing logged → no star
    stars.push({ id: entry.id, text, ts: entry.ts });
  }
  return { stars, start, end: nowTs };
}

// Deterministic 0..1 pseudo-random from an id + salt.
function rand01(id, salt) {
  return (hashString(id + "|" + salt) % 100000) / 100000;
}

// Deterministic scatter position within a box (with padding).
function starPosition(id, w, h, pad) {
  return {
    x: pad + rand01(id, "x") * Math.max(1, w - 2 * pad),
    y: pad + rand01(id, "y") * Math.max(1, h - 2 * pad)
  };
}

// 0 (oldest) … 1 (newest) within the window.
function recencyFrac(ts, start, end) {
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (ts - start) / (end - start)));
}

// Pick a star image index deterministically from a set length.
function starImageIndex(id, count) {
  if (count <= 0) return 0;
  return hashString(id + "|img") % count;
}
