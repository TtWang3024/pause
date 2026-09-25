const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../experiment-background.js'),'utf8');
function harness(state=null) {
 const data={},moves=[],removed=[];let handler;
 const group={id:'g',schedule:{}};
 const storage={get:async key=>key===null?{...data}:{[key]:data[key]},set:async obj=>Object.assign(data,obj),remove:async key=>delete data[key]};
 vm.runInNewContext(code,{URL,Date,Number,Math,Error,crypto:require('node:crypto').webcrypto,
 chrome:{runtime:{id:'ext',getURL:p=>'chrome-extension://ext/'+p.replace(/^\//,''),onMessage:{addListener:fn=>handler=fn}},storage:{local:storage},tabs:{update:async(id,change)=>moves.push(change.url),remove:async id=>removed.push(id)}},
 getSettings:async()=>({groups:[group],magicStars:true}),findGroupForUrl:()=>group,getGroupState:async()=>state,scheduleActiveNow:()=>true,snoozeUntil:async()=>0,breakUrl:()=> 'required-break',entryUrl:()=> 'normal-gate'});
 const send=(msg,url='https://video.test/watch')=>new Promise(resolve=>handler(msg,{tab:{id:7,url},url},resolve));
 return {data,moves,removed,send};
}
async function launch(h){assert.equal((await h.send({type:'experimentLaunch',playback:{time:125,index:0}})).ok,true);return Object.values(h.data)[0];}
for(const [name,state,expected] of [
 ['active allowance',{allowanceEnd:Date.now()+60000,breakEnd:Date.now()+120000},'https://video.test/watch'],
 ['required break',{allowanceEnd:0,breakEnd:Date.now()+60000},'required-break'],
 ['expired session',null,'normal-gate']]) {
 test('return preserves '+name,async()=>{const h=harness(state),r=await launch(h);const before=JSON.stringify(state);assert.equal((await h.send({type:'experimentLeave',id:r.id,nextChoice:'return'},'chrome-extension://ext/experiment.html?id='+r.id)).ok,true);assert.equal(h.moves.at(-1),expected);assert.equal(JSON.stringify(state),before);assert.equal(h.data['experiment:'+r.id].nextChoice,'return');});
}
test('finish closes only the experiment tab and records the choice',async()=>{const h=harness(),r=await launch(h);await h.send({type:'experimentLeave',id:r.id,nextChoice:'finish'},'chrome-extension://ext/experiment.html?id='+r.id);assert.deepEqual(h.removed,[7]);assert.equal(h.data['experiment:'+r.id].phase,'done');});
test('website cannot forge an experiment exit',async()=>{const h=harness(),r=await launch(h);assert.equal((await h.send({type:'experimentLeave',id:r.id,nextChoice:'return'})).ok,false);assert.equal(h.moves.length,1);});
test('records in separate launches do not overwrite each other',async()=>{const h=harness();await launch(h);await launch(h);assert.equal(Object.keys(h.data).filter(k=>k.startsWith('experiment:')).length,2);});
test('playback restoration is matched to the original URL and consumed once',async()=>{const h=harness({allowanceEnd:Date.now()+60000}),r=await launch(h);await h.send({type:'experimentLeave',id:r.id,nextChoice:'return'},'chrome-extension://ext/experiment.html?id='+r.id);assert.equal((await h.send({type:'experimentResume'},'https://other.test/')).playback,undefined);assert.equal((await h.send({type:'experimentResume'})).playback.time,125);assert.equal((await h.send({type:'experimentResume'})).playback,undefined);});
