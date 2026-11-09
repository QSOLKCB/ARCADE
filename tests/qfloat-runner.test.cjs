/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
  fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const modulePromise=import('../scripts/qfloat-lab-runner.mjs');
const sha='a'.repeat(40);
test('post-merge QFloat runner requires explicit exact source identity and bounded arguments',async()=>{
  const {parseArgs}=await modulePromise;
  assert.deepEqual(parseArgs(['--expected-head',sha,'--out','/tmp/qfloat-witness']),
    {head:sha,out:'/tmp/qfloat-witness',target:'both'});
  assert.deepEqual(parseArgs(['--expected-head',sha,'--out','/tmp/qfloat-witness','--target','local']),
    {head:sha,out:'/tmp/qfloat-witness',target:'local'});
  for(const argv of [
    [],['--expected-head','bad','--out','/tmp/a'],
    ['--expected-head',sha,'--out','relative'],
    ['--expected-head',sha,'--out','/tmp/../danger'],
    ['--expected-head',sha,'--out','/tmp/a','--target','pages-only'],
    ['--expected-head',sha,'--out','/tmp/a','--target','both','--target','local'],
    ['--expected-head',sha,'--out','/tmp/a','--install','yes']
  ])assert.throws(()=>parseArgs(argv));
});
test('request allowlist requires exact resource paths on a pinned local or public origin',async()=>{
  const {allowedResource}=await modulePromise,
    base='https://qsolkcb.github.io/ARCADE/',
    local='http://127.0.0.1:38473/';
  for(const page of ['arcade3/qfloat-lab.html','arcade3/qfloat-lab.css',
    'arcade3/qfloat-lab.js','arcade3/qfloat-sim.js','arcade2/qfloat.js']){
    assert.equal(allowedResource(base+page,base),true,page);
    assert.equal(allowedResource(local+page,local),true,page);
  }
  assert.equal(allowedResource(base+'arcade2/engine.js?v=0.8.0',base),true);
  for(const url of [
    'https://example.org/ARCADE/arcade3/qfloat-lab.js',
    base+'arcade2/engine.js?v=untrusted',
    base+'arcade3/evil.js',
    base+'arcade3/qfloat-lab.js?inject=1',
    base+'arcade3/qfloat-lab.js#wrong',
    'file:///home/user/ARCADE/arcade3/qfloat-lab.html',
    'http://qsolkcb.github.io/ARCADE/arcade3/qfloat-lab.html'
  ])assert.equal(allowedResource(url,base),false,url);
});
test('the attestable browser runtime source manifest includes exactly the lab dependencies',async()=>{
  const {sourceManifest}=await modulePromise,items=sourceManifest();
  assert.equal(items.length,6);
  for(const item of items){
    assert.ok(item.path.startsWith('arcade2/')||item.path.startsWith('arcade3/'));
    assert.ok(fs.existsSync(path.join(ROOT,item.path)));
    assert.match(item.sha256,/^[a-f0-9]{64}$/);
    assert.ok(item.bytes>0&&item.bytes<=256*1024);
  }
  assert.deepEqual(sourceManifest(),items);
  const html=fs.readFileSync(path.join(ROOT,'arcade3/qfloat-lab.html'),'utf8');
  for(const script of ['../arcade2/engine.js?v=0.8.0','../arcade2/qfloat.js',
    'qfloat-sim.js','qfloat-lab.js'])assert.ok(html.includes('src="'+script+'"'),script);
});
test('workflow has no PR/push/schedule triggers and cannot start without explicit owner consent',async()=>{
  const y=fs.readFileSync(path.join(ROOT,'.github/workflows/qfloat-lab-runner.yml'),'utf8');
  assert.match(y,/^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(y,/^\s{2}(?:push|pull_request|schedule):/m);
  assert.match(y,/github\.repository == 'QSOLKCB\/ARCADE'/);
  assert.match(y,/github\.ref == 'refs\/heads\/main'/);
  assert.match(y,/github\.actor == 'EmergentMonk'/);
  assert.match(y,/inputs\.acknowledge_local_execution == true/);
  assert.match(y,/runs-on: \[self-hosted, linux, x64, qsol-rtx5060ti\]/);
  assert.match(y,/node scripts\/rtx-playwright\.mjs/);
  assert.doesNotMatch(y,/\bnpm (?:install|ci)|\bapt(?:-get)? install/);
  assert.match(y,/publish_evidence/);
  assert.match(y,/SHA256SUMS/);
  assert.match(y,/verify_pages/);
});
test('a successful browser witness cannot remain green when browser close rejects',async()=>{
  const {closeResourcesAndFinalize}=await modulePromise;
  const report={status:'PASS',failures:[]};
  const browser={close:async()=>{throw new Error('injected Chromium teardown failure');}};
  const exitCode=await closeResourcesAndFinalize(report,browser,null);
  assert.equal(exitCode,1);
  assert.equal(report.status,'FAIL');
  assert.deepEqual(report.failures,['browser close: injected Chromium teardown failure']);
});
test('a failed server close, or earlier failed witness, returns a nonzero exit code',async()=>{
  const {closeResourcesAndFinalize}=await modulePromise;
  const server={listening:true,close:cb=>cb(new Error('injected server shutdown failure'))};
  const report={status:'PASS',failures:[]};
  assert.equal(await closeResourcesAndFinalize(report,null,server),1);
  assert.equal(report.status,'FAIL');
  assert.deepEqual(report.failures,['server close: injected server shutdown failure']);
  const alreadyFailed={status:'FAIL',failures:['page assertion failed']};
  assert.equal(await closeResourcesAndFinalize(alreadyFailed,null,null),1);
  const success={status:'PASS',failures:[]};
  assert.equal(await closeResourcesAndFinalize(success,{close:async()=>{}},null),0);
  assert.equal(success.status,'PASS');
  assert.deepEqual(success.failures,[]);
});

test('a process without authorized workflow context cannot read/launch owner workstation',async()=>{
  const {requireReviewedHead}=await modulePromise;
  assert.throws(()=>requireReviewedHead(sha),/Only owner-dispatched reviewed main/);
});
