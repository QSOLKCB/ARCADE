'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../js/core.js');require('../js/audio.js');
const A=globalThis.Arcade;
function mock(){
 const calls=[];const param=()=>({value:0,setValueAtTime(v){assert.ok(Number.isFinite(v)&&v>0);},linearRampToValueAtTime(v){assert.ok(Number.isFinite(v)&&v>0);},exponentialRampToValueAtTime(v){assert.ok(Number.isFinite(v)&&v>0);}});
 const ctx={state:'running',currentTime:1,sampleRate:100,destination:{},createGain:()=>({gain:param(),connect(){},disconnect(){}}),createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)}),createOscillator:()=>source('tone'),createBufferSource:()=>source('noise'),resume:async()=>{ctx.state='running';},suspend:async()=>{ctx.state='suspended';}};
 function source(kind){const n={frequency:param(),playbackRate:{value:1},connect(){},disconnect(){},start(){calls.push(kind)},stop(){},onended:null};calls.nodes.push(n);return n;}calls.nodes=[];
 global.window={AudioContext:function(){return ctx}};return{ctx,calls};
}
test('audio remains optional, only unlocks after enabling, and clamps saved levels',()=>{
 const {calls,ctx}=mock(),a=new A.Audio();a.unlock();assert.equal(a.ctx,null);a.effect('fire');assert.equal(calls.length,0);a.setLevels(NaN,4);assert.equal(a.musicLevel,.55);assert.equal(a.fxLevel,1);a.setEnabled(true);assert.equal(a.ctx,ctx);a.effect('fire');assert.ok(calls.length>0);a.suspend();assert.equal(a.voices,0);assert.equal(a.active.size,0);const count=calls.length;a.effect('boom');assert.equal(calls.length,count);
});
test('all original arrangements schedule finite notes and release bounded voices',()=>{
 const {calls}=mock(),a=new A.Audio();a.setEnabled(true);
 for(const id of ['iron','ninja','heist','hockey','brawl','chrono','breaker','void']){a.setTrack(id);for(let i=0;i<600;i++){a.tick(1/60,id);for(const n of calls.nodes.splice(0))n.onended?.();}assert.ok(a.beat>=32);}
 assert.ok(calls.includes('noise'));assert.ok(calls.includes('tone'));assert.equal(a.voices,0);
 for(let i=0;i<200;i++)a.effect('boom');assert.equal(a.voices,32);
});
test('music and effects can be muted independently',()=>{
 const {calls}=mock(),a=new A.Audio();a.setEnabled(true);a.setLevels(0,1);a.tick(.2,'iron');assert.equal(calls.length,0);a.effect('pickup');assert.ok(calls.length>0);const n=calls.length;a.setLevels(1,0);a.effect('pickup');assert.equal(calls.length,n);a.tick(.2,'iron');assert.ok(calls.length>n);
});
test('decorative effects remain bounded and expire without changing game randomness',()=>{const fx=new A.Effects();for(let i=0;i<100;i++)fx.add('blast',0,0);assert.equal(fx.items.length,32);fx.update(1);assert.equal(fx.items.length,0);});
