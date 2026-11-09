/* SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('screen'),ctx=canvas.getContext('2d');
  if(!ctx){$('hall').hidden=true;$('playroom').hidden=false;$('game-title').textContent='Canvas 2D is unavailable in this browser.';return;}
  ctx.imageSmoothingEnabled=false;
  const read=(key,fallback)=>{try{const value=localStorage.getItem('qsol-arcade2:'+key);return value===null?fallback:JSON.parse(value);}catch(_){return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem('qsol-arcade2:'+key,JSON.stringify(value));}catch(_){}};
  const best=id=>{const n=read('best:'+id,0);return Number.isSafeInteger(n)&&n>=0&&n<1000000000?n:0;};
  let sound=read('sound',false)===true,audio=null,voices=[],buffers=new Map(),mode='hall',game=null,selected=null,last=null,lastMessage='';
  const G=A.Gfx;let fxChoice=read('fx','high')==='lite'?'lite':'high',fxAuto=false;G.setQuality(fxChoice);
  // VANILLAJS FrameGate: redraw only when the complete frame key changes. The key
  // names every input to drawing: the shell generation (bumped on any shell change),
  // the cabinet, the simulation tick, stage, status and the FX tier.
  const gate=new A.Engine.FrameGate();let generation=0;
  // OPT-APPROX-001 guard: if full effects cost too much paint time on this device,
  // fall back to the lite tier (cosmetic only) for the rest of the session.
  const PAINT_BUDGET_MS=7,PAINT_WINDOW=120;let paintSamples=0,paintTotal=0,paintWarmup=0;
  const clock=new A.Engine.FixedClock({step:1/60,maxFrame:.1,maxSteps:6,snapTolerance:.0005});clock.setPaused(true);
  function unlockAudio(){
    if(!sound)return;
    try{if(!audio){const Type=window.AudioContext||window.webkitAudioContext;if(!Type)return;audio=new Type();}const p=audio.resume();if(p?.catch)p.catch(()=>{});}catch(_){}
  }
  function quiet(){for(const voice of voices){try{voice.osc.stop();}catch(_){}}voices=[];}
  // Effects come from the audio2d PCM bank (arcade2/sound.js); the oscillator
  // recipes below remain as a fallback if buffers cannot be created.
  function sample(name){
    try{
      if(!buffers.has(name)){const pcm=A.Sound.pcm(name),buffer=audio.createBuffer(1,pcm.length,A.Sound.RATE),out=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++)out[i]=pcm[i]/32768;buffers.set(name,buffer);}
      const src=audio.createBufferSource(),gain=audio.createGain(),voice={osc:src};src.buffer=buffers.get(name);gain.gain.value=.55;
      src.connect(gain);gain.connect(audio.destination);voices.push(voice);
      src.onended=()=>{src.disconnect();gain.disconnect();voices=voices.filter(v=>v!==voice);};src.start();return true;
    }catch(_){return false;}
  }
  function sfx(name){
    if(!sound||!audio||audio.state!=='running'||voices.length>=8)return;
    if(A.Sound&&sample(name))return;
    const notes={shot:[410,170,.06],hurt:[135,50,.13],blast:[95,24,.22],jump:[230,650,.09],pickup:[530,1050,.12],win:[440,880,.25],lose:[190,40,.4],dash:[900,120,.12],block:[240,190,.06]};
    const [from,to,length]=notes[name]||notes.shot;
    try{const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime,voice={osc};
      osc.type=name==='win'||name==='pickup'?'triangle':'square';osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+length);
      gain.gain.setValueAtTime(.025,now);gain.gain.exponentialRampToValueAtTime(.001,now+length);osc.connect(gain);gain.connect(audio.destination);
      voices.push(voice);osc.onended=()=>{osc.disconnect();gain.disconnect();voices=voices.filter(v=>v!==voice);};osc.start(now);osc.stop(now+length);
    }catch(_){}
  }
  const input=new A.Input(canvas,()=>mode==='playing',()=>{if(mode==='playing'){pause();return true;}if(mode==='paused'){resume();return true;}return false;});
  function invalidate(){generation++;gate.invalidate();paintWarmup=20;}
  function setMode(value){mode=value;invalidate();clock.setPaused(value!=='playing');last=null;input.clear();if(game)game.cancelInput();quiet();$('overlay').hidden=value==='playing'||value==='hall';$('pause').textContent=value==='paused'?'Resume':'Pause';}
  function showOverlay(kicker,title,copy,button){$('overlay-kicker').textContent=kicker;$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;$('continue').textContent=button;$('continue').focus({preventScroll:true});}
  function pause(){if(mode!=='playing')return;setMode('paused');showOverlay('TAKE A BREATHER','PAUSED','Your run is waiting right here.','Resume game');}
  function resume(){if(mode!=='paused')return;unlockAudio();setMode('playing');canvas.focus({preventScroll:true});}
  function frameKey(){return generation+'|'+selected.id+'|'+game.tickCount+'|'+game.stage+'|'+game.status+'|'+G.quality();}
  function paint(){if(game)gate.present({key:frameKey(),width:canvas.width,height:canvas.height},draw);}
  function draw(){
    const started=performance.now();
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';game.draw(ctx);G.post(ctx,game);
    budget(performance.now()-started);
    const hud=game.hud();$('hud-left').textContent=hud.left;$('hud-right').textContent=hud.right;$('hud-score').textContent=String(game.score).padStart(6,'0');$('objective').textContent=hud.objective;
    const message=game.messageTicks?game.message:'';if(message!==lastMessage){lastMessage=message;$('announcement').textContent=message;}
  }
  function budget(ms){
    if(mode!=='playing'||G.quality()!=='high')return;
    if(paintWarmup>0){paintWarmup--;return;} // First frames after a change build cached layers.
    paintTotal+=ms;if(++paintSamples<PAINT_WINDOW)return;
    const average=paintTotal/paintSamples;paintSamples=paintTotal=0;
    if(average>PAINT_BUDGET_MS){fxAuto=true;G.setQuality('lite');fxLabel();invalidate();redrawPreviews();}
  }
  function fxLabel(){const lite=G.quality()==='lite';$('fx').textContent=lite?(fxAuto?'FX lite (auto)':'FX lite'):'FX full';$('fx').setAttribute('aria-pressed',String(!lite));}
  function launch(meta,ready=false){
    selected=meta;game=meta.create();clock.reset();invalidate();$('hall').hidden=true;$('playroom').hidden=false;
    $('game-title').textContent=meta.title;$('game-genre').textContent='CABINET '+meta.number+' / '+meta.genre;
    $('control-guide').replaceChildren(...meta.controls.map(label=>{const el=document.createElement('span');el.textContent=label;return el;}));
    $('best').textContent='BEST '+String(best(meta.id)).padStart(6,'0');canvas.dataset.aim=String(meta.id==='breach');
    document.title=meta.title+' — ARCADE 2';try{history.replaceState(null,'','#'+meta.id);}catch(_){}
    setMode(ready?'paused':'playing');unlockAudio();paint();window.scrollTo({top:0,behavior:'instant'});
    if(ready)showOverlay('FREE PLAY','READY PLAYER ONE',meta.description,'Start game');else canvas.focus({preventScroll:true});
  }
  function hall(){
    const returnId=selected?.id;setMode('hall');game=null;$('hall').hidden=false;$('playroom').hidden=true;document.title='ARCADE 2 — The Second Shift';
    try{history.replaceState(null,'','#cabinets');}catch(_){}
    const button=document.querySelector('[data-play="'+returnId+'"]');if(button)button.focus();
  }
  function end(){
    setMode('result');paint();
    if(game.status==='stageclear')showOverlay('CABINET '+selected.number,'STAGE CLEAR','Score '+game.score.toLocaleString()+' · the next stage is waiting.','Next stage');
    else{
      const previous=best(selected.id);if(game.score>previous)write('best:'+selected.id,game.score);
      const won=game.status==='won',title=won?(selected.id==='kombat'?'DEPLOYALITY!':'YOU CLEARED IT.'):'ANOTHER CREDIT?';
      showOverlay(won?'MISSION COMPLETE':'RUN ENDED',title,'Score '+game.score.toLocaleString()+(game.score>previous?' · new local best.':' · free play, always.'),'Play again');
      $('best').textContent='BEST '+String(best(selected.id)).padStart(6,'0');sfx(won?'win':'lose');
    }
  }
  $('continue').addEventListener('click',()=>{
    if(mode==='paused')resume();
    else if(game?.status==='stageclear'){game.next();setMode('playing');unlockAudio();paint();canvas.focus({preventScroll:true});}
    else if(selected)launch(selected);
  });
  $('pause').addEventListener('click',()=>mode==='paused'?resume():pause());
  $('restart').addEventListener('click',()=>{if(selected)launch(selected);});
  $('leave').addEventListener('click',hall);$('overlay-leave').addEventListener('click',hall);
  $('fx').addEventListener('click',()=>{fxAuto=false;fxChoice=G.quality()==='high'?'lite':'high';G.setQuality(fxChoice);write('fx',fxChoice);paintSamples=paintTotal=0;fxLabel();invalidate();redrawPreviews();if(game)paint();});fxLabel();
  $('audio').addEventListener('click',()=>{sound=!sound;write('sound',sound);audioLabel();if(sound){unlockAudio();sfx('pickup');}else quiet();});
  function audioLabel(){$('audio').textContent=sound?'Sound on':'Sound off';$('audio').setAttribute('aria-pressed',String(sound));}audioLabel();
  window.addEventListener('blur',()=>{if(mode==='playing')pause();else input.clear();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(mode==='playing')pause();else input.clear();}});
  const previews=[];
  function preview(meta,target){
    const g=meta.create();for(let i=0;i<(meta.id==='kombat'?150:100);i++){const a=A.empty();if(['shadow','cache','iron'].includes(meta.id)){a.x=1;a.a=true;}g.tick(a);}
    const context=target.getContext('2d');if(context){context.imageSmoothingEnabled=false;g.draw(context);previews.push([g,context]);}
  }
  function redrawPreviews(){for(const [g,context] of previews){context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='source-over';g.draw(context);}}
  for(const meta of A.registry.sort((a,b)=>Number(a.number)-Number(b.number))){
    const article=document.createElement('article');article.className='card';article.style.setProperty('--accent',meta.color);
    article.dataset.category=['soccer','hoops'].includes(meta.id)?'sport':['shadow','cache','iron','kombat'].includes(meta.id)?'action':'shooter';
    const top=document.createElement('div');top.className='card-top';const genre=document.createElement('span'),number=document.createElement('span');genre.textContent=meta.genre;number.textContent='NO. '+meta.number;top.append(genre,number);
    const art=document.createElement('div');art.className='card-preview';const screen=document.createElement('canvas');screen.width=640;screen.height=360;screen.setAttribute('aria-label',meta.title+' gameplay preview');screen.setAttribute('role','img');art.append(screen);
    const copy=document.createElement('div');copy.className='card-copy';const title=document.createElement('h3');title.textContent=meta.title;
    const subtitle=document.createElement('p');subtitle.className='card-subtitle';subtitle.textContent=meta.subtitle;
    const description=document.createElement('p');description.className='card-description';description.textContent=meta.description;
    const foot=document.createElement('div');foot.className='card-footer';const tag=document.createElement('span');tag.textContent='1 PLAYER / FREE PLAY';
    const play=document.createElement('button');play.type='button';play.textContent='PLAY CABINET ↗';play.dataset.play=meta.id;play.setAttribute('aria-label','Play '+meta.title);play.addEventListener('click',()=>launch(meta));foot.append(tag,play);
    copy.append(title,subtitle,description,foot);article.append(top,art,copy);$('cards').append(article);preview(meta,screen);
  }
  for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{
    const filter=button.dataset.filter;
    for(const other of document.querySelectorAll('[data-filter]'))other.setAttribute('aria-pressed',String(other===button));
    for(const card of document.querySelectorAll('.card'))card.hidden=filter!=='all'&&card.dataset.category!==filter;
  });
  const featured=A.registry.find(m=>m.id==='kombat');preview(featured,$('feature-art'));$('featured-play').addEventListener('click',()=>launch(featured));
  function padMenus(){
    const edges=input.pollMenu();if(edges.includes('pause')){if(mode==='playing')pause();else if(mode==='paused')resume();return;}
    if(mode==='playing')return;
    if(edges.includes('b')&&mode!=='hall'){hall();return;}
    const buttons=mode==='hall'?[...document.querySelectorAll('.card:not([hidden]) [data-play]')]:[$('continue'),$('overlay-leave')];
    if(!buttons.length)return;
    let index=buttons.indexOf(document.activeElement);if(index<0)index=0;
    const move=edges.includes('right')||edges.includes('down')?1:edges.includes('left')||edges.includes('up')?-1:0;
    if(move){index=(index+move+buttons.length)%buttons.length;buttons[index].focus();}
    if(edges.includes('a'))buttons[index].click();
  }
  function frame(now){
    padMenus();
    if(mode==='playing'){
      const seconds=last===null?0:Math.max(0,(now-last)/1000);last=now;
      try{
        const result=clock.advance(seconds,()=>{
          game.tick(input.sample());for(const event of game.events)sfx(event);game.events.length=0;
          if(game.status!=='playing')end();
        });
        paint();
      }catch(error){console.error(error);setMode('error');showOverlay('CABINET STOPPED','LET’S RESTART.','This run encountered an error. A fresh credit is ready.','Restart cabinet');}
    }else last=null;
    requestAnimationFrame(frame);
  }
  const requested=A.registry.find(m=>m.id===location.hash.slice(1));if(requested)launch(requested,true);
  requestAnimationFrame(frame);
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
    navigator.serviceWorker.register('../sw.js').then(reg=>{
      let requestedUpdate=false;
      const waiting=()=>{if(reg.waiting)$('update').hidden=false;};waiting();
      reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',waiting);});
      $('update').addEventListener('click',()=>{if(reg.waiting){requestedUpdate=true;if(mode==='playing')pause();reg.waiting.postMessage({type:'ACTIVATE_UPDATE'});}});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requestedUpdate)location.reload();});
    }).catch(()=>{});
  }
})(globalThis.Arcade2);
