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

// The breathing pattern the wave pacer follows; remembered between sessions.
async function loadBreathPattern() {
  const { reflectBreathPattern } = await chrome.storage.sync.get("reflectBreathPattern");
  return reflectBreathPattern || "box";
}
async function saveBreathPattern(id) {
  await chrome.storage.sync.set({ reflectBreathPattern: id || "box" });
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
  const bodyText = bodyItems
    .map((b) => (b.part ? (b.note ? b.part + ": " + b.note : b.part) : (b.note || "")))
    .filter(Boolean).join(" · ");
  if (bodyText) return bodyText;
  const wave = Array.isArray(entry.wave) ? entry.wave : [];
  if (wave.length) {                     // a wave-only session still lights its star
    const peak = Math.max(...wave.map((p) => p.v || 0));
    return "rode an urge wave · peak " + peak + "/10 · " + wave.length + (wave.length === 1 ? " point" : " points");
  }
  const rest = entry.rest;               // a break with nothing written before it still lights its star
  if (rest && rest.durationMin) {
    const acts = (rest.activities || []).map((a) => (typeof a === "string" ? a : (a && a.name) || "")).filter(Boolean);
    return "rested " + rest.durationMin + " min" + (acts.length ? " · " + acts.slice(0, 3).join(" · ") : "");
  }
  return "";
}

// ---------- the urge wave chart (reflection window and break screen) ----------
// Time is left out on purpose: each tap is one step to the right, so the curve
// reads as a sequence and never folds back on itself. Steps start roomy and
// shrink once the points would overflow the width. Only the last few hours show.
const WAVE_RECENT_MS = 4 * 60 * 60 * 1000;
const WAVE_STEP_FRAC = 0.1;              // a roomy step is a tenth of the width

function recentWave(pts, now) {
  return (pts || []).filter((p) => p && now - p.ts <= WAVE_RECENT_MS);
}

// x for point i of n, from x0 across to at most x1; also the step, for sizing dots.
function waveLayout(n, x0, x1) {
  const w = x1 - x0;
  const step = n > 1 ? Math.min(w * WAVE_STEP_FRAC, w / (n - 1)) : 0;
  return { step, x: (i) => x0 + i * step };
}

// A smooth curve through P ([[x, y], ...], x evenly spaced) that stays between
// neighbouring points: no overshoot above 10 or below 0, and a flat top at each
// peak (monotone cubic, Fritsch-Carlson tangents).
function wavePathD(P) {
  if (P.length < 2) return "";
  const n = P.length, h = P[1][0] - P[0][0];
  const s = [];
  for (let i = 0; i < n - 1; i++) s.push(h ? (P[i + 1][1] - P[i][1]) / h : 0);
  const m = new Array(n);
  m[0] = s[0]; m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = s[i - 1] * s[i] <= 0 ? 0 : (2 * s[i - 1] * s[i]) / (s[i - 1] + s[i]);   // a turn is flat
  }
  const f = (v) => v.toFixed(1);
  let d = "M" + f(P[0][0]) + "," + f(P[0][1]);
  for (let i = 0; i < n - 1; i++) {
    d += "C" + f(P[i][0] + h / 3) + "," + f(P[i][1] + m[i] * h / 3) +
         " " + f(P[i + 1][0] - h / 3) + "," + f(P[i + 1][1] - m[i + 1] * h / 3) +
         " " + f(P[i + 1][0]) + "," + f(P[i + 1][1]);
  }
  return d;
}

// Dots shrink with the step so a crowded wave stays readable.
function waveDotR(step, full) {
  return step ? Math.max(1.6, Math.min(full, step * 0.35)) : full;
}

// A session's star is lit only once its break has finished: an entry saved on
// "Open it anyway" or "Relax my body first" waits as `pending` until then.
// The star picture: the one summoned on the reflection screen when known,
// else a deterministic pick, so the same entry always shows the same star.
const REFLECT_STAR_COUNT = 21;
function reflectStarSrc(i) {
  const p = "images/stars-" + String(i + 1).padStart(3, "0") + ".png";
  try { return chrome.runtime.getURL(p); } catch (e) { return p; }
}
function entryStarSrc(entry) {
  const n = entry && Number.isInteger(entry.star) && entry.star >= 0 && entry.star < REFLECT_STAR_COUNT
    ? entry.star : starImageIndex(entry ? entry.id : "", REFLECT_STAR_COUNT);
  return reflectStarSrc(n);
}

// Each reflection is ONE star within the window.
function reflectionStars(log, windowMonths, nowTs) {
  const windowMs = windowMonths * 30 * 24 * 60 * 60 * 1000;
  const start = nowTs - windowMs;
  const stars = [];
  for (const entry of log) {
    if (!entry || entry.ts < start || entry.pending) continue;   // pending: its break has not finished yet
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
