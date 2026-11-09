'use strict';
// Neon Ronin fighter select (v0.9.0): a roster chosen at every district clear. KAGE is the
// original hero with the original numbers; tests/parity.test.cjs proves a run without a pick
// is unchanged. These tests cover unlocks, picks, each fighter's skills and completability.
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../js/core.js');require('../js/games/ninja.js');
const A=globalThis.Arcade,F=A.Ninja.FIGHTERS;
const clear=(g,stage)=>{g.stage=stage;g.setup();g.state='stageclear';};
const ids=g=>g.menu().choices.map(c=>c.id);

test('the default run carries no fighter state and offers no choice before the first clear',()=>{
 const g=new A.Ninja({players:2});
 assert.equal(g.menu().choices,undefined);
 assert.ok(g.players.every(p=>!('fighter' in p)&&!('air' in p)));assert.equal(g.picks,undefined);
 g.action('start');assert.equal(g.menu().choices,undefined);
});

test('defeated bosses join the roster: the Lantern Warden after district 1, the Iron Jackal after district 2',()=>{
 const g=new A.Ninja({players:1});
 clear(g,0);assert.deepEqual(ids(g),['pick0:kage','pick0:tsuru','pick0:warden']);
 assert.match(g.menu().description,/LANTERN WARDEN was defeated and joins your roster/);
 clear(g,1);assert.deepEqual(ids(g),['pick0:kage','pick0:tsuru','pick0:warden','pick0:jackal']);
 assert.match(g.menu().description,/IRON JACKAL was defeated/);
 // The final boss ends the game, so no fighter is defined for a district-3 clear.
 assert.ok(Object.values(F).every(f=>f.joins<=2));
});

test('a pick applies to the next district, persists, and each player picks independently',()=>{
 const g=new A.Ninja({players:2});
 clear(g,0);g.action('pick0:tsuru');g.action('pick1:warden');
 const m=g.menu();assert.ok(m.choices.find(c=>c.id==='pick0:tsuru').selected);assert.ok(m.choices.find(c=>c.id==='pick1:warden').selected);
 assert.ok(m.choices.every(c=>/^P[12] · /.test(c.label)));
 g.action('start');assert.equal(g.state,'playing');assert.equal(g.stage,1);
 assert.equal(g.players[0].fighter,'tsuru');assert.equal(g.players[0].maxHP,Math.round(120*F.tsuru.hp));
 assert.equal(g.players[1].fighter,'warden');assert.equal(g.players[1].maxHP,Math.round(120*F.warden.hp));
 g.state='stageclear';g.action('start');assert.equal(g.players[0].fighter,'tsuru','picks persist');
});

test('picks are ignored outside the stage-clear screen, for locked fighters and for absent players',()=>{
 const g=new A.Ninja({players:1});g.action('start');
 g.action('pick0:tsuru');assert.equal(g.picks,undefined,'not while playing');
 clear(g,0);g.action('pick0:jackal');g.action('pick1:tsuru');g.action('pick0:nobody');assert.equal(g.picks,undefined);
});

function fighter(kind,opts={}){
 const g=new A.Ninja({players:1,...opts});clear(g,kind==='jackal'?1:0);g.action('pick0:'+kind);g.action('start');
 g.enemies=[];g.bullets=[];g.players[0].inv=0;return g;
}
const enemy=(x,y,hp=300)=>({x,y,hp,maxHP:hp,kind:'brute',cd:9,windup:0,face:-1,walk:0,attack:0,hurt:0});
const input=over=>({...A.emptyInput(),...over});

test('fighters move at their own speeds',()=>{
 const run=k=>{const g=fighter(k);g.gates=[9999,9999,9999,9999];const x0=g.players[0].x;for(let i=0;i<30;i++)g.update(A.STEP,[input({x:1})]);return g.players[0].x-x0;};
 const d={};for(const k of Object.keys(F))d[k]=run(k);
 assert.ok(d.tsuru>d.kage&&d.kage>d.jackal&&d.jackal>d.warden,JSON.stringify(d));
});

test('Tsuru double-jumps once per jump and throws twin stars on two lanes',()=>{
 const g=fighter('tsuru'),p=g.players[0];
 g.update(A.STEP,[input({jumpPressed:true})]);for(let i=0;i<10;i++)g.update(A.STEP,[input()]);
 const vz=p.vz;g.update(A.STEP,[input({jumpPressed:true})]);assert.ok(p.vz>vz,'second jump');assert.equal(p.air,true);
 const v2=p.vz;g.update(A.STEP,[input({jumpPressed:true})]);assert.ok(p.vz<v2,'no third jump');
 for(let i=0;i<80&&p.z>0;i++)g.update(A.STEP,[input()]);assert.equal(p.air,false,'landing restores the double jump');
 g.bullets=[];p.cd=0;g.update(A.STEP,[input({fire:true})]);
 assert.equal(g.bullets.length,2);assert.deepEqual(g.bullets.map(b=>b.y-p.y).sort((a,b)=>a-b),[-9,9]);
});

test('the Lantern Warden always throws ember stars; the Iron Jackal throws a short shockwave',()=>{
 const w=fighter('warden'),pw=w.players[0];pw.cd=0;w.update(A.STEP,[input({fire:true})]);
 assert.equal(w.bullets[0].power,true);assert.equal(w.bullets[0].damage,34);
 const j=fighter('jackal'),pj=j.players[0];pj.cd=0;j.update(A.STEP,[input({fire:true})]);
 assert.equal(j.bullets[0].damage,40);assert.ok(j.bullets[0].life<.5);
});

test('an ember pickup never weakens a fighter: the Jackal keeps its 40-damage shockwave (PR #12 review)',()=>{
 const j=fighter('jackal'),p=j.players[0];p.power=20;p.cd=0;j.update(A.STEP,[input({fire:true})]);
 assert.equal(j.bullets[0].damage,40);
 const k=new A.Ninja({players:1});k.action('start');k.enemies=[];const kp=k.players[0];kp.power=20;kp.cd=0;k.update(A.STEP,[input({fire:true})]);
 assert.equal(k.bullets[0].damage,34,'KAGE keeps the original ember damage');
});

test('Iron Quake reaches every enemy in the view, not just those near the Jackal (PR #12 review)',()=>{
 const g=fighter('jackal'),p=g.players[0];g.cam=0;p.x=65;
 g.enemies=[enemy(405,p.y),enemy(470,p.y+30),enemy(600,p.y)];g.update(A.STEP,[input({specialPressed:true})]);
 assert.ok(g.enemies[0].hp<300&&g.enemies[1].hp<300,'on screen');assert.equal(g.enemies[2].hp,300,'off screen');
});

test('each storm art does what its fighter card says',()=>{
 // Gale Dash: moves along the lane and cuts every enemy it passes.
 let g=fighter('tsuru');let p=g.players[0];g.gates=[9999,9999,9999,9999];const x0=p.x;
 g.enemies=[enemy(x0+60,p.y),enemy(x0+120,p.y),enemy(x0+60,p.y+40)];g.update(A.STEP,[input({specialPressed:true})]);
 assert.ok(p.x>x0+100);assert.ok(g.enemies[0].hp<300&&g.enemies[1].hp<300);assert.equal(g.enemies[2].hp,300,'other lanes untouched');
 // Lantern Ring: burns close enemies and snuffs nearby enemy stars, but not distant ones.
 g=fighter('warden');p=g.players[0];
 g.enemies=[enemy(p.x+80,p.y),enemy(p.x+250,p.y)];g.bullets=[{x:p.x+100,y:p.y,z:15,vx:-100,life:3,damage:15,enemy:true}];
 g.update(A.STEP,[input({specialPressed:true})]);
 assert.ok(g.enemies[0].hp<300);assert.equal(g.enemies[1].hp,300);assert.equal(g.bullets.length,0);
 // Iron Quake: strikes and freezes every enemy in view.
 g=fighter('jackal');p=g.players[0];
 g.enemies=[enemy(p.x+200,p.y,300),enemy(p.x+40,p.y+30,300)];g.enemies[0].windup=.3;
 g.update(A.STEP,[input({specialPressed:true})]);
 for(const e of g.enemies){assert.ok(e.hp<300);assert.ok(e.hurt>2);assert.equal(e.windup,0);}
 const before=g.enemies.map(e=>e.x);for(let i=0;i<60;i++)g.update(A.STEP,[input()]);
 assert.deepEqual(g.enemies.map(e=>e.x),before,'frozen enemies do not advance');
 assert.ok(g.players[0].energy<100,'the quake spent energy');
 // Later hits keep the freeze (PR #12 review): ordinary hit feedback never shortens a longer stun.
 const q=fighter('jackal'),qp=q.players[0];q.enemies=[enemy(qp.x+30,qp.y,999)];
 q.update(A.STEP,[input({specialPressed:true})]);const stun=q.enemies[0].hurt;
 for(let i=0;i<20;i++){qp.cd=0;q.update(A.STEP,[input({fire:true})]);}
 assert.ok(q.enemies[0].hp<999-60,'follow-up hits landed');assert.ok(q.enemies[0].hurt>stun-21*A.STEP-1e-9,'stun not cut short');
});

// Every fighter can finish the campaign: the same scripted, real-damage input as
// tests/playthrough.test.cjs, picking the fighter at each clear once it is on the roster.
// The slowest fighter finishes in 5,172 frames; the 12,000-frame cap only bounds a failing run.
for(const kind of Object.keys(F))for(const difficulty of ['arcade','relaxed'])test(F[kind].name+' can finish all three districts ('+difficulty+')',()=>{
 const g=new A.Ninja({difficulty});g.action('start');const used=new Set();
 for(let frame=0;frame<12000&&!['victory','gameover'].includes(g.state);frame++){
  if(g.state==='stageclear'){if(g.roster().includes(kind))g.action('pick0:'+kind);g.action('start');}
  const p=g.players[0],a=A.emptyInput();used.add(p.fighter||'kage');
  const e=g.enemies.filter(e=>e.hp>0).sort((a,b)=>A.dist(a,p)-A.dist(b,p))[0];
  if(e){const dx=e.x-p.x;a.y=Math.abs(e.y-p.y)>4?Math.sign(e.y-p.y):0;if(Math.abs(dx)>115||Math.sign(dx)!==p.face)a.x=Math.sign(dx);a.specialPressed=p.energy>=60&&Math.abs(dx)<280;a.fire=true;}else a.x=1;
  a.jumpPressed=frame%48===0;g.update(A.STEP,[a]);
 }
 assert.equal(g.state,'victory');assert.equal(g.stage,2);assert.ok(used.has(kind),kind+' played');
});
