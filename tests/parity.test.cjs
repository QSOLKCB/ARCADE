'use strict';
// Exact-replay parity gate. Every cabinet runs a scripted, input-driven session and the complete
// game state is hashed once per simulated second. Optimizations must reproduce these hashes
// exactly; update the pins only for an intentional rule change (QSOLKCB/OPT: keep a deterministic
// reference and require exact equivalence before claiming a speedup).
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
for(const file of ['core','draw','vanilla2d','games/kestrel','games/iron','games/heist','games/ninja','games/hockey','games/brawl','games/chrono','games/breaker','games/void'])require(path.join(__dirname,'../js',file+'.js'));
const A=globalThis.Arcade;
const TYPES={iron:A.Iron,heist:A.Heist,ninja:A.Ninja,hockey:A.Hockey,brawl:A.Brawl,chrono:A.Chrono,breaker:A.Breaker,void:A.Void,kestrel:A.Kestrel};
const ORDERS=['SCAN','JUMP 2 3','SHIELD 400','BEAM 300','MOVE 4 4','LANCE 5 2','DOCK','REPAIR','WAIT','STATUS','HELP','MAP'];

// Stable serialization of plain game state: functions are skipped and repeated references are
// written once, so the hash covers every simulation and presentation value a session can reach.
function snapshot(value){
  const seen=new WeakSet();
  return JSON.stringify(value,(key,v)=>{
    if(typeof v==='function')return undefined;
    if(typeof v==='number'&&!Number.isFinite(v))return String(v);
    if(v&&typeof v==='object'){if(seen.has(v))return '[ref]';seen.add(v);}
    return v;
  });
}
function script(frame,id){
  const a=A.emptyInput(),t=frame/60;
  a.x=Math.round(Math.sin(t*1.7)*2)/2;a.y=Math.round(Math.cos(t*1.3)*2)/2;
  a.fire=frame%23<12;a.special=frame%97===0;a.specialPressed=a.special;
  a.jump=frame%71===0;a.jumpPressed=a.jump;a.interact=frame%53<3;a.interactPressed=frame%53===0;
  if(id==='iron'||id==='hockey'||id==='breaker')a.aim={x:240+Math.round(Math.sin(t)*150),y:135+Math.round(Math.cos(t*.7)*80)};
  return a;
}
function session(id,options,seconds=60){
  const g=new TYPES[id](options,()=>{}),hash=crypto.createHash('sha256');
  for(let frame=0;frame<seconds*60;frame++){
    if(g.state!=='playing'&&g.state!=='victory'&&g.state!=='gameover'){const m=g.menu();if(m.choices&&frame===0)g.action(m.choices[m.choices.length-1].id);g.action(m.action);}
    if(id==='void'&&frame%90===0)g.queue(ORDERS[(frame/90)%ORDERS.length]);
    if(g.state==='playing')g.update(A.STEP,[script(frame,id),script(frame+31,id)]);
    if(frame%60===59)hash.update(snapshot(g));
  }
  return {hash:hash.digest('hex'),state:g.state,score:g.score};
}
const CASES=[
  ['iron',{players:2,difficulty:'arcade'}],['iron',{players:1,difficulty:'relaxed'}],
  ['heist',{difficulty:'arcade'}],['ninja',{players:2,difficulty:'arcade'}],['ninja',{players:1,difficulty:'relaxed'}],
  ['hockey',{difficulty:'arcade',aiDifficulty:'expert'}],['hockey',{difficulty:'relaxed',aiDifficulty:'rookie'}],
  ['brawl',{difficulty:'arcade'}],['chrono',{difficulty:'arcade'}],['chrono',{difficulty:'relaxed'}],
  ['breaker',{difficulty:'arcade'}],['void',{difficulty:'arcade'}],['void',{difficulty:'relaxed'}],
  ['kestrel',{difficulty:'arcade'}],['kestrel',{difficulty:'relaxed'}],
];
// Recorded from 847b0da (v0.3.0) before any change in this branch.
const PINNED={
  "iron:{\"players\":2,\"difficulty\":\"arcade\"}": "6f468d8b846c2db69672f08f8ca7945ae814dc1ac2deea2639511b6849fb2710",  // playing 400
  "iron:{\"players\":1,\"difficulty\":\"relaxed\"}": "f6f90c4a50f95b297f6bd32c0d9fd4b3f662e7f22e8ebdda819b4e0050b63575",  // playing 300
  "heist:{\"difficulty\":\"arcade\"}": "4dd82b64eb5aca0a84a33e9ac4456eb607b30967adb220225f7d6a9f301e40ea",  // playing 500
  "ninja:{\"players\":2,\"difficulty\":\"arcade\"}": "606509fa835fa1961cb1cf11f513f07c995f3e8d0018c621ff16ecc937737361",  // playing 1050
  "ninja:{\"players\":1,\"difficulty\":\"relaxed\"}": "747b65047be76487a89e3e4119f8b3a150773ca4d68c5e84631cb401f2f9eeea",  // playing 750
  "hockey:{\"difficulty\":\"arcade\",\"aiDifficulty\":\"expert\"}": "1abbfd55a3c2be5f5b4009f0959ea7d224de605f33310557290debc5b0053b7d",  // gameover 0
  "hockey:{\"difficulty\":\"relaxed\",\"aiDifficulty\":\"rookie\"}": "f80e4f3ad5377ee6f8f834308f9458e0fd52615caa412254fd81d1e668fcfbfe",  // gameover 3000
  "brawl:{\"difficulty\":\"arcade\"}": "7f15fedd805644ffaca72b7a66a402e5795b89284c888219b3d40a7681770a94",  // playing 6100
  "chrono:{\"difficulty\":\"arcade\"}": "8ad7ef364bda96eb90fb390cc1f21ab6e974578529bf804626d6694756a91615",  // gameover 1200
  "chrono:{\"difficulty\":\"relaxed\"}": "ec3ff9128d524f71ce8e2c86b2105f07994f4bec3d5c7e0b19148304bef2b647",  // playing 6250
  "breaker:{\"difficulty\":\"arcade\"}": "755a509593f6746b5e8fc21c26429bba300f7c5f2b892200fd916641956f9e36",  // gameover 500
  "void:{\"difficulty\":\"arcade\"}": "15b1adf4a17461412348dd4f6da4973919fcda3ba705b4e8e5820373689d073e",  // playing 0
  "void:{\"difficulty\":\"relaxed\"}": "470180762e2fd0ae486740451fd3caab6308017935368fa5fa021f1c94ff7ab7",  // playing 0
  // Added in v0.5.0 with the new ninth cabinet, then re-recorded in the same release when the snapshot
  // gained the explosion, wreckage and scorch pools. Score and state are unchanged, and the simulation
  // fields alone hash identically to the build before the graphics pass (see docs/VERIFICATION.md).
  "kestrel:{\"difficulty\":\"arcade\"}": "baaf23417462d0dc4cc4cc9a7ca215817d8ab317f138e685ee0c60d8c1d155fd",  // gameover 3380
  "kestrel:{\"difficulty\":\"relaxed\"}": "2b545bb463279ae564127b13a3a85d8e0c122d5c592c0ceb5e35183ab43ad296",  // playing 11750
};
if(process.env.ARCADE_PRINT_PARITY){
  for(const [id,options] of CASES){const r=session(id,options);console.log(JSON.stringify(id+':'+JSON.stringify(options))+': '+JSON.stringify(r.hash)+', // '+r.state+' '+r.score);}
}else{
  for(const [id,options] of CASES){
    const key=id+':'+JSON.stringify(options);
    test('exact replay parity: '+key,()=>{const r=session(id,options);assert.equal(r.hash,PINNED[key],'state diverged from the pinned reference ('+r.state+', score '+r.score+')');});
  }
}
