'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness(){
 class Target{constructor(){this.handlers={};this.tagName='CANVAS';this.dataset={};this.held=false;this.classList={add:()=>this.held=true,remove:()=>this.held=false};}addEventListener(n,f){(this.handlers[n]??=[]).push(f);}fire(n,data={}){const event={target:this,preventDefault(){},...data};for(const f of this.handlers[n]||[])f(event);}setPointerCapture(){}getBoundingClientRect(){return{left:0,top:0,width:640,height:360};}}
 const canvas=new Target(),window=new Target(),buttons=['left','right','up','down','a','b','c','d'].map(action=>{const b=new Target();b.dataset.input=action;return b;});
 let enabled=true,pauses=0,pads=[];
 const context=vm.createContext({window,document:{querySelectorAll:selector=>selector.includes('.held')?buttons.filter(b=>b.held):buttons},navigator:{getGamepads:()=>pads},console});
 for(const file of ['engine','core','input'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../arcade2/'+file+'.js'),'utf8'),context);
 const input=new context.Arcade2.Input(canvas,()=>enabled,()=>{pauses++;return true;});
 const key=(code,type='keydown',extra={})=>window.fire(type,{code,repeat:false,...extra});
 return{input,key,canvas,window,buttons,setEnabled:v=>enabled=v,setPads:p=>pads=p,get pauses(){return pauses;}};
}
const pad=()=>({index:0,id:'virtual standard controller',mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false}))});
test('keyboard actions merge aliases and release a charged shot only when every source releases',()=>{
 const h=harness();h.key('KeyZ');let a=h.input.sample();assert.ok(a.a&&a.aPressed);h.key('KeyJ');h.input.sample();h.key('KeyZ','keyup');a=h.input.sample();assert.ok(a.a);assert.equal(a.aReleased,false);h.key('KeyJ','keyup');a=h.input.sample();assert.equal(a.a,false);assert.ok(a.aReleased);
});
test('pause cancellation requires a fresh keyboard press and rejects auto-repeat',()=>{
 const h=harness();h.key('ArrowRight');h.key('KeyZ');h.input.clear();h.key('KeyZ','keydown',{repeat:true});assert.equal(h.input.sample().a,false);assert.equal(h.input.sample().x,0);
 h.key('KeyZ','keyup');h.key('KeyZ');assert.ok(h.input.sample().aPressed);h.setEnabled(false);h.key('KeyX');assert.equal(h.input.sample().b,false);h.key('KeyP');assert.equal(h.pauses,1);
});
test('short action taps survive one simulation sample and do not repeat',()=>{
 const h=harness();h.key('KeyZ');h.key('KeyZ','keyup');let a=h.input.sample();assert.ok(a.a&&a.aPressed&&a.aReleased);a=h.input.sample();assert.equal(a.a,false);assert.equal(a.aPressed,false);
});
test('touch cancellation, lost capture and scene clearing release all sources',()=>{
 const h=harness(),button=h.buttons.find(b=>b.dataset.input==='a');button.fire('pointerdown',{pointerId:7});assert.ok(h.input.sample().a);button.fire('pointercancel',{pointerId:7});assert.equal(h.input.sample().a,false);
 button.fire('pointerdown',{pointerId:8});button.fire('lostpointercapture',{pointerId:8});assert.equal(h.input.sample().a,false);
 button.fire('pointerdown',{pointerId:9});h.input.clear();assert.equal(h.input.sample().a,false);assert.equal(button.held,false);
});
test('controller connection and scene transitions require neutral, then map all actions',()=>{
 const h=harness(),p=pad();p.buttons[0].pressed=true;h.setPads([p]);assert.equal(h.input.sample().a,false);p.buttons[0].pressed=false;h.input.sample();p.axes[0]=.9;p.buttons[0].pressed=true;p.buttons[2].pressed=true;
 let a=h.input.sample();assert.equal(a.x,1);assert.ok(a.aPressed&&a.cPressed);h.input.clear();assert.equal(h.input.sample().a,false);p.axes[0]=0;p.buttons[0].pressed=false;p.buttons[2].pressed=false;h.input.sample();p.buttons[1].pressed=true;assert.ok(h.input.sample().bPressed);
 h.window.fire('gamepaddisconnected');assert.equal(h.pauses,1);
});
test('menu pad events have edges and mouse aim yields to keyboard direction',()=>{
 const h=harness(),p=pad();h.setPads([p]);h.input.pollMenu();p.buttons[9].pressed=true;assert.deepEqual([...h.input.pollMenu()],['pause']);assert.deepEqual([...h.input.pollMenu()],[]);
 h.canvas.dataset.aim='true';h.canvas.fire('pointermove',{clientX:300,clientY:100});assert.equal(h.input.sample().aim.x,300);h.key('ArrowLeft');assert.equal(h.input.sample().aim,null);
});
