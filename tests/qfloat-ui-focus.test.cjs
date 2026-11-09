/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
  fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
function ui(){
  const handlers=new Map();
  class HTMLElement{
    constructor(id){this.id=id;this.listeners={};this.style={};this.dataset={};
      this.textContent='';this.value='';this.disabled=false;}
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
    dispatch(type,extras={}){
      const event={type,target:this,code:null,preventDefault(){},...extras};
      for(const callback of this.listeners[type]??[])callback(event);
    }
    click(){this.dispatch('click');}
    focus(){}
    matches(selector){return selector==='input,textarea,select'&&
      ['speed','operand-a','operand-b'].includes(this.id);}
    setPointerCapture(){}
  }
  const elements=new Map();
  const get=id=>{
    if(!elements.has(id))elements.set(id,new HTMLElement(id));
    return elements.get(id);
  };
  const canvas=get('field');
  canvas.getContext=()=>({
    fillRect(){},moveTo(){},lineTo(){},stroke(){},strokeRect(){},fillText(){},
    beginPath(){},getImageData(){return {data:[255,255,255,255]};}
  });
  get('speed').value='1.25';
  get('operand-a').value='0.1';get('operand-b').value='0.2';
  const directional=['left','right','up','down'].map(key=>{
    const button=new HTMLElement('touch-'+key);button.dataset.direction=key;
    return button;
  });
  const window=new HTMLElement('window'),document=new HTMLElement('document');
  document.hidden=false;document.documentElement={dataset:{}};
  document.getElementById=get;document.querySelectorAll=()=>directional;
  let frameNumber=0;
  const pending=new Map();
  const sandbox=vm.createContext({
    window,document,HTMLElement,console,
    requestAnimationFrame:fn=>{const id=++frameNumber;pending.set(id,fn);return id;},
    cancelAnimationFrame:id=>pending.delete(id)
  });
  for(const file of [
    'arcade2/engine.js','arcade2/qfloat.js',
    'arcade3/qfloat-sim.js','arcade3/qfloat-lab.js'
  ]){
    vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),sandbox,
      {filename:file,timeout:5000});
  }
  assert.equal(document.documentElement.dataset.qfloatReady,'ready');
  return {get,canvas,window,document,directional,pending,
    keyDown:code=>window.dispatch('keydown',{code,target:canvas}),
    keyUp:code=>window.dispatch('keyup',{code,target:canvas}),
    x:()=>get('x-raw').textContent,
    tick:()=>get('tick-label').textContent};
}
test('blur while already paused clears a key released outside the window',()=>{
  const h=ui();
  assert.equal(h.x(),'RAW 20971520');
  h.keyDown('ArrowRight');
  h.window.dispatch('blur');
  // The browser cannot deliver keyup after the release happens outside it.
  h.get('single').click();
  assert.equal(h.x(),'RAW 20971520');
  assert.equal(h.tick(),'TICK 1');
});
test('visibility loss and pagehide also clear held keys while paused',()=>{
  for(const lost of ['visibilitychange','pagehide']){
    const h=ui();
    h.keyDown('ArrowRight');
    if(lost==='visibilitychange'){
      h.document.hidden=true;
      h.document.dispatch('visibilitychange');
    }else h.window.dispatch('pagehide');
    h.get('single').click();
    assert.equal(h.x(),'RAW 20971520',lost+' must release input');
    assert.equal(h.tick(),'TICK 1');
  }
});
test('blur clears touch controls while paused, including missing pointerup',()=>{
  const h=ui(),right=h.directional.find(x=>x.dataset.direction==='right');
  right.dispatch('pointerdown',{pointerId:7});
  h.window.dispatch('blur');
  h.get('single').click();
  assert.equal(h.x(),'RAW 20971520');
});
test('blur while running stops RAF and clears controls before any later Step',()=>{
  const h=ui();
  h.get('play').click();
  assert.equal(h.pending.size,1);
  h.keyDown('ArrowRight');
  h.window.dispatch('blur');
  assert.equal(h.pending.size,0,'no animation callback remains scheduled');
  assert.equal(h.get('pause').disabled,true);
  h.get('single').click();
  assert.equal(h.x(),'RAW 20971520');
  assert.equal(h.tick(),'TICK 1');
});
test('ordinary keyboard movement and independent aliases remain functional',()=>{
  const h=ui();
  h.keyDown('ArrowRight');
  h.keyDown('KeyD');
  h.keyUp('ArrowRight');
  h.get('single').click();
  assert.equal(h.x(),'RAW 21053440');
  h.keyUp('KeyD');
  h.get('single').click();
  assert.equal(h.x(),'RAW 21053440');
});
