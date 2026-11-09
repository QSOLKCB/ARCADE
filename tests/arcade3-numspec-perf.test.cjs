/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const perf=require('../scripts/arcade3-numspec-perf.cjs');
const exact=require('../scripts/arcade3-numspec-arithmetic.cjs');
const A=globalThis.Arcade2,E=A.Engine;
function result(fn,...args){
  try{return {ok:true,value:fn(...args)};}
  catch(error){return {ok:false,name:error.name};}
}
test('nine immutable campaign pins preserve their existing names and digest size',()=>{
  assert.deepEqual(Object.keys(perf.PINS),[
    'commando','lantern','sleepwalker','lancer','canal',
    'skyline','stratos','feud','knockout'
  ]);
  assert.equal(Object.values(perf.STAGES).reduce((a,b)=>a+b,0),29);
  for(const v of Object.values(perf.PINS))assert.match(v,/^[0-9a-f]{64}$/);
});
test('guarded candidate matches the original exact engine on signed edges and rejects invalid inputs',()=>{
  const candidate=perf.checkedFastPath(E.mulDiv,E.int32);
  for(const triple of [
    [0,1,1],[65536,65536,65536],[-65536,65536,65536],
    [2147483645,1073741824,2147483647],
    [-2147483645,1073741824,2147483647],
    [-2147483648,1,-1],[2147483647,2147483647,2147483647],
    [1,1,0],[.5,1,1],[1,1,2.5],[2**31,1,2],
    [2147483647,2147483647,1],
    [2147483647,2147483647,2147483647]
  ]){
    const reference=result(E.mulDiv,...triple),chosen=result(candidate,...triple);
    assert.deepEqual(chosen,reference,'candidate must have identical value/error category: '+triple);
  }
  assert.equal(candidate(2147483645,1073741824,2147483647),1073741822);
  assert.equal(exact.naiveFloat64(2147483645,1073741824,2147483647),1073741823);
  assert.equal(E.mulDiv(60000,70000,1000),candidate(60000,70000,1000));
  assert.equal(Object.is(candidate(0,-1,1),-0),false);
});
test('randomized scalar corpus is checked against independent BigInt before timing',()=>{
  const base=perf.reproducibleSamples(160),wide=perf.wideSamples(160);
  assert.deepEqual(base,perf.reproducibleSamples(160));
  assert.deepEqual(wide,perf.wideSamples(160));
  const b=perf.classify(base),w=perf.classify(wide);
  assert.ok(b.samples.length>0);
  assert.ok(w.samples.length>0);
  assert.ok(w.fallback>0,'wide products must actually exercise exact fallback');
  assert.equal(b.safe+b.fallback,b.samples.length);
  assert.equal(w.safe+w.fallback,w.samples.length);
});
test('paired AB/BA microbench returns finite readings, source-preserving checksums, and no auto-promotion',()=>{
  const samples=perf.classify(perf.reproducibleSamples(48)).samples;
  const result=perf.pairedBenchmark({rounds:3,iterations:2,samples});
  assert.equal(result.trials.length,3);
  assert.deepEqual(result.trials.map(t=>t.order),[
    ['reference','candidate'],['candidate','reference'],['reference','candidate']
  ]);
  assert.ok(result.referenceMedianNsPerCall>0);
  assert.ok(result.candidateMedianNsPerCall>0);
  assert.ok(Number.isFinite(result.medianPairedSpeedup));
  assert.ok(result.trials.every(x=>Number.isSafeInteger(x.checksum)));
  assert.throws(()=>perf.pairedBenchmark({rounds:2,iterations:2,samples}),RangeError);
});
test('original and candidate arithmetic can coexist as isolated runtime instances',()=>{
  const a=perf.context('reference'),b=perf.context('candidate',{collect:true});
  const ma=a.A.registry.find(x=>x.id==='knockout'),
    mb=b.A.registry.find(x=>x.id==='knockout');
  const g=ma.create(),h=mb.create(),makeInput=()=>({...a.A.empty(),x:1});
  for(let t=0;t<60;t++){
    const input=makeInput();g.tick(input);h.tick(input);
  }
  assert.equal(JSON.stringify(g),JSON.stringify(h));
  assert.ok(b.calls.total>0);
  assert.ok(b.corpus.length>0);
  assert.equal(a.calls.total,0);
  assert.equal(A.Engine.mulDiv,E.mulDiv,'authoritative global engine not patched');
});
