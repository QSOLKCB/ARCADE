'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
for(const file of ['engine','core','gfx','platforms','sports','kombat','breach','shooters'])require('../arcade2/'+file+'.js');
const A=globalThis.Arcade2,px=A.px,q=A.q;
const {policy}=require('./arcade2-policy.cjs');
for(const meta of A.registry)test(meta.title+' completes a fresh campaign using controls alone',()=>{
 const g=meta.create(),control=policy(meta.id);let t=0,transitions=0;
 for(;t<15000&&g.status!=='won'&&g.status!=='lost';t++){
  if(g.status==='stageclear'){g.next();transitions++;continue;}
  g.tick(control(g,t));
 }
 assert.equal(g.status,'won',meta.id+' ended '+g.status+' at tick '+t+' stage '+g.stage);
 assert.ok(g.score>0);assert.ok(t<15000);
 assert.equal(transitions,['soccer','hoops'].includes(meta.id)?0:meta.id==='invaders'?3:2);
});
