const params = new URLSearchParams(location.search);
const targetUrl = params.get("url");
const groupId = params.get("group") || "";

const trailCanvas = document.getElementById("trail");
const skymapCanvas = document.getElementById("skymap");
const tooltipEl = document.getElementById("tooltip");
const composeOverlay = document.getElementById("compose-overlay");
const composeClose = document.getElementById("compose-close");
const wandEl = document.getElementById("wand");
const twinkleEl = document.getElementById("twinkle");
const thoughtInput = document.getElementById("thought-input");
const thoughtChips = document.getElementById("thought-chips");
const bodyFig = document.getElementById("body-fig");
const bodyDots = document.getElementById("body-dots");
const bodyTagsEl = document.getElementById("body-tags");
const bodyHint = document.getElementById("body-hint");
const circumplexEl = document.getElementById("circumplex");
const saveBtn = document.getElementById("save-btn");
const continueBtn = document.getElementById("continue-btn");
const winToggle = document.getElementById("window-toggle");
const bottomEl = document.getElementById("bottom");
const composeEl = document.getElementById("compose");
const celebrateEl = document.getElementById("celebrate");
const celebrateStar = document.getElementById("celebrate-star");
const celebrateMsg = document.getElementById("celebrate-msg");
const celebrateName = document.getElementById("celebrate-name");
const celebrateContinue = document.getElementById("celebrate-continue");

// The merged pause countdown greys both buttons until it finishes.
continueBtn.disabled = true;
saveBtn.disabled = true;

const WAND_SMALL = 120;             // resting size on the star map (uses images/wand-120.png)
const WAND_LARGE = 250;             // when you shake to summon a star (uses images/wand.png)
let wandSize = WAND_SMALL;          // current size, animated between the two
// ===== Tunables — tweak these numbers and reload to taste =====
const TIP_X = 0.36, TIP_Y = 0.25;   // wand star hotspot (fraction of the image) — where the pointer sits on the wand
const TRAIL_OFFSET_X = -6;          // shift the trail from the pointer: negative = LEFT
const TRAIL_OFFSET_Y = -18;         // negative = UP, so the trail rides above the star
// ==============================================================

// ===== Body-map dots — position of each part on the rabbit, as a fraction of the
// figure (x: 0 = left → 1 = right, y: 0 = top → 1 = bottom). Nudge to reposition a dot. =====
const BODY_POINTS = [
  { part: "listen",       x: 0.207, y: 0.313 }, // the big ear  (155, 485)
  { part: "neck",         x: 0.571, y: 0.276 }, // (428, 428)
  { part: "shoulder",     x: 0.604, y: 0.331 }, // (453, 513)
  { part: "chest & heart",x: 0.773, y: 0.358 }, // (580, 555)
  { part: "arm",          x: 0.436, y: 0.41 },  // (327, 635)
  { part: "touch",        x: 0.207, y: 0.516 }, // the hand  (155, 800)
  { part: "belly / gut",  x: 0.88, y: 0.49 },   // (660, 760)
  { part: "lower back",   x: 0.544, y: 0.491 }, // (408, 761)
  { part: "spine",        x: 0.369, y: 0.65 },  // the puff  (277, 1007)
  { part: "leg",          x: 0.604, y: 0.742 }, // (453, 1150)
  { part: "feet",         x: 0.601, y: 0.965 }, // (451, 1495)
];
// The crowded head senses share one cluster that fans them out to choose.
const FACE_CLUSTER = { x: 0.667, y: 0.143, members: ["see", "smell", "taste", "head area"] }; // (500, 222)
// The five senses (plus head area) get the pink "sense" styling.
const SENSE_PARTS = ["see", "smell", "taste", "head area", "listen", "touch"];
const NEAR_FRAC = 0.34;             // how close (× figure width) the cursor must be to light a dot
// ==============================================================

let thoughts = [];
let bodyTags = [];          // [{ part, note }] — body-map tags, up to BODY_MAX
const BODY_MAX = 3;
let bodyDotEls = [];
let bodyFaceEl = null;
let bodyFaceOpen = false;   // hysteresis so the face popover stays open while you reach its chips
let selectedMoods = [];     // [{ q, name }] — up to MOOD_MAX, ranked on save
const MOOD_MAX = 3;
// rank order: positive-high, negative-high, positive-low, negative-low; then A-Z within a quadrant
const MOOD_Q_RANK = { tr: 0, tl: 1, br: 2, bl: 3 };
let windowMonths = 1;
let reflectionLog = [];
let feelings = {};

let reduceMotion = false;   // e-ink / reduced-motion: no trail, sparkles, or twinkle

// planetarium sky + its drag-to-pan state
let sky = null;
let skyDragging = false;
let appSettings = null;     // cached settings (for forceBreak routing on proceed)
let celebrating = false;    // save celebration playing → hide wand, freeze the sky
let lastSummonSrc = "";     // the star image you summoned, reused in the celebration
let isLightBg = false;      // light star-map background → draw the wand trail/sparkles in dark warm ink
let skyLastX = 0, skyLastY = 0;
let skyRaf = 0;             // coalesces pan/zoom redraws to one per animation frame

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

const STAR_COUNT = 21;
const STAR_SRCS = Array.from({ length: STAR_COUNT }, (_, i) => "images/stars-" + String(i + 1).padStart(3, "0") + ".png");
function starSrc(i) {
  try { return chrome.runtime.getURL(STAR_SRCS[i]); } catch (e) { return STAR_SRCS[i]; }
}

// ---------- wand visibility (native cursor over UI / while the modal is open) ----------
let overUI = false;     // pointer over a UI control
let modalOpen = false;  // compose modal showing
function uiActive() { return overUI || modalOpen || celebrating; }
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
  if (!uiActive() && !reduceMotion) {
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

  wandEl.style.transform = `translate(${curX - TIP_X * wandSize}px, ${curY - TIP_Y * wandSize}px)`;
  twinkleEl.style.setProperty("--pos", `translate(${curX}px, ${curY}px)`);

  if (!uiActive() && !reduceMotion && distAccum > 46) {
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
  if (!modalOpen && !celebrating && !centerStar && !skyDragging && t - lastSummon > 3500 && shakeMoves.length >= 6) {
    let path = 0;
    for (let i = 1; i < shakeMoves.length; i++) {
      path += Math.hypot(shakeMoves[i].x - shakeMoves[i - 1].x, shakeMoves[i].y - shakeMoves[i - 1].y);
    }
    const a = shakeMoves[0], b = shakeMoves[shakeMoves.length - 1];
    const net = Math.hypot(b.x - a.x, b.y - a.y);
    if (path > 650 && net < path * 0.45) { lastSummon = t; summonStar(); }
  }

  // hover one of your reflection-stars → show its note + the real star's name
  if (sky && sky.isLoaded() && !skyDragging && !uiActive()) {
    const info = sky.hitTest(curX, curY);
    if (info) showTip(info.text, formatDateTime(info.ts) + " · " + info.name, curX, curY);
    else hideTip();
  }
}
window.addEventListener("pointermove", onMove, { passive: true });

// Grow the wand to WAND_LARGE while a summoned star is on screen; shrink back after.
// Animated per-frame (repositioning each step) so the tip stays pinned to the cursor.
let wandAnim = null;
function growWand(big) {
  const target = big ? WAND_LARGE : WAND_SMALL;
  wandEl.src = big ? "images/wand.png" : "images/wand-120.png";
  if (reduceMotion) {                       // instant, no animation, on e-ink
    wandSize = target;
    wandEl.style.width = target + "px"; wandEl.style.height = target + "px";
    if (curX > -200) wandEl.style.transform = `translate(${curX - TIP_X * wandSize}px, ${curY - TIP_Y * wandSize}px)`;
    return;
  }
  const start = wandSize, t0 = performance.now(), dur = 170;
  if (wandAnim) cancelAnimationFrame(wandAnim);
  function step(now) {
    const k = Math.min(1, (now - t0) / dur);
    wandSize = start + (target - start) * (1 - Math.pow(1 - k, 3));   // ease-out
    wandEl.style.width = wandSize + "px";
    wandEl.style.height = wandSize + "px";
    if (curX > -200) wandEl.style.transform = `translate(${curX - TIP_X * wandSize}px, ${curY - TIP_Y * wandSize}px)`;
    if (k < 1) wandAnim = requestAnimationFrame(step);
  }
  wandAnim = requestAnimationFrame(step);
}

function summonStar() {
  if (centerStar) return;
  growWand(true);                       // magic activates → wand grows large
  const img = document.createElement("img");
  img.className = "summon-star";
  img.alt = ""; img.title = "Open a reflection";
  const n = Math.floor(Math.random() * STAR_SRCS.length);
  img.src = starSrc(n);
  lastSummonSrc = img.src;
  img.addEventListener("error", () => { img.src = STAR_FALLBACKS[n % STAR_FALLBACKS.length]; }, { once: true });
  centerStar = img;
  document.body.appendChild(img);
  nativeCursorZone(img);
  const dismiss = () => {
    if (!centerStar) return;
    clearTimeout(centerStar._t);
    centerStar.remove();
    centerStar = null;
    growWand(false);                    // shrink back to the resting size
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
  ctx.strokeStyle = isLightBg ? "rgba(150,85,5,0.95)" : "rgba(255,225,150,0.95)";
  ctx.lineWidth = Math.max(1, s * 0.5);
  ctx.lineCap = "round";
  ctx.shadowBlur = 8; ctx.shadowColor = isLightBg ? "rgba(150,85,5,0.55)" : "rgba(255,210,120,0.95)";
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
        ctx.strokeStyle = isLightBg ? "rgba(200,120,15,0.3)" : "rgba(255,205,110,0.22)";
        ctx.lineWidth = 16; ctx.shadowBlur = 18; ctx.shadowColor = isLightBg ? "rgba(190,110,15,0.5)" : "rgba(255,200,110,0.55)";
        strokeNewRibbonSegments();

        // Pass 2: thin bright core (identical geometry)
        prevMid = passStartMid; strokedCtrlIdx = passStartCtrl;
        ctx.strokeStyle = isLightBg ? "rgba(150,80,5,0.95)" : "rgba(255,236,175,0.9)";
        ctx.lineWidth = 5; ctx.shadowBlur = 8; ctx.shadowColor = isLightBg ? "rgba(190,110,15,0.5)" : "rgba(255,200,110,0.55)";
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

window.addEventListener("resize", () => { setupCanvas(); if (sky) sky.setSize(); washFromBg(); renderStars(); });

// ---------- star map (real planetarium sky; reflections pinned to real stars) ----------
function renderStars() {
  if (!sky || !sky.isLoaded()) return;
  const { stars } = reflectionStars(reflectionLog, windowMonths, Date.now());
  sky.setReflections(stars, windowMonths, Date.now());
  sky.render(false);
}

// drag to pan the dome, wheel to zoom
function onSkyDown(e) {
  if (uiActive()) return;
  skyDragging = true;
  skyLastX = e.clientX; skyLastY = e.clientY;
  try { skymapCanvas.setPointerCapture(e.pointerId); } catch (_) {}
}
function scheduleSky(fast) {            // many pointermove/wheel events → one redraw per frame
  if (skyRaf) return;
  skyRaf = requestAnimationFrame(() => { skyRaf = 0; if (sky) sky.render(fast); });
}
function onSkyDrag(e) {
  if (!skyDragging || !sky) return;
  sky.pan(e.clientX - skyLastX, e.clientY - skyLastY);
  skyLastX = e.clientX; skyLastY = e.clientY;
  hideTip();
  scheduleSky(true);                      // fast (stars + lines) while dragging
}
function onSkyUp(e) {
  if (!skyDragging) return;
  skyDragging = false;
  try { skymapCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
  if (skyRaf) { cancelAnimationFrame(skyRaf); skyRaf = 0; }   // drop a pending fast frame
  if (sky) sky.render(false);             // full render (Milky Way + labels) on settle
}
function onSkyWheel(e) {
  if (uiActive() || !sky) return;
  e.preventDefault();
  sky.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
  scheduleSky(false);
}
skymapCanvas.addEventListener("pointerdown", onSkyDown);
skymapCanvas.addEventListener("pointermove", onSkyDrag);
window.addEventListener("pointerup", onSkyUp);
skymapCanvas.addEventListener("wheel", onSkyWheel, { passive: false });
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
// Drag `handle` to reorder `list`; `target` gets the .dragging class and is the drop zone.
function makeReorderable(handle, target, list, index, rerender) {
  handle.draggable = true;
  handle.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    target.classList.add("dragging");
  });
  handle.addEventListener("dragend", () => target.classList.remove("dragging"));
  target.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
  target.addEventListener("drop", (e) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(from) || from === index) return;
    const [moved] = list.splice(from, 1);
    list.splice(from < index ? index - 1 : index, 0, moved);   // exact drop position
    rerender();
  });
}

function renderThoughtChips() {
  thoughtChips.innerHTML = "";
  thoughts.forEach((t, i) => {
    const chip = document.createElement("span");
    chip.className = "thought-chip";
    const grip = document.createElement("span");
    grip.className = "drag-grip"; grip.textContent = "⠿"; grip.title = "Drag to reorder";
    chip.appendChild(grip);
    chip.append(document.createTextNode(t));
    const x = document.createElement("button");
    x.className = "x"; x.type = "button"; x.textContent = "×";
    x.addEventListener("click", () => { thoughts.splice(i, 1); renderThoughtChips(); });
    chip.appendChild(x);
    makeReorderable(grip, chip, thoughts, i, renderThoughtChips);   // drag the grip to reorder
    thoughtChips.appendChild(chip);
  });
  refreshSaveLabel();
}
thoughtInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const v = thoughtInput.value.trim();
    if (v) { thoughts.push(v); thoughtInput.value = ""; renderThoughtChips(); }
  }
});

// ---------- body map (hover the rabbit → dots reveal labels; tap to tag, jot words, up to BODY_MAX) ----------
function syncBodyDots() {
  const sel = new Set(bodyTags.map((t) => t.part));
  bodyDotEls.forEach((d) => d.classList.toggle("on", sel.has(d.dataset.part)));
  if (bodyFaceEl) {
    bodyFaceEl.querySelectorAll(".bface-chip").forEach((c) => c.classList.toggle("on", sel.has(c.dataset.part)));
    bodyFaceEl.querySelector(".bface-anchor").classList.toggle("on", FACE_CLUSTER.members.some((m) => sel.has(m)));
  }
}
function renderBodyTags() {
  bodyTagsEl.innerHTML = "";
  bodyTags.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "body-tag";
    if (SENSE_PARTS.includes(t.part) && t.part !== "head area") row.classList.add("sense"); // pink box for the five senses
    const head = document.createElement("div");
    head.className = "body-tag-head";
    const grip = document.createElement("span");
    grip.className = "drag-grip"; grip.textContent = "⠿"; grip.title = "Drag to reorder";
    const name = document.createElement("span");
    name.className = "body-tag-name";
    name.textContent = t.part;
    const x = document.createElement("button");
    x.className = "x"; x.type = "button"; x.textContent = "×";
    x.addEventListener("click", () => { bodyTags.splice(i, 1); renderBodyTags(); });
    head.appendChild(grip); head.appendChild(name); head.appendChild(x);
    const note = document.createElement("input");
    note.type = "text"; note.autocomplete = "off"; note.draggable = false;
    note.placeholder = "words for this… (optional)";
    note.value = t.note || "";
    note.addEventListener("input", () => { t.note = note.value; });
    row.appendChild(head); row.appendChild(note);
    makeReorderable(grip, row, bodyTags, i, renderBodyTags);   // drag the grip to reorder
    bodyTagsEl.appendChild(row);
  });
  syncBodyDots();
  refreshSaveLabel();
}
function toggleBodyPart(part) {
  const idx = bodyTags.findIndex((t) => t.part === part);
  if (idx >= 0) { bodyTags.splice(idx, 1); renderBodyTags(); return; }
  if (bodyTags.length >= BODY_MAX) {
    if (bodyHint) {                       // gentle "you're at 3" flash
      bodyHint.classList.remove("limit");
      void bodyHint.offsetWidth;          // restart the animation
      bodyHint.classList.add("limit");
    }
    return;
  }
  bodyTags.push({ part, note: "" });
  renderBodyTags();
  // put the caret straight into the new tag's note box so you can type immediately
  const inputs = bodyTagsEl.querySelectorAll(".body-tag input");
  if (inputs.length) inputs[inputs.length - 1].focus();
}
function makeDot(part, x, y) {
  const dot = document.createElement("button");
  dot.type = "button";
  dot.className = "bdot";
  dot.style.left = (x * 100) + "%";
  dot.style.top = (y * 100) + "%";
  dot.dataset.part = part;
  if (SENSE_PARTS.includes(part)) dot.classList.add("sense");   // pink label for senses
  dot._fx = x; dot._fy = y;
  const lbl = document.createElement("span");
  lbl.className = "bdot-label"; lbl.textContent = part;
  dot.appendChild(lbl);
  return dot;
}
function renderBodyDots() {
  bodyDots.innerHTML = "";
  bodyDotEls = [];
  for (const p of BODY_POINTS) {
    const dot = makeDot(p.part, p.x, p.y);
    dot.addEventListener("click", (e) => { e.stopPropagation(); toggleBodyPart(p.part); });
    bodyDots.appendChild(dot);
    bodyDotEls.push(dot);
  }
  // crowded face senses → one cluster anchor that opens see / smell / taste together
  bodyFaceEl = document.createElement("div");
  bodyFaceEl.className = "bface";
  bodyFaceEl.style.left = (FACE_CLUSTER.x * 100) + "%";
  bodyFaceEl.style.top = (FACE_CLUSTER.y * 100) + "%";
  const anchor = document.createElement("span");
  anchor.className = "bdot bface-anchor";
  bodyFaceEl.appendChild(anchor);
  // head area opens to the LEFT of the dot, the three senses to the RIGHT, so their text never overlaps
  const popR = document.createElement("div");
  popR.className = "bface-pop bface-pop-right";
  const popL = document.createElement("div");
  popL.className = "bface-pop bface-pop-left";
  for (const m of FACE_CLUSTER.members) {
    const chip = document.createElement("button");
    chip.type = "button"; chip.className = "bface-chip"; chip.textContent = m; chip.dataset.part = m;
    chip.addEventListener("click", (e) => { e.stopPropagation(); toggleBodyPart(m); });
    (m === "head area" ? popL : popR).appendChild(chip);
  }
  bodyFaceEl.appendChild(popR);
  bodyFaceEl.appendChild(popL);
  bodyDots.appendChild(bodyFaceEl);
  syncBodyDots();
}
function onBodyFigMove(e) {
  const rect = bodyFig.getBoundingClientRect();
  if (!rect.width) return;
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const near = NEAR_FRAC * rect.width;
  const faceDist = Math.hypot(px - FACE_CLUSTER.x * rect.width, py - FACE_CLUSTER.y * rect.height);
  let best = null, bestD = Infinity;
  for (const d of bodyDotEls) {
    const dist = Math.hypot(px - d._fx * rect.width, py - d._fy * rect.height);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  // Keep the popover open while the pointer is actually over it, so every chip (see / smell /
  // taste / head area) is reachable without the cluster closing and a body dot popping up under it.
  let overPop = false;
  if (bodyFaceOpen && bodyFaceEl) {
    for (const pop of bodyFaceEl.querySelectorAll(".bface-pop")) {
      const pr = pop.getBoundingClientRect();
      if (e.clientX >= pr.left - 10 && e.clientX <= pr.right + 10 &&
          e.clientY >= pr.top - 10 && e.clientY <= pr.bottom + 10) { overPop = true; break; }
    }
  }
  // open when the cluster is the closest target; stay open while over the popover or near the centre
  bodyFaceOpen = overPop || (bodyFaceOpen ? (faceDist < near * 1.7) : (faceDist < near && faceDist <= bestD));
  if (bodyFaceEl) bodyFaceEl.classList.toggle("open", bodyFaceOpen);
  bodyDotEls.forEach((d) => d.classList.toggle("near", !bodyFaceOpen && d === best && bestD < near));
}
function clearBodyNear() {
  bodyDots.classList.remove("active");   // hide all dots once the cursor leaves the rabbit
  bodyDotEls.forEach((d) => d.classList.remove("near"));
  bodyFaceOpen = false;
  if (bodyFaceEl) bodyFaceEl.classList.remove("open");
}
function bindBodyMap() {
  renderBodyDots();
  bodyFig.addEventListener("pointerenter", () => bodyDots.classList.add("active"));
  bodyFig.addEventListener("pointermove", (e) => { bodyDots.classList.add("active"); onBodyFigMove(e); });
  bodyFig.addEventListener("pointerleave", clearBodyNear);
}

function moodOn(q, name) { return selectedMoods.some((m) => m.q === q && m.name === name); }
function toggleMood(q, name) {
  const idx = selectedMoods.findIndex((m) => m.q === q && m.name === name);
  if (idx >= 0) { selectedMoods.splice(idx, 1); renderCircumplex(); return; }
  if (selectedMoods.length >= MOOD_MAX) return;   // up to 3
  selectedMoods.push({ q, name });
  renderCircumplex();
}
function sortedMoods() {                            // rank: quadrant order, then A-Z
  return selectedMoods.slice().sort((a, b) => {
    const r = (MOOD_Q_RANK[a.q] ?? 9) - (MOOD_Q_RANK[b.q] ?? 9);
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });
}
function renderCircumplex() {
  for (const q of QUADRANTS) {
    const cell = circumplexEl.querySelector(`.cx-cell[data-q="${q}"]`);
    if (!cell) continue;
    const meta = QUADRANT_META[q];
    cell.innerHTML = "";
    for (const name of (feelings[q] || [])) {
      const on = moodOn(q, name);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cx-chip" + (on ? " on" : "");
      chip.textContent = name;
      chip.style.color = meta.text;
      chip.style.borderColor = meta.text;
      if (on) chip.style.background = meta.text;
      chip.addEventListener("click", (e) => { e.stopPropagation(); toggleMood(q, name); });
      cell.appendChild(chip);
    }
  }
  refreshSaveLabel();
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
    if (!moodOn(q, name) && selectedMoods.length < MOOD_MAX) selectedMoods.push({ q, name });
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
  bodyTags = []; renderBodyTags();
  selectedMoods = [];
  renderCircumplex();
}
function openCompose() {
  composeOverlay.classList.add("open");
  if (bottomEl) bottomEl.classList.add("hide");   // hide the screen's Continue while a star is open
  modalOpen = true; updateWand();
  thoughtInput.focus();
}
function closeCompose() {
  composeOverlay.classList.remove("open");
  if (bottomEl) bottomEl.classList.remove("hide");
  modalOpen = false; updateWand();
}
// The Save button is themed: it lights a star when there's something to save, and reads
// "Continue" when the reflection is empty (then it just proceeds, lighting nothing).
function reflectionHasContent() {
  return thoughts.length > 0 || bodyTags.length > 0 || selectedMoods.length > 0;
}
function saveLabel() { return reflectionHasContent() ? "Light this star ✨" : "Continue"; }
function refreshSaveLabel() { if (pauseDone && !celebrating) saveBtn.textContent = saveLabel(); }

async function saveReflection() {
  if (!pauseDone || celebrating) return;           // gated by the countdown; ignore double clicks
  if (targetUrl) { openRank(); return; }           // the unlock flow passes the front door
  const body = bodyTags
    .map((t) => ({ part: t.part, note: (t.note || "").trim() }))
    .filter((t) => t.part);
  const mood = sortedMoods().map((m) => m.name);   // ranked feeling names, up to 3
  if (!reflectionHasContent()) {
    resetFields(); closeCompose(); proceed(); return;   // nothing written → behave like Continue
  }
  const entry = { id: genId("r"), ts: Date.now(), thoughts: thoughts.slice(), body, mood };
  reflectionLog.unshift(entry);
  await saveReflectionLog(reflectionLog);
  renderStars();                                   // re-place: the new star is now in the sky
  await clearPauseRemaining();
  celebrate(entry.id);
}
saveBtn.addEventListener("click", saveReflection);

// ---- the front door (Android parity): a thought AND the aim it serves ----
// Both doors light the star; only the chosen one decides where you go next.
const rankEl = document.getElementById("rank");
const rankPillsEl = document.getElementById("rank-pills");
const rankKeyEl = document.getElementById("rank-key");
const rankGoalEcho = document.getElementById("rank-goal-echo");
const rankNewEl = document.getElementById("rank-new");
const rankGoalEl = document.getElementById("rank-goal");
const rankUnlockBtn = document.getElementById("rank-unlock");
const rankElseBtn = document.getElementById("rank-else");
let rankKey = null;
let rankIsNew = false;
let rankIntentUnlock = true;
let rankSaving = false;

function rankReady() { return !!rankKey && rankGoalEl.value.trim().length > 0; }

function refreshRank() {
  rankKeyEl.textContent = rankKey || "…";
  rankKeyEl.style.opacity = rankKey ? "1" : "0.4";
  const g = rankGoalEl.value.trim();
  rankGoalEcho.textContent = g ? "for: " + g : "";
  rankUnlockBtn.disabled = !rankReady();
  rankElseBtn.disabled = !rankReady();
}

function openRank() {
  try { rankUnlockBtn.textContent = "I'll unlock " + new URL(targetUrl).hostname.replace(/^www\./, ""); }
  catch (e) { rankUnlockBtn.textContent = "I'll unlock this site"; }
  rankPillsEl.innerHTML = "";
  for (const t of thoughts) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rank-pill";
    b.textContent = t;
    b.addEventListener("click", () => {
      rankKey = t; rankIsNew = false; rankNewEl.value = "";
      rankPillsEl.querySelectorAll(".rank-pill").forEach((p) => p.classList.toggle("on", p === b));
      refreshRank();
    });
    rankPillsEl.appendChild(b);
  }
  refreshRank();
  rankEl.classList.remove("hidden");
  if (!thoughts.length) rankNewEl.focus();
}

rankNewEl.addEventListener("input", () => {
  const v = rankNewEl.value.trim();
  if (v) {
    rankKey = v; rankIsNew = true;
    rankPillsEl.querySelectorAll(".rank-pill").forEach((p) => p.classList.remove("on"));
  } else if (rankIsNew) {
    rankKey = null;
  }
  refreshRank();
});
rankGoalEl.addEventListener("input", refreshRank);

async function finishRank(unlock) {
  if (!rankReady() || rankSaving) return;
  rankSaving = true;
  rankIntentUnlock = unlock;
  const key = rankKey;
  const goal = rankGoalEl.value.trim();
  if (rankIsNew && !thoughts.includes(key)) thoughts.push(key);
  const body = bodyTags
    .map((t) => ({ part: t.part, note: (t.note || "").trim() }))
    .filter((t) => t.part);
  const mood = sortedMoods().map((m) => m.name);
  const entry = {
    id: genId("r"), ts: Date.now(), thoughts: thoughts.slice(), body, mood,
    keyThought: key + " · " + goal
  };
  reflectionLog.unshift(entry);
  await saveReflectionLog(reflectionLog);
  renderStars();
  await clearPauseRemaining();
  rankEl.classList.add("hidden");
  rankSaving = false;
  celebrate(entry.id);
}

rankUnlockBtn.addEventListener("click", () => finishRank(true));
rankElseBtn.addEventListener("click", () => finishRank(false));

// The compose shrinks into the summoned star, which is then carried to its real
// place in the sky; its real name and a thank-you line fade in. A "Continue" goes on.
// Reduced-motion users get the same moment without the scale pop or the eased pan.
function celebrate(id) {
  if (celebrating) return;
  celebrating = true;
  document.body.classList.add("celebrating");   // restore a normal cursor (the wand is hidden now)
  saveBtn.disabled = true; continueBtn.disabled = true;   // no second submit
  modalOpen = false;
  updateWand();
  hideTip();
  const ref = sky ? sky.getRef(id) : null;

  const reveal = () => {
    if (!reduceMotion) { celebrateStar.classList.remove("pop"); celebrateStar.classList.add("settle"); }
    celebrateName.textContent = ref ? ref.name : "in your sky";
    celebrateMsg.classList.add("show");
    celebrateContinue.classList.add("show");
  };

  const land = () => {
    if (lastSummonSrc) celebrateStar.src = lastSummonSrc;
    celebrateEl.classList.remove("hidden");
    celebrateStar.classList.remove("pop", "settle", "static");
    if (reduceMotion) {
      celebrateStar.classList.add("static");        // present at full size, no scale pop
      if (ref && sky) { sky.setCenter(ref.ra, ref.dec); sky.render(false); }
      setTimeout(reveal, 250);
    } else {
      void celebrateStar.offsetWidth;               // restart the pop keyframes
      celebrateStar.classList.add("pop");
      if (ref && sky && sky.animateTo) sky.animateTo(ref.ra, ref.dec, 1400, reveal);
      else setTimeout(reveal, 500);
    }
  };

  if (reduceMotion) {
    composeOverlay.classList.remove("open");        // no shrink animation on e-ink
    land();
  } else {
    composeEl.classList.add("shrink");              // shrink the card toward the centre
    setTimeout(() => {
      composeOverlay.classList.remove("open");
      composeEl.classList.remove("shrink");
      land();
    }, 480);
  }
}
// Return to the live screen when there is nowhere to go (e.g. opened without a target),
// so the wand and the shake-to-summon keep working instead of leaving you stuck here.
function dismissCelebration() {
  celebrating = false;
  document.body.classList.remove("celebrating");
  celebrateEl.classList.add("hidden");
  celebrateStar.classList.remove("pop", "settle", "static");
  celebrateMsg.classList.remove("show");
  celebrateContinue.classList.remove("show");
  resetFields();
  if (bottomEl) bottomEl.classList.remove("hide");
  updateWand();
}
celebrateContinue.addEventListener("click", () => {
  // The else-door still lights the star, but leads away instead of onward.
  if (targetUrl && !rankIntentUnlock) { location.replace("about:blank"); return; }
  if (targetUrl) proceed(); else dismissCelebration();
});
composeClose.addEventListener("click", () => { resetFields(); closeCompose(); });
composeOverlay.addEventListener("click", (e) => { if (e.target === composeOverlay) { resetFields(); closeCompose(); } });

// ---------- merged pause countdown (replaces the separate hold page) ----------
// Both Continue and Save stay grey, showing "(in Ns)", until this counts down the
// group's pause length. It pauses when the page loses focus and resumes where it
// left off (persisted per group, so a reload resumes too).
let pauseTotalMs = 10000;
let pauseRemaining = 10000;
let pauseDone = false;
let pauseRaf = 0;
let pauseLastTick = 0;
let pauseReady = false;     // true once the persisted remaining is loaded (guards early saves)

function holdMode() { return !!(appSettings && appSettings.holdToContinue); }
let holdActive = false;

function countdownCanRun() {
  if (holdMode() && !holdActive) return false;   // hold-to-count-down: only while pressed
  return !document.hidden;   // tick whenever the tab is visible; a visible-but-unfocused window must not freeze it (app-switch still pauses via the blur listener)
}

function paintCountdown() {
  if (pauseDone) {
    continueBtn.textContent = "Continue →";
    saveBtn.textContent = saveLabel();
    continueBtn.disabled = false;
    saveBtn.disabled = false;
    return;
  }
  const secs = Math.max(0, Math.ceil(pauseRemaining / 1000));
  if (holdMode()) {
    continueBtn.innerHTML = holdActive
      ? 'Keep holding\u2026 <span class="cd-num">' + secs + '</span>'
      : 'Continue \u00b7 hold (<span class="cd-num">' + secs + '</span>s)';
  } else {
    continueBtn.innerHTML = 'Continue (in <span class="cd-num">' + secs + '</span>s)';
  }
  saveBtn.innerHTML = saveLabel() + ' (in <span class="cd-num">' + secs + '</span>s)';
  continueBtn.disabled = holdMode() ? false : true;   // must stay pressable to hold
  saveBtn.disabled = true;
}

function finishCountdown() {
  pauseRemaining = 0;
  pauseDone = true;
  if (pauseRaf) { cancelAnimationFrame(pauseRaf); pauseRaf = 0; }
  paintCountdown();
  savePauseRemaining(0);
}

function tickCountdown(now) {
  pauseRaf = 0;
  if (pauseDone) return;
  if (!countdownCanRun()) return;            // tab hidden mid-frame → stop (resumes on visible/focus)
  const dt = now - pauseLastTick;
  pauseLastTick = now;
  pauseRemaining -= dt;
  if (pauseRemaining <= 0) { finishCountdown(); return; }
  paintCountdown();
  pauseRaf = requestAnimationFrame(tickCountdown);
}

function startCountdown() {
  if (pauseDone || pauseRaf || !countdownCanRun()) return;
  pauseLastTick = performance.now();
  pauseRaf = requestAnimationFrame(tickCountdown);
}

function haltCountdown() {                    // focus lost → freeze and remember where we are
  if (pauseRaf) { cancelAnimationFrame(pauseRaf); pauseRaf = 0; }
  if (pauseReady && !pauseDone) savePauseRemaining(pauseRemaining);
}

async function loadPauseRemaining(totalMs) {
  try {
    const { pauseCountdowns = {} } = await chrome.storage.local.get("pauseCountdowns");
    const v = pauseCountdowns[groupId];
    if (typeof v === "number" && v >= 0 && v <= totalMs) return v;
  } catch (e) {}
  return totalMs;
}
async function savePauseRemaining(ms) {
  if (!groupId) return;
  try {
    const { pauseCountdowns = {} } = await chrome.storage.local.get("pauseCountdowns");
    pauseCountdowns[groupId] = Math.max(0, Math.round(ms));
    await chrome.storage.local.set({ pauseCountdowns });
  } catch (e) {}
}
async function clearPauseRemaining() {
  if (!groupId) return;
  try {
    const { pauseCountdowns = {} } = await chrome.storage.local.get("pauseCountdowns");
    delete pauseCountdowns[groupId];
    await chrome.storage.local.set({ pauseCountdowns });
  } catch (e) {}
}

// Hold-to-count-down: pressing the Continue button runs the countdown;
// releasing (or sliding off) freezes it, progress kept and persisted.
continueBtn.addEventListener("pointerdown", (e) => {
  if (!holdMode() || pauseDone) return;
  e.preventDefault();
  holdActive = true;
  paintCountdown();
  startCountdown();
});
let suppressHoldClick = false;
const endContinueHold = () => {
  if (!holdActive) return;
  holdActive = false;
  // The release also synthesizes a click; swallow it so finishing the hold
  // still asks for one deliberate click on "Continue →".
  suppressHoldClick = true;
  haltCountdown();
  paintCountdown();
};
continueBtn.addEventListener("pointerup", endContinueHold);
continueBtn.addEventListener("pointercancel", endContinueHold);
continueBtn.addEventListener("pointerleave", endContinueHold);

window.addEventListener("blur", haltCountdown);
window.addEventListener("focus", startCountdown);
document.addEventListener("visibilitychange", () => { if (document.hidden) haltCountdown(); else startCountdown(); });
window.addEventListener("pagehide", () => { if (pauseReady && !pauseDone) savePauseRemaining(pauseRemaining); });

async function initCountdown() {
  const grp = appSettings && appSettings.groups
    ? appSettings.groups.find((g) => g.id === groupId) : null;
  pauseTotalMs = (grp && grp.pauseSeconds ? grp.pauseSeconds : 10) * 1000;
  pauseRemaining = await loadPauseRemaining(pauseTotalMs);
  pauseReady = true;
  pauseDone = pauseRemaining <= 0;
  paintCountdown();
  startCountdown();
}

// ---------- continue / proceed (the countdown gates this) ----------
async function proceed() {
  if (!targetUrl || !pauseDone) return;
  await clearPauseRemaining();
  if (appSettings && appSettings.forceBreak) {
    location.replace(
      chrome.runtime.getURL("commit.html") +    // a break is enforced → commit its length next
      "?url=" + encodeURIComponent(targetUrl) +
      "&group=" + encodeURIComponent(groupId)
    );
    return;
  }
  try { await chrome.runtime.sendMessage({ type: "grantAllowance", groupId }); } catch (e) {}
  location.replace(targetUrl);
}
continueBtn.addEventListener("click", () => {
  if (suppressHoldClick) { suppressHoldClick = false; return; }
  proceed();
});

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

  reduceMotion = (await loadReduceMotion()) ||
    !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduceMotion) document.body.classList.add("reduce-motion");
  if (!reduceMotion) requestAnimationFrame(trailFrame);   // skip the moving trail on e-ink / reduced motion

  wandEl.style.width = WAND_SMALL + "px";
  wandEl.style.height = WAND_SMALL + "px";
  wandEl.src = "images/wand-120.png";   // resting on the star map; grows when you summon a star
  wandEl.addEventListener("error", () => { wandEl.src = WAND_FALLBACK; });

  // The screen stays a night sky (the planetarium needs darkness), but the compose
  // panel follows the pause-page theme — a light card on a light theme.
  const isThemeLight = (bg) => {
    if (!bg) return false;
    if (bg.type === "preset") return bg.value === "white";
    if (bg.type === "custom" && bg.value) {
      const m = /^#?([0-9a-f]{6})$/i.exec(bg.value.trim());
      if (!m) return false;
      const v = parseInt(m[1], 16);
      return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) > 160;
    }
    return false;
  };
  let settings = null;
  try { settings = await chrome.runtime.sendMessage({ type: "getSettings" }); } catch (e) {}
  appSettings = settings;
  if (settings && isThemeLight(settings.background)) document.body.classList.add("compose-light");

  // user-defined star-map background; flip the screen + sky ink to stay readable on light colours
  const starmapBg = await loadStarmapBg();
  document.body.style.background = starmapBg;
  let skyLight = false;
  const bgHex = /^#?([0-9a-f]{6})$/i.exec((starmapBg || "").trim());
  if (bgHex) {
    const bv = parseInt(bgHex[1], 16);
    skyLight = (0.299 * ((bv >> 16) & 255) + 0.587 * ((bv >> 8) & 255) + 0.114 * (bv & 255)) > 150;
  }
  document.body.style.color = skyLight ? "#1a1a1a" : "#fff";
  isLightBg = skyLight;
  if (skyLight) document.body.classList.add("starmap-light");

  washFromBg();
  await initCountdown();

  feelings = await ensureSeededFeelings();
  bindCircumplexCells();
  renderCircumplex();
  bindBodyMap();
  renderBodyTags();
  windowMonths = await loadWindowMonths();
  paintToggle();
  reflectionLog = await loadReflectionLog();

  sky = createSkyMap(skymapCanvas, {});
  sky.setLightMode(skyLight);
  sky.setSize();
  try { await sky.load((p) => chrome.runtime.getURL(p)); } catch (e) {}
  renderStars();
})();
