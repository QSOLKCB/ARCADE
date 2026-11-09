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
 commando:'d5125b2306f5a0a9040b29110cc7b2e73a3387185dd32d92768e284ad50e5ffa',
 lantern:'9ee2e0a936f8fb156958b5c49350e5507a6aa501f6fbab582a6ef657bc9e037f',
 sleepwalker:'cf55e265068d44d620b7023a288327feeeed4017c200dbe3a088fd186e0e4f25',
 lancer:'eebf0fc68b6ca05ecc43fc3c80cef3298c145098f37700a43d23e126efd8fbe4',
 canal:'8c6e56e41f17cd10841b77d3b3d30546ab26c765dca88333ec2eaab7197b07cc',
 skyline:'d9ce9e47d894140305a46fbad4938f3e18537ef80a5ecb658da4e6547f960820',
 stratos:'7f42a84418081db3a788f9bde643cb79af2f22cd0fc37e61a99bb36bfe801100',
 feud:'128aa7ef6c0aab80c27a1cf61b4356aecb8d5f20d426fa07b1f9a80b9e08512f',
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

// Jump rise measured from the real physics; a ledge must sit at least 4 px under it.
const jumpRise=id=>{const g=make(id);g.inv=99999;const y0=px(g.p.y);let top=y0;
 g.tick({...A.empty(),cPressed:true,c:true});for(let i=0;i<80;i++){g.foes=[];if(g.slag)g.slag=[];g.tick({...A.empty(),c:true});top=Math.min(top,px(g.p.y));}return y0-top;};
test('Commando and Lantern: every ledge is within jump reach (PR #11 review)',()=>{
 for(const id of ['commando','lantern']){
  const rise=jumpRise(id),g=make(id);
  for(let s=0;s<3;s++){g.stage=s;g.setup();for(const [x,y] of g.ledges)assert.ok(303-y<=rise-4,id+' stage '+(s+1)+' ledge at '+x+' is '+(303-y)+' px high; jump rises '+rise.toFixed(1));}
 }
});

test('Overclock Commando: a runner that falls into a pit cannot touch the player that tick (PR #11 review)',()=>{
 const g=make('commando');g.inv=0;const [l]=g.pits[0];const lives=g.lives;
 g.foes=[{kind:'runner',x:q(l+10),y:q(303),hp:1,maxHP:1,cd:999,flash:0,uid:1,vx:q(1)}];Object.assign(g.p,{x:q(l+16),y:q(303)});
 g.pits=[[l,l+60]];run(g,1);assert.equal(g.lives,lives);
});

test('Overclock Commando: turret firing warnings survive the lite FX tier (PR #11 review)',()=>{
 const g=make('commando'),t=g.foes.find(f=>f.kind==='turret');t.cd=5;g.camera=t.x-q(300);
 for(const quality of ['high','lite']){G.setQuality(quality);const c=recordingContext(null,{logging:true});g.draw(c);
  assert.ok(c.log.some(e=>e==='fillStyle=#ff4d4d'),quality+' tier draws the muzzle flare');}
 G.setQuality('high');
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

test('Skyline Overdrive: a target locks exactly when it appears inside the drawn reticle (PR #11 review)',()=>{
 const g=make('skyline'),c=recordingContext();
 const inBox=f=>{const [rx,ry]=g.project(g.p.x,g.p.y,1800),[sx,sy]=g.project(f.x,f.y,f.z);return Math.abs(sx-rx)<36&&Math.abs(sy-ry)<28;};
 for(const [x,y,z] of [[190,0,700],[300,0,3000],[0,0,1500],[120,60,2600],[-80,-40,900],[400,100,3300]]){
  const f={kind:'fighter',x,y,bx:x,by:y,z,hp:1,uid:1};
  assert.equal(g.inReticle(f),inBox(f),'target at '+[x,y,z]);
 }
 assert.equal(g.inReticle({x:190,y:0,z:700}),false,'a near target off to the side is outside the reticle');
 assert.equal(g.inReticle({x:300,y:0,z:3000}),true,'a far target inside the reticle locks');
 g.draw(c);assert.ok(c.calls.includes('strokeRect'));
});

test('Pixel Sleepwalker: the extra-life crystal reward is reachable (PR #11 review)',()=>{
 const g=make('sleepwalker');let blocks=0;
 for(let s=0;s<3;s++){g.stage=s;g.setup();blocks+=g.blocks.filter(k=>k.kind==='s').length;}
 const h=make('sleepwalker'),lives=h.lives;
 for(let i=0;i<6;i++)h.gainCrystal({x:100,y:200});
 assert.equal(h.lives,lives+1,'six crystals earn a life');
 assert.ok(blocks>=18,'enough crystal blocks for three extra lives: '+blocks);
});

test('Pixel Sleepwalker: a sleepwalker sinking in a pit cannot step back onto the bank (PR #11 review)',()=>{
 const g=make('sleepwalker');g.foes=[];g.inv=999;const [l,r]=g.pits[0];
 Object.assign(g.p,{x:q(r-6),y:q(330),vy:q(1),grounded:false});const lives=g.lives;
 run(g,1,{x:1,c:true});assert.ok(g.p.y>q(303),'still falling, not snapped to y 303');
 run(g,40,{x:1,c:true});assert.equal(g.lives,lives-1,'the fall costs a life');
});

test('Hard Court Feud: a stunned ball carrier cannot shoot or pass until recovered (PR #11 review)',()=>{
 const g=make('feud');g.pause=0;g.ball.holder=0;g.men[0].stun=30;
 run(g,1,{aPressed:true});assert.equal(g.ball.holder,0,'no shot while stunned');assert.equal(g.ball.flight,null);
 run(g,1,{bPressed:true});assert.equal(g.ball.holder,0,'no pass while stunned');
 const h=make('feud');h.pause=0;h.ball.holder=2;h.men[2].stun=30;h.men[2].shot=0;Object.assign(h.men[2],{x:q(90),y:q(276)});
 for(const m of h.men)if(m!==h.men[2])m.x=q(560);
 run(h,5);assert.equal(h.ball.holder,2,'a stunned rival keeps the ball without shooting');
});

test('Lattice Lancer: entities project exactly onto the straight painted rails (PR #11 review)',()=>{
 for(let lane=0;lane<5;lane++){
  const [x0,y0]=A.Lancer.project(lane,0),[x1,y1]=A.Lancer.project(lane,1000);
  for(const z of [150,400,500,750,900]){const [x,y]=A.Lancer.project(lane,z);
   assert.ok(Math.abs(x-(x0+(x1-x0)*(y-y0)/(y1-y0)))<1e-9,'lane '+lane+' z '+z+' lies on its rail');}
 }
});

test('Skyline Overdrive: the jet is drawn where its collision checks place it (PR #11 review)',()=>{
 const g=make('skyline'),c=recordingContext(null,{logging:true});g.inv=0;g.draw(c);
 const [sx,sy]=g.project(g.p.x,g.p.y+40,300);assert.ok(c.log.includes('translate('+sx+','+sy+')'),'jet translated to its projected collision point');
 // Flak at the jet's drawn position hits; flak at the reticle's aim point 40 px above passes.
 const h=make('skyline');h.inv=0;const lives=h.lives;h.flak=[{x:0,y:40,z:340,vx:0,vy:0}];run(h,1);assert.equal(h.lives,lives-1);
 const k=make('skyline');k.inv=0;k.flak=[{x:0,y:-40,z:340,vx:0,vy:0}];run(k,1);assert.equal(k.lives,lives);
});

test('Stratos Ward: an enemy killed by the last bomb pulse cannot cost a ship (PR #11 review)',()=>{
 const g=make('stratos');g.inv=0;g.bomb=1;const lives=g.lives;
 g.foes=[{kind:'heli',x:g.p.x,y:g.p.y,vx:0,vy:0,hp:1,age:0,cd:999,flash:0,uid:99}];
 run(g,1);assert.equal(g.lives,lives);assert.equal(g.foes.length,0);
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

test('Hard Court Feud: the ball is in the inbounder\'s hands during every pause (PR #11 review)',()=>{
 const g=make('feud'),held=()=>{const h=g.men[g.ball.holder];return Math.abs(g.ball.x-h.x)<=q(8)&&g.ball.y===h.y;};
 assert.ok(g.pause>0&&held(),'opening pause');
 g.pause=0;g.giveBall(1);g.pause=30;run(g,10);assert.ok(held(),'after a basket');
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
