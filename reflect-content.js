// Content script: while a blocked site's group allowance is active, show a small
// floating wand icon; clicking it opens a compact reflection panel that saves to
// the same reflection log. Styles are isolated in a shadow root.
(async function () {
  if (window.top !== window) return; // top frame only

  // Restore a best-effort HTML5 playback position after an experiment, paused.
  try {
    const resume = await chrome.runtime.sendMessage({type:'experimentResume'});
    if (resume?.playback) {
      const until = Date.now() + 15000;
      const restore = setInterval(() => {
        if (!chrome.runtime?.id || Date.now() > until) { clearInterval(restore); return; }
        const video = document.querySelectorAll('video')[resume.playback.index];
        if (video && video.readyState >= 1) {
          try { video.pause(); video.currentTime = resume.playback.time; clearInterval(restore); } catch {}
        }
      }, 250);
    }
  } catch {}

  let show = false;
  try {
    const res = await chrome.runtime.sendMessage({ type: "reflectIconCheck", url: location.href });
    show = !!(res && res.show);
  } catch (e) { return; }
  if (!show) return;
  if (document.getElementById("__holdpause_reflect_host")) return;

  // ---- the halfway check: is it giving you what you hoped for? ----
  // Covers the page at the midpoint of the session until one of Yes / Partly /
  // No has been held for five seconds. Answered in any tab, it clears in all.
  (async function midCheck() {
    let session = null;
    try { session = (await chrome.runtime.sendMessage({ type: "sessionInfo", url: location.href }) || {}).session; } catch (e) { return; }
    if (!session || session.mid) return;
    const HOLD_MS = 5000;
    const host = document.createElement("div");
    host.id = "__holdpause_mid_host";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .cover { position: fixed; inset: 0; z-index: 2147483646; background: rgba(8, 10, 18, 0.82);
          display: flex; align-items: center; justify-content: center; padding: 24px;
          font: 16px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #fff; }
        .card { width: min(520px, 100%); background: #fff; color: #111; border-radius: 18px; padding: 26px 26px 22px;
          box-shadow: 0 20px 60px rgba(0,0,0,.5); text-align: center; }
        .eyebrow { margin: 0 0 6px; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; opacity: .5; }
        h2 { margin: 0 0 10px; font-size: 22px; font-weight: 700; line-height: 1.25; }
        .hope { margin: 0 0 18px; font-size: 15px; color: #555; }
        .hope strong { color: #111; }
        .row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        button { position: relative; overflow: hidden; font: inherit; font-size: 16px; font-weight: 600; padding: 12px 24px;
          border-radius: 999px; border: 1.5px solid #cfd3da; background: #fff; color: #111; cursor: pointer;
          user-select: none; -webkit-user-select: none; touch-action: none; min-width: 108px; }
        button .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(106,163,255,.28); }
        button .t { position: relative; font-variant-numeric: tabular-nums; }
        button.holding { border-color: #6aa3ff; }
        .foot { margin: 14px 0 0; font-size: 12px; color: #777; }
      </style>
      <div class="cover">
        <div class="card">
          <p class="eyebrow">Halfway through</p>
          <h2>Is it giving you what you hoped for?</h2>
          <p class="hope">You hoped for: <strong></strong></p>
          <div class="row">
            <button type="button" data-v="yes"><span class="fill"></span><span class="t">Yes</span></button>
            <button type="button" data-v="partly"><span class="fill"></span><span class="t">Partly</span></button>
            <button type="button" data-v="no"><span class="fill"></span><span class="t">No</span></button>
          </div>
          <p class="foot">Hold your answer for 5 seconds.</p>
        </div>
      </div>`;
    root.querySelector(".hope strong").textContent = session.hope || "";
    let shown = false, done = false;
    const show = () => {
      if (shown || done) return;
      shown = true;
      (document.body || document.documentElement).appendChild(host);
    };
    const finish = async (value) => {
      if (done) return;
      done = true;
      try { await chrome.runtime.sendMessage({ type: "sessionMid", id: session.id, value }); } catch (e) {}
      host.remove();
    };
    root.querySelectorAll("button").forEach((b) => {
      const fill = b.querySelector(".fill"), label = b.querySelector(".t"), word = label.textContent;
      let raf = 0, t0 = 0;
      const paint = (ms) => {
        fill.style.width = Math.min(100, (ms / HOLD_MS) * 100) + "%";
        label.textContent = ms > 0 ? word + " \u00b7 " + Math.max(1, Math.ceil((HOLD_MS - ms) / 1000)) : word;
      };
      const stop = () => { if (!raf) return; cancelAnimationFrame(raf); raf = 0; b.classList.remove("holding"); paint(0); };
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        b.classList.add("holding");
        t0 = performance.now();
        const tick = (t) => {
          const ms = t - t0;
          if (ms >= HOLD_MS) { raf = 0; paint(HOLD_MS); finish(b.dataset.v); return; }
          paint(ms);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, stop));   // letting go starts over
    });
    // Answered in another tab: this cover goes too.
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes.sessionLog) return;
        const s = (changes.sessionLog.newValue || []).find((x) => x && x.id === session.id);
        if (s && s.mid && !done) { done = true; host.remove(); }
      });
    } catch (e) {}
    const mid = (session.start + session.end) / 2;
    const wait = mid - Date.now();
    if (wait <= 0) show(); else setTimeout(show, wait);
  })();

  // Russell circumplex (kept in sync with reflections-common.js; content scripts
  // don't load that file, so the quadrant data lives here too).
  const QUADRANTS = ["tl", "tr", "bl", "br"];
  const QUADRANT_META = {
    tl: { cell: "#FAECE7", border: "#F0997B", text: "#712B13" },
    tr: { cell: "#FAEEDA", border: "#FAC775", text: "#633806" },
    bl: { cell: "#E6F1FB", border: "#B5D4F4", text: "#0C447C" },
    br: { cell: "#EAF3DE", border: "#C0DD97", text: "#27500A" }
  };
  const DEFAULT_FEELINGS = {
    tl: ["terror / panic", "anger / rage", "tension / nervousness", "distress / vexation"],
    tr: ["surprise / amazement", "excitement", "joy / gladness", "delight / pleasure"],
    bl: ["sadness", "dejection / frustration", "fatigue / exhaustion"],
    br: ["reassurance / peace of mind", "ease & comfort", "contentment", "serenity / tranquility", "relaxation"]
  };

  const host = document.createElement("div");
  host.id = "__holdpause_reflect_host";
  const root = host.attachShadow({ mode: "open" });
  (document.body || document.documentElement).appendChild(host);

  // Reloading the extension orphans this script in already-open tabs: any
  // chrome.* call then throws "Extension context invalidated". Notice the
  // orphaning and retire quietly instead of erroring.
  function extAlive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
  }
  function retire() {
    try { host.remove(); } catch (e) {}
  }

  const wandUrl = chrome.runtime.getURL("images/wand.png");
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .icon { position: fixed; top: 14px; left: 14px; width: 46px; height: 46px; z-index: 2147483647;
        cursor: pointer; filter: drop-shadow(0 2px 6px rgba(0,0,0,.3)); transition: transform .15s ease; }
      .icon:hover { transform: scale(1.08) rotate(-6deg); }
      .panel { position: fixed; top: 66px; left: 14px; width: 300px; z-index: 2147483647; display: none;
        background: #11121a; color: #fff; border-radius: 14px; padding: 14px;
        font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 12px 34px rgba(0,0,0,.5); }
      .panel.open { display: block; }
      .panel h3 { margin: 0 0 6px; font-size: 15px; font-weight: 700; }
      .panel label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; opacity: .55; margin: 12px 0 4px; }
      .panel input { width: 100%; box-sizing: border-box; font-size: 13px; padding: 8px 10px; border-radius: 8px;
        border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.08); color: #fff; }
      .panel input::placeholder { color: rgba(255,255,255,.4); }
      .chips { display: flex; flex-wrap: wrap; gap: 5px; }
      #tchips:not(:empty) { margin-bottom: 6px; }
      .chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 4px 5px 4px 9px; border-radius: 999px; background: rgba(255,255,255,.14); }
      .chip button { border: none; background: rgba(0,0,0,.25); color: #fff; border-radius: 999px; padding: 1px 6px; cursor: pointer; font-size: 12px; }
      .cxax { font-size: 10px; opacity: .5; text-align: center; margin: 2px 0; }
      .cxval { display: flex; justify-content: space-between; font-size: 10px; opacity: .5; padding: 0 2px; margin-top: 2px; }
      .cx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
      .cx-cell { border-radius: 8px; padding: 6px; min-height: 56px; display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start; cursor: pointer; }
      .cx-cell[data-q="tl"] { background: #FAECE7; }
      .cx-cell[data-q="tr"] { background: #FAEEDA; }
      .cx-cell[data-q="bl"] { background: #E6F1FB; }
      .cx-cell[data-q="br"] { background: #EAF3DE; }
      .cxchip { font-family: inherit; font-size: 11px; padding: 3px 7px; border-radius: 999px; background: #fff; border: .5px solid; cursor: pointer; }
      .cxchip.on { color: #fff !important; }
      .cxadd { font-family: inherit; font-size: 11px; padding: 3px 6px; border-radius: 999px; border: .5px dashed currentColor; background: rgba(255,255,255,.75); width: 8ch; min-width: 0; }
      .row { display: flex; gap: 8px; margin-top: 14px; }
      .row button { flex: 1; font-size: 14px; font-weight: 600; padding: 9px; border-radius: 999px; border: none; cursor: pointer; }
      .save { background: #6aa3ff; color: #fff; }
      .close { background: rgba(255,255,255,.12); color: #fff; }
      .done { font-size: 12px; opacity: .75; margin-top: 8px; text-align: center; min-height: 14px; }
      .summon { position: fixed; top: 50%; left: 50%; width: 84px; height: 84px; z-index: 2147483647;
        transform: translate(-50%, -50%) scale(0); cursor: pointer;
        animation: hp-pop .4s cubic-bezier(.2,1.4,.4,1) forwards, hp-pulse 1.8s ease-in-out .4s infinite; }
      @keyframes hp-pop { to { transform: translate(-50%, -50%) scale(1); } }
      @keyframes hp-pulse { 0%,100% { filter: drop-shadow(0 0 12px rgba(255,220,130,.85)); } 50% { filter: drop-shadow(0 0 22px rgba(255,235,160,1)); } }
    </style>
    <img class="icon" src="${wandUrl}" alt="Reflect" title="Take a moment to reflect" />
    <div class="panel">
      <h3>A moment of magic</h3><div class="row"><button class="experiment" type="button">Try a small experiment</button></div>
      <label>Thoughts</label>
      <div class="chips" id="tchips"></div>
      <input id="tin" type="text" autocomplete="off" placeholder="What's on your mind? (press Enter)" />
      <label>Body</label>
      <input id="bin" type="text" autocomplete="off" placeholder="How does your body feel?" />
      <label>Mood</label>
      <div class="cxax">↑ high arousal</div>
      <div class="cx-grid">
        <div class="cx-cell" data-q="tl"></div>
        <div class="cx-cell" data-q="tr"></div>
        <div class="cx-cell" data-q="bl"></div>
        <div class="cx-cell" data-q="br"></div>
      </div>
      <div class="cxax">↓ low arousal</div>
      <div class="cxval"><span>← unpleasant</span><span>pleasant →</span></div>
      <div class="row"><button class="close" type="button">Close</button><button class="save" type="button">Save</button></div>
      <div class="done" id="done"></div>
    </div>
  `;

  const icon = root.querySelector(".icon");
  const panel = root.querySelector(".panel");
  const tin = root.getElementById("tin");
  const tchips = root.getElementById("tchips");
  const bin = root.getElementById("bin");
  const doneEl = root.getElementById("done");

  root.querySelector('.experiment').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    const videos = [...document.querySelectorAll('video')];
    const video = videos.find(v => !v.paused) || videos[0];
    const playback = video ? {time:video.currentTime,index:videos.indexOf(video)} : null;
    try {
      const result = await chrome.runtime.sendMessage({type:'experimentLaunch',playback});
      if (!result?.ok) throw new Error('Could not open');
    } catch { event.target.disabled=false; doneEl.textContent='Could not open the experiment. Please try again.'; }
  });

  let thoughts = [];
  let selectedMood = "";
  let feelings = {};
  try {
    const s = await chrome.storage.sync.get("reflectionFeelings");
    feelings = (s.reflectionFeelings && typeof s.reflectionFeelings === "object")
      ? s.reflectionFeelings : JSON.parse(JSON.stringify(DEFAULT_FEELINGS));
  } catch (e) { feelings = JSON.parse(JSON.stringify(DEFAULT_FEELINGS)); }
  for (const q of QUADRANTS) if (!Array.isArray(feelings[q])) feelings[q] = [];

  icon.addEventListener("click", () => panel.classList.toggle("open"));

  function renderTChips() {
    tchips.innerHTML = "";
    thoughts.forEach((t, i) => {
      const c = document.createElement("span"); c.className = "chip";
      c.append(document.createTextNode(t));
      const x = document.createElement("button"); x.type = "button"; x.textContent = "×";
      x.addEventListener("click", () => { thoughts.splice(i, 1); renderTChips(); });
      c.appendChild(x); tchips.appendChild(c);
    });
  }
  tin.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); const v = tin.value.trim(); if (v) { thoughts.push(v); tin.value = ""; renderTChips(); } }
  });

  function renderCircumplex() {
    for (const q of QUADRANTS) {
      const cell = root.querySelector(`.cx-cell[data-q="${q}"]`);
      if (!cell) continue;
      const meta = QUADRANT_META[q];
      cell.innerHTML = "";
      (feelings[q] || []).forEach((name) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "cxchip" + (selectedMood === name ? " on" : "");
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
      });
    }
  }
  function addFeelingInline(cell, q) {
    if (cell.querySelector(".cxadd")) { cell.querySelector(".cxadd").focus(); return; }
    const meta = QUADRANT_META[q];
    const input = document.createElement("input");
    input.className = "cxadd"; input.type = "text"; input.placeholder = "name…"; input.style.color = meta.text;
    cell.appendChild(input); input.focus();
    let done = false;
    const commit = async () => {
      if (done) return; done = true;
      const name = input.value.trim(); input.remove();
      if (!name) return;
      if (!feelings[q]) feelings[q] = [];
      if (!feelings[q].includes(name)) feelings[q].push(name);
      try { await chrome.storage.sync.set({ reflectionFeelings: feelings }); } catch (e) {}
      selectedMood = name; renderCircumplex();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { done = true; input.remove(); }
    });
    input.addEventListener("blur", commit);
  }
  QUADRANTS.forEach((q) => {
    const cell = root.querySelector(`.cx-cell[data-q="${q}"]`);
    if (cell) cell.addEventListener("click", (e) => { if (e.target === cell) addFeelingInline(cell, q); });
  });
  renderCircumplex();

  root.querySelector(".close").addEventListener("click", () => panel.classList.remove("open"));
  root.querySelector(".save").addEventListener("click", async () => {
    if (!extAlive()) { retire(); return; }
    const body = bin.value.trim();
    const mood = selectedMood;
    if (!thoughts.length && !body && !mood) { doneEl.textContent = "Nothing to save yet."; return; }
    const entry = {
      id: "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      ts: Date.now(), thoughts: thoughts.slice(), body, mood
    };
    try {
      const cur = await chrome.storage.local.get("reflectionLog");
      const logArr = Array.isArray(cur.reflectionLog) ? cur.reflectionLog : [];
      logArr.unshift(entry);
      await chrome.storage.local.set({ reflectionLog: logArr });
      thoughts = []; renderTChips(); bin.value = ""; selectedMood = ""; renderCircumplex();
      doneEl.textContent = "Saved ✨";
      setTimeout(() => { doneEl.textContent = ""; panel.classList.remove("open"); }, 1200);
    } catch (e) { doneEl.textContent = "Couldn't save."; }
  });

  // --- shake / whirl the cursor to summon a star in the centre ---
  let centerStar = null;
  let lastSummon = 0;
  const moves = [];
  function summonStar() {
    if (centerStar) return;
    if (!extAlive()) { retire(); return; }
    const img = document.createElement("img");
    img.className = "summon";
    img.src = chrome.runtime.getURL("images/stars-" + String(1 + Math.floor(Math.random() * 21)).padStart(3, "0") + ".png");
    img.alt = ""; img.title = "Open reflection";
    centerStar = img;
    root.appendChild(img);
    const dismiss = () => { if (centerStar) { centerStar.remove(); centerStar = null; } };
    img.addEventListener("click", () => { dismiss(); panel.classList.add("open"); });
    setTimeout(dismiss, 5000);
  }
  document.addEventListener("pointermove", (e) => {
    const t = e.timeStamp;
    moves.push({ t, x: e.clientX, y: e.clientY });
    while (moves.length && t - moves[0].t > 450) moves.shift();
    if (centerStar || panel.classList.contains("open")) return;
    if (t - lastSummon < 4000 || moves.length < 6) return;
    let path = 0;
    for (let i = 1; i < moves.length; i++) path += Math.hypot(moves[i].x - moves[i - 1].x, moves[i].y - moves[i - 1].y);
    const net = Math.hypot(moves[moves.length - 1].x - moves[0].x, moves[moves.length - 1].y - moves[0].y);
    // high path length but small net displacement = a shake or whirl
    if (path > 650 && net < path * 0.45) { lastSummon = t; summonStar(); }
  }, { passive: true });
})();
