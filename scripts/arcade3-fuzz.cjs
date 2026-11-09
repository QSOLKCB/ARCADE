/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
// ARCADE3-FUZZ-001 — deterministic, valid-control crash discovery.
// No external packages, network calls, world mutation, or modified campaign pins.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
for(const file of ['engine','core','gfx','sound'])
  require('../arcade2/'+file+'.js');
const IDS=Object.freeze([
  'commando','lantern','sleepwalker','lancer','canal',
  'skyline','stratos','feud','knockout'
]);
for(const file of ['kit','hall',...IDS])
  require('../arcade3/'+file+'.js');
const {recordingContext}=require('../tests/arcade2-mock-canvas.cjs');
const A=globalThis.Arcade2,G=A.Gfx;
const POOLS=Object.freeze([
  'shots','foes','bullets','items','pods','flak','missiles','sparks','pops','slag'
]);
const REPORT_KIND='qsol.arcade3.fuzz.001.v1';
const SHA=value=>crypto.createHash('sha256').update(value).digest('hex');
const MAX_SEEDS=256,MAX_TICKS=40000;
function seedWord(cabinet,seed){
  if(!IDS.includes(cabinet)||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)
    throw new RangeError('invalid cabinet or seed');
  let word=seed>>>0;
  for(const c of cabinet)word=(Math.imul(word^c.charCodeAt(0),16777619))>>>0;
  return word||0x9e3779b9;
}
function prng(seed){
  let state=seed||0x9e3779b9;
  return ()=>{state=(state+0x6d2b79f5)>>>0;
    let x=Math.imul(state^(state>>>15),state|1);
    x^=x+Math.imul(x^(x>>>7),x|61);
    return (x^(x>>>14))>>>0;
  };
}
// The real arcade2/input.js sampler defines edge events using prior held keys.
// No mismatched "pressed while released" controls are generated.
function inputTape(cabinet,seed,ticks){
  if(!Number.isSafeInteger(ticks)||ticks<1||ticks>MAX_TICKS)
    throw new RangeError('invalid tick count');
  const next=prng(seedWord(cabinet,seed)),inputs=[],buttons={a:false,b:false,c:false,d:false};
  let x=0,y=0;
  for(let i=0;i<ticks;i++){
    if(next()%17===0)x=(next()%3)-1;
    if(next()%19===0)y=(next()%3)-1;
    const before={...buttons};
    for(const key of ['a','b','c','d'])
      if(next()%23===0)buttons[key]=!buttons[key];
    const input={...A.empty(),x,y};
    for(const key of ['a','b','c','d']){
      input[key]=buttons[key];
      input[key+'Pressed']=buttons[key]&&!before[key];
    }
    input.aReleased=before.a&&!buttons.a;
    // Real pointer aiming is allowed only with no directional input.
    if(x===0&&y===0&&next()%11===0)input.aim={x:next()%640,y:next()%360};
    inputs.push(input);
  }
  return inputs;
}
function validInputSequence(tape){
  let previous={a:false,b:false,c:false,d:false};
  if(!Array.isArray(tape)||tape.length>MAX_TICKS)
    throw new TypeError('invalid input tape');
  for(const input of tape){
    const template=A.empty();
    if(!input||typeof input!=='object'||Array.isArray(input)||
      Object.keys(input).length!==Object.keys(template).length||
      Object.keys(template).some(k=>!Object.hasOwn(input,k))||
      ![-1,0,1].includes(input.x)||![-1,0,1].includes(input.y))
      throw new TypeError('invalid control shape or direction');
    for(const key of ['a','b','c','d']){
      if(typeof input[key]!=='boolean'||typeof input[key+'Pressed']!=='boolean'||
        input[key+'Pressed']!==(input[key]&&!previous[key]))
        throw new TypeError('incoherent button edge: '+key);
    }
    if(typeof input.aReleased!=='boolean'||
       input.aReleased!==(previous.a&&!input.a))
      throw new TypeError('incoherent release edge');
    if(input.aim!==null){
      const aim=input.aim;
      if(input.x||input.y||!aim||Object.keys(aim).length!==2||
        !Number.isInteger(aim.x)||!Number.isInteger(aim.y)||
        aim.x<0||aim.x>639||aim.y<0||aim.y>359)
        throw new TypeError('invalid mouse aim');
    }
    previous={a:input.a,b:input.b,c:input.c,d:input.d};
  }
  return true;
}
function scanFinite(value,label='state',seen=new WeakSet(),depth=0){
  if(depth>25)throw new RangeError('state nesting depth exceeded: '+label);
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new RangeError('nonfinite state: '+label);
    return;
  }
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='undefined')return;
  if(typeof value!=='object')throw new TypeError('unsupported state: '+label);
  if(seen.has(value))throw new TypeError('cyclic/shared state reference: '+label);
  seen.add(value);
  const entries=Array.isArray(value)?value.entries():Object.entries(value);
  for(const [key,v] of entries)scanFinite(v,label+'.'+key,seen,depth+1);
  seen.delete(value);
}
function audit(g,cabinet){
  if(!['playing','stageclear','won','lost'].includes(g.status))
    throw new TypeError('invalid lifecycle state: '+g.status);
  if(!Number.isSafeInteger(g.tickCount)||g.tickCount<0)
    throw new RangeError('invalid tick counter');
  scanFinite(g);
  if(!Array.isArray(g.effects)||g.effects.length>96)
    throw new RangeError('effects pool exceeds 96');
  if(!Array.isArray(g.events)||g.events.length>8)
    throw new RangeError('event pool exceeds 8');
  for(const pool of POOLS)if(Object.hasOwn(g,pool)&&
      (!Array.isArray(g[pool])||g[pool].length>160))
    throw new RangeError(cabinet+' pool '+pool+' exceeds cap 160');
}
function signature(error){
  return error?.name+':'+error?.message;
}
function failAt(error,phase,tick,cabinet,seed){
  return {cabinet,seed,tick,phase,name:error?.name??'Error',
    message:error?.message??String(error),stack:String(error?.stack??error),
    signature:signature(error)};
}
function make(cabinet){
  const meta=A.registry.find(m=>m.id===cabinet);
  if(!meta)throw new Error('missing cabinet: '+cabinet);
  return meta.create();
}
// One complete run; optional drawing is checked for state purity.
// Comparisons are at deterministic checkpoints; deliberate terminal resets
// keep random input coverage running rather than freezing after early defeat.
function executeTape(cabinet,seed,tape,{draw=true}={}){
  validInputSequence(tape);
  let g=make(cabinet),resets=0,stageAdvances=0,draws=0,observations=0;
  const digest=crypto.createHash('sha256'),ctx=draw?recordingContext():null;
  let tick=0,phase='start',lastState=null;
  try{
    for(tick=0;tick<tape.length;tick++){
      phase='lifecycle';
      if(g.status==='stageclear'){
        g.next();stageAdvances++;
        digest.update('STAGE:'+g.stage+'\n');
      }else if(g.status==='won'||g.status==='lost'){
        const previous=JSON.stringify(g);
        g.tick(tape[tick]);
        if(JSON.stringify(g)!==previous)
          throw new Error('terminal state changed on tick');
        digest.update('TERMINAL:'+g.status+'\n');
        g=make(cabinet);resets++;
      }
      phase='simulation';
      g.tick(tape[tick]);
      if(tick%31===0||tick===tape.length-1){
        phase='audit';
        audit(g,cabinet);observations++;
      }
      phase='render';
      if(draw&&tick%127===0){
        const before=JSON.stringify(g);
        ctx.reset();g.draw(ctx);G.post(ctx,g);
        if(JSON.stringify(g)!==before)
          throw new Error('drawing mutated authoritative state');
        draws++;
      }
      phase='receipt';
      // Browser shell consumes bounded events; do this identically in both
      // passes. Snapshot captures event payload before consumption.
      if(tick%31===0||tick===tape.length-1){
        lastState=JSON.stringify(g);
        digest.update('TICK:'+tick+':'+lastState+'\n');
      }
      g.events.length=0;
    }
    return {ok:true,cabinet,seed,ticks:tape.length,resets,stageAdvances,draws,
      observations,stateSha256:digest.digest('hex'),finalStateSha256:SHA(JSON.stringify(g))};
  }catch(error){
    return {ok:false,failure:failAt(error,phase,tick,cabinet,seed),
      lastStateSha256:lastState===null?null:SHA(lastState),resets,stageAdvances,
      draws,observations};
  }
}
function evaluate(cabinet,seed,tape,draw=true){
  const a=executeTape(cabinet,seed,tape,{draw});
  if(!a.ok)return {ok:false,run:'with-render',...a};
  const b=executeTape(cabinet,seed,tape,{draw:false});
  if(!b.ok)return {ok:false,run:'reference-no-render',...b};
  if(a.stateSha256!==b.stateSha256||
     a.finalStateSha256!==b.finalStateSha256||
     a.resets!==b.resets||a.stageAdvances!==b.stageAdvances){
    const error=new Error('rendered and headless replays diverged');
    return {ok:false,run:'parity',failure:failAt(error,'comparison',tape.length,
      cabinet,seed),expected:a,actual:b};
  }
  return {ok:true,cabinet,seed,ticks:tape.length,
    stateSha256:a.stateSha256,finalStateSha256:a.finalStateSha256,
    draws:a.draws,stageAdvances:a.stageAdvances,resets:a.resets,
    audits:a.observations};
}
// Preserve a complete unmodified failure prefix AND a smaller attempt.
// Delta debugging only accepts the SAME failure signature. No fix or rewrite
// is attempted by the fuzzer; genuine unexpected crashes block CI.
function shrink(cabinet,seed,tape,expected,{limit=48}={}){
  let smallest=tape.slice(),attempts=0,parts=2;
  while(smallest.length>1&&attempts<limit){
    const chunk=Math.ceil(smallest.length/parts);let reduced=false;
    for(let start=0;start<smallest.length&&attempts<limit;start+=chunk){
      const candidate=smallest.slice(0,start).concat(smallest.slice(start+chunk));
      if(!candidate.length)continue;
      // Removed steps change predecessor transitions. Rebuild each button
      // edge so every candidate remains an actually realizable input tape.
      const normalized=retime(candidate);
      attempts++;
      const result=executeTape(cabinet,seed,normalized,{draw:true});
      if(!result.ok&&result.failure.signature===expected.signature){
        smallest=normalized;parts=Math.max(2,parts-1);reduced=true;break;
      }
    }
    if(!reduced){
      if(parts>=smallest.length)break;
      parts=Math.min(smallest.length,parts*2);
    }
  }
  return {inputs:smallest,attempts,reducedFrom:tape.length,reducedTo:smallest.length};
}
function retime(tape){
  const prior={a:false,b:false,c:false,d:false};
  return tape.map(x=>{
    const input={...x};
    for(const key of ['a','b','c','d']){
      input[key+'Pressed']=input[key]&&!prior[key];
    }
    input.aReleased=prior.a&&!input.a;
    for(const key of ['a','b','c','d'])prior[key]=input[key];
    return input;
  });
}
function fuzz({seeds=32,ticks=2000,cabinets=IDS}={}){
  if(!Number.isInteger(seeds)||seeds<1||seeds>MAX_SEEDS||
     !Number.isInteger(ticks)||ticks<1||ticks>MAX_TICKS||
     !Array.isArray(cabinets)||!cabinets.length||
     cabinets.some(id=>!IDS.includes(id))||
     new Set(cabinets).size!==cabinets.length)throw new RangeError('invalid fuzz workload');
  const results=[];
  for(const cabinet of cabinets)for(let n=1;n<=seeds;n++){
    const tape=inputTape(cabinet,n,ticks),result=evaluate(cabinet,n,tape);
    if(!result.ok){
      const prefix=tape.slice(0,Math.min(ticks,result.failure.tick+1));
      // First preserve the original replay verbatim; optional shortening
      // can never erase a source failure when the minimizer is imperfect.
      const minimized=shrink(cabinet,n,prefix,result.failure);
      return {kind:REPORT_KIND,status:'FAIL',plannedCases:cabinets.length*seeds,
        cases:results, failure:result.failure,
        failingRun:result.run,
        originalTape:prefix, originalTapeSha256:SHA(JSON.stringify(prefix)),
        minimized,proofOfReproduction:executeTape(cabinet,n,prefix,{draw:true})};
    }
    results.push(result);
  }
  return {kind:REPORT_KIND,status:'PASS',plannedCases:cabinets.length*seeds,
    seeds,ticks,plannedTicks:cabinets.length*seeds*ticks,
    executedTicks:results.reduce((s,x)=>s+x.ticks,0),
    cases:results};
}
function saveReport(out,report){
  const dir=path.dirname(out);fs.mkdirSync(dir,{recursive:true});
  const contents=JSON.stringify(report,null,2)+'\n';
  fs.writeFileSync(out,contents,{flag:'wx'});
  const sums=SHA(contents)+'  '+path.basename(out)+'\n';
  fs.writeFileSync(path.join(dir,'SHA256SUMS'),sums,{flag:'wx'});
  console.log(JSON.stringify({status:report.status,path:out,sha256:SHA(contents),
    cases:report.cases?.length,executedTicks:report.executedTicks,
    failure:report.failure??null}));
}
function main(args=process.argv.slice(2)){
  let seeds=32,ticks=2000,out='artifacts/arcade3-fuzz-001.json',replay=null;
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(['--seeds','--ticks','--out','--replay'].includes(arg)&&i+1<args.length){
      const value=args[++i];
      if(arg==='--seeds')seeds=Number(value);
      if(arg==='--ticks')ticks=Number(value);
      if(arg==='--out')out=value;
      if(arg==='--replay')replay=value;
    }else throw new Error('usage: --seeds N --ticks N --out path | --replay receipt.json');
  }
  if(replay){
    const data=JSON.parse(fs.readFileSync(replay,'utf8'));
    if(data.kind!==REPORT_KIND||data.status!=='FAIL'||!data.failure||
       !Array.isArray(data.originalTape))throw new TypeError('invalid fuzz failure receipt');
    const {cabinet,seed,signature:expected}=data.failure;
    const result=executeTape(cabinet,seed,data.originalTape,{draw:true});
    console.log(JSON.stringify({replayed:result.failure??null,
      matched:!result.ok&&result.failure.signature===expected}));
    if(result.ok||result.failure.signature!==expected)process.exitCode=1;
    return;
  }
  const report=fuzz({seeds,ticks});saveReport(out,report);
  if(report.status!=='PASS')process.exitCode=1;
}
if(require.main===module)main();
module.exports={IDS,inputTape,validInputSequence,scanFinite,audit,
  executeTape,evaluate,shrink,retime,fuzz,witnessKind:REPORT_KIND};
