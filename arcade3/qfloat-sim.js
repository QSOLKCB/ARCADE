/* SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  // QFLOAT-001 live experiment: Q16.16 integers are the only world state.
  const E=A.Engine,F=A.QFloat;
  if(!F)throw new Error('Load qfloat.js before the simulation adapter');
  const XMAX=E.fromRatio(640),YMAX=E.fromRatio(360);
  function check(state){
    if(!state||typeof state!=='object'||Array.isArray(state)||
       Object.keys(state).length!==4||
       !['x','y','speed','tick'].every(k=>Object.hasOwn(state,k)))
      throw new TypeError('canonical QFloat world state required');
    for(const key of ['x','y','speed'])E.int32(state[key]);
    if(!Number.isSafeInteger(state.tick)||state.tick<0||state.tick>=2147483647)
      throw new RangeError('tick exhausted');
    if(state.x<0||state.x>XMAX||state.y<0||state.y>YMAX||
       state.speed<0||state.speed>E.fromRatio(20))
      throw new RangeError('world state exceeds playfield limits');
    return state;
  }
  function create({x='320',y='180',speed='1.25'}={}){
    const state={x:F.fromDecimal(x).raw,y:F.fromDecimal(y).raw,
      speed:F.fromDecimal(speed).raw,tick:0};
    check(state);return Object.freeze(state);
  }
  function step(state,input){
    check(state);
    if(!input||typeof input!=='object'||Array.isArray(input)||
      Object.keys(input).length!==2||
      ![-1,0,1].includes(input.x)||![-1,0,1].includes(input.y))
      throw new TypeError('legal directional controller values required');
    // Float-like object API for the author; Q16 checked operations underneath.
    const dx=F.fromRaw(state.speed).multiply(F.fromRatio(input.x)),
      dy=F.fromRaw(state.speed).multiply(F.fromRatio(input.y));
    const x=F.fromRaw(state.x).add(dx),
      y=F.fromRaw(state.y).add(dy);
    const bound=(raw,max)=>Math.max(0,Math.min(max,raw));
    return Object.freeze({x:bound(x.raw,XMAX),y:bound(y.raw,YMAX),
      speed:state.speed,tick:state.tick+1});
  }
  function present(state){
    check(state);
    const x=F.fromRaw(state.x),y=F.fromRaw(state.y);
    return {x:x.number,y:y.number,
      xApprox:x.approx(3),yApprox:y.approx(3),
      xExact:x.exact(),yExact:y.exact()};
  }
  // Non-cryptographic, deterministic FNV-1a *display token* of integer state.
  // The independent Node test uses SHA-256 for its actual replay receipt.
  function displayToken(state){
    check(state);
    let h=2166136261>>>0;
    for(const n of [state.x,state.y,state.speed,state.tick]){
      const x=n>>>0;
      for(let k=0;k<4;k++){
        h=Math.imul(h^(x>>>(k*8)&255),16777619)>>>0;
      }
    }
    return h.toString(16).padStart(8,'0');
  }
  A.QFloatSim=Object.freeze({create,check,step,present,displayToken});
})(globalThis.Arcade2=globalThis.Arcade2||{});
