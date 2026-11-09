// SPDX-License-Identifier: Apache-2.0
// QFLOAT-RUNNER-001: OWNER-DISPATCHED, reviewed-main, headed Chromium witness.
// Preinstalled pinned Playwright only; never install packages or run PR code.
// The Pages mirror is byte-verified against the checkout BEFORE browser execution.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdirSync,readFileSync,realpathSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve,extname,relative,sep} from 'node:path';
import os from 'node:os';
import {findPlaywright} from './rtx-playwright.mjs';

const ROOT=resolve(import.meta.dirname,'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const SITE='https://qsolkcb.github.io/ARCADE/';
const TARGETS=['local','both'];
const FILES=Object.freeze([
  'arcade3/qfloat-lab.html',
  'arcade3/qfloat-lab.css',
  'arcade3/qfloat-lab.js',
  'arcade3/qfloat-sim.js',
  'arcade2/qfloat.js',
  'arcade2/engine.js'
]);
const LIMIT=256*1024;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8'};
function parseArgs(args){
  const options={};
  for(let i=0;i<args.length;i++){
    const name=args[i],value=args[++i];
    if(!['--expected-head','--out','--target'].includes(name)||value===undefined||
      Object.hasOwn(options,name))throw new TypeError('usage: --expected-head SHA --out ABS_DIR --target local|both');
    options[name]=value;
  }
  const head=options['--expected-head'],out=options['--out'],target=options['--target']??'both';
  if(!/^[a-f0-9]{40}$/.test(head??''))throw new TypeError('expected 40-hex commit SHA');
  if(typeof out!=='string'||!out.startsWith('/')||out.includes('/../'))
    throw new TypeError('evidence must have an absolute nontraversing directory');
  if(!TARGETS.includes(target))throw new TypeError('invalid target');
  return {head,out,target};
}
function git(...args){
  const r=spawnSync('git',args,{cwd:ROOT,encoding:'utf8',timeout:10000});
  if(r.error||r.status!==0)throw Error('git '+args[0]+' failed: '+(r.stderr||r.error?.message||r.status));
  return r.stdout.trim();
}
function requireReviewedHead(expected){
  if(process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||
     process.env.GITHUB_REPOSITORY!=='QSOLKCB/ARCADE'||
     process.env.GITHUB_REF!=='refs/heads/main'||
     process.env.GITHUB_ACTOR!=='EmergentMonk'||
     process.env.GITHUB_SHA!==expected)
    throw Error('Only owner-dispatched reviewed main is allowed on this workstation');
  if(git('rev-parse','--abbrev-ref','HEAD')!=='HEAD'&&git('branch','--show-current')!=='main')
    throw Error('unexpected checkout branch');
  if(git('rev-parse','HEAD')!==expected||git('status','--porcelain')!=='')
    throw Error('checkout is not exact clean reviewed main');
  if(!/(?:github\.com[:/])QSOLKCB\/ARCADE(?:\.git)?$/i.test(git('remote','get-url','origin')))
    throw Error('Git origin does not match QSOLKCB/ARCADE');
  if(!process.env.WAYLAND_DISPLAY&&!process.env.DISPLAY)
    throw Error('A visible logged-in desktop is required; SSH/systemd headless execution is refused');
}
function sourceManifest(){
  return FILES.map(file=>{
    const bytes=readFileSync(join(ROOT,file));
    if(!bytes.length||bytes.length>LIMIT)throw Error('unreasonable local runtime file size: '+file);
    return {path:file,bytes:bytes.length,sha256:sha(bytes)};
  });
}
function allowedResource(url,base){
  let parsed,origin;
  try{parsed=new URL(url);origin=new URL(base);}catch{return false;}
  if(parsed.origin!==origin.origin||parsed.hash)return false;
  let path=parsed.pathname;
  const prefix=origin.pathname;
  if(!path.startsWith(prefix))return false;
  path=path.slice(prefix.length);
  if(!FILES.includes(path))return false;
  return parsed.search===''||(path==='arcade2/engine.js'&&parsed.search==='?v=0.8.0');
}
async function verifyPublished(manifest){
  const result=[];
  for(const file of manifest){
    const url=SITE+file.path+(file.path==='arcade2/engine.js'?'?v=0.8.0':'');
    const response=await fetch(url,{redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(12000),
      headers:{'Accept':'text/html,application/javascript,text/css,*/*;q=0.1'}});
    if(!response.ok)throw Error('Pages not deployed at '+url+': HTTP '+response.status);
    const advertised=Number(response.headers.get('content-length'));
    if(Number.isFinite(advertised)&&advertised>LIMIT)
      throw Error('Pages resource is unexpectedly large: '+file.path);
    const payload=Buffer.from(await response.arrayBuffer());
    if(payload.length>LIMIT)throw Error('Pages resource exceeds size bound: '+file.path);
    const digest=sha(payload);
    if(digest!==file.sha256)
      throw Error('Pages content differs from reviewed main for '+file.path+
        ' (expected '+file.sha256+', received '+digest+
        '). Wait for Pages deployment, then dispatch again.');
    result.push({path:file.path,bytes:payload.length,sha256:digest});
  }
  return result;
}
function server(){
  const root=realpathSync(ROOT);
  return createServer((req,res)=>{
    try{
      if(req.method!=='GET'&&req.method!=='HEAD'){
        res.writeHead(405);res.end();return;
      }
      const request=new URL(req.url,'http://127.0.0.1');
      const key=request.pathname.replace(/^\/+/,'');
      if(!FILES.includes(key)||
         (request.search&&!(key==='arcade2/engine.js'&&request.search==='?v=0.8.0'))){
        res.writeHead(404);res.end();return;
      }
      const filename=realpathSync(join(root,key));
      const rel=relative(root,filename);
      if(rel==='..'||rel.startsWith('..'+sep)){
        res.writeHead(403);res.end();return;
      }
      const content=readFileSync(filename);
      res.writeHead(200,{'Content-Type':MIME[extname(filename)]??'application/octet-stream',
        'Content-Length':content.length,'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff'});
      if(req.method==='HEAD')res.end();
      else res.end(content);
    }catch{res.writeHead(404);res.end();}
  });
}
function commandPath(names){
  for(const name of names){
    const r=spawnSync('which',[name],{encoding:'utf8',timeout:3000});
    if(r.status===0&&r.stdout.trim())return realpathSync(r.stdout.trim());
  }
  throw Error('A local Chrome/Chromium executable is required; no download is attempted');
}
async function start(srv){
  await new Promise((ok,bad)=>{srv.once('error',bad);srv.listen(0,'127.0.0.1',ok);});
  return 'http://127.0.0.1:'+srv.address().port+'/';
}
async function stop(srv){
  if(srv.listening)await new Promise(done=>srv.close(done));
}
async function witness(browser,base,name,out){
  const context=await browser.newContext({viewport:{width:1360,height:940},
    serviceWorkers:'block',reducedMotion:'reduce'});
  let page;
  const errors=[],checks=[];
  const record=(description,detail)=>checks.push({description,detail});
  try{
    await context.route('**/*',async route=>{
      const url=route.request().url();
      if(allowedResource(url,base))return route.continue();
      if(new URL(url).pathname.endsWith('/favicon.ico'))
        return route.fulfill({status:204,body:''});
      errors.push('unexpected request: '+url);
      return route.abort();
    });
    page=await context.newPage();
    page.on('pageerror',e=>errors.push('pageerror: '+e.message));
    page.on('console',message=>{
      if(message.type()==='error')errors.push('console: '+message.text());
    });
    const url=base+'arcade3/qfloat-lab.html';
    const response=await page.goto(url,{waitUntil:'load',timeout:20000});
    assert.equal(response.status(),200,'QFloat lab document must load');
    await page.waitForFunction(()=>document.documentElement.dataset.qfloatReady==='ready',null,{timeout:12000});
    assert.match(await page.title(),/QFLOAT-001/);
    assert.equal(await page.locator('#result-view').innerText(),'0.300');
    assert.equal(await page.locator('#result-exact').innerText(),'0.2999877929687500');
    assert.equal(await page.locator('#result-raw').innerText(),'19660');
    record('decimal quantum visible',{raw:19660,exact:'0.2999877929687500',display:'0.300'});

    const pixels=await page.locator('#field').evaluate(canvas=>{
      const ctx=canvas.getContext('2d'),center=ctx.getImageData(320,180,1,1).data;
      return [center[0],center[1],center[2],center[3]];
    });
    assert.ok(pixels[0]>75&&pixels[1]>185&&pixels[2]>160&&pixels[3]===255,
      'Canvas2D must actually draw the illuminated player at the initial coordinate');
    record('real Canvas2D pixels',{centerRGB:pixels});

    assert.equal(await page.locator('#tick-label').innerText(),'TICK 0');
    assert.equal(await page.locator('#x-raw').innerText(),'RAW 20971520');
    await page.keyboard.down('ArrowRight');
    await page.locator('#single').click();
    assert.equal(await page.locator('#tick-label').innerText(),'TICK 1');
    assert.equal(await page.locator('#x-raw').innerText(),'RAW 21053440');
    await page.keyboard.up('ArrowRight');
    const holding=await page.locator('#x-raw').innerText();
    await page.locator('#single').click();
    assert.equal(await page.locator('#x-raw').innerText(),holding);
    assert.equal(await page.locator('#tick-label').innerText(),'TICK 2');
    record('keyboard and exact single step',{firstTickXRaw:21053440,stationaryNextTick:true});

    // Two aliases for the same direction: releasing one must not cancel the other.
    await page.keyboard.down('ArrowRight');await page.keyboard.down('KeyD');
    await page.keyboard.up('ArrowRight');
    await page.locator('#single').click();
    assert.equal(await page.locator('#x-raw').innerText(),'RAW 21135360');
    await page.keyboard.up('KeyD');
    record('concurrent key aliases',{xRaw:21135360});

    const tickBefore=Number((await page.locator('#tick-label').innerText()).slice(5));
    await page.locator('#play').click();
    await page.waitForFunction(n=>{
      const label=document.querySelector('#tick-label').textContent;
      return Number(label.slice(5))>=n+9;
    },tickBefore,{timeout:14000});
    const ticking=Number((await page.locator('#tick-label').innerText()).slice(5));
    assert.equal(await page.locator('#single').isDisabled(),true);
    await page.locator('#pause').click();
    const frozen=await page.locator('#tick-label').innerText(),
      frozenX=await page.locator('#x-raw').innerText();
    await page.waitForTimeout(240);
    assert.equal(await page.locator('#tick-label').innerText(),frozen);
    assert.equal(await page.locator('#x-raw').innerText(),frozenX);
    record('real requestAnimationFrame ticking and pause freeze',
      {startedAt:tickBefore,reached:ticking,pausedAt:frozen});

    await page.locator('#speed').fill('20.1');
    await page.locator('#speed').dispatchEvent('change');
    assert.match(await page.locator('#status').innerText(),/Rejected speed/);
    await page.locator('#speed').fill('1.25');
    await page.locator('#reset').click();
    assert.equal(await page.locator('#tick-label').innerText(),'TICK 0');
    assert.equal(await page.locator('#x-raw').innerText(),'RAW 20971520');
    record('invalid speed fails closed and reset restores exact origin',{resetRawX:20971520});

    await page.locator('#operand-a').fill('1e3');
    await page.locator('#calculate').click();
    assert.equal(await page.locator('#result-view').innerText(),'REJECTED');
    await page.locator('#operand-a').fill('0.1');
    await page.locator('#operand-b').fill('0.2');
    await page.locator('#calculate').click();
    assert.equal(await page.locator('#result-raw').innerText(),'19660');
    record('malformed decimal refuses',{invalid:'1e3'});

    await page.locator('#play').click();
    await page.waitForFunction(()=>document.querySelector('#tick-label').textContent!=='TICK 0',
      null,{timeout:14000});
    await page.evaluate(()=>dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('#pause').isDisabled(),true);
    const blurState=await page.locator('#tick-label').innerText();
    await page.waitForTimeout(240);
    assert.equal(await page.locator('#tick-label').innerText(),blurState);
    record('window blur pauses and clears controls',{at:blurState});

    await page.screenshot({path:join(out,name+'-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(80);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=0,'390 px mobile layout must not overflow horizontally: '+overflow);
    await page.screenshot({path:join(out,name+'-mobile.png'),fullPage:true});
    record('responsive 390px screenshot',{horizontalOverflowPx:overflow});

    assert.deepEqual(errors,[],'browser JS/console/network errors are forbidden');
    return {target:name,url,passed:true,checks,errors,screenshots:[
      name+'-desktop.png',name+'-mobile.png']};
  }catch(error){
    if(page){
      try{await page.screenshot({path:join(out,name+'-failure.png'),fullPage:true,
        timeout:5000});}catch{}
    }
    error.checks=checks;error.browserErrors=errors;throw error;
  }finally{await context.close();}
}
function seal(out,report){
  writeFileSync(join(out,'QFLOAT_RUNNER_REPORT.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  const lines=['# QFLOAT-RUNNER-001 — headed Chromium on owner workstation','',
    'Result: **'+report.status+'**',
    'Checked out reviewed commit: '+report.source.head,
    'Browser: '+(report.browser?.version??'unavailable'),
    'Target selection: '+report.target,
    '',...report.targets.map(x=>'- '+x.target+': '+(x.passed?'PASS':'FAIL')),
    '',...report.failures.map(x=>'- FAILURE: '+x),
    '','The execution is a browser UI witness, not a numerical speedup or GPU-timer measurement.',''];
  writeFileSync(join(out,'SUMMARY.md'),lines.join('\n'),{flag:'wx',mode:0o600});
  const receipts=readdirSync(out,{withFileTypes:true})
    .filter(x=>x.isFile()&&x.name!=='SHA256SUMS')
    .sort((a,b)=>a.name.localeCompare(b.name));
  writeFileSync(join(out,'SHA256SUMS'),
    receipts.map(f=>sha(readFileSync(join(out,f.name)))+'  '+f.name).join('\n')+'\n',
    {flag:'wx',mode:0o600});
}
async function main(args=process.argv.slice(2)){
  const opts=parseArgs(args);
  requireReviewedHead(opts.head);
  const tool=findPlaywright(),chrome=commandPath([
    'google-chrome-stable','google-chrome','chromium','chromium-browser'
  ]);
  const baseEvidence=resolve(opts.out);
  if(existsSync(baseEvidence))throw Error('refuse to overwrite existing evidence directory');
  mkdirSync(resolve(baseEvidence,'..'),{recursive:true,mode:0o700});
  mkdirSync(baseEvidence,{mode:0o700});
  let browser=null,srv=null;
  const report={kind:'qsol.arcade.qfloat.runner.001.v1',status:'FAIL',
    target:opts.target,source:{head:opts.head,files:sourceManifest()},
    startedAt:new Date().toISOString(),finishedAt:null,
    runner:{name:process.env.RUNNER_NAME??null,platform:os.platform(),
      release:os.release(),cpu:os.cpus()[0]?.model,architecture:os.arch(),
      node:process.version,display:process.env.WAYLAND_DISPLAY?'wayland':'x11'},
    playwright:{version:tool.version,executable:chrome},browser:null,
    pagesManifest:null,targets:[],failures:[]};
  try{
    srv=server();const local=await start(srv);
    browser=await tool.chromium.launch({headless:false,executablePath:chrome,
      args:['--disable-background-networking','--no-first-run']});
    report.browser={version:browser.version()};
    report.targets.push(await witness(browser,local,'local',baseEvidence));
    if(opts.target==='both'){
      report.pagesManifest=await verifyPublished(report.source.files);
      report.targets.push(await witness(browser,SITE,'pages',baseEvidence));
    }
    report.status='PASS';
  }catch(error){
    report.failures.push(error.name+': '+error.message);
    if(error.checks)report.partialChecks=error.checks;
    if(error.browserErrors)report.browserErrors=error.browserErrors;
    console.error('QFLOAT browser witness FAILED:',error.stack);
    process.exitCode=1;
  }finally{
    if(browser)await browser.close().catch(e=>report.failures.push('browser close: '+e.message));
    if(srv)await stop(srv).catch(e=>report.failures.push('server close: '+e.message));
    if(report.failures.length)report.status='FAIL';
    report.finishedAt=new Date().toISOString();
    seal(baseEvidence,report);
    console.log(JSON.stringify({status:report.status,out:baseEvidence,
      head:opts.head,checks:report.targets.map(x=>x.target),failures:report.failures}));
  }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))
  main().catch(error=>{console.error('QFLOAT PRECONDITION FAILED:',error.stack);process.exitCode=1;});
export {parseArgs,allowedResource,sourceManifest,requireReviewedHead};
