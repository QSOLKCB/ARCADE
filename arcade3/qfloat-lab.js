/* SPDX-License-Identifier: Apache-2.0 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),A=globalThis.Arcade2,
    F=A.QFloat,S=A.QFloatSim,E=A.Engine,canvas=$('field'),ctx=canvas.getContext('2d');
  if(!ctx){$('status').textContent='Canvas 2D unavailable; integer library remains usable.';return;}
  const STEP=1000/60,keys=new Set(),touch=new Map();
  let state=S.create(),running=false,last=null,debt=0,frameId=null;
  const say=(message,warning=false)=>{
    $('status').textContent=message;
    $('status').style.color=warning?'#ffb49c':'';
  };
  function controls(){
    const down=new Set(touch.values());
    for(const code of keys)down.add(keyMap[code]);
    const held=dir=>down.has(dir);
    return {x:Number(held('right'))-Number(held('left')),
      y:Number(held('down'))-Number(held('up'))};
  }
  function labels(){
    const p=S.present(state);
    $('x-view').textContent=p.xApprox;$('y-view').textContent=p.yApprox;
    $('x-raw').textContent='RAW '+state.x;$('y-raw').textContent='RAW '+state.y;
    $('x-exact').textContent=p.xExact;$('y-exact').textContent=p.yExact;
    $('tick-label').textContent='TICK '+state.tick;
    $('token').textContent=S.displayToken(state);
    $('play').disabled=running;$('pause').disabled=!running;
    $('single').disabled=running;$('speed').disabled=running;
  }
  function paint(){
    ctx.fillStyle='#081522';ctx.fillRect(0,0,640,360);
    ctx.strokeStyle='#16334b';ctx.lineWidth=1;ctx.beginPath();
    for(let x=0;x<=640;x+=32){ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,360);}
    for(let y=0;y<=360;y+=32){ctx.moveTo(0,y+.5);ctx.lineTo(640,y+.5);}
    ctx.stroke();
    ctx.fillStyle='#244459';ctx.fillRect(0,0,640,2);
    ctx.fillRect(0,358,640,2);
    // The ONLY conversion to JavaScript floating point happens here,
    // at Canvas and UI presentation boundaries.
    const p=S.present(state),x=p.x,y=p.y;
    ctx.shadowColor='#72f5d0';ctx.shadowBlur=21;ctx.fillStyle='#86ffe2';
    ctx.fillRect(x-9,y-9,18,18);ctx.shadowBlur=0;
    ctx.strokeStyle='#d4fff3';ctx.strokeRect(x-11,y-11,22,22);
    ctx.fillStyle='#a1bfd0';ctx.font='11px monospace';
    ctx.fillText('X:'+p.xApprox+' Y:'+p.yApprox,12,22);
  }
  function redraw(){labels();paint();}
  function pause(){
    // Blur/visibility/pagehide must release input even when already paused:
    // the browser may never deliver keyup or pointerup after focus loss.
    const wasRunning=running;
    running=false;last=null;debt=0;
    if(frameId!==null){cancelAnimationFrame(frameId);frameId=null;}
    keys.clear();touch.clear();
    redraw();
    if(wasRunning)say('Paused. Authoritative state retained exactly.');
  }
  function frame(now){
    frameId=null;
    if(!running)return;
    if(last!==null){
      debt+=Math.min(Math.max(now-last,0),150);let updates=0;
      try{
        while(debt>=STEP&&updates<6){
          state=S.step(state,controls());debt-=STEP;updates++;
        }
        // Drop unbounded frame debt; simulation still advances in whole ticks.
        if(updates===6&&debt>=STEP)debt=0;
      }catch(error){pause();say('Checked integer guard: '+error.message,true);return;}
    }
    last=now;redraw();
    frameId=requestAnimationFrame(frame);
  }
  $('play').addEventListener('click',()=>{
    if(running)return;
    running=true;last=null;debt=0;redraw();
    say('Running. Render looks floating-point; simulation is Q16.16 int32.');
    canvas.focus({preventScroll:true});frameId=requestAnimationFrame(frame);
  });
  $('pause').addEventListener('click',pause);
  $('single').addEventListener('click',()=>{
    if(running)return;
    try{state=S.step(state,controls());redraw();say('One exact integer simulation tick.');}
    catch(error){say('Checked integer guard: '+error.message,true);}
  });
  $('reset').addEventListener('click',()=>{
    pause();keys.clear();touch.clear();
    try{state=S.create({speed:$('speed').value});redraw();say('Reset to integer world origin (320,180).');}
    catch(error){say('Invalid decimal speed: '+error.message,true);}
  });
  $('speed').addEventListener('change',()=>{
    if(running)return;
    try{
      const speed=F.fromDecimal($('speed').value).raw;
      const candidate=Object.freeze({...state,speed});
      S.check(candidate);state=candidate;redraw();
      say('Accepted exact rational input; explicitly quantized to '+speed+' Q16 units.');
    }catch(error){say('Rejected speed: '+error.message,true);}
  });
  const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',
    ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'};
  window.addEventListener('keydown',event=>{
    if(event.target instanceof HTMLElement&&event.target.matches('input,textarea,select'))return;
    const code=keyMap[event.code];if(!code)return;
    event.preventDefault();keys.add(event.code);
  });
  window.addEventListener('keyup',event=>{
    const code=keyMap[event.code];if(code){event.preventDefault();keys.delete(event.code);}
  });
  for(const button of document.querySelectorAll('[data-direction]')){
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();button.setPointerCapture(event.pointerId);
      touch.set(event.pointerId,button.dataset.direction);
    });
    const drop=event=>touch.delete(event.pointerId);
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])
      button.addEventListener(ev,drop);
  }
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.addEventListener('pagehide',pause);
  function calculate(){
    try{
      const a=F.fromDecimal($('operand-a').value),
        b=F.fromDecimal($('operand-b').value),
        result=a.add(b);
      $('result-view').textContent=result.approx(3);
      $('result-exact').textContent=result.exact();
      $('result-raw').textContent=String(result.raw);
    }catch(error){
      $('result-view').textContent='REJECTED';
      $('result-exact').textContent=error.message;
      $('result-raw').textContent='—';
    }
  }
  $('calculate').addEventListener('click',calculate);
  $('operand-a').addEventListener('change',calculate);
  $('operand-b').addEventListener('change',calculate);
  calculate();redraw();document.documentElement.dataset.qfloatReady='ready';
})();
