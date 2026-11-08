'use strict';
// Simulation parity pins for ARCADE 2 (v0.6.0 graphics pass).
// The hashes below were recorded from the v0.5.0-r3 simulation *before* any
// presentation work. Every scripted session hashes the complete game state at
// fixed checkpoints, and drawing runs between ticks with a recording context,
// so a renderer that mutated state (or a "visual" change that leaked into the
// 60 Hz fixed tick) would change a pin. Update only for an intentional rule
// change, and say so in CHANGELOG.md.
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
for(const file of ['engine','core','gfx','platforms','sports','kombat','breach','shooters'])require('../arcade2/'+file+'.js');
const A=globalThis.Arcade2;
const {recordingContext}=require('./arcade2-mock-canvas.cjs');
const {policy}=require('./arcade2-policy.cjs');

const PINS={
 shadow:'069d648233df912894d5667d4c02b440b935a2239056779ee7e07a375c126868',
 soccer:'a79944982f041701297277acc8ac2bb45109aa5b65284735e73d735b9a5ed0dc',
 hoops:'7e3da1080d37979e18a3c137adb41ae9cca240f47f3601f879dfb48313d77783',
 kombat:'a1f63fb245d8122ef06f6bf6fb542c4054733bbbd65d8e574451f2818697f09f',
 cache:'65a7b95993885f6803e30213dc75c203661e222834f57122e701cd7e82d4cee5',
 breach:'522dcd5a2a1933b225ae9ed2bae2a5f65e07f6e9216f8a93f122255cf37885ef',
 invaders:'60c8ef5f22df6b70108d52ad27479cd4b830dfca1c28dec03aa2dc4214087f29',
 iron:'2d79de86193d37cb80006f8f10c5d213760920180142901671c570888c64d004',
 vector:'67992200e681d852fe35c9526ea81348b995f60e556d93918ab6e04bda797709',
 ember:'95b740f9739f3b0b2ed13e73b02945585d46b457707f36a4a11121f4674131a9',
};
function session(id,draw){
 const g=A.registry.find(m=>m.id===id).create(),hash=crypto.createHash('sha256');
 const ctx=draw?recordingContext():null;
 for(let i=0;i<5400;i++){
  const input={...A.empty(),x:i%300<170?1:i%300<240?0:-1,y:i%220<60?-1:i%220<120?0:1,
   a:i%37<26,b:i%113<9,c:i%151<40,aPressed:i%37===0,aReleased:i%37===26,
   bPressed:i%113===0,cPressed:i%73===0,dPressed:i%211===0,
   aim:id==='breach'&&i%500<250?{x:120+(i*7)%400,y:80+(i*3)%170}:null};
  g.tick(input);g.events.length=0;
  if(draw&&i%4===0){g.draw(ctx);A.Gfx.post(ctx,g);ctx.reset();}
  if(i%600===599)hash.update(JSON.stringify(g));
  if(g.status==='stageclear')g.next();
 }
 hash.update(JSON.stringify(g));
 return hash.digest('hex');
}
const CAMPAIGN={
 shadow:'4217450eff13dd8ee2cfeb999688053331f0fa63d85bcac3b79953a501d56c36',
 soccer:'07d4bb809ac53f07d7d266a7ffadcc0c377b94aea671ebe89212a74362bd1f7f',
 hoops:'082d9095f607eb83a2be0d1ae72a44319f923cdc3b682ea3e499f1a36b185cd9',
 kombat:'d5ab98c2c4462b494b7f9976ab7b422a144ce53e1c2bf430868968eb8acc0f04',
 cache:'e071828f8499944bd7a737a87dbeaf9a4d0688642f8b9b8cd70a90d7b489c640',
 breach:'0839ca6cf99ebdc0dbafe6de0163069eef4080b362367bd8667e8c023831bbd4',
 invaders:'c70e39c379775075330309acc5d4c0b0c20d35fd34885b17d3893c13116513e5',
 iron:'abee1ba9973c19b4e2ab04f755f7ea3507231c6fef2a6737da8d0205943ff909',
 vector:'fe86258013e1db35898d162bc1dc3e019a9fe631228e83ed1044cc1b679ef714',
 ember:'a9a792e0465ee7ad062c2ed7fe840b08bdd05fccfb2e99b5c368a9326fb1816d',
};
// The state-aware playthrough policy completes every campaign, so these pins
// cover all stages, bosses and stage-clear transitions.
function campaign(id,draw){
 const g=A.registry.find(m=>m.id===id).create(),control=policy(id),hash=crypto.createHash('sha256');
 const ctx=draw?recordingContext():null;
 for(let t=0;t<15000&&g.status!=='won'&&g.status!=='lost';t++){
  if(g.status==='stageclear'){hash.update(JSON.stringify(g));g.next();continue;}
  g.tick(control(g,t));g.events.length=0;
  if(draw&&t%3===0){g.draw(ctx);A.Gfx.post(ctx,g);ctx.reset();}
  if(t%500===499)hash.update(JSON.stringify(g));
 }
 assert.equal(g.status,'won');
 hash.update(JSON.stringify(g));
 return hash.digest('hex');
}
for(const id of Object.keys(CAMPAIGN)){
 test(id+' full campaign state matches the pre-graphics pin, with and without rendering',()=>{
  const plain=campaign(id,false);
  if(process.env.ARCADE2_PRINT_PINS)console.log('campaign',id,plain);
  assert.equal(plain,CAMPAIGN[id],'campaign state hash');
  assert.equal(campaign(id,true),plain,'drawing between ticks never changes simulation state');
 });
}
for(const id of Object.keys(PINS)){
 test(id+' fixed-tick simulation matches the pre-graphics pin, with and without rendering',()=>{
  const plain=session(id,false);
  if(process.env.ARCADE2_PRINT_PINS)console.log(id,plain);
  assert.equal(plain,PINS[id],'simulation state hash');
  assert.equal(session(id,true),plain,'drawing between ticks never changes simulation state');
 });
}
