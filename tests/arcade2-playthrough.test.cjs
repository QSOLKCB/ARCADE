'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
for(const file of ['engine','core','gfx','platforms','sports','kombat','breach','shooters'])require('../arcade2/'+file+'.js');
const A=globalThis.Arcade2,px=A.px,q=A.q;
const {policy}=require('./arcade2-policy.cjs');
// Stage transitions per rule set: Extended/Remix add Kombat's fourth incident and a fifth invader orbit.
const TRANSITIONS={legacy:{soccer:0,hoops:0,invaders:3,_:2},extended:{soccer:0,hoops:0,invaders:4,kombat:3,_:2}};
for(const mode of ['legacy','extended','remix'])for(const meta of A.registry)test(meta.title+' ('+mode+') completes a fresh campaign using controls alone',()=>{
 const g=meta.create(mode),control=policy(meta.id);let t=0,transitions=0;
 for(;t<15000&&g.status!=='won'&&g.status!=='lost';t++){
  if(g.status==='stageclear'){g.next();transitions++;continue;}
  g.tick(control(g,t));
 }
 assert.equal(g.status,'won',meta.id+' ended '+g.status+' at tick '+t+' stage '+g.stage);
 assert.ok(g.score>0);assert.ok(t<15000);
 const expected=TRANSITIONS[mode==='legacy'?'legacy':'extended'];assert.equal(transitions,expected[meta.id]??expected._);
});
