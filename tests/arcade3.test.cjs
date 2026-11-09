'use strict';
// ARCADE 3: nine original cabinets on the shared ARCADE 2 engine. Registry, replay
// determinism, render purity, bounded pools, terminal freeze, control-only completion,
// campaign pins, draw-call budgets and per-cabinet mechanics.
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
for(const file of ['engine','core','gfx','sound'])require('../arcade2/'+file+'.js');
const IDS=['commando','lantern','sleepwalker','lancer','canal','skyline','stratos','feud','knockout'];
for(const file of ['kit','hall',...IDS])require('../arcade3/'+file+'.js');
const A=globalThis.Arcade2,G=A.Gfx,q=A.q,px=A.px;
const {recordingContext,mockCanvas}=require('./arcade2-mock-canvas.cjs');
const {policy}=require('./arcade3-policy.cjs');
const make=id=>A.registry.find(m=>m.id===id).create();
const run=(g,n,input={})=>{for(let i=0;i<n;i++)g.tick({...A.empty(),...input});};
const LEFT3=140; // Stratos Ward playfield edge
const STAGES={commando:3,lantern:3,sleepwalker:3,lancer:4,canal:3,skyline:3,stratos:3,feud:3,knockout:4};

test('nine distinct original cabinets with their own hall, controls and inspirations',()=>{
 assert.deepEqual(A.registry.map(m=>m.id),IDS);
 assert.deepEqual(A.registry.map(m=>m.number),['01','02','03','04','05','06','07','08','09']);
 for(const m of A.registry){
  assert.equal(m.controls.length,4);assert.ok(m.description.length>50);assert.ok(m.inspiredBy);
  assert.deepEqual([...m.modes],['extended']);assert.equal(m.create().id,m.id);
 }
 assert.equal(A.HALL.prefix,'qsol-arcade3:');assert.equal(A.HALL.featured,'knockout');
 const cats=Object.values(A.HALL.categories).flat();for(const id of cats)assert.ok(IDS.includes(id));
});

for(const id of IDS)test(id+' replay is deterministic, rendering is pure, pools stay bounded and terminal states freeze',()=>{
 const a=make(id),b=make(id),ctx=recordingContext();
 for(let i=0;i<6000;i++){
  const input={...A.empty(),x:i%240<120?1:-1,y:i%180<90?1:-1,a:i%42<30,b:i%100<30,c:i%200<70,
   aPressed:i%42===0,aReleased:i%42===30,bPressed:i%100===0,cPressed:i%65===0,dPressed:i%190===0};
  a.tick(input);b.tick(input);
  if(i%150===0){const snapshot=JSON.stringify(a);ctx.reset();a.draw(ctx);G.post(ctx,a);assert.equal(JSON.stringify(a),snapshot,'pure render');}
  if(a.status==='stageclear'){a.next();b.next();}
 }
 assert.equal(JSON.stringify(a),JSON.stringify(b));
 assert.ok(a.effects.length<=96);assert.ok(a.events.length<=8);
 for(const pool of ['shots','foes','bullets','items','pods','flak','missiles','sparks','pops','slag'])if(a[pool])assert.ok(a[pool].length<=160,id+' '+pool+' bounded');
 a.status='lost';const old=JSON.stringify(a);run(a,90,{a:true,x:1,aPressed:true});assert.equal(JSON.stringify(a),old);
 assert.equal(make(id).score,0);assert.equal(make(id).status,'playing');
});

// Complete campaigns driven by tests/arcade3-policy.cjs (controls only). The hash
// covers state at fixed checkpoints and every stage transition; drawing between
// ticks must not change it.
const PINS={
 commando:'60124f410951a81765d71b080aa93827095f64f6f3f76abc9b656f2eb54638a3',
 lantern:'f0817eaefeb91f2da7ea1c682e2708f77d0e5a05325a0841892ab5a41c3914f3',
 sleepwalker:'d32992a736a729d318851eb09a08fd1c1b55ae88b0dfa65bc6cc6fa063e85b51',
 lancer:'b7dd057a823d40b4055957aa71b894cd1940fa54f7eb9c4c04b0151fcb7efce8',
 canal:'8c6e56e41f17cd10841b77d3b3d30546ab26c765dca88333ec2eaab7197b07cc',
 skyline:'9d9c36ed69cfadd2d284083e58cf7775436253a706029c81c7a213fd1c20b59c',
 stratos:'7f42a84418081db3a788f9bde643cb79af2f22cd0fc37e61a99bb36bfe801100',
 feud:'2e6df869d47d3a8ee5c129b517d7eea0b133ff6b0227102d03c4f96fd0b5c7a6',
 knockout:'1c1e859abc9111e63b7294ac98c02d7062708290780ca4df6f129231f6465b09',
};
function campaign(id,draw){
 const g=make(id),control=policy(id),hash=crypto.createHash('sha256'),ctx=draw?recordingContext():null;
 let t=0,clears=0;
 for(;t<40000&&g.status!=='won'&&g.status!=='lost';t++){
  if(g.status==='stageclear'){hash.update(JSON.stringify(g));g.next();clears++;continue;}
  g.tick(control(g,t));g.events.length=0;
  if(draw&&t%4===0){g.draw(ctx);G.post(ctx,g);ctx.reset();}
  if(t%500===499)hash.update(JSON.stringify(g));
 }
 hash.update(JSON.stringify(g));
 return {g,t,clears,hash:hash.digest('hex')};
}
for(const id of IDS)test(id+' completes every stage using controls alone, and matches its campaign pin with and without rendering',()=>{
 const plain=campaign(id,false);
 if(process.env.ARCADE3_PRINT_PINS)console.log('pin',id,plain.hash,plain.t);
 assert.equal(plain.g.status,'won',id+' ended '+plain.g.status+' at tick '+plain.t+' stage '+plain.g.stage);
 assert.equal(plain.clears,STAGES[id]-1);assert.ok(plain.g.score>0);
 assert.equal(plain.hash,PINS[id],'campaign state hash');
 assert.equal(campaign(id,true).hash,plain.hash,'drawing between ticks never changes simulation state');
});

// Feud is excluded: your AI teammate can carry a game even when your own inputs are noise.
test('a naive input pattern does not finish the other campaigns (the policies are doing real work)',()=>{
 for(const id of IDS.filter(id=>id!=='feud')){
  const g=make(id);
  for(let t=0;t<40000&&g.status!=='won'&&g.status!=='lost';t++){
   if(g.status==='stageclear'){g.next();continue;}
   g.tick({...A.empty(),a:true,c:true,x:t%240<120?1:-1,y:t%300<150?-1:1,aPressed:t%37===0,bPressed:t%97===0,cPressed:t%53===0});
  }
  assert.notEqual(g.status,'won',id+' was finished by mashing');
 }
});

// Draw-call ceilings per frame (canvas API calls, warm caches), as for ARCADE 2.
// Measured: peaks of 345-764 full and 101-290 lite across the nine campaigns.
const BUDGET={high:1000,lite:350};
test('per-frame draw calls stay within the ARCADE 2 budget in both FX tiers (OPT-BUDGET-001)',()=>{
 const factory=G.factory;G.factory=(w,h)=>mockCanvas(w,h);G.reset();
 try{
  const ctx=recordingContext();
  for(const id of IDS){
   const peaks={};
   for(const quality of ['high','lite']){
    G.setQuality(quality);let peak=0;const g=make(id),control=policy(id);
    for(let t=0;t<40000&&g.status!=='won'&&g.status!=='lost';t++){
     if(g.status==='stageclear'){g.next();continue;}
     g.tick(control(g,t));g.events.length=0;
     if(t%5===0){ctx.reset();g.draw(ctx);G.post(ctx,g);peak=Math.max(peak,ctx.calls.length);}
    }
    peaks[quality]=peak;assert.ok(peak<=BUDGET[quality],id+' '+quality+' peak '+peak);
   }
   assert.ok(peaks.lite<=peaks.high,id+' lite never draws more than full');
  }
  for(const cache of Object.values(G.stats()))assert.ok(cache.pixels<=cache.budget);
 }finally{G.factory=factory;G.reset();G.setQuality('high');}
});

// ------------------------------------------------------------------ mechanics
test('Overclock Commando: spread fans five rounds, prone ducks fire and the core is shielded until its guns fall',()=>{
 const g=make('commando');g.p.weapon='spread';g.fire();assert.equal(g.shots.length,5);
 const core=g.foes.find(f=>f.kind==='core'),hp=core.hp;
 g.shots=[{x:core.x,y:core.y-q(25),vx:0,vy:0,mine:true,dmg:30,life:5,kind:'bullet'}];g.p.x=core.x-q(300);run(g,1);
 assert.equal(core.hp,hp,'shielded');
 g.foes=g.foes.filter(f=>f.kind!=='gun');g.shots=[{x:core.x,y:core.y-q(25),vx:0,vy:0,mine:true,dmg:30,life:5,kind:'bullet'}];run(g,1);
 assert.ok(core.hp<hp,'open core takes damage');
});

test('Tin Lantern: plating breaks before a life is lost, and jumps cannot be steered once committed',()=>{
 const g=make('lantern');g.inv=0;const lives=g.lives;
 g.hurt();assert.equal(g.p.armor,false);assert.equal(g.lives,lives);
 g.inv=0;g.hurt();assert.equal(g.lives,lives-1);
 const h=make('lantern');h.foes=[];h.inv=999;run(h,1,{x:1,cPressed:true});const vx=h.p.jumpVX;assert.ok(vx>0);
 const x0=h.p.x;run(h,5,{x:-1});assert.ok(h.p.x>x0,'still travelling forward');assert.equal(h.p.jumpVX,vx);
});

test('Pixel Sleepwalker levels are fair: running jumps clear every pit and moth-owls patrol clear of jumps and towers',()=>{
 const g=make('sleepwalker');
 for(let s=0;s<3;s++){
  g.stage=s;g.setup();
  for(const [l,r] of g.pits){
   for(const k of g.blocks){
    assert.ok(!(k.y<303-24&&k.x+24>l-70&&k.x<r+20),'night '+(s+1)+': floating block near pit '+l);
    assert.ok(!(k.kind==='w'&&k.x+24>r-10&&k.x<r+30),'night '+(s+1)+': wall on the landing of pit '+l);
   }
  }
  const tall=g.blocks.filter(k=>k.kind==='w'&&k.y<=303-48);
  for(const f of g.foes.filter(f=>f.kind==='moth')){
   const home=px(f.home),lo=home-67,hi=home+67;
   for(const [l,r] of g.pits)assert.ok(hi<l-70||lo>r+40,'moth '+home+' clear of pit '+l);
   for(const k of tall)assert.ok(hi<k.x-40||lo>k.x+64,'moth '+home+' clear of tower '+k.x);
  }
 }
});

test('Lattice Lancer: cargo blocks stop beams but not torpedoes, and torpedoes are limited',()=>{
 const g=make('lancer');g.inv=0;
 g.foes=[{kind:'block',lane:2,pos:32,z:600,vz:0,uid:1}];g.shots=[{kind:'beam',lane:2,z:620,mine:true}];
 run(g,1);assert.equal(g.foes.length,1,'beam absorbed');assert.equal(g.shots.filter(b=>b.kind==='beam').length,0);
 g.shots=[{kind:'torp',lane:2,z:620,mine:true}];run(g,1);assert.equal(g.foes.length,0,'torpedo destroys cargo');
 assert.equal(g.p.torps,3);for(let i=0;i<5;i++){g.shots=[];run(g,1,{bPressed:true});}assert.equal(g.p.torps,0);
});

test('Canal Cutter: every channel is at least 60 px wide, buoys recharge and a burned bridge becomes the checkpoint',()=>{
 const g=make('canal');
 for(let s=0;s<3;s++){g.stage=s;g.setup();for(let wy=0;wy<g.length;wy+=4)for(const [l,r] of g.channels(wy))assert.ok(r-l>=60,'run '+(s+1)+' channel at '+wy);}
 g.stage=0;g.setup();
 const fuel=g.fuel;run(g,30);assert.equal(g.fuel,fuel-30);
 g.foes=[{kind:'buoy',x:g.x,wy:g.dist+2,uid:1,hp:1,vx:0}];g.plan=[];g.cursor=0;run(g,1);assert.ok(g.fuel>fuel-30);
 const wy=g.dist+40;g.foes=[{kind:'bridge',x:320,wy,uid:2,hp:1,vx:0}];g.shots=[{x:g.x,wy:g.dist+36}];run(g,1);
 assert.equal(g.checkpoint,wy);
});

test('Skyline Overdrive: missiles need a lock, and a locked target is destroyed',()=>{
 const g=make('skyline');g.inv=999;
 run(g,1,{bPressed:true});assert.equal(g.missiles.length,0);
 g.foes=[{kind:'fighter',x:0,y:0,bx:0,by:0,z:1500,vz:0,hp:1,age:0,cd:999,uid:77}];
 run(g,1);assert.deepEqual(g.locks,[77]);run(g,1,{bPressed:true});assert.equal(g.missiles.length,1);
 run(g,30);assert.equal(g.kills,1);
});

test('Stratos Ward: crystals level the weapon, ward bombs clear the sky',()=>{
 const g=make('stratos');g.inv=0;
 g.items=[{kind:'crystal',x:g.p.x,y:g.p.y,vx:0,vy:0,age:g.tickCount+1-90}];run(g,1);
 assert.equal(g.p.weapon,'blue');assert.equal(g.p.level,2);
 g.bullets=[{x:q(200),y:q(100),vx:0,vy:0}];run(g,1,{bPressed:true});assert.equal(g.bullets.length,0);assert.equal(g.p.bombs,2);
});

test('Stratos Ward: a crystal dropped above or beside the playfield drifts back within reach (PR #11 review)',()=>{
 const g=make('stratos');g.inv=999;
 g.items=[{kind:'crystal',x:q(LEFT3+2),y:q(10),vx:-q(1,2),vy:q(1,2),age:0}];run(g,80);
 assert.ok(px(g.items[0].y)>=30&&px(g.items[0].x)>=LEFT3+10,'crystal re-entered the reachable range');
});

test('Knockout Circuit: a third knockdown on the final tick wins the bout instead of going to a decision (PR #11 review)',()=>{
 const g=make('knockout');Object.assign(g.r,{state:'open',t:30,downs:2,hp:1});g.clock=7;const lives=g.lives;
 run(g,1,{aPressed:true});run(g,200);
 assert.equal(g.status,'stageclear');assert.equal(g.lives,lives);
});

test('Hard Court Feud: an elbow stuns and strips a carrier, but never right after an inbound',()=>{
 const g=make('feud');g.pause=0;
 const me=g.men[0],rival=g.men[2];g.ball.holder=2;g.ball.safe=10;Object.assign(me,{x:rival.x-q(10),y:rival.y,cd:0});
 g.shove(me);assert.equal(g.ball.holder,2,'inbound protection');
 Object.assign(me,{cd:0});rival.stun=0;g.ball.safe=0;
 let stripped=false;for(let i=0;i<20&&!stripped;i++){me.cd=0;rival.stun=0;g.ball.holder=2;g.ball.safe=0;g.shove(me);stripped=g.ball.holder===-1;}
 assert.ok(stripped,'a shove eventually strips the ball');assert.ok(rival.stun>0);
});

test('Knockout Circuit: a slip opens the rival, a guard stops only jabs, and three knockdowns win',()=>{
 const g=make('knockout');g.r.state='tell';g.r.attack='hookL';g.r.t=1;
 run(g,1,{x:1});assert.equal(g.r.state,'open');
 const g2=make('knockout');g2.p.state='guard';g2.r.state='tell';g2.r.attack='hookR';g2.r.t=1;run(g2,1,{y:-1});assert.ok(g2.p.hp<100,'a guard does not stop a hook');
 const g3=make('knockout');g3.p.state='guard';g3.r.state='tell';g3.r.attack='jab';g3.r.t=1;run(g3,1,{y:-1});assert.equal(g3.p.hp,100,'a guard stops a jab');
 const g4=make('knockout');g4.r.downs=2;g4.r.hp=1;g4.r.state='open';g4.r.t=30;run(g4,8,{aPressed:true});
 assert.equal(g4.r.state,'down');run(g4,160);assert.equal(g4.status,'stageclear');
});
