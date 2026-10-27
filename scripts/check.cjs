'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const runtime=['index.html','styles.css','manifest.webmanifest','assets/icon.svg','js/core.js','js/draw.js','js/input.js','js/audio.js','js/games/iron.js','js/games/heist.js','js/games/ninja.js','js/app.js'];
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
