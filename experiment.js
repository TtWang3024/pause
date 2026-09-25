(() => {
  const app = document.getElementById('app');
  const error = document.getElementById('error');
  const id = new URLSearchParams(location.search).get('id');
  const key = id && 'experiment:' + id;
  const predictions = ['Everything else will feel boring.', 'I’ll feel restless.', 'I’ll keep thinking about the video.', 'Something uncomfortable will come up.', 'I’m not sure.'];
  const actions = ['Step away with a drink', 'Listen to a familiar song away from the video', 'Notice the urge without acting on it', 'My own small action'];
  let record, timer;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options = (values, selected) => values.map(v => `<option${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const rating = (name, value) => `<label for="${name}">${name === 'expected' ? 'Expected' : 'Actual'} discomfort · optional</label><select id="${name}"><option value="">Skip</option>${Array.from({length:11}, (_,n) => `<option value="${n}"${value === n ? ' selected' : ''}>${n}${n === 0 ? ' — none' : n === 10 ? ' — very uncomfortable' : ''}</option>`).join('')}</select>`;
  const value = name => document.getElementById(name).value;
  const number = name => value(name) === '' ? null : Number(value(name));
  function screen(html) {
    clearInterval(timer); app.innerHTML = html; app.removeAttribute('aria-busy');
    const h = app.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus(); }
  }
  function on(id, fn) {
    document.getElementById(id).addEventListener('click', async e => {
      e.currentTarget.disabled = true; error.textContent = '';
      try { await fn(); } catch { error.textContent = 'Could not save your change. Please try again.'; }
      finally { e.target.disabled = false; }
    });
  }
  async function save() { await chrome.storage.local.set({[key]:record}); }
  const heading = title => `<p class="eyebrow">A small experiment</p><h1>${title}</h1>`;
  async function setup() {
    const {experimentPreference} = await chrome.storage.local.get('experimentPreference');
    screen(heading('What happens if you step away?') + `<p class="subtle">You don’t have to expect it to feel better. Just try something small and see.</p><label for="prediction">What do you expect?</label><select id="prediction">${options(predictions, record.prediction || predictions[4])}</select>${rating('expected',record.expected)}<label for="action">One small action</label><select id="action">${options(actions, record.action || experimentPreference || actions[0])}</select><div id="custom-wrap" hidden><label for="custom">What will you try?</label><input id="custom" maxlength="160" placeholder="Something small and manageable"></div><label for="duration">How long?</label><select id="duration"><option value="60">1 minute</option><option value="120" selected>2 minutes</option><option value="180">3 minutes</option><option value="300">5 minutes</option></select><p class="subtle">For a song, choose a short interval or end when it finishes. These are starting points, not targets you must reach.</p><div class="actions"><button id="start" class="primary">Start experiment</button><button id="cancel">Go back</button></div>`);
    document.getElementById('action').addEventListener('change', () => {
      document.getElementById('custom-wrap').hidden = value('action') !== actions[3];
      document.getElementById('duration').value = value('action') === actions[2] ? '60' : '120';
    });
    on('start', async () => {
      const action = value('action'); const custom = value('custom').trim();
      if (action === actions[3] && !custom) { document.getElementById('custom').focus(); return; }
      record = {...record, prediction:value('prediction'), expected:number('expected'), action:action === actions[3] ? custom : action, surfing:action === actions[2], durationMs:Number(value('duration'))*1000, startedAt:Date.now(), phase:'running', result:null, actual:null, pleasant:null};
      record.endAt = record.startedAt + record.durationMs;
      await save(); await chrome.storage.local.set({experimentPreference:action === actions[3] ? actions[0] : action}); running();
    });
    on('cancel', () => leave('cancelled'));
  }
  function running() {
    screen(heading('You don’t have to feel happier.') + `<p>Just notice what this is like.</p><div class="card"><strong>${esc(record.action)}</strong><p class="subtle">You expected: ${esc(record.prediction)}</p>${record.surfing ? '<p>Where do you feel the pull? Breathe naturally. Notice what changes and what stays. You can want to watch without deciding yet.</p>' : '<p>You can leave this screen. The experiment keeps going while you are away.</p>'}</div><div id="clock" class="quiet-progress" role="img" aria-label="Experiment progress"><span id="experiment-progress"></span></div><button id="hide" class="quiet">Hide progress</button><div class="actions"><button id="end">End experiment early</button></div><p class="foot">No need to make the urge disappear. Ending early is useful information too.</p>`);
    on('hide', () => { const el=document.getElementById('clock'); el.hidden=!el.hidden; document.getElementById('hide').textContent=el.hidden?'Show progress':'Hide progress'; });
    on('end', () => end(true));
    let ending = false;
    async function tick() {
      const remaining = Math.max(0, record.endAt-Date.now());
      document.getElementById('experiment-progress').style.width = (Math.max(0, Math.min(1, 1 - remaining / record.durationMs)) * 100) + '%';
      if (remaining === 0 && !ending) {
        ending=true;
        try { await end(false); } catch { ending=false; error.textContent='Could not save yet. Retrying…'; }
      }
    }
    timer=setInterval(tick,500); tick();
  }
  async function end(early) {
    early = early && Date.now() < record.endAt;
    record.phase='review'; record.endedAt=early ? Date.now() : record.endAt;
    record.elapsedMs=Math.max(0,record.endedAt-record.startedAt); record.endedEarly=early;
    await save(); review();
  }
  function review() {
    screen(heading('What actually happened?') + `<p>You expected: <strong>${esc(record.prediction)}</strong></p><p class="subtle">${esc(record.action)}. There is no right answer.</p><label for="result">Compared with your prediction · optional</label><select id="result"><option value="">Skip</option>${options(['As expected','A little easier than expected','Harder than expected','Different in another way'],record.result)}</select>${rating('actual',record.actual)}<label for="pleasant">Anything pleasant or worthwhile, even briefly? · optional</label><select id="pleasant"><option value="">Skip</option>${options(['Nothing','A little','Yes'],record.pleasant)}</select><div class="actions"><button id="review-done" class="primary">Choose what’s next</button><button id="skip">Skip review</button></div>`);
    on('review-done', async () => { record.result=value('result')||null; record.actual=number('actual'); record.pleasant=value('pleasant')||null; await completeReview(); });
    on('skip', completeReview);
  }
  async function completeReview() {
    // The chosen interval and acknowledgement finish the experiment. Ratings and
    // the decision to return never determine the award. One record = one star.
    if (!record.endedEarly && record.elapsedMs >= record.durationMs && !record.starLitAt) {
      record.starLitAt = Date.now();
    }
    record.phase = 'choice';
    await save();
    choice();
  }
  function choice() {
    screen(heading('What would you like to do now?') + `${record.starLitAt ? '<div class="experiment-star"><img src="images/stars-001.png" alt=""><p>Your experiment lit a star.</p><a class="quiet link" href="reflect.html" target="_blank">See it in your sky</a></div>' : ''}<p>${record.pleasant === 'Nothing' ? 'Noted. This experiment didn’t offer much today.' : 'Noted. Whatever happened, you have a little more information.'}</p><p class="subtle">You can choose while the urge is still here.</p><div class="actions"><button id="longer">Stay away a little longer</button><button id="finish">Finish watching for now</button><button id="return">Return to watching</button></div><p class="foot">Returning keeps your existing viewing limits. If time has expired, your usual pause or break still applies.</p><a class="quiet link" href="experiment.html?history=1" target="_blank">Your experiment history</a>`);
    on('longer', async () => { record.nextChoice='stay-away'; record.phase='rest'; record.restEnd=Date.now()+120000; await save(); rest(); });
    on('finish', () => leave('finish'));
    on('return', () => leave('return'));
  }
  function rest() {
    screen(heading('A little more time away.')+'<p>Keep doing what you chose. There’s nothing to fill in.</p><div class="quiet-progress" role="img" aria-label="Time away progress"><span id="rest-progress"></span></div><div class="actions"><button id="rest-done">Choose what’s next</button></div>');
    on('rest-done', async () => {record.phase='choice'; await save(); choice();});
    timer=setInterval(async () => {
      document.getElementById('rest-progress').style.width = (Math.max(0, Math.min(1, 1-(record.restEnd-Date.now())/120000))*100)+'%';
      if(Date.now()>=record.restEnd) {clearInterval(timer);record.phase='choice';try{await save();choice();}catch{error.textContent='Could not save. Use “Choose what’s next” to retry.';}}
    },500);
  }
  async function leave(nextChoice) {
    const response=await chrome.runtime.sendMessage({type:'experimentLeave',id,nextChoice});
    if(!response?.ok) throw new Error('Navigation failed');
  }
  async function history() {
    const all=await chrome.storage.local.get(null);
    const entries=Object.entries(all).filter(([k,v]) => k.startsWith('experiment:') && v.startedAt).sort((a,b)=>b[1].startedAt-a[1].startedAt);
    screen(heading('Your experiments')+'<p class="subtle">Observations, not scores. Missing answers stay unknown. Saved only on this device.</p><div id="entries"></div>');
    const list=document.getElementById('entries');
    if(!entries.length) list.textContent='No experiments yet.';
    for(const [k,r] of entries) {
      const article=document.createElement('article');
      article.innerHTML=`<small>${esc(new Date(r.startedAt).toLocaleString())} · ${esc(r.context)}</small><h2>${esc(r.action)}</h2><p>Expected: ${esc(r.prediction)}<br>Experience: ${esc(r.result||'Unknown')}<br>Discomfort: ${esc(r.expected??'Unknown')} → ${esc(r.actual??'Unknown')}<br>Pleasant or worthwhile: ${esc(r.pleasant||'Unknown')}<br>Time: ${r.elapsedMs == null ? 'Not recorded' : Math.round(r.elapsedMs/1000)+' seconds'}${r.endedEarly?' · ended early':''}<br>Next choice: ${esc(r.nextChoice||'Unknown')}</p><button type="button">Delete</button>`;
      article.querySelector('button').addEventListener('click',async()=>{try{await chrome.storage.local.remove(k);article.remove();}catch{error.textContent='Could not delete. Please try again.';}});list.append(article);
    }
  }
  (async()=>{
    if(new URLSearchParams(location.search).has('history')) return history();
    if(!key) throw new Error('Missing experiment');
    record=(await chrome.storage.local.get(key))[key];
    if(!record) throw new Error('Missing experiment');
    if(record.phase==='running') running(); else if(record.phase==='review') review(); else if(record.phase==='choice') choice(); else if(record.phase==='rest') rest();
    else if(record.phase==='done') screen(heading('This experiment is saved.')+'<p>You can close this tab.</p><a class="link" href="experiment.html?history=1">Your experiment history</a>');
    else await setup();
  })().catch(()=>{screen(heading('This experiment is unavailable.')+'<p>It may have been deleted. You can close this tab and start another from the wand.</p>');});
})();
