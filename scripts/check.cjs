'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const runtime=['index.html','styles.css','manifest.webmanifest','assets/icon.svg','js/core.js','js/vanilla2d.js','js/cartridge.js','js/draw.js','js/input.js','js/audio.js','js/games/iron.js','js/games/heist.js','js/games/ninja.js','js/games/hockey.js','js/games/brawl.js','js/games/chrono.js','js/games/breaker.js','js/games/void.js','js/games/kestrel.js','js/app.js'];
const arcade2=['index.html','style.css','engine.js','core.js','gfx.js','sound.js','platforms.js','sports.js','kombat.js','breach.js','shooters.js','input.js','app.js','README.md'].map(f=>'arcade2/'+f);
runtime.push(...arcade2);
const arcade3=['index.html','style.css','kit.js','hall.js','commando.js','lantern.js','sleepwalker.js','lancer.js','canal.js','skyline.js','stratos.js','feud.js','knockout.js','README.md'].map(f=>'arcade3/'+f);
runtime.push(...arcade3);
// QFLOAT-001 is opt-in, not a tenth cabinet and not part of the shared
// arcade3/index.html deferred-script chain.
const qfloat=['arcade2/qfloat.js','arcade3/qfloat-lab.html',
  'arcade3/qfloat-lab.css','arcade3/qfloat-sim.js','arcade3/qfloat-lab.js'];
runtime.push(...qfloat);
cp.execFileSync(process.execPath,[path.join(root,'scripts/arcade2-engine.cjs'),'--check']);
for(const file of runtime){assert.ok(fs.existsSync(path.join(root,file)),file+' exists');if(file.endsWith('.js'))cp.execFileSync(process.execPath,['--check',path.join(root,file)]);}
cp.execFileSync(process.execPath,['--check',path.join(root,'sw.js')]);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){const url=match[1];if(!url.startsWith('http')&&!url.startsWith('#'))assert.ok(fs.existsSync(path.join(root,url)),url+' exists');}
assert.ok(!/type="module"/.test(html),'file-open compatible classic scripts');
assert.ok(!/<(?:script|link|img)[^>]+(?:src|href)="https?:/.test(html),'no external runtime resources');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');for(const file of runtime)assert.ok(sw.includes("'./"+file+"'"),file+' precached');
for(const file of runtime.filter(f=>f.endsWith('.js'))){const src=fs.readFileSync(path.join(root,file),'utf8');assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(src),file+' has no network game-data calls');}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
console.log('Static checks passed: syntax, local assets, cache coverage, subpath URLs, no runtime dependencies.');


const hall2=fs.readFileSync(path.join(root,'arcade2/index.html'),'utf8');
for(const match of hall2.matchAll(/(?:src|href)="([^"]+)"/g)){
 const url=match[1];if(url.startsWith('#'))continue;
 assert.ok(!/^(?:https?:|\/)/.test(url),'ARCADE2 relative runtime URLs');
 assert.ok(fs.existsSync(path.resolve(root,'arcade2',url)),url+' exists');
}
assert.ok(!/type="module"/.test(hall2),'ARCADE2 file-open compatible');
assert.ok(sw.includes("'./arcade2/'"),'nested hall navigation precached');
console.log('ARCADE2 checks passed: source pin, generated adapter, local URLs and cache coverage.');

const hall3=fs.readFileSync(path.join(root,'arcade3/index.html'),'utf8');
const release=(sw.match(/'\.\/arcade2\/app\.js\?(v=[^']+)'/)||[])[1];
assert.ok(release,'service worker precaches the versioned shared shell');
for(const match of hall3.matchAll(/(?:src|href)="([^"]+)"/g)){
 const url=match[1];if(url.startsWith('#'))continue;
 assert.ok(!/^(?:https?:|\/)/.test(url),'ARCADE3 relative runtime URLs');
 const [file,query]=url.split('?');
 assert.ok(fs.existsSync(path.resolve(root,'arcade3',file)),url+' exists');
 // Shared scripts carry the release query and are precached under exactly that URL.
 if(file.startsWith('../arcade2/')&&file.endsWith('.js')){
  assert.equal(query,release,url+' carries the current release query');
  assert.ok(sw.includes("'./arcade2/"+path.basename(file)+'?'+query+"'"),url+' precached under its versioned URL');
 }
}
for(const file of arcade3.filter(f=>f.endsWith('.js')))assert.ok(hall3.includes('src="'+path.basename(file)+'"'),file+' loaded by the ARCADE 3 hall');
assert.ok(!/type="module"/.test(hall3),'ARCADE3 file-open compatible');
assert.ok(sw.includes("'./arcade3/'"),'ARCADE 3 hall navigation precached');
console.log('ARCADE3 checks passed: shared engine, local URLs and cache coverage.');

const qLab=fs.readFileSync(path.join(root,'arcade3/qfloat-lab.html'),'utf8');
assert.ok(hall3.includes('href="qfloat-lab.html"'),'lab linked without altering cabinet registration');
assert.ok(!/type="module"/.test(qLab),'QFloat lab supports file-open classic scripts');
for(const match of qLab.matchAll(/(?:src|href)="([^"]+)"/g)){
 const url=match[1];if(url.startsWith('#'))continue;
 assert.ok(!/^(?:https?:|\/)/.test(url),'QFloat lab local resources only');
 const [file,query]=url.split('?');
 assert.ok(fs.existsSync(path.resolve(root,'arcade3',file)),url+' exists');
 if(file==='../arcade2/engine.js')
   assert.equal(query,release,'QFloat lab uses the same pinned Q16 engine revision');
}
for(const name of ['../arcade2/engine.js?v=0.8.0','../arcade2/qfloat.js',
  'qfloat-sim.js','qfloat-lab.js']){
 assert.ok(qLab.includes('src="'+name+'"'),'QFloat lab loads '+name);
}
assert.ok(!qLab.includes('src="https:')&&!qLab.includes('src="http:'),
  'No remote assets in QFloat lab');
assert.ok(sw.includes('v0.9.0-r2-qfloat-illusion'),'QFloat cache revision bumped');
console.log('QFloat illusion lab: local scripts, pinned Q16 and offline cache passed.');
