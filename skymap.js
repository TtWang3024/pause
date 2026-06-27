// Planetarium-dome star map for the reflection screen.
// Renders a real sky (Hipparcos-derived data, bundled under data/) with a
// stereographic projection you can pan + zoom, and pins each reflection to a
// real catalogue star. Self-contained; exposes a global `createSkyMap`.
//
// Data (all [RA°, Dec°]): sky-stars.json [hip,ra,dec,mag,bv] · sky-constellations.json
// [polyline...] · sky-labels.json [name,ra,dec,rank] · sky-starnames.json {hip:name}
// · sky-milkyway.json [{l,p:[ring...]}].

function createSkyMap(canvas, opts) {
  opts = opts || {};
  const D2R = Math.PI / 180;

  // ----- tunables -----
  const BASE_R = 1.0;       // projection radius as a fraction of min(W,H); × zoom
  const ZOOM_MIN = 0.45, ZOOM_MAX = 6, ZOOM_DEFAULT = 1.15;
  const CLIP = -0.35;       // cull points whose cos(angular distance from center) is below this
  const PAN_DEG_PER_PX = 0.16;   // drag sensitivity (÷ zoom)
  const STAR_NAME_ZOOM = 1.7;    // show bright-star proper names above this zoom
  const LABEL_COLOR = "rgba(150,170,225,0.55)";
  const LINE_COLOR  = "rgba(130,160,225,0.28)";

  // ----- state -----
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0;
  let stars = [], lines = [], labels = [], starNames = {}, mw = [];
  let loaded = false;
  let ra0 = 80, dec0 = 0, zoom = ZOOM_DEFAULT;   // view center (RA/Dec) + zoom
  let reflections = [], placed = [], windowMonths = 1, nowTs = 0;
  let drawnRefs = [];        // screen positions of reflection stars, for hit-testing

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return h;
  }

  // B–V colour index → a soft star colour.
  function bvColor(bv) {
    if (bv == null || isNaN(bv)) return [255, 252, 245];
    if (bv < 0.0)  return [200, 220, 255];
    if (bv < 0.3)  return [233, 240, 255];
    if (bv < 0.6)  return [255, 252, 240];
    if (bv < 1.0)  return [255, 244, 214];
    if (bv < 1.5)  return [255, 224, 186];
    return [255, 200, 168];
  }

  async function load(getURL) {
    const url = (f) => (getURL ? getURL("data/" + f) : "data/" + f);
    const grab = (f) => fetch(url(f)).then((r) => r.json());
    const [s, l, lb, nm, m] = await Promise.all([
      grab("sky-stars.json"), grab("sky-constellations.json"),
      grab("sky-labels.json"), grab("sky-starnames.json"), grab("sky-milkyway.json")
    ]);
    stars = s; lines = l; labels = lb; starNames = nm; mw = m;
    loaded = true;
    placeReflections();
  }

  function setSize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2;
  }

  function radius() { return Math.min(W, H) * BASE_R * zoom; }

  // Stereographic projection of (raDeg, decDeg). Returns {x,y} or null if culled.
  // `clip` overrides the default cull cosine (the Milky Way uses a tighter one
  // so near-horizon vertices don't blow up to extreme off-screen coordinates).
  function project(raDeg, decDeg, clip) {
    const l = raDeg * D2R, p = decDeg * D2R;
    const l0 = ra0 * D2R, p0 = dec0 * D2R;
    const sp0 = Math.sin(p0), cp0 = Math.cos(p0);
    const dl = l - l0;
    const cosc = sp0 * Math.sin(p) + cp0 * Math.cos(p) * Math.cos(dl);
    if (cosc < (clip === undefined ? CLIP : clip)) return null;
    const k = radius() / (1 + cosc);
    const x = k * Math.cos(p) * Math.sin(dl);
    const y = k * (cp0 * Math.sin(p) - sp0 * Math.cos(p) * Math.cos(dl));
    return { x: cx + x, y: cy - y };
  }

  // ----- reflections pinned to real stars (oldest first → stable assignment) -----
  function placeReflections() {
    placed = [];
    if (!loaded || !stars.length) return;
    const N = stars.length;
    const start = nowTs - windowMonths * 30 * 24 * 60 * 60 * 1000;
    const end = nowTs;
    const inWin = reflections.filter((r) => r.ts >= start).sort((a, b) => a.ts - b.ts);
    const used = new Set();
    for (const r of inWin) {
      let idx = Math.abs(hashStr(r.id)) % N, tries = 0;
      while (used.has(idx) && tries < N) { idx = (idx + 1) % N; tries++; }
      used.add(idx);
      const st = stars[idx];
      const recency = end > start ? Math.max(0, Math.min(1, (r.ts - start) / (end - start))) : 1;
      placed.push({
        text: r.text, ts: r.ts, ra: st[1], dec: st[2], recency,
        name: starNames[String(st[0])] || ("HIP " + st[0])
      });
    }
  }
  function setReflections(list, months, now) {
    reflections = Array.isArray(list) ? list : [];
    if (months) windowMonths = months;
    if (now) nowTs = now;
    placeReflections();
  }

  // ----- drawing -----
  function drawMilkyWay() {
    ctx.fillStyle = "#ffffff";
    for (const band of mw) {
      ctx.globalAlpha = 0.006 + band.l * 0.006;   // faint → brighter per level
      for (const ring of band.p) {
        // Fill each contiguous above-horizon run separately, so a ring broken by
        // the horizon never fills across the long chord between the two pieces.
        let run = [];
        const flush = () => {
          if (run.length >= 3) {
            ctx.beginPath();
            ctx.moveTo(run[0].x, run[0].y);
            for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
            ctx.fill();
          }
          run = [];
        };
        for (const pt of ring) {
          const q = project(pt[0], pt[1], 0.08);   // tighter cull than the stars
          if (!q) { flush(); continue; }
          run.push(q);
        }
        flush();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLines() {
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const seg of lines) {
      let started = false;
      for (const pt of seg) {
        const q = project(pt[0], pt[1]);
        if (!q) { started = false; continue; }
        if (!started) { ctx.moveTo(q.x, q.y); started = true; }
        else ctx.lineTo(q.x, q.y);
      }
    }
    ctx.stroke();
  }

  function drawStars() {
    for (const st of stars) {
      const mag = st[3] == null ? 6 : st[3];
      const q = project(st[1], st[2]);
      if (!q || q.x < -10 || q.x > W + 10 || q.y < -10 || q.y > H + 10) continue;
      let r = (2.5 - mag * 0.42) * Math.min(1.7, 0.7 + zoom * 0.4);
      if (r < 0.35) r = 0.35;
      const a = Math.max(0.18, Math.min(1, 1.15 - mag * 0.13));
      const c = bvColor(st[4]);
      ctx.beginPath();
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
      ctx.arc(q.x, q.y, r, 0, 6.2832);
      ctx.fill();
    }
  }

  function drawLabels() {
    ctx.font = "12px 'Figtree', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = LABEL_COLOR;
    for (const lb of labels) {
      if (lb[3] > 3) continue;                 // skip the most obscure constellations
      const q = project(lb[1], lb[2]);
      if (!q || q.x < 30 || q.x > W - 30 || q.y < 30 || q.y > H - 20) continue;
      ctx.fillText(lb[0], q.x, q.y);
    }
    if (zoom >= STAR_NAME_ZOOM) {              // bright named stars, only when zoomed in
      ctx.fillStyle = "rgba(220,228,255,0.6)";
      ctx.font = "11px 'Figtree', system-ui, sans-serif";
      ctx.textAlign = "left";
      for (const st of stars) {
        if (st[3] == null || st[3] > 2.4) continue;
        const nm = starNames[String(st[0])];
        if (!nm) continue;
        const q = project(st[1], st[2]);
        if (!q || q.x < 20 || q.x > W - 20 || q.y < 20 || q.y > H - 10) continue;
        ctx.fillText(nm, q.x + 6, q.y + 3);
      }
    }
  }

  function drawReflections() {
    drawnRefs = [];
    for (const p of placed) {
      const q = project(p.ra, p.dec);
      if (!q || q.x < -20 || q.x > W + 20 || q.y < -20 || q.y > H + 20) continue;
      const r = 3 + p.recency * 6;
      const a = 0.45 + p.recency * 0.55;
      ctx.beginPath();                          // halo
      ctx.fillStyle = `rgba(255,205,110,${0.12 + p.recency * 0.13})`;
      ctx.arc(q.x, q.y, r * 2.4, 0, 6.2832);
      ctx.fill();
      ctx.beginPath();                          // warm core
      ctx.fillStyle = `rgba(255,224,150,${a})`;
      ctx.arc(q.x, q.y, r, 0, 6.2832);
      ctx.fill();
      ctx.beginPath();                          // bright center
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.arc(q.x, q.y, r * 0.42, 0, 6.2832);
      ctx.fill();
      drawnRefs.push({ x: q.x, y: q.y, r: Math.max(10, r * 2.4), data: p });
    }
  }

  function render(fast) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (!loaded) return;
    if (!fast) drawMilkyWay();
    drawLines();
    drawStars();
    if (!fast) drawLabels();
    drawReflections();
  }

  // ----- interaction -----
  function pan(dx, dy) {
    const k = PAN_DEG_PER_PX / zoom;
    ra0 = (ra0 - dx * k) % 360; if (ra0 < 0) ra0 += 360;
    dec0 = Math.max(-89, Math.min(89, dec0 + dy * k));
  }
  function zoomBy(factor) {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
  }
  function setCenter(ra, dec) { ra0 = ra; dec0 = dec; }

  // nearest reflection star to a screen point (within its halo); else null
  function hitTest(px, py) {
    let best = null, bestD = Infinity;
    for (const d of drawnRefs) {
      const dist = Math.hypot(px - d.x, py - d.y);
      if (dist <= d.r && dist < bestD) { bestD = dist; best = d.data; }
    }
    return best;
  }

  return {
    load, setSize, render, setReflections, pan, zoomBy, setCenter, hitTest,
    isLoaded: () => loaded,
    getZoom: () => zoom
  };
}
