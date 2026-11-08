'use strict';
// The VANILLAJS 2D foundation, as shipped in js/vanilla2d.js for file:// play.
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
for(const file of ['core','vanilla2d','audio'])require(path.join(__dirname,'../js',file+'.js'));
const A=globalThis.Arcade,V=A.V2D;

test('the generated port names its exact VANILLAJS source and exposes every module',()=>{
  assert.equal(V.source.repository,'QSOLKCB/VANILLAJS');assert.match(V.source.commit,/^[0-9a-f]{40}$/);
  for(const name of ['createBody2D','stepBody2D','direction2D','distanceCheck2D','withinRange2D','createSound2D','TernaryGridStore2D','tritsForByte','byteFromTrits'])assert.equal(typeof V[name],'function',name);
});
test('motion2d shmup bodies move by exact integer subunits and respect bounds',()=>{
  let b=V.createBody2D({x:0,y:0});const bounds={minX:-100,minY:-100,maxX:100,maxY:100};
  for(let i=0;i<10;i++)b=V.stepBody2D(b,{x:1,y:-1},{profile:'shmup',bounds});
  assert.deepEqual([b.x,b.y],[100,-100]);assert.ok(Number.isInteger(b.vx));
  assert.throws(()=>V.stepBody2D(b,{x:2},{profile:'shmup',bounds}),RangeError);
});
test('A.near is an exact range2d prefilter: identical to A.dist(a, b) < r for every case',()=>{
  const r=A.rng(5),cases=[[{x:0,y:0},{x:3,y:4},5],[{x:0,y:0},{x:5,y:0},5],[{x:-5,y:0},{x:0,y:0},5],[{x:0,y:0},{x:0,y:0},0]];
  for(let i=0;i<20000;i++)cases.push([{x:(r()-.5)*400,y:(r()-.5)*400},{x:(r()-.5)*400,y:(r()-.5)*400},r()*120]);
  for(const [a,b,d] of cases){assert.equal(A.near(a,b,d),A.dist(a,b)<d);assert.equal(A.near(a,b,d),V.distanceCheck2D(a,b,d,{inclusive:false}).within);}
});
test('audio2d effects bank renders bounded, deterministic PCM16 for every effect',()=>{
  const bank=A.Audio.SFX2D;assert.ok(Object.keys(bank).length>=10);
  for(const name of Object.keys(bank)){
    const a=A.Audio.pcm(name),b=V.createSound2D(bank[name]).renderAll();
    assert.ok(a instanceof Int16Array&&a.length>0&&a.length<=48000*8,name);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(a.buffer)).digest('hex'),crypto.createHash('sha256').update(Buffer.from(b.buffer)).digest('hex'),name+' replays identically');
    assert.ok(a.some(v=>v!==0),name+' is audible');
  }
  const wav=V.createSound2D(bank.hit).wav();assert.equal(Buffer.from(wav.slice(0,4)).toString(),'RIFF');assert.equal(Buffer.from(wav.slice(8,12)).toString(),'WAVE');
});
test('ternary-store2d round-trips a score cartridge and rejects tampering',()=>{
  const store=new V.TernaryGridStore2D();store.put('arcade/scores.json',{iron:{arcade:1200}});
  const snap=JSON.parse(JSON.stringify(store.snapshot()));assert.ok(snap.rows.every(r=>r.every(t=>t===0||t===1||t===2)));
  assert.deepEqual(V.TernaryGridStore2D.fromSnapshot(snap).get('arcade/scores.json'),{iron:{arcade:1200}});
  const bad=JSON.parse(JSON.stringify(snap));bad.rows[0][0]=3;assert.throws(()=>V.TernaryGridStore2D.fromSnapshot(bad));
  for(let v=0;v<256;v++)assert.equal(V.byteFromTrits(V.tritsForByte(v)),v);
});
require(path.join(__dirname,'../js/cartridge.js'));
test('score cartridges pack local records, validate strictly and only ever raise a score',()=>{
  const packed=A.Cartridge.pack({'best.iron.arcade':4200,'best.kestrel.relaxed':9100,'best.void.arcade':0,'settings':5,'best.x.y':-3});
  const text=JSON.stringify(packed);assert.deepEqual(A.Cartridge.unpack(text),{'best.iron.arcade':4200,'best.kestrel.relaxed':9100});
  const values={};const storage=new A.Storage({getItem:k=>values[k]??null,setItem:(k,v)=>values[k]=v});storage.write('best.iron.arcade',9999);
  assert.equal(A.Cartridge.merge(storage,A.Cartridge.unpack(text)),1);assert.equal(storage.read('best.iron.arcade'),9999);assert.equal(storage.read('best.kestrel.relaxed'),9100);
  for(const bad of ['{}','not json',JSON.stringify({...packed,format:'other'}),JSON.stringify({...packed,cartridge:{...packed.cartridge,byteLength:packed.cartridge.byteLength+1}})])assert.throws(()=>A.Cartridge.unpack(bad));
  const tampered=JSON.parse(text);tampered.cartridge.rows[1][3]=(tampered.cartridge.rows[1][3]+1)%3;assert.throws(()=>A.Cartridge.unpack(JSON.stringify(tampered)));
});
