/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../scripts/arcade3-numspec-arithmetic.cjs'),
  C=require('../scripts/arcade3-numspec-codecs.cjs'),
  {triples,runGuest,experiment}=require('../scripts/arcade3-numspec.cjs');
const E=globalThis.Arcade2.Engine;
test('BigInt oracle reproduces production Q16 signed truncation and overflow',()=>{
  const examples=[
    [0,1,1],[65536,65536,65536],[-65536,65536,65536],
    [2147483645,1073741824,2147483647],
    [-2147483645,1073741824,2147483647],
    [-2147483648,1,-1],[2147483647,2147483647,2147483647]
  ];
  for(const x of examples){
    let expected,real;
    try{expected={ok:true,value:M.exactMulDiv(...x)};}
    catch(error){expected={ok:false,name:error.name};}
    try{real={ok:true,value:E.mulDiv(...x)};}
    catch(error){real={ok:false,name:error.name};}
    assert.deepEqual(real,expected,JSON.stringify(x));
  }
  assert.throws(()=>M.exactMulDiv(.5,1,2),RangeError);
  assert.throws(()=>M.exactMulDiv(1,1,0),RangeError);
});
test('bounded Float64 is admitted only for exact intermediate integer products',()=>{
  const known=[2147483645,1073741824,2147483647];
  assert.equal(M.exactMulDiv(...known),1073741822);
  assert.equal(M.naiveFloat64(...known),1073741823);
  assert.equal(M.guardedFloat64(...known).admitted,false);
  assert.deepEqual(M.guardedFloat64(60000,70000,1000),
    {admitted:true,value:4200000});
  assert.equal(M.guardedFloat64(2147483647,2147483647,1).admitted,false);
  assert.throws(()=>M.guardedFloat64(2147483647,2,1),RangeError);
  assert.throws(()=>M.guardedFloat64(1,2,0),RangeError);
});
test('balanced-ternary representations are canonical and exact for signed 64-bit products',()=>{
  for(const x of [0n,1n,-1n,2n,-2n,40n,-81n,
    BigInt(-2147483648),BigInt(2147483647),
    BigInt(-2147483648)*BigInt(-2147483648)]){
    const digits=M.encodeTrits(x);
    assert.equal(M.decodeTrits(digits),x);
    assert.ok(digits.every(d=>d===-1||d===0||d===1));
  }
  for(const a of [-2147483648,-65536,-27,-2,0,1,2,37,2147483647])
    for(const b of [-2147483648,-8192,-1,0,1,3,23,2147483647]){
      const x=M.encodeTrits(BigInt(a)),y=M.encodeTrits(BigInt(b));
      assert.equal(M.decodeTrits(M.balancedAdd(x,y)),BigInt(a)+BigInt(b));
      assert.equal(M.decodeTrits(M.balancedMultiply(x,y)),BigInt(a)*BigInt(b));
    }
  assert.throws(()=>M.decodeTrits([0,0]),/noncanonical/);
  assert.throws(()=>M.decodeTrits([2]),/noncanonical/);
  assert.equal(M.ternaryMulDiv(65536,65536,65536),65536);
});
test('decimal four-place fixed values are exact; not a claim of decimal FP hardware',()=>{
  assert.equal(M.parseDecimal4('0.1')+M.parseDecimal4('0.2'),3000n);
  assert.equal(M.decimal4(3000n),'0.3000');
  assert.equal(M.decimal4(-3000n),'-0.3000');
  for(const bad of ['1e3','01.0','1.00001','abc','1.','+1'])
    assert.throws(()=>M.parseDecimal4(bad));
});
test('strict binary interpolative and varint codecs round-trip sorted IDs',()=>{
  const fixtures=[[],[0],[0,1,2,3,4],[1,4,9,22,45,90],[3,5,6,7,8,12,14],
    [0,1,17,170,1700,17000,1700000]];
  const universe=[1,1,5,100,17,2000000];
  for(let i=0;i<fixtures.length;i++){
    const values=fixtures[i],u=universe[i];
    const interpolative=C.encodeInterpolative(values,u),
      varint=C.encodeDeltaVarint(values,u);
    assert.deepEqual(C.decodeInterpolative(interpolative),values);
    assert.deepEqual(C.decodeDeltaVarint(varint),values);
    assert.equal(interpolative.bytes.length,Math.ceil(interpolative.bits/8));
  }
  let state=0x12345678;
  for(let k=0;k<70;k++){
    const values=[],limit=10+(k%50),universe=200000;
    for(let i=0;i<limit;i++){
      state=(Math.imul(state,1664525)+1013904223)>>>0;
      values.push(state%universe);
    }
    const sorted=[...new Set(values)].sort((a,b)=>a-b);
    assert.deepEqual(C.decodeInterpolative(C.encodeInterpolative(sorted,universe)),sorted);
    assert.deepEqual(C.decodeDeltaVarint(C.encodeDeltaVarint(sorted,universe)),sorted);
  }
  assert.throws(()=>C.encodeInterpolative([2,2],10),/ascending/);
  assert.throws(()=>C.encodeDeltaVarint([0,10],10),/ascending/);
  assert.throws(()=>C.decodeInterpolative({...C.encodeInterpolative([1,3,4],10),bits:0}),/container|truncated/);
  assert.throws(()=>C.decodeDeltaVarint({kind:'ascending-delta-varint-v1',
    universe:10,count:1,bytes:[128,0]}),/nonminimal/);
});
test('negative-control numeric corpus retains exact arithmetic and detects naive FP error',()=>{
  const corpus=triples(900,E.mulDiv);
  assert.equal(corpus.total,900);
  assert.ok(corpus.naiveMismatches>=1);
  assert.ok(corpus.floatAdmitted>0);
  assert.ok(corpus.floatFallback>0);
  assert.equal(corpus.ternaryCases,corpus.admissible);
});
test('real game input tapes yield byte-identical guest and original state hashes',()=>{
  for(const cabinet of ['commando','lancer','canal','skyline','stratos','feud','knockout',
    'sleepwalker','lantern']){
    const result=runGuest({cabinet,seed:1,ticks:75});
    assert.equal(result.originalStateSha256,result.guestStateSha256,cabinet);
    assert.match(result.guestStateSha256,/^[0-9a-f]{64}$/);
    assert.ok(result.shadowQ16.total>=0);
    assert.equal(result.ticks,75);
  }
});
test('research campaign reports immutable provenance, proper coverage and no replay rewrite',()=>{
  const report=experiment({samples:200,seeds:1,ticks:50});
  assert.equal(report.status,'PASS');
  assert.equal(report.cabinets.length,9);
  assert.equal(report.scalar.total,200);
  assert.equal(report.settings.ticks,50);
  assert.ok(report.observed.comparisons>=0);
  assert.ok(report.source.files.some(f=>f.path==='arcade2/engine.js'&&
    /^[0-9a-f]{64}$/.test(f.sha256)));
  assert.throws(()=>experiment({samples:100,seeds:0,ticks:50}),RangeError);
});
