const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function harness(){
 const now=Date.now();
 const data={reflectionLog:[{id:'old-reflection',ts:now,thoughts:['A note']},{id:'old-break',ts:now,rest:{durationMin:3}}],
 'experiment:complete':{id:'complete',action:'Drink water',starLitAt:now,endedEarly:false},
 'experiment:early':{id:'early',action:'Early ending',endedEarly:true},
 'experiment:unfinished':{id:'unfinished',action:'Not reviewed'}};
 const ctx=vm.createContext({chrome:{storage:{local:{get:async()=>({...data}),set:async v=>Object.assign(data,v)}}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../reflections-common.js'),'utf8'),ctx);
 return {data,ctx,now};
}
test('only completed experiments light stars, while old notes and breaks stay in history',async()=>{
 const {ctx,now}=harness();const log=await ctx.loadReflectionLog();
 assert.equal(log.length,3);const stars=ctx.reflectionStars(log,1,now).stars;
 assert.equal(stars.length,1);assert.equal(stars[0].id,'experiment-star:complete');
});
test('saving reflections cannot duplicate or overwrite experiment stars',async()=>{
 const {ctx,data,now}=harness();await ctx.saveReflectionLog(await ctx.loadReflectionLog());
 assert.equal(data.reflectionLog.length,2);
 assert.equal(ctx.reflectionStars(await ctx.loadReflectionLog(),1,now).stars.length,1);
});
test('deleting the experiment also removes its star',async()=>{
 const {ctx,data,now}=harness();delete data['experiment:complete'];
 assert.equal(ctx.reflectionStars(await ctx.loadReflectionLog(),1,now).stars.length,0);
});
