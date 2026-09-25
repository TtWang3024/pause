const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE || undefined,headless:true});
 const page=await browser.newPage({viewport:{width:1100,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://pause.test/**',async route=>{const file=path.join(root,new URL(route.request().url()).pathname);await route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'text/html'});});
 await page.addInitScript(()=>{
  if(!localStorage.db)localStorage.db=JSON.stringify({'experiment:test':{id:'test',phase:'setup',context:'Before opening',createdAt:Date.now()}});
  window.chrome={storage:{onChanged:{addListener:()=>{}},sync:{get:async()=>({reflectReduceMotion:true}),set:async()=>{}},local:{get:async key=>{const d=JSON.parse(localStorage.db);return key===null?d:{[key]:d[key]};},set:async obj=>{localStorage.db=JSON.stringify({...JSON.parse(localStorage.db),...obj});},remove:async key=>{const d=JSON.parse(localStorage.db);delete d[key];localStorage.db=JSON.stringify(d);}}},runtime:{getURL:p=>'http://pause.test/'+p,sendMessage:async msg=>{window.lastMessage=msg;if(msg.type==='getSettings')return {groups:[{id:'g',sites:['video.test'],pauseSeconds:20}],holdToContinue:true,backdoorLockMin:0,backdoorHoldSec:20,breakBackdoor:true,sleepReminder:false};return {ok:true};}}};
 });
 await page.goto('http://pause.test/experiment.html?id=test');
 await page.getByLabel('What do you expect?').selectOption('Everything else will feel boring.');
 await page.getByLabel('Expected discomfort').selectOption('7');
 await page.screenshot({path:'/tmp/pause-experiment-setup.png',fullPage:true});
 await page.getByRole('button',{name:'Start experiment',exact:true}).click();
 await page.getByRole('button',{name:'Hide progress',exact:true}).click();
 assert.equal(await page.locator('#clock').isVisible(),false);
 await page.reload();await page.getByRole('button',{name:'End experiment early'}).click();
 await page.getByLabel('Compared with your prediction').selectOption('Harder than expected');
 await page.getByLabel('Actual discomfort').selectOption('8');
 await page.getByLabel('Anything pleasant').selectOption('Nothing');
 await page.getByRole('button',{name:'Choose what’s next'}).click();
 await page.getByText('Noted. This experiment didn’t offer much today.').waitFor();
 await page.getByRole('button',{name:'Stay away a little longer'}).click();
 await page.reload();await page.getByRole('button',{name:'Choose what’s next'}).click();
 await page.getByRole('button',{name:'Return to watching',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.lastMessage.nextChoice),'return');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.db)['experiment:test'].starLitAt),undefined);
 await page.goto('http://pause.test/experiment.html?history=1');await page.getByText('Harder than expected',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Delete',exact:true}).click();assert.equal(await page.locator('article').count(),0);
 // An elapsed experiment reopens at review and keeps missing answers unknown.
 await page.evaluate(()=>{localStorage.db=JSON.stringify({'experiment:expired':{id:'expired',phase:'running',startedAt:Date.now()-70000,endAt:Date.now()-10000,durationMs:60000,action:'Notice the urge',prediction:'I’m not sure.',expected:null}});});
 await page.goto('http://pause.test/experiment.html?id=expired');await page.getByRole('heading',{name:'What actually happened?'}).waitFor();
 await page.getByRole('button',{name:'Skip review',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.db)['experiment:expired'].result??null),null);
 await page.getByText('Your experiment lit a star.').waitFor();
 const starAt=await page.evaluate(()=>JSON.parse(localStorage.db)['experiment:expired'].starLitAt);
 await page.reload();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.db)['experiment:expired'].starLitAt),starAt);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/pause-experiment-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

 // Real sky entry: closed by default, open on hover/focus, launch remains wired.
 await page.setViewportSize({width:1100,height:950});
 await page.goto('http://pause.test/reflect.html?url=https%3A%2F%2Fvideo.test&group=g');
 const box=page.getByRole('button',{name:'Open Pandora’s box: try a small experiment'});
 await box.waitFor();
 assert.equal(await box.locator('.box-open').evaluate(el=>getComputedStyle(el).opacity),'0');
 await page.screenshot({path:'/tmp/pause-box-closed.png',fullPage:true});
 await box.hover();
 assert.equal(await box.locator('.box-open').evaluate(el=>getComputedStyle(el).opacity),'1');
 await page.screenshot({path:'/tmp/pause-box-open.png',fullPage:true});
 await box.click();assert.equal(await page.evaluate(()=>window.lastMessage.type),'experimentLaunch');
 // Actual break page keeps its bars, with no countdown digits or star celebration.
 await page.goto('http://pause.test/break.html?url=https%3A%2F%2Fvideo.test&group=g&mins=3&end='+(Date.now()+120000));
 await page.getByRole('button',{name:'Hold to return',exact:true}).waitFor();
 assert.equal(await page.locator('#time-left, #break-len, #star-moment').count(),0);
 const ret=page.getByRole('button',{name:'Hold to return',exact:true});
 await ret.hover();await page.mouse.down();
 await page.getByRole('button',{name:'Keep holding…',exact:true}).waitFor();
 assert.equal(await page.locator('#return-btn').innerText(),'Keep holding…');
 await page.mouse.up();
 await page.screenshot({path:'/tmp/pause-break-no-timers.png',fullPage:true});
 // A crowded short screen must scroll rather than collapse the progress track.
 await page.setViewportSize({width:390,height:650});
 await page.locator('#progress').scrollIntoViewIfNeeded();
 const track=await page.locator('#progress').boundingBox();
 assert.ok(track.height >= 10, 'Break progress track keeps its height');
 assert.ok(track.width > 200, 'Break progress track remains wide enough to see');
 assert.ok(await page.locator('#progress-fill').evaluate(el=>el.getBoundingClientRect().width)>0);
 assert.equal(await page.locator('#time-left, #break-len').count(),0);
 await page.screenshot({path:'/tmp/pause-break-progress-restored.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: setup, early ending, honest negative review, timer hide, reload recovery, extended pause, return message, history deletion, expiry, skip review, mobile layout; no browser errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
