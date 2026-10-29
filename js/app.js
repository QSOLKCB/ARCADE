/* SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  const $=id=>document.getElementById(id);
  const CATALOG={iron:{name:'Iron Meridian',type:A.Iron,source:'Dogs of War (1989)'},heist:{name:'Velvet Heist',type:A.Heist,source:"Cops 'n' Robbers (1985)"},ninja:{name:'Neon Ronin',type:A.Ninja,source:'Ninja Combat (1990)'},hockey:{name:'Neon Air',type:A.Hockey,source:'air hockey'},brawl:{name:'Basement Brawl',type:A.Brawl,source:'Pit-Fighter (1990)'},chrono:{name:'Chrono Wing',type:A.Chrono,source:'Time Pilot (1982)'},breaker:{name:'Prism Break',type:A.Breaker,source:'Breakout (1976)'},void:{name:'Void Command',type:A.Void,source:'the mechanics of Star Trek (1971), in an original setting'}};
  let nativeStorage;try{nativeStorage=window.localStorage;}catch(_){nativeStorage=null;}
  const storage=new A.Storage(nativeStorage),audio=new A.Audio(),canvas=$('game'),c=canvas.getContext('2d'),clock=new A.Clock();
  const commandHistory=[];let historyIndex=0;
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
  audio.setLevels(storage.read('musicLevel',.55),storage.read('fxLevel',.8));
  function updateSound(){ $('sound-label').textContent=audio.enabled?'Sound on':'Sound off';$('sound-toggle').setAttribute('aria-pressed',String(audio.enabled));$('sound-toggle').setAttribute('aria-label',audio.enabled?'Mute sound':'Enable sound'); }
  function updateOptions(){ $('touch-controls').hidden=!touch||game?.id==='void';$('cabinet').classList.toggle('touch-mode',touch);$('touch-toggle').setAttribute('aria-pressed',String(touch));$('game-frame').classList.toggle('crt',crt);$('crt-toggle').setAttribute('aria-pressed',String(crt)); }
  const storedAI=storage.read('hockeyAI','club');$('hockey-ai').value=['rookie','club','expert'].includes(storedAI)?storedAI:'club';
  const scoreKey=(id,ai=$('hockey-ai').value)=>id==='heist'?'heist.v2':id==='hockey'?'hockey.'+ai:id;
  $('hockey-ai').addEventListener('change',()=>{storage.write('hockeyAI',$('hockey-ai').value);updateBests();});
  function updateBests(){for(const b of document.querySelectorAll('[data-best]'))b.textContent=String(storage.best(scoreKey(b.dataset.best),$('difficulty').value)).padStart(6,'0');}
  $('difficulty').addEventListener('change',()=>{storage.write('difficulty',$('difficulty').value);updateBests();});
  $('players').addEventListener('change',()=>storage.write('players',Number($('players').value)));
  for(const id of Object.keys(CATALOG)){
    if(['iron','heist','ninja'].includes(id)){A.Draw.cover($('cover-'+id),id);continue;}
    const cover=$('cover-'+id),preview=new CATALOG[id].type({});
    if(id==='void'){cover.width=960;cover.height=540;}
    if(id==='chrono'){for(let n=0;n<4;n++){preview.addEnemy();Object.assign(preview.enemies[n],{x:-145+n*95,y:-55+(n%2)*130});}}
    preview.render(cover.getContext('2d'));
  }
  function configureCabinet(){
    const terminal=game.id==='void';canvas.width=terminal?960:480;canvas.height=terminal?540:270;c.imageSmoothingEnabled=false;
    canvas.dataset.pointerControl=String(['hockey','breaker'].includes(game.id));$('game-frame').classList.toggle('terminal-screen',terminal);
    $('terminal-controls').hidden=!terminal;document.querySelector('.control-legend').hidden=terminal;
    commandHistory.length=0;historyIndex=0;$('command-input').value='';$('terminal-result').textContent='';
    const labels={iron:['Move','Attack','Grenade','Dash','Use / swap'],heist:['Move','Shoot','TNT',null,'Enter / bank'],ninja:['Move','Attack','Storm','Jump','Use / revive'],hockey:['Mallet','Strike',null,null,null],brawl:['Move','Punch','Kick','Jump','Use / guard'],chrono:['Steer','Fire','Roll',null,null],breaker:['Paddle','Launch / laser',null,'Launch',null],void:['',null,null,null,null]}[game.id];
    $('legend-move').textContent=labels[0];$('legend-fire').textContent=labels[1]||'';$('legend-special').textContent=labels[2]||'';$('legend-special').parentElement.hidden=!labels[2];$('legend-jump').hidden=!labels[3];$('legend-jump-label').textContent=labels[3]||'';$('legend-use').textContent=labels[4]||'';$('legend-use').parentElement.hidden=!labels[4];
    ['fire','special','jump','interact'].forEach((action,i)=>{const b=document.querySelector('[data-touch='+action+']');b.hidden=!labels[i+1];b.firstChild.textContent=labels[i+1]||'';});
  }
  function sendCommand(value){
    if(game?.id!=='void'||game.state!=='playing'||paused||$('info-dialog').open)return;
    const order=value.trim();if(!order)return;audio.unlock();game.queue(order);commandHistory.push(order);if(commandHistory.length>50)commandHistory.shift();historyIndex=commandHistory.length;$('command-input').value='';$('command-input').focus({preventScroll:true});
  }
  $('command-form').onsubmit=e=>{e.preventDefault();sendCommand($('command-input').value);};
  document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>sendCommand(b.dataset.command));
  $('command-input').addEventListener('keydown',e=>{
    if(e.code==='Escape'){e.preventDefault();togglePause();}
    if(e.code==='ArrowUp'||e.code==='ArrowDown'){e.preventDefault();historyIndex=A.clamp(historyIndex+(e.code==='ArrowUp'?-1:1),0,commandHistory.length);e.target.value=commandHistory[historyIndex]||'';}
  });
  canvas.addEventListener('pointerdown',e=>{
    if(game?.id!=='void'||game.state!=='playing'||paused)return;
    const r=canvas.getBoundingClientRect(),order=game.pointer((e.clientX-r.left)*960/r.width,(e.clientY-r.top)*540/r.height);
    if(order){e.preventDefault();$('command-input').value=order;$('command-input').focus({preventScroll:true});}
  });
  $('sound-toggle').onclick=()=>{audio.setEnabled(!audio.enabled);storage.write('sound',audio.enabled);updateSound();};
  $('touch-toggle').onclick=()=>{touch=!touch;storage.write('touch',touch);updateOptions();};
  $('crt-toggle').onclick=()=>{crt=!crt;storage.write('crt',crt);updateOptions();};
  function saveBest(){if(game)storage.best(scoreKey(game.id,game.options.aiDifficulty),game.options.difficulty,game.score);updateBests();}
  function stop(){saveBest();game=null;paused=false;input.clear();clock.reset();audio.suspend();$('cabinet').hidden=true;$('lobby').hidden=false;document.body.classList.remove('playing');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}
  function route(){
    const id=location.hash.slice(1);if(!CATALOG[id]){const old=game?.id;stop();if(old)document.querySelector('[data-game="'+old+'"]').focus({preventScroll:true});return;}
    saveBest();input.clear();clock.reset();paused=false;lastState='';
    const options={players:['iron','ninja'].includes(id)?Number($('players').value):1,difficulty:$('difficulty').value,aiDifficulty:$('hockey-ai').value};
    game=new CATALOG[id].type(options,name=>audio.effect(name));audio.setTrack(id);audio.unlock();
    configureCabinet();
    $('lobby').hidden=true;$('cabinet').hidden=false;document.body.classList.add('playing');$('game-title').textContent=CATALOG[id].name;$('game-inspiration').textContent='Inspired by '+CATALOG[id].source+'.';$('coop-hint').hidden=options.players!==2;
    document.querySelector('.solo-arrows').hidden=options.players===2;$('pause-button').textContent='Pause';updateOptions();window.scrollTo(0,0);renderMenu();updateStatus();
  }
  for(const b of document.querySelectorAll('[data-game]'))b.onclick=()=>{audio.unlock();location.hash=b.dataset.game;};
  window.addEventListener('hashchange',route);$('back-button').onclick=()=>{location.hash='';};
  function togglePause(force){if(!game||game.state!=='playing')return false;paused=typeof force==='boolean'?force:!paused;game.pending?.splice(0);input.clear();clock.reset();if(paused)audio.suspend();else audio.unlock();$('pause-button').textContent=paused?'Resume':'Pause';renderMenu();return true;}
  $('pause-button').onclick=()=>togglePause();
  window.addEventListener('blur',()=>{if(game&&game.state==='playing'&&!paused)togglePause(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game&&game.state==='playing'&&!paused)togglePause(true);});
  $('fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('cabinet').requestFullscreen)await $('cabinet').requestFullscreen();else $('game-status').textContent='Fullscreen is unavailable in this browser.';}catch(_){$('game-status').textContent='Fullscreen could not start. The game remains playable here.';}};
  function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
  function addButton(parent,label,action,primary=false){const b=node('button',label,primary?'primary-button':'');b.onclick=action;parent.append(b);return b;}
  function restart(){const id=game.id,options={...game.options};$('pause-button').textContent='Pause';saveBest();input.clear();clock.reset();paused=false;game=new CATALOG[id].type(options,name=>audio.effect(name));audio.setTrack(id);configureCabinet();lastState='';renderMenu();updateStatus();}
  function renderMenu(){
    if(!game)return;const overlay=$('game-overlay'),content=$('menu-content');lastState=game.state+(paused?':paused':'');
    if(game.id==='void')for(const el of $('terminal-controls').querySelectorAll('button,input'))el.disabled=paused||game.state!=='playing';
    if(game.state==='playing'&&!paused){overlay.hidden=true;input.clear();(game.id==='void'?$('command-input'):canvas).focus({preventScroll:true});return;}
    overlay.hidden=false;content.replaceChildren();let focus;
    const leave=()=>{location.hash='';};
    if(paused){content.append(node('span','TAKE A BREATHER','eyebrow'),node('h2','Your game can wait.'),node('p','Paused. Take your time — nothing moves until you return.'));const row=node('div',undefined,'menu-buttons');focus=addButton(row,'Resume game',()=>togglePause(false),true);addButton(row,'Restart run',restart);addButton(row,'All cabinets',leave);content.append(row);}
    else if(game.state==='victory'||game.state==='gameover'){
      saveBest();const won=game.state==='victory';content.append(node('span',won?'JOB DONE. FEELING PRESERVED.':'THERE IS ALWAYS ONE MORE GO.','eyebrow'),node('h2',won?(game.id==='heist'?'Clean getaway.':game.id==='iron'?'All contracts complete.':game.id==='hockey'?'The table is yours.':game.id==='brawl'?'Champion of the underpass.':game.id==='chrono'?'Every sky is free.':game.id==='breaker'?'Every prism shattered.':game.id==='void'?'The relays are free.':'The night is yours.'):'Out of luck. Not out of quarters.'),node('span',String(game.score).padStart(6,'0'),'menu-score'),node('p','Best in '+game.options.difficulty+' mode: '+storage.best(scoreKey(game.id,game.options.aiDifficulty),game.options.difficulty)+'. Your score stays on this device.'));
      const row=node('div',undefined,'menu-buttons');focus=addButton(row,'Play again',restart,true);addButton(row,'Choose another game',leave);content.append(row);
    }else{
      const m=game.menu();content.append(node('span',m.eyebrow+' · '+game.options.difficulty.toUpperCase(),'eyebrow'),node('h2',m.title),node('p',m.description),node('p',m.details,'menu-controls'));
      if(m.choices){const choices=node('div',undefined,'menu-choices');for(const choice of m.choices){const b=addButton(choices,choice.label,()=>{game.action(choice.id);renderMenu();});b.setAttribute('aria-pressed',String(choice.selected));}content.append(choices);}
      if(m.shop){const heading=node('div',undefined,'shop-heading');heading.append(node('span','QUARTERMASTER / TEAM LOADOUT'),node('strong',m.credits+' CR'));content.append(heading);const shop=node('div',undefined,'shop');for(const item of m.shop){const b=node('button');b.append(node('span',item.name),node('small',item.detail),node('b',item.owned?'EQUIPPED':item.cost+' CR'));b.disabled=item.owned||item.cost>m.credits;b.setAttribute('aria-label',item.name+' · '+(item.owned?'equipped':item.cost+' credits'));b.onclick=()=>{game.action(item.id);renderMenu();};shop.append(b);}content.append(shop);}
      const row=node('div',undefined,'menu-buttons');focus=addButton(row,m.button,()=>{audio.unlock();game.action(m.action);input.clear();clock.reset();renderMenu();},true);addButton(row,'All cabinets',leave);content.append(row);
    }
    if(focus)focus.focus({preventScroll:true});
  }
  function updateStatus(){if(game){if(game.id==='void'){$('terminal-result').textContent=game.lastMessage||'';for(const el of $('terminal-controls').querySelectorAll('button,input'))el.disabled=paused||game.state!=='playing';}$('game-status').textContent=game.status();canvas.setAttribute('aria-label',CATALOG[game.id].name+'. '+game.status()+'. Press Escape to pause.');canvas.dataset.game=game.id;canvas.dataset.state=paused?'paused':game.state;}}
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
  const newControls='<h3>Five new cabinets</h3><p><b>Neon Air:</b> mouse / arrows move the mallet. J strikes. First to 7; Rookie, Club and Expert AI are selected on its card.</p><p><b>Basement Brawl:</b> J punches, K kicks, Space jumps. E picks up a nearby chair or throws a staggered enemy; hold E to guard. Choose a fighter before the first bout.</p><p><b>Chrono Wing:</b> steer in any direction, hold J to fire, K rolls. Rescue parachutes and defeat each flagship.</p><p><b>Prism Break:</b> mouse / left-right moves, J or Space launches. Catch capsules. J fires while the laser power is active.</p><p><b>Void Command:</b> type HELP for orders. Click maps to prepare MOVE, LANCE or JUMP and press Execute. Scan, manage energy and shields, dock beside depots, and clear the raiders before time runs out. Arrow Up / Down recalls orders. The seven quick-order buttons also work on touch screens.</p>';
  const controls='<p class="eyebrow">THE CONTROL PANEL</p><h2>Pick up. Play.</h2><p>Solo players can use WASD or arrow keys. Two-player mode is available in Iron Meridian and Neon Ronin. Select it in the launcher before starting.</p><table><thead><tr><th>Action</th><th>Player 1</th><th>Player 2</th></tr></thead><tbody><tr><td>Move</td><td>WASD / arrows (solo)</td><td>Arrows</td></tr><tr><td>Attack</td><td>J or Z</td><td>U or Numpad 1</td></tr><tr><td>Grenade / TNT / storm</td><td>K or X</td><td>I or Numpad 2</td></tr><tr><td>Dash / jump</td><td>Space or C</td><td>O or Numpad 0</td></tr><tr><td>Use / switch / revive</td><td>E</td><td>H or Numpad 3</td></tr><tr><td>Pause</td><td colspan="2">Escape or P</td></tr></tbody></table><h3>Controllers &amp; touch</h3><p>Standard gamepad: left stick / D-pad move; A attack; B special; X jump/dash; Y use; Start pause. Up to two controllers. Touch enables the on-screen pad and buttons; hold two directions to move diagonally in action games.</p><h3>A few useful tricks</h3><p><b>Iron Meridian:</b> mouse aims, left button fires, right button throws a grenade. With keys only, you fire in your last movement direction. E switches weapons; hold it next to a fallen partner to revive them. The sidearm never runs out.</p><p><b>Velvet Heist:</b> E enters doors and lifts, banks gems and reloads 8 rounds at the car. Find the key in the police station, take the service lift above the safe floor, then hold E at the safe with the code. The safe contains four gems and a rechargeable torch. Find TNT in the mine and press K near the giant ghost to open the dark gallery. J clears police and small ghosts, but police reinforcements keep coming. A flashing ! warns of an arriving patrol; a marked row warns of the helicopter. The station can restore captured lives. Keep banked gems and tools if caught, and recover your dropped bag. Jump is unused.</p><p><b>Neon Ronin:</b> attack up close for melee or at range for throwing stars. Jump to avoid attacks. Storm costs 60 energy, which recharges. Clear the block and follow GO. Hold E beside a fallen partner.</p><p>Relaxed mode gives more health or lives and gentler enemies. Scores are kept separately for each difficulty. Runs are not saved when you close or reload the page.</p>'+newControls;
  const newAbout='<h3>The new arrivals</h3><p>Neon Air reimagines air hockey. Basement Brawl draws on Pit-Fighter (1990), Chrono Wing on Time Pilot (1982), and Prism Break on Breakout (1976). Void Command draws on the sector navigation, resource management and turn-based combat of Star Trek (1971), with a wholly original world and terminal interface.</p>';
  const about='<p class="eyebrow">PRESERVATION THROUGH PLAY</p><h2>The feeling is the thing.</h2><p>ARCADE is an independent QSOL–IMC project: new browser games built around memorable retro game experiences. You can keep the entire collection on your own computer, read its source, and play without an account or connection.</p><p>These are original reinterpretations with new names, characters, maps, pixel artwork and synthesised music. They are not emulations or exact ports. No original game code, ROMs, artwork or recordings are included.</p><h3>The starting points</h3><p><a href="https://www.myabandonware.com/game/dogs-of-war-738" target="_blank" rel="noopener noreferrer">Dogs of War (1989)</a> — mission selection, equipment buying and top-down mercenary action.</p><p><a href="https://www.myabandonware.com/game/cops-n-robbers-4qo" target="_blank" rel="noopener noreferrer">Cops ’n’ Robbers (1985)</a> — maze exploration, jewel collection, limited ammunition, haunted mines and the getaway car.</p><p><a href="https://snk.fandom.com/wiki/Ninja_Combat" target="_blank" rel="noopener noreferrer">Ninja Combat (1990)</a> — scrolling ninja combat, throwing stars, pickups, jumping and special attacks.</p><p>Historical game names identify inspirations. This project is independent of their creators and rights holders. The original contributions are available under Apache-2.0.</p><p><a href="https://github.com/QSOLKCB/ARCADE" target="_blank" rel="noopener noreferrer">Explore the source and preservation notes ↗</a></p>'+newAbout;
  const offline='<p class="eyebrow">NO CONNECTION REQUIRED</p><h2>Take the arcade with you.</h2><h3>Option 1 · Keep a local copy</h3><p><a href="https://github.com/QSOLKCB/ARCADE/archive/refs/heads/main.zip">Download the complete arcade ZIP</a>, extract it, then open <code>index.html</code> in your browser. Keep the folders beside that file. All eight games work directly from disk — no server or installation required.</p><h3>Option 2 · Return to the cached site</h3><p>On GitHub Pages, wait for “Offline ready” in the launcher before disconnecting. This confirms the complete game collection has been cached by your browser. You can then reload the same address offline. Clearing browser site data removes the cached copy and local scores.</p><p>Scores and sound/display preferences stay on this device when browser storage is available. Current runs are not saved. No accounts, analytics or online game services are used.</p>';
  function showInfo(html){returnFocus=document.activeElement;if(game&&game.state==='playing'&&!paused)togglePause(true);$('info-content').innerHTML=html;$('info-dialog').showModal();}
  $('audio-button').onclick=()=>{
    showInfo('<p class="eyebrow">THE SOUND BOOTH</p><h2>Set the mix.</h2><p>Original chip music and synthesised effects. Velvet Heist keeps its music sparse so pursuit cues stay clear.</p><label class="audio-enable"><input id="audio-enabled" type="checkbox"> Enable sound</label><label class="audio-slider" for="music-level">Music <output id="music-value"></output></label><input id="music-level" type="range" min="0" max="100" step="5"><label class="audio-slider" for="fx-level">Effects <output id="fx-value"></output></label><input id="fx-level" type="range" min="0" max="100" step="5"><p class="muted">Set music to zero for effects only. Your mix stays on this device.</p>');
    $('audio-enabled').checked=audio.enabled;$('music-level').value=Math.round(audio.musicLevel*100);$('fx-level').value=Math.round(audio.fxLevel*100);
    const show=()=>{$('music-value').textContent=$('music-level').value+'%';$('fx-value').textContent=$('fx-level').value+'%';};show();
    $('audio-enabled').onchange=()=>{audio.setEnabled($('audio-enabled').checked);storage.write('sound',audio.enabled);updateSound();};
    const mix=()=>{audio.setLevels(Number($('music-level').value)/100,Number($('fx-level').value)/100);storage.write('musicLevel',audio.musicLevel);storage.write('fxLevel',audio.fxLevel);show();};
    $('music-level').oninput=mix;$('fx-level').oninput=mix;
  };
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
      });announceUpdate();$('offline-status').textContent='Offline ready · all 8 games';
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested)location.reload();});
    }catch(_){$('offline-status').textContent='Download for offline play';}
  }
  $('update-button').onclick=()=>{if(waitingWorker){updateRequested=true;waitingWorker.postMessage({type:'ACTIVATE_UPDATE'});}};
  updateSound();updateOptions();updateBests();route();requestAnimationFrame(frame);offlineSetup();
})(globalThis.Arcade);
