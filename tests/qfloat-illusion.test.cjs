/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
  crypto=require('node:crypto');
require('../arcade2/engine.js');
require('../arcade2/qfloat.js');
require('../arcade3/qfloat-sim.js');
const A=globalThis.Arcade2,F=A.QFloat,S=A.QFloatSim,E=A.Engine;
test('QFloat is an explicit immutable integer-backed author API',()=>{
  const a=F.fromDecimal('0.1'),b=F.fromDecimal('0.2'),c=a.add(b);
  assert.equal(a.raw,6553);
  assert.equal(b.raw,13107);
  assert.equal(c.raw,19660);
  assert.equal(c.approx(3),'0.300');
  assert.equal(c.exact(),'0.2999877929687500');
  assert.equal(a.exact(),'0.0999908447265625');
  assert.equal(F.fromDecimal('0.0000152587890625').raw,1);
  assert.equal(F.fromDecimal('-32768').raw,E.INT_MIN);
  assert.equal(F.fromDecimal('32767.9999847412109375').raw,E.INT_MAX);
  assert.equal(F.fromDecimal('0.1').raw,F.fromRatio(1,10).raw);
  assert.equal(F.fromRaw(E.INT_MIN).exact(),'-32768.0000000000000000');
  assert.ok(Object.isFrozen(a));
  assert.equal(Object.isFrozen(F),true);
  assert.throws(()=>{a.raw=123;},TypeError);
  assert.throws(()=>a+1,/implicit QFloat/);
  assert.throws(()=>Number(a),/implicit QFloat/);
  assert.throws(()=>Math.sin(a),/implicit QFloat/);
});
test('all operations dispatch to the pinned exact integer engine',()=>{
  const [a,b]=['4.5','2.25'].map(F.fromDecimal);
  assert.equal(a.add(b).raw,E.add(a.raw,b.raw));
  assert.equal(a.subtract(b).raw,E.subtract(a.raw,b.raw));
  assert.equal(a.multiply(b).raw,E.multiply(a.raw,b.raw));
  assert.equal(a.divide(b).raw,E.divide(a.raw,b.raw));
  assert.equal(F.fromDecimal('4').sqrt().raw,E.sqrt(F.fromDecimal('4').raw));
  assert.equal(a.compare(b),1);
  assert.equal(b.compare(a),-1);
  assert.equal(a.compare(a),0);
  assert.equal(F.fromDecimal('-0').raw,0);
  assert.equal(F.fromDecimal('0.0000000000000001').raw,0);
  assert.equal(F.fromRaw(E.INT_MAX).number,E.INT_MAX/65536);
  assert.equal(F.fromRaw(E.INT_MAX).exact(),'32767.9999847412109375');
  const saved=JSON.parse(JSON.stringify(a));
  assert.deepEqual(saved,{kind:'qsol.qfloat.q16.v1',raw:a.raw});
  assert.equal(F.fromJSON(saved).raw,a.raw);
  assert.throws(()=>F.fromJSON({...saved,execute:'evil'}),/serialization/);
  assert.throws(()=>F.fromJSON({kind:saved.kind,raw:NaN}),RangeError);
});
test('bad input, fractional raw values, overflow and zero division reject',()=>{
  for(const text of ['1e2','01.2','+1','1.',' .1','0.12345678901234567',
    '32768','-32768.0000152587890625','100000','Infinity','NaN'])
    assert.throws(()=>F.fromDecimal(text),undefined,'reject: '+text);
  assert.throws(()=>F.fromRaw(1.25),RangeError);
  assert.throws(()=>F.fromRaw(E.INT_MAX).add(F.fromRaw(1)),RangeError);
  assert.throws(()=>F.fromRaw(E.INT_MIN).subtract(F.fromRaw(1)),RangeError);
  assert.throws(()=>F.fromDecimal('1').divide(F.fromRaw(0)),RangeError);
  assert.throws(()=>F.fromRaw(-1).sqrt(),RangeError);
  assert.throws(()=>F.fromDecimal('1').add(1),TypeError);
  assert.throws(()=>F.fromDecimal('1').approx(25),RangeError);
});
test('integer-backed Point is immutable and accepts only QFloat scalars',()=>{
  const p=F.point(F.fromDecimal('1.25'),F.fromDecimal('-2.5'));
  const moved=p.translate(F.fromDecimal('3.5'),F.fromRatio(2));
  assert.deepEqual(p.raw,[81920,-163840]);
  assert.deepEqual(moved.raw,[311296,-32768]);
  assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.raw));
  assert.throws(()=>F.point(1,2),TypeError);
});
test('fixed tick world state retains only integer Q16.16 and is independent of display precision',()=>{
  const initial=S.create(),before=JSON.stringify(initial);
  let state=initial;
  for(let i=0;i<32;i++){
    const next=S.step(state,{x:1,y:-1});
    assert.ok(Object.isFrozen(next));
    for(const key of ['x','y','speed','tick'])assert.ok(Number.isInteger(next[key]));
    state=next;
  }
  assert.equal(initial.x,20971520);
  assert.equal(initial.y,11796480);
  assert.equal(initial.speed,81920);
  assert.equal(state.x,initial.x+32*81920);
  assert.equal(state.y,initial.y-32*81920);
  const token=S.displayToken(state);
  const visual=S.present(state);
  assert.equal(visual.xExact,F.fromRaw(state.x).exact());
  assert.equal(visual.yExact,F.fromRaw(state.y).exact());
  assert.equal(S.displayToken(state),token);
  assert.equal(JSON.stringify(initial),before);
  assert.throws(()=>S.step(initial,{x:2,y:0}),/legal directional/);
  assert.throws(()=>S.create({speed:'20.1'}),RangeError);
});
test('tick exhaustion rejects before constructing any next state that violates check()',()=>{
  const maxAccepted=2147483646;
  const lastStepInput=Object.freeze({x:0,y:0});
  const before=Object.freeze({x:0,y:0,speed:0,tick:maxAccepted-1});
  const last=S.step(before,lastStepInput);
  assert.equal(last.tick,maxAccepted);
  assert.equal(S.check(last),last,'a successful step must validate itself');
  assert.ok(Object.isFrozen(last));
  const snapshot=JSON.stringify(last);
  assert.throws(()=>S.step(last,lastStepInput),/tick exhausted/);
  assert.equal(JSON.stringify(last),snapshot,'rejection must preserve caller state');
  assert.equal(JSON.stringify(before),JSON.stringify({x:0,y:0,speed:0,tick:maxAccepted-1}));
  assert.throws(()=>S.check({...last,tick:maxAccepted+1}),/tick exhausted/);
});

test('two independent runs produce identical SHA256 replay identities even with intervening presentation',()=>{
  const tape=Array.from({length:500},(_,i)=>({
    x:i%80<30?1:i%80<55?-1:0,
    y:i%101<50?-1:1
  }));
  function run(draw){
    let s=S.create({speed:'0.3'}),hash=crypto.createHash('sha256');
    for(const input of tape){
      s=S.step(s,input);
      if(draw){S.present(s);F.fromRaw(s.x).approx(9);}
      hash.update(JSON.stringify(s)+'\n');
    }
    return {hash:hash.digest('hex'),state:s};
  }
  assert.deepEqual(run(false),run(true));
  assert.deepEqual(run(false),run(false));
  const edge=S.create({x:'639',y:'359',speed:'20'});
  const clamped=S.step(edge,{x:1,y:1});
  assert.equal(clamped.x,E.fromRatio(640));
  assert.equal(clamped.y,E.fromRatio(360));
  assert.equal(S.displayToken(clamped).length,8);
});
