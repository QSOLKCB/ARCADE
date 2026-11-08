'use strict';
// ARCADE 2 presentation layer (v0.6.0): cache-key completeness, layer reuse,
// memory and draw-call budgets, FX tiers, FrameGate pacing and the audio2d bank.
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
for(const file of ['engine','core','gfx','sound','platforms','sports','kombat','breach','shooters'])require('../arcade2/'+file+'.js');
const A=globalThis.Arcade2,G=A.Gfx;
const {recordingContext,mockCanvas}=require('./arcade2-mock-canvas.cjs');
const {policy}=require('./arcade2-policy.cjs');
const ids=A.registry.map(m=>m.id);
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
// Visit frames of a full, policy-driven campaign (all stages and bosses).
function campaign(id,every,visit){
 const g=A.registry.find(m=>m.id===id).create(),control=policy(id);
 for(let t=0;t<15000&&g.status!=='won'&&g.status!=='lost';t++){
  if(g.status==='stageclear'){g.next();continue;}
  g.tick(control(g,t));g.events.length=0;
  if(t%every===0)visit(g,t);
 }
 return g;
}
function withLayers(fn){
 const factory=G.factory;G.factory=(w,h)=>mockCanvas(w,h);G.reset();
 try{return fn();}finally{G.factory=factory;G.onPaint=null;G.reset();G.setQuality('high');}
}
const frame=(ctx,g)=>{ctx.reset();g.draw(ctx);G.post(ctx,g);return ctx.calls.length;};

test('figure art is rectangular and uses only the documented legend',()=>{
 for(const kind of ['ninja','trooper'])for(let frame=0;frame<3;frame++)for(let flutter=0;flutter<2;flutter++){
  const art=G.personArt(kind,frame,flutter);assert.equal(art.length,14);
  for(const row of art){assert.equal(row.length,12,kind+' '+frame+' '+row);assert.match(row,/^[.kpdhsSawmnb]+$/);}
 }
});

test('every cached layer is keyed by all of its paint inputs (OPT-INC-001)',()=>withLayers(()=>{
 // Clearing the caches before sampled frames forces each key to be painted again
 // from later game states. A key whose paint read anything outside the key would
 // produce a different draw log under the same key.
 const seen=new Map();let compared=0;const ctx=recordingContext();
 G.onPaint=(cache,key,canvas)=>{
  const digest=sha(canvas.getContext('2d').log.join('\n')),id=cache+'|'+key;
  if(seen.has(id)){assert.equal(digest,seen.get(id),'layer '+id+' painted differently under the same key');compared++;}
  else seen.set(id,digest);
 };
 for(const quality of ['high','lite']){G.setQuality(quality);
  for(const id of ids)campaign(id,173,g=>{G.reset();frame(ctx,g);});
 }
 assert.ok(seen.size>150,'many distinct layers were checked: '+seen.size);
 assert.ok(compared>seen.size,'keys were repainted and compared: '+compared);
}));

test('layers are materialised once, reused and kept inside their pixel budgets (OPT-FAN-001, OPT-CACHE-001)',()=>withLayers(()=>{
 const ctx=recordingContext();
 for(const id of ids){
  G.reset();
  campaign(id,2,g=>frame(ctx,g));
  const s=G.stats();
  for(const [name,cache] of Object.entries(s))assert.ok(cache.pixels<=cache.budget,id+' '+name+' within budget');
  const hits=s.scenery.hits+s.sprites.hits+s.kernels.hits,misses=s.scenery.misses+s.sprites.misses+s.kernels.misses;
  assert.ok(hits/(hits+misses)>0.97,id+' layer reuse ratio '+(hits/(hits+misses)).toFixed(3));
  // Redrawing an unchanged state materialises nothing new.
  const g=A.registry.find(m=>m.id===id).create();frame(ctx,g);
  const before=JSON.stringify(G.stats());frame(ctx,g);
  for(const cache of Object.values(G.stats()))assert.ok(cache.misses>=0);
  const after=G.stats();for(const name of Object.keys(after))assert.equal(after[name].misses,JSON.parse(before)[name].misses,id+' '+name+' no repaint of a warm frame');
 }
}));

test('a full eviction cycle stays bounded and keeps drawing correctly',()=>withLayers(()=>{
 const ctx=recordingContext(),scenery=G.caches.scenery,budget=scenery.budget;
 scenery.budget=400000;
 try{
  for(const id of ['shadow','iron','vector','soccer','kombat','breach'])campaign(id,97,g=>frame(ctx,g));
  assert.ok(scenery.evictions>0,'small budget forces evictions');assert.ok(scenery.pixels<=400000);
 }finally{scenery.budget=budget;}
}));

// Deterministic draw-call ceilings per frame (canvas API calls, warm caches).
// Measured under this harness (policy campaigns, every 5th tick): the v0.5.0
// renderer averaged 200-815 calls per frame and peaked at 1,402 (Spaced
// Invaders), because every sprite pixel, window and spectator was a fillRect.
// v0.6.0 averages 98-338 (full) with peaks of 866 full / 231 lite.
const BUDGET={high:1000,lite:300};
test('per-frame draw calls stay within the budget in both FX tiers (OPT-BUDGET-001)',()=>withLayers(()=>{
 const ctx=recordingContext(),report={};
 for(const id of ids){
  const peaks={};
  for(const quality of ['high','lite']){
   G.setQuality(quality);let peak=0;
   campaign(id,5,g=>{peak=Math.max(peak,frame(ctx,g));});
   peaks[quality]=peak;
   assert.ok(peak<=BUDGET[quality],id+' '+quality+' peak '+peak+' > '+BUDGET[quality]);
  }
  assert.ok(peaks.lite<=peaks.high,id+' lite tier never draws more than full');
  report[id]=peaks;
 }
 if(process.env.ARCADE2_PRINT_BUDGET)console.log(JSON.stringify(report));
}));

test('renderer works without offscreen canvases and in both tiers without touching state',()=>{
 const ctx=recordingContext();
 for(const quality of ['lite','high']){G.setQuality(quality);
  for(const id of ids){const g=A.registry.find(m=>m.id===id).create();for(let i=0;i<240;i++)g.tick({...A.empty(),x:1,a:i%9<5,aPressed:i%9===0,aReleased:i%9===5});
   const snapshot=JSON.stringify(g);frame(ctx,g);assert.equal(JSON.stringify(g),snapshot);}
 }
 G.setQuality('high');
 assert.equal(G.setQuality('bogus'),'high');assert.equal(G.setQuality('lite'),'lite');G.setQuality('high');
});

test('low-health alarm and CRT pass follow state and tier only',()=>withLayers(()=>{
 const ctx=recordingContext(),g=A.registry.find(m=>m.id==='shadow').create();
 const count=()=>{ctx.reset();G.post(ctx,g);return ctx.calls.filter(c=>c==='drawImage').length;};
 assert.equal(count(),1,'CRT only');g.hp=20;assert.equal(count(),2,'alarm + CRT');
 G.setQuality('lite');assert.equal(count(),1,'alarm survives lite');g.hp=100;assert.equal(count(),0);
 g.hp=20;g.status='lost';assert.equal(count(),0,'no alarm after the run ends');
}));

test('FrameGate key draws exactly once per simulation step and on shell invalidation',()=>{
 const g=A.registry.find(m=>m.id==='vector').create(),clock=new A.Engine.FixedClock({step:1/60,maxFrame:.1,maxSteps:6,snapTolerance:.0005});
 const gate=new A.Engine.FrameGate();let generation=0,draws=0;
 const present=()=>gate.present({key:generation+'|vector|'+g.tickCount+'|'+g.stage+'|'+g.status+'|'+G.quality(),width:640,height:360},()=>draws++);
 for(let i=0;i<720;i++){clock.advance(1/144,()=>g.tick(A.empty()));present();}
 assert.equal(clock.ticks,300);assert.equal(draws,301,'initial frame + one per tick at 144 Hz');
 present();assert.equal(draws,301,'idle frames are skipped');
 generation++;gate.invalidate();present();assert.equal(draws,302,'shell change redraws');
 G.setQuality('lite');present();assert.equal(draws,303,'tier change redraws');G.setQuality('high');
});

test('audio2d effects bank is valid, bounded, unclipped and deterministic',()=>{
 const S=A.Sound,parts=[];
 assert.deepEqual(S.names.sort(),['blast','block','dash','hurt','jump','lose','pickup','shot','win']);
 for(const name of S.names){
  const pcm=S.pcm(name),again=A.Engine.createSound2D(S.BANK[name]).renderAll();
  assert.ok(pcm instanceof Int16Array);assert.ok(pcm.length>0&&pcm.length<=S.RATE,name+' at most one second');
  assert.deepEqual(Array.from(again),Array.from(pcm),name+' renders identically');
  let peak=0;for(const v of pcm)peak=Math.max(peak,Math.abs(v));
  assert.ok(peak>1000&&peak<32767,name+' audible without clipping: '+peak);
  for(const e of S.BANK[name].events)assert.ok(e.channel>=0&&e.channel<4);
  parts.push(name+':'+Buffer.from(pcm.buffer).toString('base64'));
 }
 assert.equal(S.pcm('unknown'),S.pcm('shot'));
 assert.equal(sha(parts.join('|')),'c2edae152c357357ed844b053d437cd234d359584d97b627b307dfb0fe8714c8','bank PCM pin');
});

test('Breach cover art shows rubble only at zero health, and full health is undamaged',()=>withLayers(()=>{
 const ctx=recordingContext(),g=A.registry.find(m=>m.id==='breach').create();g.enemies=[];
 const keyFor=hp=>{const keys=[];G.reset();G.onPaint=(cache,key)=>{if(key.startsWith('cover:'))keys.push(key);};
  for(const wall of g.cover)wall.hp=hp;frame(ctx,g);G.onPaint=null;return [...new Set(keys)];};
 assert.deepEqual(keyFor(0),['cover:3'],'destroyed');
 assert.deepEqual(keyFor(100),['cover:0'],'full health is intact');
 for(let hp=1;hp<=100;hp++){const [key]=keyFor(hp);assert.notEqual(key,'cover:3','hp '+hp+' still protects, so it must not look destroyed');}
 assert.deepEqual([keyFor(67),keyFor(66),keyFor(34),keyFor(33),keyFor(1)].flat(),['cover:0','cover:1','cover:1','cover:2','cover:2']);
}));
