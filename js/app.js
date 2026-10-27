/* SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  const $=id=>document.getElementById(id);
  const CATALOG={iron:{name:'Iron Meridian',type:A.Iron,source:'Dogs of War (1989)'},heist:{name:'Velvet Heist',type:A.Heist,source:"Cops 'n' Robbers (1985)"},ninja:{name:'Neon Ronin',type:A.Ninja,source:'Ninja Combat (1990)'}};
  let nativeStorage;try{nativeStorage=window.localStorage;}catch(_){nativeStorage=null;}
  const storage=new A.Storage(nativeStorage),audio=new A.Audio(),canvas=$('game'),c=canvas.getContext('2d'),clock=new A.Clock();
  let game=null,paused=false,lastState='',lastTime=0,statusTimer=0,returnFocus=null,waitingWorker=null,updateRequested=false;
  if(!c){$('offline-status').textContent='Canvas is unavailable in this browser.';return;}
  c.imageSmoothingEnabled=false;
  const input=new A.Input(canvas,()=>!!game&&game.state==='playing'&&!paused&&!$('info-dialog').open,()=>togglePause());
  const storedDifficulty=storage.read('difficulty','arcade');$('difficulty').value=storedDifficulty==='relaxed'?'relaxed':'arcade';
  const storedPlayers=storage.read('players',1);$('players').value=storedPlayers===2?'2':'1';
  let touch=storage.read('touch',matchMedia('(pointer:coarse)').matches)===true;
  let crt=storage.read('crt',false)===true;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  audio.enabled=storage.read('sound',false)===true;
  function updateSound(){ $('sound-label').textContent=audio.enabled?'Sound on':'Sound off';$('sound-toggle').setAttribute('aria-pressed',String(audio.enabled));$('sound-toggle').setAttribute('aria-label',audio.enabled?'Mute sound':'Enable sound'); }
  function updateOptions(){ $('touch-controls').hidden=!touch;$('cabinet').classList.toggle('touch-mode',touch);$('touch-toggle').setAttribute('aria-pressed',String(touch));$('game-frame').classList.toggle('crt',crt);$('crt-toggle').setAttribute('aria-pressed',String(crt)); }
  function updateBests(){for(const b of document.querySelectorAll('[data-best]'))b.textContent=String(storage.best(b.dataset.best,$('difficulty').value)).padStart(6,'0');}
  $('difficulty').addEventListener('change',()=>{storage.write('difficulty',$('difficulty').value);updateBests();});
  $('players').addEventListener('change',()=>storage.write('players',Number($('players').value)));
  for(const id of Object.keys(CATALOG)){A.Draw.cover($('cover-'+id),id);}
  $('sound-toggle').onclick=()=>{audio.setEnabled(!audio.enabled);storage.write('sound',audio.enabled);updateSound();};
  $('touch-toggle').onclick=()=>{touch=!touch;storage.write('touch',touch);updateOptions();};
  $('crt-toggle').onclick=()=>{crt=!crt;storage.write('crt',crt);updateOptions();};
  function saveBest(){if(game)storage.best(game.id,game.options.difficulty,game.score);updateBests();}
  function stop(){saveBest();game=null;paused=false;input.clear();clock.reset();audio.suspend();$('cabinet').hidden=true;$('lobby').hidden=false;document.body.classList.remove('playing');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}
  function route(){
    const id=location.hash.slice(1);if(!CATALOG[id]){const old=game?.id;stop();if(old)document.querySelector('[data-game="'+old+'"]').focus({preventScroll:true});return;}
    saveBest();input.clear();clock.reset();paused=false;lastState='';
    const options={players:id==='heist'?1:Number($('players').value),difficulty:$('difficulty').value};
    game=new CATALOG[id].type(options,name=>audio.effect(name));audio.unlock();
    $('lobby').hidden=true;$('cabinet').hidden=false;document.body.classList.add('playing');$('game-title').textContent=CATALOG[id].name;$('game-inspiration').textContent='Inspired by '+CATALOG[id].source+'.';$('coop-hint').hidden=options.players!==2;
    document.querySelector('.solo-arrows').hidden=options.players===2;$('pause-button').textContent='Pause';updateOptions();window.scrollTo(0,0);renderMenu();updateStatus();
  }
  for(const b of document.querySelectorAll('[data-game]'))b.onclick=()=>{audio.unlock();location.hash=b.dataset.game;};
  window.addEventListener('hashchange',route);$('back-button').onclick=()=>{location.hash='';};
  function togglePause(force){if(!game||game.state!=='playing')return false;paused=typeof force==='boolean'?force:!paused;input.clear();clock.reset();if(paused)audio.suspend();else audio.unlock();$('pause-button').textContent=paused?'Resume':'Pause';renderMenu();return true;}
  $('pause-button').onclick=()=>togglePause();
  window.addEventListener('blur',()=>{if(game&&game.state==='playing'&&!paused)togglePause(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game&&game.state==='playing'&&!paused)togglePause(true);});
  $('fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('cabinet').requestFullscreen)await $('cabinet').requestFullscreen();else $('game-status').textContent='Fullscreen is unavailable in this browser.';}catch(_){$('game-status').textContent='Fullscreen could not start. The game remains playable here.';}};
  function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
  function addButton(parent,label,action,primary=false){const b=node('button',label,primary?'primary-button':'');b.onclick=action;parent.append(b);return b;}
  function restart(){const id=game.id,options={...game.options};saveBest();input.clear();clock.reset();paused=false;game=new CATALOG[id].type(options,name=>audio.effect(name));lastState='';renderMenu();}
  function renderMenu(){
    if(!game)return;const overlay=$('game-overlay'),content=$('menu-content');lastState=game.state+(paused?':paused':'');
    if(game.state==='playing'&&!paused){overlay.hidden=true;input.clear();canvas.focus({preventScroll:true});return;}
    overlay.hidden=false;content.replaceChildren();let focus;
    const leave=()=>{location.hash='';};
    if(paused){content.append(node('span','TAKE A BREATHER','eyebrow'),node('h2','Your game can wait.'),node('p','Paused. Take your time — nothing moves until you return.'));const row=node('div',undefined,'menu-buttons');focus=addButton(row,'Resume game',()=>togglePause(false),true);addButton(row,'Restart run',restart);addButton(row,'All cabinets',leave);content.append(row);}
    else if(game.state==='victory'||game.state==='gameover'){
      saveBest();const won=game.state==='victory';content.append(node('span',won?'JOB DONE. FEELING PRESERVED.':'THERE IS ALWAYS ONE MORE GO.','eyebrow'),node('h2',won?(game.id==='heist'?'Clean getaway.':game.id==='iron'?'All contracts complete.':'The night is yours.'):'Out of luck. Not out of quarters.'),node('span',String(game.score).padStart(6,'0'),'menu-score'),node('p','Best in '+game.options.difficulty+' mode: '+storage.best(game.id,game.options.difficulty)+'. Your score stays on this device.'));
      const row=node('div',undefined,'menu-buttons');focus=addButton(row,'Play again',restart,true);addButton(row,'Choose another game',leave);content.append(row);
    }else{
      const m=game.menu();content.append(node('span',m.eyebrow+' · '+game.options.difficulty.toUpperCase(),'eyebrow'),node('h2',m.title),node('p',m.description),node('p',m.details,'menu-controls'));
      if(m.shop){const heading=node('div',undefined,'shop-heading');heading.append(node('span','QUARTERMASTER / TEAM LOADOUT'),node('strong',m.credits+' CR'));content.append(heading);const shop=node('div',undefined,'shop');for(const item of m.shop){const b=node('button');b.append(node('span',item.name),node('small',item.detail),node('b',item.owned?'EQUIPPED':item.cost+' CR'));b.disabled=item.owned||item.cost>m.credits;b.setAttribute('aria-label',item.name+' · '+(item.owned?'equipped':item.cost+' credits'));b.onclick=()=>{game.action(item.id);renderMenu();};shop.append(b);}content.append(shop);}
      const row=node('div',undefined,'menu-buttons');focus=addButton(row,m.button,()=>{audio.unlock();game.action(m.action);input.clear();clock.reset();renderMenu();},true);addButton(row,'All cabinets',leave);content.append(row);
    }
    if(focus)focus.focus({preventScroll:true});
  }
  function updateStatus(){if(game){$('game-status').textContent=game.status();canvas.setAttribute('aria-label',CATALOG[game.id].name+'. '+game.status()+'. Press Escape to pause.');canvas.dataset.game=game.id;canvas.dataset.state=paused?'paused':game.state;}}
  function frame(now){
    const dt=lastTime?Math.min(.1,(now-lastTime)/1000):0;lastTime=now;
    if(game){
      if(!document.hidden)input.pollPause();
      if(game.state==='playing'&&!paused&&!$('info-dialog').open){clock.advance(dt,step=>{if(game.state==='playing'&&!paused){const commands=input.sample(game.options.players);if(!paused){game.update(step,commands);audio.tick(step,game.id);}}});}
      c.save();if(game.shake>0&&!reducedMotion&&!paused)c.translate(Math.sin(game.time*151)*2,Math.cos(game.time*123)*1.5);game.render(c);c.restore();
      if(lastState!==game.state+(paused?':paused':''))renderMenu();
      statusTimer+=dt;if(statusTimer>.25){statusTimer=0;updateStatus();}
    }
    requestAnimationFrame(frame);
  }
  const controls='<p class="eyebrow">THE CONTROL PANEL</p><h2>Pick up. Play.</h2><p>Solo players can use WASD or arrow keys. Two-player mode is available in Iron Meridian and Neon Ronin. Select it in the launcher before starting.</p><table><thead><tr><th>Action</th><th>Player 1</th><th>Player 2</th></tr></thead><tbody><tr><td>Move</td><td>WASD / arrows (solo)</td><td>Arrows</td></tr><tr><td>Attack</td><td>J or Z</td><td>U or Numpad 1</td></tr><tr><td>Grenade / smoke / storm</td><td>K or X</td><td>I or Numpad 2</td></tr><tr><td>Dash / jump</td><td>Space or C</td><td>O or Numpad 0</td></tr><tr><td>Use / switch / revive</td><td>E</td><td>H or Numpad 3</td></tr><tr><td>Pause</td><td colspan="2">Escape or P</td></tr></tbody></table><h3>Controllers &amp; touch</h3><p>Standard gamepad: left stick / D-pad move; A attack; B special; X jump/dash; Y use; Start pause. Up to two controllers. Touch enables the on-screen pad and buttons; hold two directions to move diagonally in action games.</p><h3>A few useful tricks</h3><p><b>Iron Meridian:</b> mouse aims, left button fires, right button throws a grenade. With keys only, you fire in your last movement direction. E switches weapons; hold it next to a fallen partner to revive them. The sidearm never runs out.</p><p><b>Velvet Heist:</b> E uses nearby doors, banks gems and refills ammunition at your car. Hold E at the safe with all 3 codes. Bullets stun police; ghosts ignore them. The lockup can recover captured lives. Jump is unused.</p><p><b>Neon Ronin:</b> attack up close for melee or at range for throwing stars. Jump to avoid attacks. Storm costs 60 energy, which recharges. Clear the block and follow GO. Hold E beside a fallen partner.</p><p>Relaxed mode gives more health or lives and gentler enemies. Scores are kept separately for each difficulty. Runs are not saved when you close or reload the page.</p>';
  const about='<p class="eyebrow">PRESERVATION THROUGH PLAY</p><h2>The feeling is the thing.</h2><p>ARCADE is an independent QSOL–IMC project: new browser games built around memorable retro game experiences. You can keep the entire collection on your own computer, read its source, and play without an account or connection.</p><p>These are original reinterpretations with new names, characters, maps, pixel artwork and synthesised music. They are not emulations or exact ports. No original game code, ROMs, artwork or recordings are included.</p><h3>The starting points</h3><p><a href="https://www.myabandonware.com/game/dogs-of-war-738" target="_blank" rel="noopener noreferrer">Dogs of War (1989)</a> — mission selection, equipment buying and top-down mercenary action.</p><p><a href="https://www.myabandonware.com/game/cops-n-robbers-4qo" target="_blank" rel="noopener noreferrer">Cops ’n’ Robbers (1985)</a> — maze exploration, jewel collection, limited ammunition, haunted mines and the getaway car.</p><p><a href="https://snk.fandom.com/wiki/Ninja_Combat" target="_blank" rel="noopener noreferrer">Ninja Combat (1990)</a> — scrolling ninja combat, throwing stars, pickups, jumping and special attacks.</p><p>Historical game names identify inspirations. This project is independent of their creators and rights holders. The original contributions are available under Apache-2.0.</p><p><a href="https://github.com/QSOLKCB/ARCADE" target="_blank" rel="noopener noreferrer">Explore the source and preservation notes ↗</a></p>';
  const offline='<p class="eyebrow">NO CONNECTION REQUIRED</p><h2>Take the arcade with you.</h2><h3>Option 1 · Keep a local copy</h3><p><a href="https://github.com/QSOLKCB/ARCADE/archive/refs/heads/main.zip">Download the complete arcade ZIP</a>, extract it, then open <code>index.html</code> in your browser. Keep the folders beside that file. All three games work directly from disk — no server or installation required.</p><h3>Option 2 · Return to the cached site</h3><p>On GitHub Pages, wait for “Offline ready” in the launcher before disconnecting. This confirms the complete game collection has been cached by your browser. You can then reload the same address offline. Clearing browser site data removes the cached copy and local scores.</p><p>Scores and sound/display preferences stay on this device when browser storage is available. Current runs are not saved. No accounts, analytics or online game services are used.</p>';
  function showInfo(html){returnFocus=document.activeElement;if(game&&game.state==='playing'&&!paused)togglePause(true);$('info-content').innerHTML=html;$('info-dialog').showModal();}
  $('about-button').onclick=()=>showInfo(about);$('offline-button').onclick=()=>showInfo(offline);$('controls-home').onclick=()=>showInfo(controls);$('help-button').onclick=()=>showInfo(controls);$('close-info').onclick=()=>$('info-dialog').close();
  $('info-dialog').addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
  $('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=$('info-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('info-dialog').close();}});
  async function offlineSetup(){
    if(location.protocol==='file:'){$('offline-status').textContent='Local edition · offline ready';return;}
    if(!('serviceWorker' in navigator)){$('offline-status').textContent='Download for offline play';return;}
    try{
      const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
      const announceUpdate=()=>{const pending=registration.waiting;const isUpdate=!!(pending&&registration.active&&pending!==registration.active);waitingWorker=isUpdate?pending:null;$('update-button').hidden=!isUpdate;};
      announceUpdate();registration.addEventListener('updatefound',()=>{const worker=registration.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed'||worker.state==='activated')announceUpdate();});});
      await new Promise((resolve,reject)=>{
        if(registration.active?.state==='activated'){resolve();return;}
        const worker=registration.installing||registration.waiting||registration.active;
        if(!worker){reject(new Error('No arcade worker'));return;}
        const check=()=>{if(worker.state==='activated'){worker.removeEventListener('statechange',check);resolve();}else if(worker.state==='redundant'){worker.removeEventListener('statechange',check);reject(new Error('Arcade cache installation failed'));}};
        worker.addEventListener('statechange',check);check();
      });announceUpdate();$('offline-status').textContent='Offline ready · all 3 games';
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested)location.reload();});
    }catch(_){$('offline-status').textContent='Download for offline play';}
  }
  $('update-button').onclick=()=>{if(waitingWorker){updateRequested=true;waitingWorker.postMessage({type:'ACTIVATE_UPDATE'});}};
  updateSound();updateOptions();updateBests();route();requestAnimationFrame(frame);offlineSetup();
})(globalThis.Arcade);
