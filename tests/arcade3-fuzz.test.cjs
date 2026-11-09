/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {IDS,inputTape,validInputSequence,scanFinite,audit,executeTape,evaluate,
  retime,fuzz,witnessKind}=require('../scripts/arcade3-fuzz.cjs');
const A=globalThis.Arcade2;
test('nine cabinets have a real registry and canonical control sampler',()=>{
  assert.equal(IDS.length,9);
  assert.deepEqual(A.registry.map(m=>m.id),IDS);
  assert.deepEqual(Object.keys(inputTape('commando',17,1)[0]).sort(),
    Object.keys(A.empty()).sort());
});
test('random control tapes reproduce byte-for-byte and have coherent button edges',()=>{
  for(const id of IDS){
    const a=inputTape(id,17,300),b=inputTape(id,17,300),other=inputTape(id,29,300);
    assert.deepEqual(a,b);
    assert.notDeepEqual(a,other);
    assert.equal(validInputSequence(a),true);
    for(const v of a){
      assert.ok([-1,0,1].includes(v.x));
      assert.ok([-1,0,1].includes(v.y));
      assert.ok(v.aim===null||(!v.x&&!v.y));
    }
  }
});
test('invalid edge transitions, aim and unsupported control fields fail closed',()=>{
  const input=inputTape('commando',17,15),copy=t=>t.map(x=>({...x}));
  const a=copy(input);a[0].aPressed=!a[0].aPressed;
  assert.throws(()=>validInputSequence(a),/incoherent/);
  const b=copy(input);b[1].aReleased=!b[1].aReleased;
  assert.throws(()=>validInputSequence(b),/incoherent/);
  const c=copy(input);c[0].x=2;
  assert.throws(()=>validInputSequence(c),/invalid control/);
  const d=copy(input);d[0].execute='malicious code';
  assert.throws(()=>validInputSequence(d),/invalid control/);
  const e=copy(input);e[0].aim={x:Infinity,y:0};
  assert.throws(()=>validInputSequence(e),/invalid mouse aim/);
});
test('Q16.16 exceptions on illegal arithmetic are guards, not game crashes',()=>{
  assert.throws(()=>A.Engine.int32(0.5),RangeError);
  assert.throws(()=>A.Engine.int32(2**31),RangeError);
  assert.throws(()=>A.Engine.mulDiv(1,2,0),RangeError);
  assert.equal(A.Engine.int32(-2147483648),-2147483648);
});
test('nonfinite/cyclic state and pool overflow are independently rejected',()=>{
  assert.throws(()=>scanFinite({p:{x:NaN}}),/nonfinite/);
  assert.throws(()=>scanFinite({p:{x:Infinity}}),/nonfinite/);
  const cyc={};cyc.self=cyc;
  assert.throws(()=>scanFinite(cyc),/cyclic/);
  const g=A.registry[0].create();
  g.effects=Array.from({length:97},()=>({life:1}));
  assert.throws(()=>audit(g,'commando'),/effects pool/);
});
test('tape removal recalculates edges to preserve a physically realizable sequence',()=>{
  const sample=inputTape('lantern',31,200);
  const smaller=retime(sample.filter((_,i)=>i%3!==0));
  assert.ok(smaller.length<sample.length);
  assert.equal(validInputSequence(smaller),true);
});
test('each cabinet executes deterministic randomized smoke with and without rendering',()=>{
  for(const id of IDS){
    for(const seed of [11,29]){
      const tape=inputTape(id,seed,160);
      const a=evaluate(id,seed,tape);
      assert.equal(a.ok,true,a.failure&&JSON.stringify(a.failure));
      assert.match(a.stateSha256,/^[0-9a-f]{64}$/);
      assert.equal(a.ticks,160);
      assert.ok(a.draws>=1);
    }
  }
});
test('artificial render-only crash yields a complete original tape and reducible witness',()=>{
  const before=A.Commando.prototype.draw;
  try{
    A.Commando.prototype.draw=function injectedFailure(){
      throw new Error('synthetic draw fault for witness test');
    };
    const tape=inputTape('commando',41,40);
    const first=executeTape('commando',41,tape,{draw:true});
    assert.equal(first.ok,false);
    assert.equal(first.failure.tick,0);
    assert.match(first.failure.stack,/synthetic draw fault/);
    assert.equal(executeTape('commando',41,tape,{draw:false}).ok,true,
      'no-render reference must not trigger a rendering-only injected fault');
    const report=fuzz({seeds:1,ticks:40,cabinets:['commando']});
    assert.equal(report.status,'FAIL');
    assert.equal(report.failingRun,'with-render');
    assert.equal(report.failure.tick,0);
    assert.equal(report.originalTape.length,1);
    assert.match(report.originalTapeSha256,/^[0-9a-f]{64}$/);
    assert.equal(report.proofOfReproduction.ok,false);
    assert.equal(validInputSequence(report.minimized.inputs),true);
  }finally{A.Commando.prototype.draw=before;}
});
test('bounded fuzz aggregation retains source-bound PASS summaries',()=>{
  const report=fuzz({seeds:2,ticks:100});
  assert.equal(report.kind,witnessKind);
  assert.equal(report.status,'PASS',report.failure&&JSON.stringify(report.failure));
  assert.equal(report.plannedCases,18);
  assert.equal(report.executedTicks,1800);
  assert.equal(report.cases.length,18);
  if(report.source.gitHead!==null)
    assert.match(report.source.gitHead,/^[0-9a-f]{40}$/);
  else assert.equal(report.source.gitHead,null);
  assert.equal(report.source.nodeVersion,process.version);
  assert.ok(report.source.sourceFiles.some(f=>f.path==='arcade2/engine.js'&&
    /^[0-9a-f]{64}$/.test(f.sha256)));
  assert.throws(()=>fuzz({seeds:0,ticks:100}),RangeError);
  assert.throws(()=>fuzz({seeds:1,ticks:1,cabinets:['unknown']}),RangeError);
});
