const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const groupId = params.get("group") || "";

const trailCanvas = document.getElementById("trail");
const starmapEl = document.getElementById("starmap");
const tooltipEl = document.getElementById("tooltip");
const composeOverlay = document.getElementById("compose-overlay");
const composeClose = document.getElementById("compose-close");
const wandEl = document.getElementById("wand");
const twinkleEl = document.getElementById("twinkle");
const thoughtInput = document.getElementById("thought-input");
const thoughtChips = document.getElementById("thought-chips");
const bodyInput = document.getElementById("body-input");
const circumplexEl = document.getElementById("circumplex");
const saveBtn = document.getElementById("save-btn");
const continueBtn = document.getElementById("continue-btn");
const winToggle = document.getElementById("window-toggle");

const WAND_SIZE = 250;
// ===== Tunables — tweak these numbers and reload to taste =====
const TIP_X = 0.36, TIP_Y = 0.25;   // wand star hotspot (fraction of the image) — where the pointer sits on the wand
const TRAIL_OFFSET_X = -6;          // shift the trail from the pointer: negative = LEFT
const TRAIL_OFFSET_Y = -18;         // negative = UP, so the trail rides above the star
// ==============================================================

let thoughts = [];
let selectedMood = "";
let windowMonths = 1;
let reflectionLog = [];
let feelings = {};

// ---------- fallback art (used until/if a PNG is missing) ----------
function svgUri(svg) { return "data:image/svg+xml," + encodeURIComponent(svg); }
const WAND_FALLBACK = svgUri(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" +
  "<line x1='28' y1='26' x2='76' y2='76' stroke='#c9a45c' stroke-width='6' stroke-linecap='round'/>" +
  "<path transform='translate(28,26)' d='M0,-13 L3.8,-3.8 L13,0 L3.8,3.8 L0,13 L-3.8,3.8 L-13,0 L-3.8,-3.8 Z' fill='#ffd86b'/>" +
  "</svg>"
);
const STAR_FALLBACKS = [
  "<path d='M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z' fill='#ffd86b'/>",
  "<path d='M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z' fill='#ffffff'/>",
  "<circle cx='12' cy='12' r='6' fill='#7db4ff'/>",
  "<path d='M12 2 L20 16 L4 16 Z' fill='#ff9ec7'/><path d='M12 22 L4 8 L20 8 Z' fill='#ff9ec7'/>",
  "<path d='M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z' fill='#9ee6a0'/>"
].map((p) => svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" + p + "</svg>"));

const STAR_SRCS = [1, 2, 3, 4, 5, 6].map((n) => "images/stars-00" + n + ".png");
function starSrc(i) {
  try { return chrome.runtime.getURL(STAR_SRCS[i]); } catch (e) { return STAR_SRCS[i]; }
}

// ---------- theme ----------
function applyBackground(bg) {
  if (!bg) return;
  if (bg.type === "preset") {
    document.body.classList.toggle("theme-white", bg.value === "white");
  } else if (bg.type === "custom" && bg.value) {
    document.body.style.background = bg.value;
    document.body.style.color = isLightColor(bg.value) ? "#000" : "#fff";
  }
}
function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return false;
  const v = parseInt(m[1], 16);
  return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) > 160;
}

// ---------- wand visibility (native cursor over UI / while the modal is open) ----------
let overUI = false;     // pointer over a UI control
let modalOpen = false;  // compose modal showing
function uiActive() { return overUI || modalOpen; }
function updateWand() {
  const hide = uiActive();
  wandEl.classList.toggle("hidden", hide);
  twinkleEl.classList.toggle("hidden", hide);
}
function nativeCursorZone(el) {
  el.addEventListener("pointerenter", () => { overUI = true; updateWand(); });
  el.addEventListener("pointerleave", () => { overUI = false; updateWand(); });
}

// ---------- wand + twinkle + sparkle + shake detection ----------
let curX = -300, curY = -300;
let distAccum = 0;
const pendingSparkles = [];
let centerStar = null;
let lastSummon = -100000;
const shakeMoves = [];

function onMove(e) {
  const nx = e.clientX, ny = e.clientY;
  if (curX > -200) distAccum += Math.hypot(nx - curX, ny - curY);
  curX = nx; curY = ny;

  // Queue trailing-ribbon targets ONLY (wand PNG + twinkle stay live below, zero lag).
  // Capture every native sub-frame point so a fast flick integrates the true path.
  if (!uiActive()) {
    const coalesced = (typeof e.getCoalescedEvents === "function") ? e.getCoalescedEvents() : null;
    if (coalesced && coalesced.length) {
      for (let i = 0; i < coalesced.length; i++) {
        const ce = coalesced[i];
        ribbonTargets.push({ x: ce.clientX + TRAIL_OFFSET_X, y: ce.clientY + TRAIL_OFFSET_Y });
      }
    } else {
      ribbonTargets.push({ x: nx + TRAIL_OFFSET_X, y: ny + TRAIL_OFFSET_Y });
    }
  }

  wandEl.style.transform = `translate(${curX - TIP_X * WAND_SIZE}px, ${curY - TIP_Y * WAND_SIZE}px)`;
  twinkleEl.style.setProperty("--pos", `translate(${curX}px, ${curY}px)`);

  if (!uiActive() && distAccum > 46) {
    distAccum = 0;
    pendingSparkles.push({
      x: curX + TRAIL_OFFSET_X + (Math.random() * 2 - 1) * 22,
      y: curY + TRAIL_OFFSET_Y + (Math.random() * 2 - 1) * 22,
      s: 2.5 + Math.random() * 4
    });
  }

  // shake / whirl → summon a star in the centre
  const t = e.timeStamp;
  shakeMoves.push({ t, x: curX, y: curY });
  while (shakeMoves.length && t - shakeMoves[0].t > 450) shakeMoves.shift();
  if (!modalOpen && !centerStar && t - lastSummon > 3500 && shakeMoves.length >= 6) {
    let path = 0;
    for (let i = 1; i < shakeMoves.length; i++) {
      path += Math.hypot(shakeMoves[i].x - shakeMoves[i - 1].x, shakeMoves[i].y - shakeMoves[i - 1].y);
    }
    const a = shakeMoves[0], b = shakeMoves[shakeMoves.length - 1];
    const net = Math.hypot(b.x - a.x, b.y - a.y);
    if (path > 650 && net < path * 0.45) { lastSummon = t; summonStar(); }
  }
}
window.addEventListener("pointermove", onMove, { passive: true });

function summonStar() {
  if (centerStar) return;
  const img = document.createElement("img");
  img.className = "summon-star";
  img.alt = ""; img.title = "Open a reflection";
  const n = Math.floor(Math.random() * STAR_SRCS.length);
  img.src = starSrc(n);
  img.addEventListener("error", () => { img.src = STAR_FALLBACKS[n % STAR_FALLBACKS.length]; }, { once: true });
  centerStar = img;
  document.body.appendChild(img);
  nativeCursorZone(img);
  const dismiss = () => {
    if (!centerStar) return;
    clearTimeout(centerStar._t);
    centerStar.remove();
    centerStar = null;
    overUI = false; updateWand();
  };
  img.addEventListener("click", () => { dismiss(); openCompose(); });
  img._t = setTimeout(dismiss, 6000);
}

// ---------- glowing movement trail (trailing ribbon) ----------
// An eased "ribbon" head lerps toward the (offset) cursor and is stroked as a
// midpoint-quadratic curve, so the trail is a smooth flowing line that lags a
// beat behind the wand instead of a chain of straight chords. EASE is the one
// feel knob (lower = silkier / more lag).
let ctx, W = 0, H = 0, washColor = "rgba(4,4,10,0.045)";
let headX = null, headY = null;          // eased ribbon head, in OFFSET space (CSS px)
const ribbonTargets = [];                // sub-frame offset targets queued by onMove
const headPts = [];                      // small ring buffer of recent head samples {x,y}
let prevMid = null;                      // last on-curve midpoint actually painted {x,y}
let strokedCtrlIdx = -1;                 // index of last headPts[] point used as a quad control point
const EASE = 0.3;                        // lower = silkier / more lag
function washFromBg() {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(getComputedStyle(document.body).backgroundColor);
  washColor = m ? `rgba(${m[1]},${m[2]},${m[3]},0.045)` : "rgba(4,4,10,0.045)";
}
function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  trailCanvas.width = W * dpr; trailCanvas.height = H * dpr;
  trailCanvas.style.width = W + "px";
  trailCanvas.style.height = H + "px";
  ctx = trailCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawSparkle(x, y, s) {
  ctx.strokeStyle = "rgba(255,225,150,0.95)";
  ctx.lineWidth = Math.max(1, s * 0.5);
  ctx.lineCap = "round";
  ctx.shadowBlur = 8; ctx.shadowColor = "rgba(255,210,120,0.95)";
  ctx.beginPath();
  ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
  ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
  ctx.stroke();
  ctx.shadowBlur = 0;
}
function resetRibbon() {
  ribbonTargets.length = 0;
  headPts.length = 0;
  headX = null; headY = null;
  prevMid = null;
  strokedCtrlIdx = -1;
}

function midpoint(a, b) { return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 }; }

// Ease the head toward each queued target IN ORDER, appending a head sample per target.
// A fast flick (many coalesced targets) therefore integrates the real path within one frame.
function advanceRibbon() {
  if (headX == null) {
    // Seed the head on the first available target so the first stroke isn't a long chord.
    if (ribbonTargets.length) {
      const t0 = ribbonTargets.shift();
      headX = t0.x; headY = t0.y;
      headPts.push({ x: headX, y: headY });
    } else {
      return;
    }
  }
  for (let i = 0; i < ribbonTargets.length; i++) {
    const tgt = ribbonTargets[i];
    headX += (tgt.x - headX) * EASE;
    headY += (tgt.y - headY) * EASE;
    headPts.push({ x: headX, y: headY });
  }
  ribbonTargets.length = 0;
}

// Stroke ONLY the quadratic segments added since last frame, using midpoint smoothing.
// On-curve endpoints are the segment midpoints; each headPts[i] is a quadratic control point,
// so adjacent quadratics share a midpoint endpoint+tangent (C1-continuous, no kinks).
// Begins at the carried prevMid (cross-frame continuity) and returns the last midpoint painted.
// Pure replay: it does not advance prevMid/strokedCtrlIdx, so both glow passes draw identically.
function strokeNewRibbonSegments() {
  const lastCtrl = headPts.length - 2;                 // last index usable as a control point
  const firstNewCtrl = Math.max(strokedCtrlIdx + 1, 1); // control points need a left neighbour
  if (lastCtrl < firstNewCtrl) return null;            // nothing genuinely new -> let it fade

  let startMid = prevMid;
  if (startMid == null) startMid = midpoint(headPts[firstNewCtrl - 1], headPts[firstNewCtrl]);
  if (!startMid || Number.isNaN(startMid.x) || Number.isNaN(startMid.y)) return null;

  ctx.beginPath();
  ctx.moveTo(startMid.x, startMid.y);
  let endMid = startMid;
  for (let i = firstNewCtrl; i <= lastCtrl; i++) {
    const m = midpoint(headPts[i], headPts[i + 1]);
    ctx.quadraticCurveTo(headPts[i].x, headPts[i].y, m.x, m.y);
    endMid = m;
  }
  ctx.stroke();
  return endMid;   // last on-curve endpoint painted this pass
}

function trailFrame() {
  if (ctx) {
    ctx.fillStyle = washColor;
    ctx.fillRect(0, 0, W, H);                          // FADE WASH each frame (preserved)

    if (uiActive()) {
      // Suppress + reset so re-entering the canvas can't bridge the gap with one long chord.
      resetRibbon();
    } else {
      advanceRibbon();
      // Snapshot continuity anchor + progress so BOTH passes replay IDENTICAL geometry
      // without double-advancing the continuity anchor.
      const passStartMid = prevMid;
      const passStartCtrl = strokedCtrlIdx;
      const haveNew = (headPts.length - 2) >= Math.max(passStartCtrl + 1, 1);
      const seeded = (passStartMid != null) || (headPts.length >= 2);
      if (haveNew && seeded) {
        ctx.save();
        ctx.lineCap = "round"; ctx.lineJoin = "round";

        // Pass 1: wide soft glow
        prevMid = passStartMid; strokedCtrlIdx = passStartCtrl;
        ctx.strokeStyle = "rgba(255,205,110,0.22)";
        ctx.lineWidth = 16; ctx.shadowBlur = 18; ctx.shadowColor = "rgba(255,200,110,0.55)";
        strokeNewRibbonSegments();

        // Pass 2: thin bright core (identical geometry)
        prevMid = passStartMid; strokedCtrlIdx = passStartCtrl;
        ctx.strokeStyle = "rgba(255,236,175,0.9)";
        ctx.lineWidth = 5; ctx.shadowBlur = 8; ctx.shadowColor = "rgba(255,200,110,0.55)";
        const endMid = strokeNewRibbonSegments();

        ctx.restore();   // resets shadowBlur/shadowColor so no glow leaks into drawSparkle

        if (endMid) {
          // Commit continuity to the ACTUAL last on-curve endpoint painted (kink-free, no back-track).
          prevMid = endMid;
          strokedCtrlIdx = headPts.length - 2;
          // Trim points fully consumed; keep the carried control + its span + left neighbour.
          if (strokedCtrlIdx >= 2) {
            const dropTo = strokedCtrlIdx - 1;
            headPts.splice(0, dropTo);
            strokedCtrlIdx -= dropTo;
          }
        } else {
          // Nothing painted this frame: restore snapshot, do not advance.
          prevMid = passStartMid; strokedCtrlIdx = passStartCtrl;
        }
      }
    }

    for (const sp of pendingSparkles) drawSparkle(sp.x, sp.y, sp.s);   // sparkle loop (preserved)
    pendingSparkles.length = 0;
  }
  requestAnimationFrame(trailFrame);
}

window.addEventListener("resize", () => { setupCanvas(); washFromBg(); renderStars(); });

// ---------- star map ----------
function renderStars() {
  starmapEl.innerHTML = "";
  const { stars, start, end } = reflectionStars(reflectionLog, windowMonths, Date.now());
  const small = window.innerWidth < 600;
  const useImages = stars.length <= (small ? 100 : 500);
  const pad = 46;

  for (const s of stars) {
    const pos = starPosition(s.id, window.innerWidth, window.innerHeight, pad);
    const r = recencyFrac(s.ts, start, end);
    const op = (0.3 + r * 0.7).toFixed(2);
    let el;
    if (useImages) {
      const size = 10 + r * 26;
      const idx = starImageIndex(s.id, STAR_SRCS.length);
      el = document.createElement("img");
      el.className = "star";
      el.src = starSrc(idx);
      el.addEventListener("error", () => { el.src = STAR_FALLBACKS[idx % STAR_FALLBACKS.length]; }, { once: true });
      el.style.width = size + "px";
      el.style.height = size + "px";
    } else {
      const d = (2 + r * 5) * 2;
      el = document.createElement("div");
      el.className = "star-dot";
      el.style.width = d + "px";
      el.style.height = d + "px";
    }
    el.style.left = pos.x + "px";
    el.style.top = pos.y + "px";
    el.style.opacity = op;
    const text = s.text, when = formatDateTime(s.ts);
    el.addEventListener("mouseenter", () => showTip(text, when, pos.x, pos.y));
    el.addEventListener("mouseleave", hideTip);
    starmapEl.appendChild(el);
  }
}
function showTip(text, when, x, y) {
  tooltipEl.innerHTML = "";
  tooltipEl.append(document.createTextNode(text));
  const d = document.createElement("span");
  d.className = "tt-date"; d.textContent = when;
  tooltipEl.appendChild(d);
  tooltipEl.style.left = x + "px";
  tooltipEl.style.top = y + "px";
  tooltipEl.classList.remove("hidden");
}
function hideTip() { tooltipEl.classList.add("hidden"); }

// ---------- compose ----------
function renderThoughtChips() {
  thoughtChips.innerHTML = "";
  thoughts.forEach((t, i) => {
    const chip = document.createElement("span");
    chip.className = "thought-chip";
    chip.append(document.createTextNode(t));
    const x = document.createElement("button");
    x.className = "x"; x.type = "button"; x.textContent = "×";
    x.addEventListener("click", () => { thoughts.splice(i, 1); renderThoughtChips(); });
    chip.appendChild(x);
    thoughtChips.appendChild(chip);
  });
}
thoughtInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const v = thoughtInput.value.trim();
    if (v) { thoughts.push(v); thoughtInput.value = ""; renderThoughtChips(); }
  }
});
function renderCircumplex() {
  for (const q of QUADRANTS) {
    const cell = circumplexEl.querySelector(`.cx-cell[data-q="${q}"]`);
    if (!cell) continue;
    const meta = QUADRANT_META[q];
    cell.innerHTML = "";
    for (const name of (feelings[q] || [])) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cx-chip" + (selectedMood === name ? " on" : "");
      chip.textContent = name;
      chip.style.color = meta.text;
      chip.style.borderColor = meta.border;
      if (selectedMood === name) chip.style.background = meta.text;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedMood = selectedMood === name ? "" : name;
        renderCircumplex();
      });
      cell.appendChild(chip);
    }
  }
}
function bindCircumplexCells() {
  for (const q of QUADRANTS) {
    const cell = circumplexEl.querySelector(`.cx-cell[data-q="${q}"]`);
    if (!cell) continue;
    cell.addEventListener("click", (e) => {
      if (e.target === cell) addFeelingInline(cell, q); // clicked empty space, not a chip
    });
  }
}
function addFeelingInline(cell, q) {
  const existing = cell.querySelector(".cx-add");
  if (existing) { existing.focus(); return; }
  const meta = QUADRANT_META[q];
  const input = document.createElement("input");
  input.className = "cx-add"; input.type = "text"; input.placeholder = "name it…";
  input.style.color = meta.text;
  cell.appendChild(input);
  input.focus();
  let done = false;
  const commit = async () => {
    if (done) return; done = true;
    const name = input.value.trim();
    input.remove();
    if (!name) return;
    if (!feelings[q]) feelings[q] = [];
    if (!feelings[q].includes(name)) feelings[q].push(name);
    await saveFeelings(feelings);
    selectedMood = name;
    renderCircumplex();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { done = true; input.remove(); }
  });
  input.addEventListener("blur", commit);
}

function resetFields() {
  thoughts = []; renderThoughtChips();
  bodyInput.value = ""; selectedMood = "";
  renderCircumplex();
}
function openCompose() {
  composeOverlay.classList.add("open");
  modalOpen = true; updateWand();
  thoughtInput.focus();
}
function closeCompose() {
  composeOverlay.classList.remove("open");
  modalOpen = false; updateWand();
}
async function saveReflection() {
  const body = bodyInput.value.trim();
  const mood = selectedMood;
  if (thoughts.length || body || mood) {
    reflectionLog.unshift({ id: genId("r"), ts: Date.now(), thoughts: thoughts.slice(), body, mood });
    await saveReflectionLog(reflectionLog);
    renderStars();
  }
  resetFields();
  closeCompose();
}
saveBtn.addEventListener("click", saveReflection);
composeClose.addEventListener("click", () => { resetFields(); closeCompose(); });
composeOverlay.addEventListener("click", (e) => { if (e.target === composeOverlay) { resetFields(); closeCompose(); } });

// ---------- continue (skip to the break-length screen) ----------
function proceed() {
  if (!targetUrl) return;
  location.replace(
    chrome.runtime.getURL("commit.html") +
    "?url=" + encodeURIComponent(targetUrl) +
    "&group=" + encodeURIComponent(groupId)
  );
}
continueBtn.addEventListener("click", proceed);

// ---------- window toggle ----------
function paintToggle() {
  winToggle.querySelectorAll(".win-btn").forEach((b) => {
    b.classList.toggle("on", parseInt(b.dataset.m, 10) === windowMonths);
  });
}
winToggle.querySelectorAll(".win-btn").forEach((b) => {
  b.addEventListener("click", async () => {
    windowMonths = parseInt(b.dataset.m, 10);
    await saveWindowMonths(windowMonths);
    paintToggle();
    renderStars();
  });
});

// native cursor over the always-visible controls
nativeCursorZone(continueBtn);
nativeCursorZone(winToggle);

// ---------- init ----------
(async function init() {
  setupCanvas();
  requestAnimationFrame(trailFrame);

  wandEl.src = "images/wand.png";
  wandEl.addEventListener("error", () => { wandEl.src = WAND_FALLBACK; }, { once: true });

  let settings = null;
  try { settings = await chrome.runtime.sendMessage({ type: "getSettings" }); } catch (e) {}
  if (settings) applyBackground(settings.background);
  washFromBg();

  feelings = await ensureSeededFeelings();
  bindCircumplexCells();
  renderCircumplex();
  windowMonths = await loadWindowMonths();
  paintToggle();
  reflectionLog = await loadReflectionLog();
  renderStars();
})();
