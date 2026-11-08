/* SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  const bindings={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',KeyZ:'a',KeyJ:'a',KeyX:'b',KeyK:'b',Space:'c',KeyL:'c',KeyC:'d',KeyE:'d'};
  A.Input=class{
    constructor(canvas,enabled,pause){
      this.canvas=canvas;this.enabled=enabled;this.pause=pause;this.keys=new Map();this.touch=new Map();this.pending=new Set();this.released=new Set();this.previous=new Set();this.aim=null;this.mouse=false;this.padArmed=false;this.padIds='';this.menuPrevious=new Set();
      window.addEventListener('keydown',e=>{
        if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
        if((e.code==='Escape'||e.code==='KeyP')&&!e.repeat){if(this.pause())e.preventDefault();return;}
        if(!this.enabled()||!bindings[e.code])return;
        e.preventDefault();
        // Held game keys must not scroll, but repeats must not re-arm cleared input.
        if(e.repeat)return;
        this.keys.set(e.code,bindings[e.code]);this.pending.add(bindings[e.code]);
      });
      window.addEventListener('keyup',e=>{const action=this.keys.get(e.code);this.keys.delete(e.code);if(action)this.released.add(action);});
      for(const button of document.querySelectorAll('[data-input]')){
        button.addEventListener('pointerdown',e=>{if(!this.enabled())return;e.preventDefault();button.setPointerCapture(e.pointerId);this.touch.set(e.pointerId,button.dataset.input);this.pending.add(button.dataset.input);button.classList.add('held');});
        const release=e=>{const action=this.touch.get(e.pointerId);this.touch.delete(e.pointerId);if(action){if(e.type==='pointerup')this.released.add(action);else this.pending.delete(action);}button.classList.remove('held');};
        for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
      }
      const aim=e=>{const r=canvas.getBoundingClientRect();if(r.width&&r.height)this.aim={x:(e.clientX-r.left)*640/r.width,y:(e.clientY-r.top)*360/r.height};};
      canvas.addEventListener('pointermove',e=>{if(this.enabled()&&canvas.dataset.aim==='true')aim(e);});
      canvas.addEventListener('pointerdown',e=>{if(!this.enabled()||canvas.dataset.aim!=='true')return;e.preventDefault();canvas.setPointerCapture(e.pointerId);aim(e);if(e.button===0){this.mouse=true;this.pending.add('a');}});
      canvas.addEventListener('pointerup',()=>{if(this.mouse)this.released.add('a');this.mouse=false;});
      for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{this.mouse=false;this.pending.delete('a');this.aim=null;});
      canvas.addEventListener('contextmenu',e=>e.preventDefault());
      window.addEventListener('gamepaddisconnected',()=>{this.clear();if(this.enabled())this.pause();});
    }
    clear(){this.keys.clear();this.touch.clear();this.pending.clear();this.released.clear();this.previous.clear();this.aim=null;this.mouse=false;this.padArmed=false;this.menuPrevious.clear();for(const b of document.querySelectorAll('[data-input].held'))b.classList.remove('held');}
    pads(){try{return Array.from(navigator.getGamepads?navigator.getGamepads():[]).filter(p=>p&&p.mapping==='standard');}catch(_){return[];}}
    padState(){
      const pads=this.pads(),ids=pads.map(p=>p.index+':'+p.id).join('|');
      if(ids!==this.padIds){this.padIds=ids;this.padArmed=false;}
      const neutral=pads.every(p=>p.buttons.every(b=>!b.pressed)&&p.axes.every(v=>Math.abs(v)<.25));
      if(!this.padArmed){if(neutral)this.padArmed=true;return new Set();}
      const down=new Set(),p=pads[0];if(!p)return down;
      const pressed=n=>!!p.buttons[n]?.pressed;
      if(p.axes[0]<-.25||pressed(14))down.add('left');if(p.axes[0]>.25||pressed(15))down.add('right');
      if(p.axes[1]<-.25||pressed(12))down.add('up');if(p.axes[1]>.25||pressed(13))down.add('down');
      for(const [n,key] of [[0,'a'],[1,'b'],[2,'c'],[3,'d'],[9,'pause']])if(pressed(n))down.add(key);
      return down;
    }
    pollMenu(){
      const down=this.padState(),edges=[...down].filter(k=>!this.menuPrevious.has(k));this.menuPrevious=down;
      return edges;
    }
    sample(){
      if(!this.enabled())return A.empty();
      const down=this.padState();for(const k of this.keys.values())down.add(k);for(const k of this.touch.values())down.add(k);if(this.mouse)down.add('a');
      const input=A.empty();input.x=Number(down.has('right'))-Number(down.has('left'));input.y=Number(down.has('down'))-Number(down.has('up'));
      for(const action of ['a','b','c','d']){input[action]=down.has(action)||this.pending.has(action);input[action+'Pressed']=this.pending.has(action)||(down.has(action)&&!this.previous.has(action));}
      input.aReleased=!down.has('a')&&(this.released.has('a')||this.previous.has('a'));
      input.aim=this.aim;
      // Direction keys take ownership of the reticle after mouse aim.
      if(input.x||input.y){input.aim=null;this.aim=null;}
      this.previous=down;this.pending.clear();this.released.clear();return input;
    }
  };
})(globalThis.Arcade2);
