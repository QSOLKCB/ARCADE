'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../js/core.js');require('../js/games/iron.js');require('../js/games/ninja.js');
const A=globalThis.Arcade;
// Scripted input only: no invulnerability, enemy removal or forced progression.
for(const difficulty of ['arcade','relaxed']){
 test('Iron completes a real-damage input replay in '+difficulty+' mode',()=>{
  const g=new A.Iron({difficulty});g.action('buy1');g.action('armour');g.action('deploy');
  for(let frame=0;frame<30000&&!['victory','gameover'].includes(g.state);frame++){
   if(g.state==='briefing')g.action('deploy');const p=g.players[0],a=A.emptyInput();
   const enemies=g.enemies.filter(e=>e.hp>0).sort((a,b)=>A.dist(a,p)-A.dist(b,p)),enemy=enemies[0],boss=g.enemies.find(e=>e.kind==='tank');
   const target=g.objectives.find(o=>!o.done)||(boss.hp>0?{x:240,y:270}:{x:240,y:70});const d=A.unit(target.x-p.x,target.y-p.y);
   if(A.dist(target,p)>8){a.x=d.x;a.y=d.y;}a.fire=true;a.aim=enemy?{x:enemy.x,y:enemy.y-g.cam}:{x:p.x,y:0};a.jumpPressed=frame%100===0;a.specialPressed=!!enemy&&A.dist(enemy,p)<90&&frame%80===0;
   g.update(1/60,[a]);
  }
  assert.equal(g.state,'victory');assert.equal(g.stage,2);assert.ok(g.players[0].hp>0);assert.ok(g.score>6000);
 });
 test('Ninja completes a real-damage input replay in '+difficulty+' mode',()=>{
  const g=new A.Ninja({difficulty});g.action('start');
  for(let frame=0;frame<60000&&!['victory','gameover'].includes(g.state);frame++){
   if(g.state==='stageclear')g.action('start');const p=g.players[0],a=A.emptyInput();const e=g.enemies.filter(e=>e.hp>0).sort((a,b)=>A.dist(a,p)-A.dist(b,p))[0];
   if(e){const dx=e.x-p.x;a.y=Math.abs(e.y-p.y)>4?Math.sign(e.y-p.y):0;if(Math.abs(dx)>115||Math.sign(dx)!==p.face)a.x=Math.sign(dx);a.specialPressed=p.energy>=60&&Math.abs(dx)<280;a.fire=true;}else a.x=1;
   a.jumpPressed=frame%48===0;g.update(1/60,[a]);
  }
  assert.equal(g.state,'victory');assert.equal(g.stage,2);assert.equal(g.wave,3);assert.ok(g.players[0].hp>0);
 });
}
