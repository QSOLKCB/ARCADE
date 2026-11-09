/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
const PREFIX='qsol-arcade:'+self.registration.scope+':';
const CACHE=PREFIX+'v0.9.0-r1-roster';
const FILES=['./','./index.html','./styles.css','./manifest.webmanifest','./assets/icon.svg','./js/core.js','./js/vanilla2d.js','./js/cartridge.js','./js/draw.js','./js/input.js','./js/audio.js','./js/games/iron.js','./js/games/heist.js','./js/games/ninja.js','./js/games/hockey.js','./js/games/brawl.js','./js/games/chrono.js','./js/games/breaker.js','./js/games/void.js','./js/games/kestrel.js','./js/app.js','./arcade2/','./arcade2/index.html','./arcade2/style.css','./arcade2/engine.js','./arcade2/core.js','./arcade2/gfx.js','./arcade2/sound.js','./arcade2/platforms.js','./arcade2/sports.js','./arcade2/kombat.js','./arcade2/breach.js','./arcade2/shooters.js','./arcade2/input.js','./arcade2/app.js','./arcade2/README.md','./arcade3/','./arcade3/index.html','./arcade3/style.css','./arcade3/kit.js','./arcade3/hall.js','./arcade3/commando.js','./arcade3/lantern.js','./arcade3/sleepwalker.js','./arcade3/lancer.js','./arcade3/canal.js','./arcade3/skyline.js','./arcade3/stratos.js','./arcade3/feud.js','./arcade3/knockout.js','./arcade3/README.md','./arcade2/engine.js?v=0.8.0','./arcade2/core.js?v=0.8.0','./arcade2/gfx.js?v=0.8.0','./arcade2/sound.js?v=0.8.0','./arcade2/input.js?v=0.8.0','./arcade2/app.js?v=0.8.0'];
const URLS=new Set(FILES.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  // Navigations can carry a #fragment (ARCADE 2 and 3 deep links); cache matching ignores it.
  if(event.request.method!=='GET'||!URLS.has(event.request.url.split('#')[0]))return;
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(hit=>hit||fetch(event.request)));
});

