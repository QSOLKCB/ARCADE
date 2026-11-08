'use strict';
// A Canvas 2D stand-in for Node tests. It records every method call, rejects
// non-finite numeric arguments and supports gradients, patterns and offscreen
// layer canvases, so the ARCADE 2 renderer can run headlessly.
const assert=require('node:assert/strict');
const STATE=['fillStyle','strokeStyle','lineWidth','globalAlpha','globalCompositeOperation','font','textAlign','textBaseline','imageSmoothingEnabled','lineCap','lineJoin'];
function recordingContext(canvas=null,{logging=false}={}){
 const calls=[],log=[],state={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,globalAlpha:1,globalCompositeOperation:'source-over',font:'10px monospace',textAlign:'left',textBaseline:'alphabetic',imageSmoothingEnabled:true,lineCap:'butt',lineJoin:'miter'};
 const stack=[];
 const gradient=()=>({stops:0,addColorStop(offset,color){assert.ok(Number.isFinite(offset)&&offset>=0&&offset<=1,'gradient stop '+offset);assert.equal(typeof color,'string');this.stops++;if(logging)log.push('stop('+offset+','+color+')');}});
 const special={
  createLinearGradient:gradient,createRadialGradient:gradient,createPattern:()=>({}),
  measureText:text=>({width:String(text).length*6}),
  save:()=>{stack.push({...state});},restore:()=>{if(stack.length)Object.assign(state,stack.pop());},
  getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
 };
 const ctx=new Proxy(state,{
  get(target,key){
   if(key==='calls')return calls;
   if(key==='log')return log;
   if(key==='canvas')return canvas;
   if(key==='reset')return()=>{calls.length=0;log.length=0;};
   if(key in target)return target[key];
   if(typeof key!=='string')return undefined;
   return(...args)=>{
    for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),'finite draw '+key);
    if(key==='drawImage')assert.ok(args[0]&&typeof args[0]==='object','drawImage source');
    calls.push(key);if(logging)log.push(key+'('+args.map(a=>typeof a==='number'?+a.toFixed(3):typeof a==='string'?a:'#').join(',')+')');
    return special[key]?special[key](...args):undefined;
   };
  },
  set(target,key,value){
   if(!STATE.includes(key))throw new Error('unexpected context property '+String(key));
   if(key==='globalAlpha')assert.ok(Number.isFinite(value)&&value>=0&&value<=1,'globalAlpha '+value);
   if(logging)log.push(key+'='+(typeof value==='object'?'#':String(value)));
   target[key]=value;return true;
  },
 });
 return ctx;
}
function mockCanvas(width,height){
 const canvas={width,height,contexts:0};
 const ctx=recordingContext(canvas,{logging:true});
 canvas.getContext=()=>{canvas.contexts++;return ctx;};
 return canvas;
}
module.exports={recordingContext,mockCanvas};
