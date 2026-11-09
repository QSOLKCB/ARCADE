/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
// NUMSPEC-PERF-002: no modifications to ARCADE/VANILLAJS runtime or pinned games.
// Exact checked safe-product Float64 fast path with native widened fallback;
// independent game contexts and AB/BA paired scalar timings.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),
  crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const A=require('./arcade3-fuzz.cjs')&&globalThis.Arcade2;
const {exactMulDiv,guardedFloat64}=require('./arcade3-numspec-arithmetic.cjs');
const {IDS}=require('./arcade3-fuzz.cjs');
const ROOT=path.resolve(__dirname,'..'),SHA=b=>crypto.createHash('sha256').update(b).digest('hex');
const SOURCES=['arcade2/engine.js','arcade2/core.js','arcade2/gfx.js','arcade2/sound.js',
  'arcade3/kit.js','arcade3/hall.js',...IDS.map(x=>'arcade3/'+x+'.js')];
const INPUTS=['tests/arcade3-policy.cjs','tests/arcade3.test.cjs',
  'scripts/arcade3-numspec-perf.cjs','scripts/arcade3-numspec-arithmetic.cjs',
  'scripts/arcade3-fuzz.cjs'];
const PINS=Object.freeze({
  commando:'d5125b2306f5a0a9040b29110cc7b2e73a3387185dd32d92768e284ad50e5ffa',
  lantern:'9ee2e0a936f8fb156958b5c49350e5507a6aa501f6fbab582a6ef657bc9e037f',
  sleepwalker:'cf55e265068d44d620b7023a288327feeeed4017c200dbe3a088fd186e0e4f25',
  lancer:'eebf0fc68b6ca05ecc43fc3c80cef3298c145098f37700a43d23e126efd8fbe4',
  canal:'8c6e56e41f17cd10841b77d3b3d30546ab26c765dca88333ec7b07cc',
  skyline:'d9ce9e47d894140305a46fbad4938f3e18537ef80a5ecb658da4e6547f960820',
  stratos:'7f42a84418081db3a788f9bde643cb79af2f22cd0fc37e61a99bb36bfe801100',
  feud:'128aa7ef6c0aab80c27a1cf61b4356aecb8d5f20d426fa07b1f9a80b9e08512f',
  knockout:'1c1e859abc9111e63b7294ac98c02d7062708290780ca4df6f129231f6465b09'
});
// The source-hash contract makes test-pin edits visible, but no pin is updated here.
const STAGES={commando:3,lantern:3,sleepwalker:3,lancer:4,canal:3,
  skyline:3,stratos:3,feud:3,knockout:4};
function checkedFastPath(native,int32){
  if(typeof native!=='function'||typeof int32!=='function')
    throw new TypeError('missing exact fallback and checked operand validator');
  return function candidateMulDiv(a,b,d){
    a=int32(a);b=int32(b);d=int32(d);
    if(d===0)throw new RangeError('division by zero');
    const p=a*b;
    if(!Number.isSafeInteger(p))return native(a,b,d);
    // Exact integer multiple of d is formed before division; never accept
    // Math.trunc(p/d) as a substitute near integer boundaries.
    const q=(p-(p%d))/d;
    return int32(q,'quotient');
  };
}
function context(mode,{collect=false,maxSamples=2048}={}){
  if(!['reference','candidate'].includes(mode))throw new TypeError('invalid mode');
  const sandbox=vm.createContext({module:{exports:{}},console});
  const load=file=>vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),
    sandbox,{filename:file,timeout:15000});
  load(SOURCES[0]);
  const E=sandbox.Arcade2.Engine,original=E.mulDiv,
    candidate=checkedFastPath(original,E.int32),calls={total:0,safe:0,fallback:0},
    corpus=[];
  if(mode==='candidate'){
    function instrument(a,b,d){
      const p=a*b;
      const admissible=Number.isSafeInteger(p);
      if(collect){
        calls.total++;
        if(admissible)calls.safe++;else calls.fallback++;
        // Constant-stride sampling, bounded memory, reproducible from source.
        if(corpus.length<maxSamples&&calls.total%13===1)corpus.push([a,b,d]);
      }
      return candidate(a,b,d);
    }
    E.mulDiv=instrument;
    E.fromRatio=(n,d=1)=>instrument(n,65536,d);
    E.multiply=(a,b)=>instrument(a,b,65536);
    E.divide=(a,b)=>instrument(a,65536,b);
  }
  for(const file of SOURCES.slice(1))load(file);
  load('tests/arcade3-policy.cjs');
  const policy=sandbox.module.exports.policy;
  if(typeof policy!=='function')throw new Error('policy not loaded in guest context');
  return {A:sandbox.Arcade2,policy,calls,corpus};
}
function runCampaign(cabinet,guest,{maxTicks=40000}={}){
  if(!IDS.includes(cabinet))throw new TypeError('unknown cabinet');
  const meta=guest.A.registry.find(x=>x.id===cabinet);
  if(!meta)throw new Error('missing guest cabinet '+cabinet);
  const game=meta.create(),choose=guest.policy(cabinet),
    hash=crypto.createHash('sha256');
  let ticks=0,clears=0;
  for(;ticks<maxTicks&&game.status!=='won'&&game.status!=='lost';ticks++){
    if(game.status==='stageclear'){
      hash.update(JSON.stringify(game));
      game.next();clears++;
      continue;
    }
    const input=choose(game,ticks);
    game.tick(input);
    game.events.length=0;
    if(ticks%500===499)hash.update(JSON.stringify(game));
  }
  hash.update(JSON.stringify(game));
  return {cabinet,status:game.status,ticks,clears,score:game.score,
    hash:hash.digest('hex')};
}
function verifyCampaigns({maxTicks=40000}={}){
  const independent=[];
  const samples=[],totals={total:0,safe:0,fallback:0};
  for(const cabinet of IDS){
    const a=context('reference'),b=context('candidate',{collect:true});
    const reference=runCampaign(cabinet,a,{maxTicks});
    const candidate=runCampaign(cabinet,b,{maxTicks});
    for(const result of [reference,candidate]){
      if(result.status!=='won'||result.clears!==STAGES[cabinet]-1||
         result.hash!==PINS[cabinet])
        throw new Error('campaign pin mismatch '+JSON.stringify({cabinet,result,
          expected:PINS[cabinet]}));
    }
    if(JSON.stringify(reference)!==JSON.stringify(candidate))
      throw new Error('reference/candidate campaign divergence: '+cabinet);
    samples.push(...b.corpus);for(const k of Object.keys(totals))totals[k]+=b.calls[k];
    independent.push({cabinet,ticks:reference.ticks,stages:STAGES[cabinet],
      sha256:reference.hash,reference:'PASS',candidate:'PASS',
      observedQ16:b.calls.total,admitted:b.calls.safe,fallback:b.calls.fallback});
  }
  return {independent,totals,samples};
}
function reproducibleSamples(size=2048){
  const vals=[],next=(()=>{let x=0x91d4ab37;return ()=>{
    x=(Math.imul(x,1664525)+1013904223)>>>0;return x;};})();
  for(let i=0;i<size;i++){
    const a=(next()%200000)-100000,b=(next()%160000)-80000,d=(next()%100000)+1;
    vals.push([a,b,d]);
  }
  return vals;
}
function wideSamples(size=2048){
  const vals=[],next=(()=>{let x=0x5a03d228;return ()=>{
    x=(Math.imul(x,1664525)+1013904223)>>>0;return x;};})();
  for(let i=0;i<size;i++){
    const a=0x40000000+(next()%500000),b=0x40000000+(next()%500000),
      d=0x40000000+(next()%500000);
    vals.push([i%2?-a:a,b,d]);
  }
  return vals;
}
function classify(samples,expected){
  const native=A.Engine.mulDiv,int32=A.Engine.int32,
    candidate=checkedFastPath(native,int32);
  const valid=[];let refused=0,safe=0,fallback=0;
  for(const triple of samples){
    if(!Array.isArray(triple)||triple.length!==3)
      throw new TypeError('invalid measurement triple');
    const [a,b,d]=triple;
    let oracle,original,chosen;
    try{oracle={value:exactMulDiv(a,b,d)};}catch(e){oracle={error:e.name};}
    try{original={value:native(a,b,d)};}catch(e){original={error:e.name};}
    try{chosen={value:candidate(a,b,d)};}catch(e){chosen={error:e.name};}
    if(JSON.stringify(oracle)!==JSON.stringify(original)||
      JSON.stringify(oracle)!==JSON.stringify(chosen))
      throw new Error('scalar mismatch '+JSON.stringify({triple,oracle,original,chosen}));
    if(oracle.error){refused++;continue;}
    const admitted=guardedFloat64(a,b,d).admitted;
    if(admitted)safe++;else fallback++;
    valid.push(triple);
  }
  if(expected&&(!valid.length||!safe&&!fallback))
    throw new Error('no valid benchmark domain');
  return {samples:valid,safe,fallback,refused};
}
function median(numbers){
  if(!numbers.length||numbers.some(x=>!Number.isFinite(x)||x<0))
    throw new TypeError('invalid median samples');
  const s=[...numbers].sort((a,b)=>a-b),middle=Math.floor(s.length/2);
  return s.length%2?s[middle]:(s[middle-1]+s[middle])/2;
}
function benchCalls(fn,samples,iterations){
  let checksum=0;
  const start=process.hrtime.bigint();
  for(let repeat=0;repeat<iterations;repeat++)
    for(const [a,b,d] of samples)
      checksum=Math.imul(checksum^fn(a,b,d),1664525);
  return {nanoseconds:Number(process.hrtime.bigint()-start),checksum};
}
function pairedBenchmark({rounds=9,iterations=8,samples}){
  if(!Number.isInteger(rounds)||rounds<3||rounds>31||rounds%2!==1||
    !Number.isInteger(iterations)||iterations<1||iterations>50||
    !Array.isArray(samples)||!samples.length||samples.length>8192)
    throw new RangeError('invalid benchmark limits');
  const reference=A.Engine.mulDiv,candidate=checkedFastPath(reference,A.Engine.int32);
  const a=[],b=[],trials=[],warmups=2;
  for(let trial=-warmups;trial<rounds;trial++){
    // Alternating AB and BA pairs; record only post-warmup measurements.
    const swapped=trial>=0?trial%2===1:(trial+warmups)%2===1;
    const order=swapped?['candidate','reference']:['reference','candidate'];
    const observed={};
    for(const variant of order)observed[variant]=benchCalls(
      variant==='reference'?reference:candidate,samples,iterations);
    if(observed.reference.checksum!==observed.candidate.checksum)
      throw new Error('benchmark candidate checksum differs');
    if(trial>=0){
      const per=iterations*samples.length;
      a.push(observed.reference.nanoseconds/per);
      b.push(observed.candidate.nanoseconds/per);
      trials.push({order,referenceNs:observed.reference.nanoseconds,
        candidateNs:observed.candidate.nanoseconds,operations:per,
        checksum:observed.reference.checksum});
    }
  }
  return {workloadSize:samples.length,iterations,rounds,warmups,
    referenceMedianNsPerCall:median(a),candidateMedianNsPerCall:median(b),
    medianPairedSpeedup:median(a.map((n,i)=>n/b[i])),
    ratioOfMedians:median(a)/median(b),trials};
}
function sourceIdentity(){
  let gitHead=null;
  try{gitHead=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();}
  catch{}
  if(process.env.GITHUB_SHA&&gitHead!==process.env.GITHUB_SHA)
    throw new Error('GitHub checkout SHA mismatch');
  return {gitHead,platform:process.platform,arch:process.arch,node:process.version,
    files:[...SOURCES,...INPUTS].map(p=>({path:p,
      sha256:SHA(fs.readFileSync(path.join(ROOT,p))) }))};
}
function experiment({rounds=9,iterations=8}={}){
  const campaigns=verifyCampaigns();
  const group={
    sampledGame:classify(campaigns.samples,true),
    syntheticSafe:classify(reproducibleSamples(),true),
    syntheticWide:classify(wideSamples(),true),
  };
  const bench={},coverage={};
  for(const [name,domain] of Object.entries(group)){
    coverage[name]={safe:domain.safe,fallback:domain.fallback,refused:domain.refused,
      measured:domain.samples.length};
    bench[name]=pairedBenchmark({rounds,iterations,samples:domain.samples});
  }
  return {kind:'qsol.arcade3.numspec.perf.002.v1',status:'PASS',
    source:sourceIdentity(),settings:{rounds,iterations},
    campaignGate:{total:campaigns.independent.length,
      stageCount:campaigns.independent.reduce((n,x)=>n+x.stages,0),
      campaigns:campaigns.independent,observed:campaigns.totals},
    domains:coverage,benchmarks:bench,
    promotionStatus:'NOT_ADMITTED',
    claimBoundary:'CPU Node microbench, one host; no production change. Independent CPU/hardware and expanded numeric proofs required.'};
}
function main(args=process.argv.slice(2)){
  let rounds=9,iterations=8,out='artifacts/arcade3-numspec-perf-002.json';
  for(let i=0;i<args.length;i++){
    const flag=args[i],value=args[++i];
    if(value===undefined)throw new Error('missing CLI option value');
    if(flag==='--rounds')rounds=Number(value);
    else if(flag==='--iterations')iterations=Number(value);
    else if(flag==='--out')out=value;
    else throw new Error('unsupported CLI option '+flag);
  }
  let report;
  try{report=experiment({rounds,iterations});}
  catch(error){
    process.exitCode=1;
    report={kind:'qsol.arcade3.numspec.perf.002.v1',status:'FAIL',
      source:sourceIdentity(),settings:{rounds,iterations},
      failure:{name:error.name,message:error.message,stack:error.stack}};
  }
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const contents=JSON.stringify(report,null,2)+'\n';
  fs.writeFileSync(out,contents,{flag:'wx'});
  fs.writeFileSync(path.join(path.dirname(out),'NUMSPEC_PERF_SHA256SUMS'),
    SHA(contents)+'  '+path.basename(out)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:report.status,reportSha256:SHA(contents),
    benchmarks:report.benchmarks&&Object.fromEntries(
      Object.entries(report.benchmarks).map(([k,v])=>[k,v.medianPairedSpeedup])),
    campaignCount:report.campaignGate?.total,
    failure:report.failure?.message??null}));
}
if(require.main===module)main();
module.exports={PINS,STAGES,checkedFastPath,context,runCampaign,
  verifyCampaigns,reproducibleSamples,wideSamples,classify,pairedBenchmark,
  experiment};
