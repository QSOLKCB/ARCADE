/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
const PREFIX='qsol-arcade:'+self.registration.scope+':';
const CACHE=PREFIX+'v0.6.0-r2-arcade2';
const FILES=['./','./index.html','./styles.css','./manifest.webmanifest','./assets/icon.svg','./js/core.js','./js/vanilla2d.js','./js/cartridge.js','./js/draw.js','./js/input.js','./js/audio.js','./js/games/iron.js','./js/games/heist.js','./js/games/ninja.js','./js/games/hockey.js','./js/games/brawl.js','./js/games/chrono.js','./js/games/breaker.js','./js/games/void.js','./js/games/kestrel.js','./js/app.js','./arcade2/','./arcade2/index.html','./arcade2/style.css','./arcade2/engine.js','./arcade2/core.js','./arcade2/gfx.js','./arcade2/sound.js','./arcade2/platforms.js','./arcade2/sports.js','./arcade2/kombat.js','./arcade2/breach.js','./arcade2/shooters.js','./arcade2/input.js','./arcade2/app.js','./arcade2/README.md'];
const URLS=new Set(FILES.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  // Navigations can carry a #fragment (ARCADE 2 deep links); cache matching ignores it.
  if(event.request.method!=='GET'||!URLS.has(event.request.url.split('#')[0]))return;
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(hit=>hit||fetch(event.request)));
});

