// SPDX-License-Identifier: Apache-2.0
// ARCADE 2 on the owner's RTX 5060 Ti: an owner-dispatched, physically headed check.
// Never runs on push or pull_request (see .github/workflows/rtx5060ti-arcade2.yml).
//
// What it observes, in a visible Chrome window on the real GPU and display:
//  1. Identity: nvidia-smi and the browser's WebGL renderer must name the RTX 5060 Ti;
//     software renderers (SwiftShader, llvmpipe, lavapipe) are refused.
//  2. Paint submission cost per frame (performance.now around draw + post) for every
//     cabinet across a complete policy-driven campaign: v0.6.0 full, v0.6.0 lite and
//     the pre-graphics baseline commit. CPU-side command submission, not GPU timers.
//  3. The running app: each cabinet launched from its Play button with held keys;
//     simulation ticks per second, requestAnimationFrame intervals on the real
//     display, page errors, the FX label (automatic lite must not trigger) and a
//     screenshot. Optional audible effects.
//  4. Offline: the service worker reloads a #cabinet deep link with the server stopped.
// Evidence goes to a fresh directory outside the checkout with SHA256SUMS.
// --dry-run (development only) allows headless, any Playwright version, no NVIDIA
// device and a non-main checkout; its report says dryRun:true and is never evidence.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {existsSync,mkdirSync,readFileSync,realpathSync,writeFileSync,readdirSync} from 'node:fs';
import {extname,join,relative,resolve,sep} from 'node:path';
import os from 'node:os';
import {findPlaywright} from './rtx-playwright.mjs';

const ROOT=resolve(import.meta.dirname,'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const GATES={tickRateMin:59.5,tickRateMax:60.5,fullPaintP99Ms:8,fullLongFrameRatio:0.05};
const FRAMES=360; // presented frames sampled evenly across each campaign
// Held keys keep each run alive for the sample (platform heroes stay clear of the pits).
const KEYS={shadow:['ArrowLeft','z'],cache:['ArrowLeft','z'],iron:['ArrowLeft','z'],soccer:['ArrowRight','z','x'],hoops:['ArrowRight','z'],
  kombat:['ArrowRight','z','x'],breach:['ArrowLeft','z'],invaders:['ArrowLeft','z'],vector:['ArrowDown','z'],ember:['ArrowUp','z']};

function cmd(command,argv,cwd=ROOT){
  const r=spawnSync(command,argv,{cwd,encoding:'utf8',timeout:30000});
  if(r.error||r.status!==0)throw Error(command+' failed: '+(r.stderr||r.error?.message||r.status));
  return r.stdout.trim();
}
function parseArgs(argv){
  const o={dryRun:false,sound:false};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(key==='--help'){console.log('Usage: node scripts/rtx5060ti-arcade2.mjs --expected-head 40hex --baseline /abs/worktree --out /abs/fresh/dir [--sound] [--dry-run]');process.exit(0);}
    if(key==='--dry-run'){o.dryRun=true;continue;}
    if(key==='--sound'){o.sound=true;continue;}
    if(!['--expected-head','--baseline','--out'].includes(key)||!argv[i+1])throw Error('unknown or incomplete argument '+key);
    o[key.slice(2).replace('-h','H')]=argv[++i];
  }
  if(!/^[a-f0-9]{40}$/.test(o.expectedHead??''))throw Error('--expected-head must be a 40-hex commit');
  if(!o.out?.startsWith('/')||!o.baseline?.startsWith('/'))throw Error('--out and --baseline must be absolute');
  return o;
}
function browserExecutable(){
  for(const name of ['google-chrome-stable','google-chrome','chromium','chromium-browser']){
    const r=spawnSync('which',[name],{encoding:'utf8',timeout:5000});
    if(r.status===0&&r.stdout.trim())return realpathSync(r.stdout.trim());
  }
  throw Error('Native Chrome/Chromium executable required');
}
// Static server: checkout at /, baseline worktree at /__baseline/. No traversal or symlink escape.
function server(baseline){
  const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.md':'text/markdown',
    '.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.cjs':'text/javascript'};
  const roots={'':realpathSync(ROOT),'/__baseline':realpathSync(baseline)};
  const sockets=new Set();
  const srv=createServer((req,res)=>{
    try{
      let name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      let root=roots[''];
      if(name.startsWith('/__baseline/')){root=roots['/__baseline'];name=name.slice('/__baseline'.length);}
      if(name.endsWith('/'))name+='index.html';
      const target=resolve(root,'.'+name),rel=relative(root,target);
      if(!rel||rel.startsWith('..')||rel.split(sep).some(part=>part.startsWith('.')))throw Error('unsafe path');
      const actual=realpathSync(target),sub=relative(root,actual);
      if(sub.startsWith('..'))throw Error('symlink escape');
      res.setHeader('Content-Type',types[extname(actual)]||'application/octet-stream');res.end(readFileSync(actual));
    }catch{res.writeHead(404);res.end();}
  });
  srv.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
  srv.stop=()=>new Promise(ok=>{srv.close(()=>ok());for(const s of sockets)s.destroy();});
  return srv;
}
const quantiles=xs=>{const s=[...xs].sort((a,b)=>a-b),q=p=>s[Math.min(s.length-1,Math.floor(p*s.length))];
  return {n:s.length,median:+q(.5).toFixed(3),p95:+q(.95).toFixed(3),p99:+q(.99).toFixed(3),max:+s.at(-1).toFixed(3)};};

// In-page paint benchmark: FRAMES presented frames sampled evenly across a complete
// campaign (policy from tests/arcade2-policy.cjs). Each frame is drawn inside its own
// requestAnimationFrame onto a visible canvas, so the browser flushes and presents
// every frame on the real GPU. Records CPU-side submission time and rAF intervals.
async function paintBenchmark(page,base,policySource,quality){
  await page.goto(base);
  await page.waitForFunction(()=>window.Arcade2&&window.Arcade2.registry.length===10);
  await page.addScriptTag({content:'(function(module){'+policySource+'})(window.__policy={});'});
  return page.evaluate(async([quality,frames])=>{
    const A=window.Arcade2;if(A.Gfx&&quality)A.Gfx.setQuality(quality);
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
    canvas.style.cssText='position:fixed;left:0;top:0;width:640px;height:360px;z-index:2147483647;image-rendering:pixelated';
    document.body.append(canvas);
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
    const raf=()=>new Promise(done=>requestAnimationFrame(done)),out={};
    const run=(meta,visit)=>{const g=meta.create(),control=window.__policy.exports.policy(meta.id);let t=0;
      const step=()=>{if(g.status==='stageclear')g.next();else{g.tick(control(g,t));g.events.length=0;}t++;};
      return {g,step,done:()=>t>=15000||g.status==='won'||g.status==='lost',get t(){return t;}};};
    for(const meta of A.registry){
      const probe=run(meta);while(!probe.done())probe.step();
      const stride=Math.max(1,Math.floor(probe.t/frames)),r=run(meta),times=[],intervals=[];let last=null;
      while(!r.done()){
        for(let k=0;k<stride&&!r.done();k++)r.step();
        const now=await raf();if(last!==null)intervals.push(now-last);last=now;
        const start=performance.now();
        c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';r.g.draw(c);if(A.Gfx)A.Gfx.post(c,r.g);
        times.push(performance.now()-start);
      }
      out[meta.id]={status:r.g.status,times:times.slice(5),intervals:intervals.slice(5)};
    }
    canvas.remove();return out;
  },[quality||'',FRAMES]);
}

async function main(){
  const o=parseArgs(process.argv.slice(2));
  const head=cmd('git',['rev-parse','HEAD']);
  const findings=[],fail=message=>findings.push(message);
  if(!o.dryRun){
    if(cmd('git',['branch','--show-current'])!=='main'||head!==o.expectedHead)throw Error('Exact reviewed main required');
    if(cmd('git',['status','--porcelain']))throw Error('dirty checkout; refuse physical evidence');
    if(!/(?:github\.com[:/])QSOLKCB\/ARCADE(?:\.git)?$/i.test(cmd('git',['remote','get-url','origin'])))throw Error('unexpected Git origin');
    if(!process.env.DISPLAY&&!process.env.WAYLAND_DISPLAY)throw Error('visible desktop required, no Xvfb/headless fallback');
  }else if(head!==o.expectedHead)throw Error('--expected-head does not match HEAD');
  const baselineHead=cmd('git',['rev-parse','HEAD'],o.baseline);
  if(!existsSync(join(o.baseline,'arcade2/index.html')))throw Error('baseline worktree has no arcade2/');
  if(existsSync(o.out))throw Error('refuse overwrite of existing evidence directory');
  mkdirSync(o.out,{recursive:true,mode:0o700});

  let nvidia=null;
  try{nvidia=cmd('nvidia-smi',['--query-gpu=name,driver_version,memory.total','--format=csv,noheader']);}
  catch(error){if(!o.dryRun)throw error;}
  if(!o.dryRun&&nvidia.split(/\r?\n/).filter(s=>/RTX\s*5060\s*Ti/i.test(s)).length!==1)throw Error('exactly one RTX 5060 Ti required');

  const tool=findPlaywright({pin:o.dryRun?null:undefined});
  const chrome=o.dryRun?null:browserExecutable();
  const policySource=readFileSync(join(ROOT,'tests/arcade2-policy.cjs'),'utf8');
  const srv=server(o.baseline);let browser;
  const report={kind:'qsol.arcade.arcade2.rtx5060ti.v1',dryRun:o.dryRun,head,baselineHead,
    startedAt:new Date().toISOString(),host:{platform:os.platform(),release:os.release(),cpu:os.cpus()[0]?.model,cpus:os.cpus().length,nvidia,
      // Which self-hosted runner served the job (set by the Actions runner).
      runner:{name:process.env.RUNNER_NAME||null,os:process.env.RUNNER_OS||null,arch:process.env.RUNNER_ARCH||null},
      session:process.env.WAYLAND_DISPLAY?'wayland':process.env.DISPLAY?'x11':'none'},
    playwright:tool.version,gates:GATES};
  try{
    await new Promise((ok,bad)=>{srv.once('error',bad);srv.listen(0,'127.0.0.1',ok);});
    const base='http://127.0.0.1:'+srv.address().port;
    browser=await tool.chromium.launch({...(chrome?{executablePath:chrome}:{}),headless:o.dryRun,
      args:['--disable-background-networking','--no-first-run']});
    report.browser=browser.version();
    const context=await browser.newContext({viewport:{width:1280,height:900}});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push('pageerror: '+e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
    await context.route('**/*',route=>{
      const url=route.request().url();
      if(url.startsWith(base+'/'))return route.continue();
      errors.push('external request refused: '+url);return route.abort();
    });
    await page.goto(base+'/arcade2/index.html');await page.bringToFront();
    report.identity=await page.evaluate(()=>{
      const gl=document.createElement('canvas').getContext('webgl');if(!gl)return {vendor:null,renderer:null};
      const ext=gl.getExtension('WEBGL_debug_renderer_info');
      return ext?{vendor:gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}:{vendor:null,renderer:null};
    });
    report.display=await page.evaluate(()=>({width:screen.width,height:screen.height,dpr:Math.round(devicePixelRatio*100)/100}));
    if(!o.dryRun){
      if(!/NVIDIA/i.test(report.identity.vendor||'')||!/RTX\s*5060\s*Ti/i.test(report.identity.renderer||''))fail('browser renderer is not the RTX 5060 Ti: '+JSON.stringify(report.identity));
      if(/swiftshader|software|llvmpipe|lavapipe/i.test(report.identity.renderer||''))fail('software renderer in use');
    }

    // 2. Paint submission cost, paired: baseline, v0.6.0 full, v0.6.0 lite.
    report.paint={};
    for(const [label,url,quality] of [['baseline',base+'/__baseline/arcade2/index.html',''],['full',base+'/arcade2/index.html','high'],['lite',base+'/arcade2/index.html','lite']]){
      const raw=await paintBenchmark(page,url,policySource,quality);
      report.paint[label]=Object.fromEntries(Object.entries(raw).map(([id,r])=>{
        const frames=quantiles(r.intervals),long=r.intervals.filter(v=>v>frames.median*1.5).length;
        return [id,{campaign:r.status,...quantiles(r.times),frameIntervalMs:frames,longFrames:long,longFrameRatio:+(long/r.intervals.length).toFixed(4)}];}));
    }
    for(const [id,q] of Object.entries(report.paint.full)){
      if(q.p99>GATES.fullPaintP99Ms)fail(id+' full-tier paint p99 '+q.p99+' ms exceeds '+GATES.fullPaintP99Ms+' ms');
      if(q.longFrameRatio>GATES.fullLongFrameRatio)fail(id+' full-tier long presented frames '+(q.longFrameRatio*100).toFixed(1)+'%');
    }
    for(const [label,rows] of Object.entries(report.paint))for(const [id,q] of Object.entries(rows))if(q.campaign!=='won')fail(label+' '+id+' campaign ended '+q.campaign);

    // 3. The real app on the real display.
    await page.goto(base+'/arcade2/index.html');await page.waitForFunction(()=>document.querySelectorAll('.card').length===10);
    await page.evaluate(()=>{try{localStorage.removeItem('qsol-arcade2:fx');}catch(_){}});
    await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.card').length===10);
    await page.screenshot({path:join(o.out,'hall.png')});
    if(o.sound)await page.click('#audio');
    // Measurement only: count real tick() calls on each game family's prototype.
    await page.evaluate(()=>{window.__ticks=0;const A=window.Arcade2;
      for(const C of [A.Platform,A.Sport,A.Kombat,A.Breach,A.Shmup,A.Invaders]){const tick=C.prototype.tick;C.prototype.tick=function(input){window.__ticks++;return tick.call(this,input);};}});
    report.play={};
    for(const id of await page.evaluate(()=>[...document.querySelectorAll('[data-play]')].map(b=>b.dataset.play))){
      await page.click(`[data-play="${id}"]`);await page.waitForSelector('#playroom:not([hidden])');
      for(const key of KEYS[id])await page.keyboard.down(key);
      await page.waitForTimeout(600);
      const sample=await page.evaluate(()=>new Promise(done=>{
        const intervals=[],n0=window.__ticks,t0=performance.now();let last=null;
        const step=now=>{if(last!==null)intervals.push(now-last);last=now;
          if(now-t0<5000)requestAnimationFrame(step);else done({ticks:window.__ticks-n0,seconds:(performance.now()-t0)/1000,intervals});};
        requestAnimationFrame(step);}));
      for(const key of KEYS[id])await page.keyboard.up(key);
      await page.locator('.monitor').screenshot({path:join(o.out,'play-'+id+'.png')});
      const fx=await page.locator('#fx').textContent(),ended=await page.locator('#overlay').isVisible();
      const rate=sample.ticks/sample.seconds,frames=quantiles(sample.intervals),median=frames.median;
      const long=sample.intervals.filter(v=>v>median*1.5).length;
      report.play[id]={ticksPerSecond:+rate.toFixed(3),seconds:+sample.seconds.toFixed(3),frameIntervalMs:frames,longFrames:long,fx,endedDuringSample:ended,
        score:await page.locator('#hud-score').textContent(),hud:await page.locator('#hud-right').textContent()};
      if(ended)fail(id+' run ended during the sample, so its tick rate is not a clock measurement');
      else if(rate<GATES.tickRateMin||rate>GATES.tickRateMax)fail(id+' ran '+rate.toFixed(2)+' ticks/s');
      if(/auto/.test(fx))fail(id+' triggered the automatic lite fallback');
      await page.click('#leave');await page.waitForSelector('#hall:not([hidden])');
    }

    // 4. Offline deep link with the server stopped.
    const offline=await context.newPage();offline.on('pageerror',e=>errors.push('offline pageerror: '+e.message));
    await offline.goto(base+'/arcade2/index.html');
    await offline.evaluate(()=>navigator.serviceWorker.ready);await offline.reload();
    await offline.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:20000});
    await srv.stop();
    await offline.evaluate(()=>{location.hash='ember';});
    try{
      await offline.reload();await offline.waitForSelector('#continue',{state:'visible',timeout:10000});
      await offline.click('#continue');await offline.waitForTimeout(1500);
      report.offline={reloadedWithServerStopped:true,hud:await offline.locator('#hud-right').textContent()};
    }catch(error){report.offline={reloadedWithServerStopped:false,error:error.message.split('\n')[0]};fail('offline deep-link reload failed');}
    report.errors=errors;for(const e of errors)fail(e);
  }finally{
    if(browser)await browser.close();
    if(srv.listening)await srv.stop();
  }
  report.finishedAt=new Date().toISOString();
  report.findings=findings;report.passed=findings.length===0;
  writeFileSync(join(o.out,'report.json'),JSON.stringify(report,null,2)+'\n');
  writeFileSync(join(o.out,'SUMMARY.md'),summary(report));
  const files=readdirSync(o.out).filter(f=>f!=='SHA256SUMS').sort();
  writeFileSync(join(o.out,'SHA256SUMS'),files.map(f=>sha(readFileSync(join(o.out,f)))+'  '+f).join('\n')+'\n');
  console.log(summary(report));
  if(!report.passed)process.exitCode=1;
}

function summary(r){
  const ids=Object.keys(r.paint?.full||{});
  const row=id=>{const b=r.paint.baseline[id],f=r.paint.full[id],l=r.paint.lite[id],p=r.play?.[id]||{};
    const pct=q=>(q.longFrameRatio*100).toFixed(1)+'%';
    return `| ${id} | ${b.median} / ${b.p99} · ${pct(b)} | ${f.median} / ${f.p99} · ${pct(f)} | ${l.median} / ${l.p99} · ${pct(l)} | ${p.ticksPerSecond??'—'} | ${p.frameIntervalMs?.median??'—'} / ${p.frameIntervalMs?.p95??'—'} · ${p.longFrames??'—'} |`;};
  return [`## ARCADE 2 on RTX 5060 Ti${r.dryRun?' — DRY RUN (not evidence)':''}`,'',
    `**${r.passed?'PASSED':'FAILED'}** · head \`${r.head}\` · baseline \`${r.baselineHead}\``,'',
    `Runner: ${r.host.runner?.name||'n/a'} (${r.host.session} session) · GPU: ${r.host.nvidia||'n/a'} · Browser renderer: ${r.identity?.renderer||'n/a'} · ${r.browser||''} · Playwright ${r.playwright} · display ${r.display?.width}×${r.display?.height}@${r.display?.dpr}x`,'',
    '| Cabinet | Baseline paint ms (median / p99) · long frames | v0.6.0 full | v0.6.0 lite | Ticks/s in app | In-app rAF ms (median / p95) · long |',
    '| --- | --- | --- | --- | --- | --- |',...ids.map(row),'',
    `Offline deep-link reload with the server stopped: ${r.offline?.reloadedWithServerStopped?'yes':'no'}`,'',
    `Paint = CPU-side Canvas 2D submission time of draw() + post pass for ${FRAMES} presented frames sampled across a complete campaign; not a GPU timer.`,
    'Long frames = presented rAF intervals over 1.5 × the median (GPU or compositor work that missed a refresh shows up here).',
    'In-app = 5 s of real play per cabinet from its Play button with held keys.','',
    r.findings.length?'### Findings\n\n'+r.findings.map(f=>'- '+f).join('\n'):'No findings.',''].join('\n');
}

main().catch(error=>{console.error('ARCADE2 RTX CHECK FAILED: '+error.message);process.exitCode=1;});
