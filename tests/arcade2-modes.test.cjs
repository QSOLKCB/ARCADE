'use strict';
// ARCADE 2 v0.7.0 rule sets: Legacy (v0.6.0 exactly), Extended (default) and Remix.
const {test}=require('node:test'),assert=require('node:assert/strict');
for(const file of ['engine','core','gfx','sound','platforms','sports','kombat','breach','shooters'])require('../arcade2/'+file+'.js');
const A=globalThis.Arcade2,q=A.q,px=A.px;
const make=(id,mode)=>A.registry.find(m=>m.id===id).create(mode);
const tick=(g,n=1,input={})=>{for(let i=0;i<n;i++)g.tick({...A.empty(),...input});};

test('GALAXY CORDIC port reproduces the Rust reference vectors exactly',()=>{
 // QSOLKCB/GALAXY retro/src/lib.rs, test cardinal_cordic_vectors_are_stable.
 assert.deepEqual(A.sinCosQ30(0),[1073741826,-76]);
 assert.deepEqual(A.sinCosQ30(0x40000000),[-76,1073741826]);
 assert.deepEqual(A.sinCosQ30(0x80000000),[-1073741830,79]);
 for(let i=0;i<A.Trig.STEPS;i++){
  const s=A.Trig.sin(i),c=A.Trig.cos(i);assert.ok(Number.isInteger(s)&&Number.isInteger(c));
  assert.ok(Math.abs(s/65536-Math.sin(i/512*Math.PI))<3e-5&&Math.abs(c/65536-Math.cos(i/512*Math.PI))<3e-5,'table step '+i);
 }
 assert.equal(A.Trig.sin(-1),A.Trig.sin(1023));assert.equal(A.Trig.cos(1024+5),A.Trig.cos(5));
});
test('trefoil path is integer, bounded and closes after one table period',()=>{
 let mx=0,my=0;
 for(let i=0;i<1024;i++){const [x,y]=A.trefoil(i,70,110);assert.ok(Number.isInteger(x)&&Number.isInteger(y));mx=Math.max(mx,Math.abs(x));my=Math.max(my,Math.abs(y));}
 assert.ok(mx<=q(70)&&mx>q(69),'x extent');assert.ok(my<=q(110)&&my>q(100),'y extent');
 assert.deepEqual(A.trefoil(0,70,110),A.trefoil(1024,70,110));
});

test('every cabinet offers three modes, a named Remix and fresh rule-bound games',()=>{
 for(const m of A.registry){
  assert.deepEqual([...m.modes],['extended','remix','legacy']);
  assert.ok(m.remix.name.length>3&&m.remix.summary.length>30,m.id+' remix copy');
  for(const mode of m.modes){const g=m.create(mode);assert.equal(g.rules.mode,mode);assert.equal(g.status,'playing');assert.ok(!Object.keys(g).includes('rules'),'rules stay out of state');}
  assert.equal(m.create().rules.mode,'extended','players default to Extended');
  assert.equal(m.create('bogus').rules.mode,'extended');
 }
});

test('Extended is longer than Legacy in every cabinet',()=>{
 for(const id of ['shadow','cache','iron']){assert.equal(make(id,'legacy').len,2200);assert.equal(make(id,'extended').len,3300);assert.ok(make(id,'extended').enemies.length>make(id,'legacy').enemies.length);}
 for(const id of ['vector','ember']){assert.equal(make(id,'legacy').waveEnd,1800);assert.equal(make(id,'extended').waveEnd,2700);}
 assert.equal(make('invaders','legacy').lastOrbit,3);assert.equal(make('invaders','extended').lastOrbit,4);
 assert.equal(make('kombat','legacy').lastIncident,2);assert.equal(make('kombat','extended').lastIncident,3);
 assert.equal(make('kombat','extended').roundTime,75*60);
 assert.equal(make('soccer','legacy').timeLeft,90*60);assert.equal(make('soccer','extended').timeLeft,120*60);
 assert.deepEqual(['legacy','extended','remix'].map(m=>make('soccer',m).target),[5,6,7]);
 assert.deepEqual(['legacy','extended','remix'].map(m=>make('hoops',m).target),[21,25,30]);
 assert.equal(make('breach','legacy').quota,12);assert.equal(make('breach','extended').quota,16);
});

test('Remix Shadow Circuit: the blade turns enemy fire around',()=>{
 const g=make('shadow','remix');g.inv=200;g.p.face=1;
 g.shots.push({owner:'enemy',x:g.p.x+q(30),y:g.p.y-q(20),vx:q(-3),vy:0,damage:12,type:'bolt',life:100});
 tick(g,1,{a:true});const b=g.shots.find(s=>s.damage===20);assert.ok(b,'reflected');assert.equal(b.owner,'player');assert.ok(b.vx>0);
 const l=make('shadow','extended');l.inv=200;l.p.face=1;l.shots.push({owner:'enemy',x:l.p.x+q(30),y:l.p.y-q(20),vx:q(-3),vy:0,damage:12,type:'bolt',life:100});
 tick(l,1,{a:true});assert.ok(!l.shots.some(s=>s.owner==='player'&&s.damage===20),'Extended has no ricochet');
});
test('Remix Cache Ninja: smoke recharges in half the time and witnesses heal',()=>{
 const g=make('cache','remix');tick(g,1,{bPressed:true});assert.equal(g.p.special,180);
 g.hp=50;const h=g.hostages[0];g.p.x=h.x;g.p.y=h.y;tick(g,2);assert.equal(g.rescued,1);assert.equal(g.hp,65);
 const e=make('cache','extended');tick(e,1,{bPressed:true});assert.equal(e.p.special,360);
});
test('Remix Iron Comet: three-way spread against tougher troops',()=>{
 const g=make('iron','remix'),e=make('iron','extended');tick(g,1,{a:true});tick(e,1,{a:true});
 assert.equal(g.shots.filter(b=>b.owner==='player').length,3);assert.equal(e.shots.filter(b=>b.owner==='player').length,1);
 assert.equal(g.enemies[0].maxHP,Math.round(e.enemies[0].maxHP*1.4));
});
test('Remix Floodlight FC: a long-range goal counts double',()=>{
 const g=make('soccer','remix');g.serve=0;g.players[0].x=q(380);g.players[0].y=q(188);g.ball.owner=0;g.ball.x=q(390);g.ball.y=q(188);
 g.shoot(0,0,false,0);assert.equal(g.ball.long,true,'a strike from x 390 is long range');
 const near=make('soccer','remix');near.serve=0;near.players[0].x=q(560);near.ball.owner=0;near.ball.x=q(570);near.shoot(0,0,false,0);assert.equal(near.ball.long,false);
 const goal=make('soccer','remix');goal.serve=0;goal.ball={x:q(613),y:q(185),vx:q(5),vy:0,owner:-1,lock:5,flight:null,long:true,shotAt:goal.tickCount};tick(goal);assert.equal(goal.goals[0],2);
 const stale=make('soccer','remix');stale.serve=0;stale.tickCount=500;stale.ball={x:q(613),y:q(185),vx:q(5),vy:0,owner:-1,lock:5,flight:null,long:true,shotAt:100};tick(stale);assert.equal(stale.goals[0],1,'only a fresh long strike counts double');
 const n=make('soccer','extended');n.serve=0;n.ball={x:q(613),y:q(185),vx:q(5),vy:0,owner:-1,lock:5,flight:null};tick(n);assert.equal(n.goals[0],1);
});
test('Remix Full Court.exe: shots from downtown are worth four',()=>{
 const g=make('hoops','remix');g.serve=0;g.players[0].x=q(250);g.players[0].y=q(174);g.ball.x=g.players[0].x;g.ball.y=g.players[0].y;g.ball.owner=0;
 g.shoot(0,22,false);g.ball.flight.good=true;assert.equal(g.ball.flight.points,4);tick(g,42);assert.equal(g.goals[0],4);
});
test('Remix DevOps Kombat: double meter gain and a heavier rollback',()=>{
 const r=make('kombat','remix'),e=make('kombat','extended');
 for(const g of [r,e]){g.p.x=q(200);g.enemy.x=q(250);g.p.face=1;g.enemy.guard=false;g.enemy.poise=0;g.p.attack={kind:'punch'};g.meter=0;g.impact(g.p,g.enemy,false);}
 assert.equal(r.meter,28);assert.equal(e.meter,14);
 for(const g of [r,e]){g.meter=100;g.enemyHP=100;g.enemy.x=g.p.x+q(30);tick(g,1,{dPressed:true});tick(g,3);}
 assert.equal(r.enemyHP,60);assert.equal(e.enemyHP,72);
});
test('Remix Breach Protocol: faster windups and a grenade every fifth kill',()=>{
 const g=make('breach','remix');g.bombs=0;
 for(let i=0;i<5;i++){g.enemies.push({x:q(300),y:q(150),hp:1,maxHP:1,boss:false,cd:99,wind:0,target:0,flash:0});g.damage(g.enemies.at(-1),5);}
 assert.equal(g.bombs,1);
 const w=make('breach','remix');w.enemies=[{x:q(300),y:q(150),hp:28,maxHP:28,boss:false,cd:1,wind:0,target:0,flash:0}];tick(w);assert.equal(w.enemies[0].wind,31);
});
test('Remix Spaced Invaders: a shot passes through its first kill',()=>{
 const g=make('invaders','remix');g.enemies=[{x:q(320),y:q(200),hp:1,row:1},{x:q(320),y:q(180),hp:1,row:1}];g.shield=[];g.inv=999;
 g.shots=[{x:q(320),y:q(212),vy:q(-7),enemy:false,pierce:1}];for(let i=0;i<8;i++)tick(g);
 assert.equal(g.enemies.length,0,'both invaders fell to one shot');
});
test('Remix Null Vector: a quick charge releases a piercing beam that halves per hit',()=>{
 const g=make('vector','remix');tick(g,16,{a:true});tick(g,1,{aReleased:true});const beam=g.shots.find(b=>b.beam);assert.ok(beam,'beam after 16 ticks');
 const e=make('vector','extended');tick(e,16,{a:true});tick(e,1,{aReleased:true});assert.ok(!e.shots.some(b=>b.beam),'Extended needs 25');
 // A drone bobs about 21 px on its first tick, so set its base where its next position meets the beam.
 g.enemies=[{x:beam.x+q(12),y:beam.y,hp:999,maxHP:999,boss:false,age:0,cd:999,base:beam.y+q(21),phase:0,drop:false,flash:0,shield:false}];
 tick(g);assert.equal(beam.damage,32);assert.ok(beam.life>0,'still flying');
});
test('Remix Ember Wing: Focus runs the world on alternate ticks while the meter lasts',()=>{
 const g=make('ember','remix');g.enemies=[{x:q(600),y:q(180),hp:99,maxHP:99,boss:false,age:0,cd:999,base:q(180),phase:0,drop:false,flash:0,shield:false}];
 const x0=g.enemies[0].x,t0=g.stageTicks;tick(g,10,{c:true});
 assert.equal(g.stageTicks-t0,5,'half the world ticks');assert.equal(x0-g.enemies[0].x,q(10),'enemy moved 5 steps of 2 px');assert.equal(g.focus,170);
 g.focus=0;const t1=g.stageTicks;tick(g,6,{c:true});assert.equal(g.stageTicks-t1,6,'an empty meter runs at full speed');assert.equal(g.focus,0,'and does not refill while held');
 tick(g,6);assert.equal(g.focus,2,'released, it refills one point every third tick');
 const e=make('ember','extended');tick(e,1,{cPressed:true});assert.equal(e.dodgeCD,210,'Extended keeps the dodge');
});

test('Extended bosses fly the trefoil, gain a second phase and announce themselves',()=>{
 const g=make('vector','extended');g.stageTicks=g.waveEnd-1;tick(g);const boss=g.enemies.find(e=>e.boss);assert.ok(boss);assert.ok(g.events.includes('boss'));
 for(let i=0;i<1100;i++){tick(g);if(g.status!=='playing')break;assert.ok(boss.x>=q(450)&&boss.x<=q(590)&&boss.y>=q(70)&&boss.y<=q(290),'in bounds');}
 const p=make('ember','extended');p.inv=9999;p.stageTicks=p.waveEnd-1;tick(p);const b2=p.enemies.find(e=>e.boss);b2.hp=Math.floor(b2.maxHP/3);b2.cd=1;p.shots=[];tick(p);
 assert.equal(p.shots.filter(s=>s.enemy).length,5,'phase-two volley');
 const legacy=make('vector','legacy');legacy.stageTicks=1799;tick(legacy);assert.ok(!legacy.events.includes('boss'));
});
test('Extended adds tanks, weavers, saucer salvage and medkits',()=>{
 const g=make('vector','extended');const kinds=new Set();for(let i=0;i<2000;i++){tick(g,1,{y:i%200<100?1:-1});for(const e of g.enemies)if(e.kind)kinds.add(e.kind);if(g.status!=='playing')break;}
 assert.ok(kinds.has('tank')&&kinds.has('weaver'));
 const inv=make('invaders','extended');inv.waveTicks=5;inv.bombs=1;inv.ufo={x:q(320),y:q(47),hp:1};inv.shots=[{x:q(320),y:q(50),vy:q(-7),enemy:false}];inv.shield=[];tick(inv);assert.equal(inv.bombs,2);
 const br=make('breach','extended');br.hp=50;br.kills=7;br.enemies.push({x:q(300),y:q(150),hp:1,maxHP:1,boss:false,cd:99,wind:0,target:0,flash:0});br.damage(br.enemies.at(-1),5);assert.equal(br.hp,65);
 const leg=make('breach','legacy');leg.hp=50;leg.kills=7;leg.enemies.push({x:q(300),y:q(150),hp:1,maxHP:1,boss:false,cd:99,wind:0,target:0,flash:0});leg.damage(leg.enemies.at(-1),5);assert.equal(leg.hp,50);
});
test('Legacy games carry none of the new state fields',()=>{
 for(const m of A.registry){const g=m.create('legacy');for(let i=0;i<3000&&g.status==='playing';i++){g.tick({...A.empty(),x:1,a:i%9<5,aPressed:i%9===0,aReleased:i%9===5,c:true,cPressed:i%60===0});if(g.status==='stageclear')g.next();}
  // Kombat's attacks have always had a `kind` (punch/kick); check enemy kinds via the enemy lists instead.
  const json=JSON.stringify(g);for(const key of ['"focus"','"pierce"','"long"','"shotAt"','"focusing"'])assert.ok(!json.includes(key),m.id+' legacy has no '+key);
  for(const e of g.enemies||[])assert.ok(!('kind' in e),m.id+' legacy enemies have no kind');
 }
});
test('Remix Null Vector: a piercing beam hits each enemy once and reaches the one behind',()=>{
 const g=make('vector','remix');g.inv=999;tick(g,16,{a:true});tick(g,1,{aReleased:true});const beam=g.shots.find(b=>b.beam);
 const drone=(dx)=>({x:beam.x+q(dx),y:beam.y,hp:999,maxHP:999,boss:false,age:0,cd:999,base:beam.y+q(21),phase:0,drop:false,flash:0,shield:false,uid:dx});
 g.enemies=[drone(12),drone(70)];g.shots=[beam]; // the pod's ordinary 8-damage shot is not under test
 for(let i=0;i<12;i++)tick(g);
 const [front,back]=g.enemies;
 assert.equal(999-front.hp,65,'the front drone takes one full-power hit, not four');
 assert.equal(999-back.hp,32,'the halved beam reaches the drone behind');
});
