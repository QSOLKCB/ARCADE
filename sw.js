/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
const PREFIX='qsol-arcade:'+self.registration.scope+':';
const CACHE=PREFIX+'v0.2.0-r1';
const FILES=['./','./index.html','./styles.css','./manifest.webmanifest','./assets/icon.svg','./js/core.js','./js/draw.js','./js/input.js','./js/audio.js','./js/games/iron.js','./js/games/heist.js','./js/games/ninja.js','./js/app.js'];
const URLS=new Set(FILES.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!URLS.has(event.request.url))return;
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(hit=>hit||fetch(event.request)));
});
