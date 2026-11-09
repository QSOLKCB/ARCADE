/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
// ARCADE3-NUMSPEC-001: NUM-SPEC-001 exact/Float64/ternary arithmetic,
// NUM-SPEC-002 interpolative coding. Never replace authoritative Q16 logic.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),
  vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {IDS,inputTape,executeTape,validInputSequence}
  =require('./arcade3-fuzz.cjs');
const math=require('./arcade3-numspec-arithmetic.cjs'),
  codec=require('./arcade3-numspec-codecs.cjs');
const ROOT=path.resolve(__dirname,'..');
const SHA=b=>crypto.createHash('sha256').update(b).digest('hex');
const JSFILES=['arcade2/engine.js','arcade2/core.js','arcade2/gfx.js',
  'arcade2/sound.js','arcade3/kit.js','arcade3/hall.js',
  ...IDS.map(id=>'arcade3/'+id+'.js')];
function sourceIdentity(){
  let head=null;
  try{head=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();}
  catch{head=null;}
  if(process.env.GITHUB_SHA&&head!==process.env.GITHUB_SHA)
    throw new Error('checkout SHA differs from GitHub run');
  const files=[...JSFILES,'scripts/arcade3-fuzz.cjs',
    'scripts/arcade3-numspec-arithmetic.cjs',
    'scripts/arcade3-numspec-codecs.cjs',
    'scripts/arcade3-numspec.cjs'];
  return {gitHead:head,node:process.version,platform:process.platform,
    arch:process.arch,files:files.map(file=>({path:file,
      sha256:SHA(fs.readFileSync(path.join(ROOT,file)))}))};
}
function rng(seed=0x96cd44ac){
  let s=seed>>>0;
  return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s;};
}
function result(fn,...args){
  try{return {ok:true,value:fn(...args)};}
  catch(error){return {ok:false,name:error.name};}
}
function sameResult(x,y){
  return x.ok===y.ok&&(!x.ok?x.name===y.name:Object.is(x.value,y.value));
}
function compareScalar(native,a,b,d,report,{ternary=false}={}){
  const target=result(math.exactMulDiv,a,b,d),
    actual=result(native,a,b,d);
  report.total++;
  if(!sameResult(target,actual))
    throw new Error('PRODUCTION Q16 mismatch '+JSON.stringify({a,b,d,target,actual}));
  if(!target.ok){
    report.refusals++;
    return;
  }
  report.admissible++;
  const fast=result(math.guardedFloat64,a,b,d);
  if(!fast.ok){
    if(fast.name!=='RangeError')throw new Error('guarded Float64 rejected valid quotient');
    // An exact signed int32 result must not be refused by the admitted path.
    throw new Error('guarded Float64 refused exact admissible result');
  }
  if(fast.value.admitted){
    report.floatAdmitted++;
    if(fast.value.value!==target.value)
      throw new Error('guarded Float64 value mismatch');
  }else report.floatFallback++;
  const naive=result(math.naiveFloat64,a,b,d);
  if(!sameResult(target,naive)){
    report.naiveMismatches++;
    if(report.examples.length<6)
      report.examples.push({a,b,d,exact:target.value,
        naive:naive.ok?naive.value:naive.name});
  }
  if(ternary){
    const tern=result(math.ternaryMulDiv,a,b,d);
    report.ternaryCases++;
    if(!sameResult(target,tern))
      throw new Error('balanced ternary product mismatch');
  }
}
function counters(){return {total:0,admissible:0,refusals:0,
  floatAdmitted:0,floatFallback:0,naiveMismatches:0,ternaryCases:0,examples:[]};}
function triples(samples,production){
  if(!Number.isInteger(samples)||samples<1||samples>100000)
    throw new RangeError('invalid samples');
  const report=counters(),r=rng(),vectors=[
    [2147483645,1073741824,2147483647],
    [-2147483645,1073741824,2147483647],
    [2147483647,2147483647,2147483647],
    [-2147483648,-2147483648,-2147483648],
    [0,2147483647,0],[1,1,0],
    [65536,65536,65536],[-1,1,2],
    [2147483647,1,2147483647],[-2147483648,1,-1]
  ];
  const edges=[-2147483648,-2147483647,-65536,-32768,-1,0,1,2,3,
    32767,65536,1073741824,2147483646,2147483647];
  while(vectors.length<samples){
    const i=vectors.length,mode=i%7;
    if(mode===0)vectors.push([edges[r()%edges.length],
      edges[r()%edges.length],edges[r()%edges.length]]);
    else if(mode===1)vectors.push([r()|0,r()|0,r()|0]);
    else if(mode===2)vectors.push([r()%65537-32768,r()%65537-32768,r()%65537-32768]);
    else if(mode===3)vectors.push([(r()|0),r()%17-8,r()%65536-32767]);
    else if(mode===4)vectors.push([edges[r()%edges.length],
      r()%65536-32768,r()%256-128]);
    else if(mode===5)vectors.push([r()%32768-16384,r()%32768-16384,(r()|0)]);
    else vectors.push([r()|0, r()|0, r()%33-16]);
  }
  for(let i=0;i<samples;i++)
    compareScalar(production,...vectors[i],report,{ternary:i<Math.min(samples,1024)});
  report.samples=samples;
  // Guaranteed negative control: this Float64 division rounds the quotient.
  const witness=vectors[0],e=math.exactMulDiv(...witness),
    bad=math.naiveFloat64(...witness);
  if(e===bad||report.naiveMismatches<1)
    throw new Error('naive Float64 negative control was not detected');
  return report;
}
function runGuest({cabinet,seed,ticks}){
  if(!IDS.includes(cabinet)||!Number.isInteger(seed)||seed<1||seed>256||
     !Number.isInteger(ticks)||ticks<1||ticks>40000)
    throw new RangeError('invalid guest workload');
  const tape=inputTape(cabinet,seed,ticks);
  validInputSequence(tape);
  const baseline=executeTape(cabinet,seed,tape,{draw:false});
  if(!baseline.ok)throw new Error('baseline fuzz replay failed: '+JSON.stringify(baseline.failure));
  const guest=vm.createContext({console});
  const load=file=>vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),
    guest,{filename:file,timeout:15000});
  load(JSFILES[0]);const E=guest.Arcade2.Engine;
  const stats=counters(),shadow={active:false};
  function intercept(key,conv){
    const native=E[key];
    if(typeof native!=='function')throw new TypeError('missing engine arithmetic '+key);
    E[key]=function(...args){
      const answer=native(...args);
      // The real game receives exactly the original engine result.
      if(shadow.active){
        const [a,b,d]=conv(args);
        const oracle=math.exactMulDiv(a,b,d);
        if(!Object.is(oracle,answer))
          throw new Error(key+' original computation diverged from BigInt oracle');
        compareScalar((x,y,z)=>answer,a,b,d,stats,
          {ternary:stats.ternaryCases<64});
      }
      return answer;
    };
  }
  intercept('mulDiv',a=>[a[0],a[1],a[2]]);
  intercept('fromRatio',a=>[a[0],65536,a[1]===undefined?1:a[1]]);
  intercept('multiply',a=>[a[0],a[1],65536]);
  intercept('divide',a=>[a[0],65536,a[1]]);
  for(const file of JSFILES.slice(1))load(file);
  shadow.active=true;
  const A=guest.Arcade2,meta=A.registry.find(x=>x.id===cabinet);
  if(!meta)throw new Error('guest missing cabinet');
  let g=meta.create(),resets=0,advances=0;
  const transcript=crypto.createHash('sha256');
  const compression={lists:0,values:0,rawBytes:0,deltaBytes:0,
    interpolativeBytes:0,caseExamples:[]};
  for(let tick=0;tick<ticks;tick++){
    const input=tape[tick];
    if(g.status==='stageclear'){
      g.next();advances++;
      transcript.update('STAGE:'+g.stage+'\n');
    }else if(g.status==='won'||g.status==='lost'){
      const old=JSON.stringify(g);
      g.tick(input);
      if(JSON.stringify(g)!==old)throw new Error('terminal game state changed in guest');
      transcript.update('TERMINAL:'+g.status+'\n');
      g=meta.create();resets++;
    }
    g.tick(input);
    if(tick%31===0||tick===ticks-1){
      transcript.update('TICK:'+tick+':'+JSON.stringify(g)+'\n');
      // Entity IDs harvested from real cabinet state; no gameplay edits.
      const ids=new Set();
      for(const pool of ['foes','shots','bullets','items','pods','missiles',
        'flak','sparks','pops','slag']){
        if(!Array.isArray(g[pool]))continue;
        for(const item of g[pool]){
          const id=item?.uid;
          if(Number.isInteger(id)&&id>=0&&id<=0x7ffffffe)ids.add(id);
        }
      }
      const sorted=[...ids].sort((a,b)=>a-b);
      if(sorted.length>=2&&sorted.length<=512){
        const universe=sorted.at(-1)+1,
          delta=codec.encodeDeltaVarint(sorted,universe),
          interpolative=codec.encodeInterpolative(sorted,universe);
        if(JSON.stringify(codec.decodeDeltaVarint(delta))!==JSON.stringify(sorted)||
           JSON.stringify(codec.decodeInterpolative(interpolative))!==JSON.stringify(sorted))
          throw new Error('real-cabinet sorted ID codec roundtrip failed');
        compression.lists++;compression.values+=sorted.length;
        compression.rawBytes+=sorted.length*4;
        compression.deltaBytes+=delta.bytes.length;
        compression.interpolativeBytes+=interpolative.bytes.length;
        if(compression.caseExamples.length<2)compression.caseExamples.push({
          tick,length:sorted.length,universe,raw:sorted.length*4,
          delta:delta.bytes.length,interpolative:interpolative.bytes.length});
      }
    }
    g.events.length=0;
  }
  const stateSha256=transcript.digest('hex'),finalStateSha256=SHA(JSON.stringify(g));
  if(stateSha256!==baseline.stateSha256||
    finalStateSha256!==baseline.finalStateSha256||
    resets!==baseline.resets||advances!==baseline.stageAdvances)
    throw new Error('source-identical guest diverged from uninstrumented replay: '+
      JSON.stringify({cabinet,seed,stateSha256,expected:baseline.stateSha256,
        finalStateSha256,expectedFinal:baseline.finalStateSha256,resets,advances}));
  // A cabinet can perform inline integer arithmetic without calling a
  // public engine arithmetic entry point. Report such coverage explicitly;
  // never misrepresent instrumented wrappers as whole-engine tracing.
  return {cabinet,seed,ticks,originalStateSha256:baseline.stateSha256,
    guestStateSha256:stateSha256,shadowQ16:stats,compression,stageAdvances:advances,
    resets};
}
function experiment({samples=16000,seeds=3,ticks=300}={}){
  if(!Number.isInteger(samples)||samples<10||samples>100000||
     !Number.isInteger(seeds)||seeds<1||seeds>32||
     !Number.isInteger(ticks)||ticks<1||ticks>2000)
    throw new RangeError('invalid NUM-SPEC workload');
  const scalar=triples(samples,globalThis.Arcade2.Engine.mulDiv);
  const cabinets=[];
  for(const cabinet of IDS)for(let seed=1;seed<=seeds;seed++)
    cabinets.push(runGuest({cabinet,seed,ticks}));
  const sums={comparisons:0,guardedAdmitted:0,guardedFallback:0,ternaryChecked:0,
    naiveDisagreements:0,lists:0,rawBytes:0,deltaBytes:0,interpolativeBytes:0};
  for(const c of cabinets){
    sums.comparisons+=c.shadowQ16.total;
    sums.guardedAdmitted+=c.shadowQ16.floatAdmitted;
    sums.guardedFallback+=c.shadowQ16.floatFallback;
    sums.ternaryChecked+=c.shadowQ16.ternaryCases;
    sums.naiveDisagreements+=c.shadowQ16.naiveMismatches;
    sums.lists+=c.compression.lists;
    sums.rawBytes+=c.compression.rawBytes;
    sums.deltaBytes+=c.compression.deltaBytes;
    sums.interpolativeBytes+=c.compression.interpolativeBytes;
  }
  return {kind:'qsol.arcade3.numspec.001.v1',status:'PASS',source:sourceIdentity(),
    methodologicalBoundary:'Shadow calculations only; production Q16/physics/campaign pins unmodified',
    settings:{samples,seeds,ticks,cabinetCount:IDS.length},scalar,cabinets,
    observed:sums};
}
function main(args=process.argv.slice(2)){
  let samples=16000,seeds=3,ticks=300,out='artifacts/arcade3-numspec-001.json';
  for(let i=0;i<args.length;i++){
    if(!['--samples','--seeds','--ticks','--out'].includes(args[i])||i+1>=args.length)
      throw new Error('usage: --samples N --seeds N --ticks N --out path');
    const value=args[++i];
    if(args[i-1]==='--samples')samples=Number(value);
    else if(args[i-1]==='--seeds')seeds=Number(value);
    else if(args[i-1]==='--ticks')ticks=Number(value);
    else out=value;
  }
  let report;
  try{report=experiment({samples,seeds,ticks});}
  catch(error){report={kind:'qsol.arcade3.numspec.001.v1',status:'FAIL',
    source:sourceIdentity(),settings:{samples,seeds,ticks},
    failure:{name:error.name,message:error.message,stack:error.stack}};
    process.exitCode=1;}
  const dir=path.dirname(out);
  fs.mkdirSync(dir,{recursive:true});
  const body=JSON.stringify(report,null,2)+'\n';
  fs.writeFileSync(out,body,{flag:'wx'});
  fs.writeFileSync(path.join(dir,'NUMSPEC_SHA256SUMS'),
    SHA(body)+'  '+path.basename(out)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:report.status,sha256:SHA(body),
    scalar:report.scalar?.total,gameplay:report.observed?.comparisons,
    compression:report.observed?.lists,failure:report.failure?.message}));
}
if(require.main===module)main();
module.exports={triples,runGuest,experiment,sourceIdentity};
