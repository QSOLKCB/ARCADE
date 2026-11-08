'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
for(const file of ['engine','core','platforms','sports','kombat','breach','shooters'])require('../arcade2/'+file+'.js');
const A=globalThis.Arcade2,q=A.q,tick=(g,n=1,input={})=>{for(let i=0;i<n;i++)g.tick({...A.empty(),...input});};
const make=id=>A.registry.find(m=>m.id===id).create();
const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),'finite draw '+String(k));},set:(o,k,v)=>{o[k]=v;return true;}});

test('ten distinct cabinets have unique identities, original controls and fixed source provenance',()=>{
 assert.equal(A.registry.length,10);assert.equal(new Set(A.registry.map(m=>m.id)).size,10);
 for(const m of A.registry){assert.equal(m.controls.length,4);assert.ok(m.description.length>50);assert.equal(m.create().id,m.id);}
 const root=path.join(__dirname,'../arcade2/vendor/vanillajs'),manifest=JSON.parse(fs.readFileSync(path.join(root,'PROVENANCE.json'),'utf8'));
 assert.equal(manifest.commit,'c8d6e9972d2214e2f5330f80f7dee49750c2e776');assert.equal(manifest.version,'1.2.0');
 for(const [file,hash]of Object.entries(manifest.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file);
 assert.equal(A.Engine.multiply(q(3,2),q(2)),q(3));assert.throws(()=>A.Engine.add(2147483647,1),RangeError);
});
for(const id of A.registry.map(m=>m.id)){
 test(id+' replay is deterministic, rendering is pure, pools stay bounded and terminal states freeze',()=>{
  const a=make(id),b=make(id);
  for(let i=0;i<6000;i++){
   const input={...A.empty(),x:i%240<120?1:-1,y:i%180<90?1:-1,a:i%42<30,b:i%100<30,c:i%200<70,
    aPressed:i%42===0,aReleased:i%42===30,bPressed:i%100===0,cPressed:i%65===0,dPressed:i%190===0};
   a.tick(input);b.tick(input);
   if(i%300===0){const snapshot=JSON.stringify(a);a.draw(ctx);assert.equal(JSON.stringify(a),snapshot,'pure render');}
   if(a.status==='stageclear'){a.next();b.next();}
  }
  assert.equal(JSON.stringify(a),JSON.stringify(b));
  assert.ok(a.effects.length<=96);assert.ok(a.events.length<=8);assert.ok((a.shots?.length||0)<=180);assert.ok((a.enemies?.length||0)<=36);
  if(a.p){assert.ok(Number.isInteger(a.p.x));assert.ok(Number.isInteger(a.p.y));}
  a.status='lost';const old=JSON.stringify(a);tick(a,90,{a:true,x:1});assert.equal(JSON.stringify(a),old);
  assert.equal(make(id).score,0);assert.equal(make(id).status,'playing');
 });
}
for(const id of ['shadow','cache','iron']){
 test(id+' damage resolves all bosses and the actual exit gate advances exactly three stages',()=>{
  const g=make(id);
  for(let stage=0;stage<3;stage++){
   assert.equal(g.stage,stage);
   g.p.x=q(2120);g.p.y=q(303);tick(g,8,{x:1});assert.equal(g.status,'playing','a live boss blocks exit');
   for(const e of g.enemies)g.damage(e,999);
   for(const h of g.hostages){g.p.x=h.x;g.p.y=h.y;g.p.vy=0;tick(g);}
   g.p.x=q(2135);g.p.y=q(303);g.p.vy=0;tick(g);
   assert.equal(g.status,stage<2?'stageclear':'won');if(stage<2)g.next();
  }
 });
 test(id+' pits cost health, return to reachable ground, and fatal damage beats a same-tick clear',()=>{
  const g=make(id);g.p.x=q(g.pits[0][0]+20);g.p.y=q(409);g.p.vy=q(5);g.inv=0;tick(g);assert.equal(g.hp,70);assert.ok(g.p.x<q(g.pits[0][0]));assert.ok(g.p.y<q(303));
  const losing=make(id);losing.hp=1;losing.inv=0;losing.p.y=q(409);losing.p.vy=q(5);losing.bossDead=true;losing.rescued=losing.hostages.length;tick(losing);assert.equal(losing.status,'lost');
 });
}
test('Shadow Circuit double jump is limited and re-arms only on landing',()=>{
 const g=make('shadow');tick(g,1,{cPressed:true});assert.equal(g.p.jumps,1);tick(g,8);tick(g,1,{cPressed:true});assert.equal(g.p.jumps,2);tick(g,5);const vy=g.p.vy;tick(g,1,{cPressed:true});assert.ok(g.p.vy>vy);tick(g,100);assert.equal(g.p.jumps,0);
});
test('Cache Ninja smoke expires, witnesses are counted once, and a missing witness locks the exit',()=>{
 const g=make('cache');tick(g,1,{bPressed:true});assert.equal(g.p.special,360);tick(g,100);assert.equal(g.inv,0);
 const h=g.hostages[0];g.p.x=h.x;g.p.y=h.y;tick(g,2);assert.equal(g.rescued,1);
 g.bossDead=true;g.p.x=q(2140);g.p.y=q(303);tick(g);assert.equal(g.status,'playing');assert.match(g.message,/FREE ALL/);
});
test('Iron Comet consumes grenades but always retains a gun; crates replenish once',()=>{
 const g=make('iron');g.bombs=0;tick(g,1,{a:true,bPressed:true});assert.equal(g.grenades.length,0);assert.ok(g.shots.some(b=>b.owner==='player'));
 const box=g.crates[0];g.p.x=box.x;g.p.y=box.y;g.hp=50;tick(g);assert.equal(g.hp,70);assert.equal(g.bombs,2);tick(g);assert.equal(g.hp,70);
});

test('soccer counts only goal-mouth crossings; both winners and losses terminate at five',()=>{
 for(const team of [0,1]){
  const g=make('soccer');g.serve=0;g.ball={x:q(610),y:q(100),vx:q(8),vy:0,owner:-1,lock:5,flight:null};tick(g);assert.equal(g.goals[0],0);assert.ok(g.ball.vx<0);
  for(let i=0;i<5;i++){g.serve=0;g.ball={x:q(team?27:613),y:q(185),vx:q(team?-5:5),vy:0,owner:-1,lock:5,flight:null};tick(g);}
  assert.equal(g.status,team?'lost':'won');
 }
});
test('football passing moves possession to a free ball and switches to the teammate',()=>{
 const g=make('soccer');g.serve=0;tick(g,1,{bPressed:true});assert.equal(g.controlled,1);assert.equal(g.ball.owner,-1);assert.ok(g.ball.vx||g.ball.vy);
});
test('basketball dunks use real flight, score two, serve to the opponent and finish at 21',()=>{
 const g=make('hoops');g.serve=0;g.players[0].x=q(550);g.players[0].y=q(174);g.ball.x=g.players[0].x;g.ball.y=g.players[0].y;g.goals[0]=19;
 g.shoot(0,22,true);assert.equal(g.ball.flight.dunk,true);tick(g,20);assert.equal(g.goals[0],21);assert.equal(g.status,'won');
 const loss=make('hoops');loss.goals[1]=20;loss.serve=0;loss.players[2].x=q(85);loss.players[2].y=q(174);loss.ball.owner=2;loss.ball.x=q(85);loss.ball.y=q(174);loss.shoot(2,22,true);tick(loss,20);assert.equal(loss.status,'lost');
});
test('basketball uses a bounded charge, handles missed rebounds and permits a buzzer shot',()=>{
 const g=make('hoops');g.serve=0;g.timeLeft=1;g.goals=[4,3];g.ball.owner=2;g.players[2].x=q(85);g.players[2].y=q(174);g.ball.x=q(85);g.ball.y=q(174);g.shoot(2,22,true);tick(g);assert.equal(g.status,'playing');tick(g,19);assert.equal(g.status,'lost');
 const miss=make('hoops');miss.serve=0;miss.shoot(0,1);miss.ball.flight.good=false;tick(miss,42);assert.equal(miss.goals[0],0);assert.equal(miss.ball.flight,null);assert.equal(miss.ball.owner,-1);assert.ok(miss.ball.vx);
});
test('sports ties enter sudden death and storage-independent games restart from fresh scores',()=>{
 for(const id of ['soccer','hoops']){const g=make(id);g.serve=0;g.timeLeft=1;tick(g,2);assert.equal(g.status,'playing');g.goals=[1,0];tick(g);assert.equal(g.status,'won');assert.deepEqual(make(id).goals,[0,0]);}
});

test('Kombat guard reduces damage, rollback needs meter, and fatal simultaneous damage loses',()=>{
 const a=make('kombat'),b=make('kombat');
 for(const g of [a,b]){g.p.x=q(200);g.enemy.x=q(255);g.enemy.face=-1;g.p.face=1;g.enemy.attack={kind:'kick'};}
 a.p.guard=true;a.impact(a.enemy,a.p,true);b.impact(b.enemy,b.p,true);assert.ok(a.hp>b.hp);assert.equal(a.hp,98);
 const g=make('kombat');tick(g,1,{dPressed:true});assert.equal(g.bolts.length,0);g.meter=100;tick(g,1,{dPressed:true});assert.equal(g.meter,0);assert.equal(g.bolts.length,1);
 g.hp=0;g.enemyHP=0;tick(g);assert.equal(g.status,'lost');
});
test('Kombat completes the three-incident ladder through active strikes',()=>{
 const g=make('kombat');
 for(let stage=0;stage<3;stage++){
  let guard=200;while(g.enemyHP>0&&guard--){g.p.x=q(200);g.enemy.x=q(250);g.p.face=1;g.enemy.guard=false;g.p.attack={kind:'punch'};g.impact(g.p,g.enemy,false);}
  tick(g);assert.equal(g.status,stage===2?'won':'stageclear');if(stage<2)g.next();
 }
});

test('Breach Protocol cover degrades, rolls evade and three finite waves end',()=>{
 const cover=make('breach');cover.inv=0;cover.enemies=[{x:q(320),y:q(170),hp:100,cd:0,wind:1,target:q(320),boss:false}];tick(cover,1,{y:1});assert.equal(cover.hp,100);assert.equal(cover.cover[1].hp,78);
 cover.enemies[0].wind=1;cover.p.roll=10;tick(cover);assert.equal(cover.hp,100);
 const g=make('breach');for(let stage=0;stage<3;stage++){
  let safety=4500;while(g.status==='playing'&&safety--){for(const e of g.enemies)g.damage(e,999);tick(g);}
  assert.ok(safety>0);assert.equal(g.status,stage===2?'won':'stageclear');if(stage<2)g.next();
 }
});

test('Null Vector releases charged beams, moves its pod, and bounds bursts',()=>{
 const g=make('vector');tick(g,35,{a:true});tick(g,1,{aReleased:true});assert.ok(g.shots.some(b=>b.beam&&b.damage===65));
 const p=g.pod();tick(g,1,{bPressed:true});assert.ok(p.x>g.p.x&&g.pod().x<g.p.x);
 tick(g,3,{cPressed:true});assert.equal(g.bombs,0);
});
test('Ember Wing collects options, changes scroll axis and resets finite stage resources',()=>{
 const g=make('ember');g.items.push({x:g.p.x,y:g.p.y,life:50});tick(g);assert.equal(g.power,2);tick(g,1,{a:true});assert.equal(g.shots.filter(b=>!b.enemy).length,2);
 g.status='stageclear';g.next();assert.equal(g.vertical,true);assert.equal(g.shots.length,0);assert.equal(g.bombs,2);g.status='stageclear';g.next();assert.equal(g.vertical,false);
});
for(const id of ['vector','ember'])test(id+' shield windows, all three bosses and fatal/clear precedence',()=>{
 const g=make(id);
 for(let stage=0;stage<3;stage++){
  g.stageTicks=1799;tick(g);const e=g.enemies.find(e=>e.boss);assert.ok(e);e.shield=true;g.damage(e,999);assert.ok(e.hp>0);e.shield=false;g.damage(e,999);tick(g);assert.equal(g.status,stage===2?'won':'stageclear');if(stage<2)g.next();
 }
 const dead=make(id);dead.hp=0;dead.inv=0;dead.hurt(1);dead.bossDead=true;tick(dead);assert.equal(dead.status,'lost');
});
test('Spaced Invaders clears four formations through projectile collisions and loses at the landing line',()=>{
 const g=make('invaders');
 for(let stage=0;stage<4;stage++){
  g.shield=[];
  for(const e of [...g.enemies])while(e.hp>0){g.shots=[{x:e.x,y:e.y+q(7),vy:q(-7),enemy:false}];tick(g);}
  assert.equal(g.status,stage===3?'won':'stageclear');if(stage<3)g.next();
 }
 const loss=make('invaders');loss.enemies[0].y=q(300);tick(loss);assert.equal(loss.status,'lost');
});
test('Spaced Invaders bunkers erode and immunity prevents multiple life losses on one tick',()=>{
 const g=make('invaders');g.inv=0;const block=g.shield[0];g.shots=[{x:block.x,y:block.y-q(4),vy:q(4),enemy:true}];tick(g);assert.equal(block.hp,1);
 g.shots=Array.from({length:5},()=>({x:g.p.x,y:g.p.y-q(4),vy:q(4),enemy:true}));tick(g);assert.equal(g.lives,2);
});

test('a soccer shot traverses the touchline inside the open goal mouth before scoring',()=>{
 for(const team of [0,1]){
  const g=make('soccer');g.serve=0;
  g.ball={x:q(team?70:570),y:q(185),vx:q(team?-9:9),vy:0,owner:-1,lock:60,flight:null};
  tick(g,6);assert.equal(g.goals[team],1,'goal crossing must not bounce at the pitch edge');
 }
});
test('shot-charge cancellation cannot retain a beam or basketball charge across pause',()=>{
 for(const id of ['vector','hoops']){const g=make(id);g.charge=40;g.cancelInput();assert.equal(g.charge,0);}
});
test('scrolling bulkhead half-width stays valid in checked Q16 arithmetic',()=>{
 for(const id of ['vector','ember']){const g=make(id);g.walls=[{pos:g.p.x,gap:g.p.y,width:145}];assert.doesNotThrow(()=>tick(g));assert.equal(g.hp,100);}
});

test('single-jump cabinets can cross the high-ledge gap and reach the final witness platform',()=>{
 for(const id of ['cache','iron']){
  const g=make(id);g.enemies=[];Object.assign(g.p,{x:q(960),y:q(247),vy:0,grounded:true});
  tick(g,1,{x:1,cPressed:true});tick(g,35,{x:1});assert.equal(g.p.y,q(211));assert.equal(g.p.grounded,true);
  Object.assign(g.p,{x:q(1720),y:q(303),vy:0,grounded:true});tick(g,1,{cPressed:true});tick(g,35);assert.equal(g.p.y,q(241));assert.equal(g.p.grounded,true);
 }
});
