/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
// NUM-SPEC-002: experimental lossless ordered-integer storage, not a runtime
// codec. Truncated binary interpolative coding uses no third-party packages.
const MAX=0x7fffffff,MAX_COUNT=512;
function validate(values,universe){
  if(!Array.isArray(values)||values.length>MAX_COUNT||
     !Number.isSafeInteger(universe)||universe<1||universe>MAX)
    throw new RangeError('ordered integer list/universe bounds');
  let previous=-1;
  for(const v of values){
    if(!Number.isSafeInteger(v)||v<=previous||v<0||v>=universe)
      throw new RangeError('values must be distinct ascending integers in universe');
    previous=v;
  }
  return values;
}
function writer(){
  const out=[];let count=0;
  function bit(b){
    if(count%8===0)out.push(0);
    if(b)out[out.length-1]+=2**(7-(count%8));
    count++;
  }
  return {bit,bits:(v,length)=>{
    if(!Number.isSafeInteger(v)||v<0||!Number.isInteger(length)||length<0||length>32||
       v>=2**length)throw new RangeError('invalid bounded bit field');
    for(let i=length-1;i>=0;i--)bit(Math.floor(v/2**i)%2===1);
  },result:()=>({bytes:out,bits:count})};
}
function reader(data){
  if(!data||!Array.isArray(data.bytes)||!Number.isInteger(data.bits)||
     data.bits<0||data.bits>data.bytes.length*8||
     data.bytes.length!==Math.ceil(data.bits/8)||
     data.bytes.some(x=>!Number.isInteger(x)||x<0||x>255))
    throw new TypeError('noncanonical bitstream container');
  let read=0;
  function bit(){
    if(read>=data.bits)throw new RangeError('truncated coding');
    const b=Math.floor(data.bytes[Math.floor(read/8)]/2**(7-(read%8)))%2;
    read++;return b;
  }
  return {bits:length=>{
    if(length<0||length>32)throw new RangeError('invalid bit count');
    let v=0;for(let i=0;i<length;i++)v=v*2+bit();
    return v;
  },done:()=>{
    if(read!==data.bits)throw new TypeError('noncanonical trailing coding bits');
    const padding=8-data.bits%8;
    if(data.bits%8!==0&&data.bytes.at(-1)%2**padding!==0)
      throw new TypeError('nonzero padding bits');
  }};
}
function writeBounded(w,value,range){
  if(!Number.isSafeInteger(range)||range<1||range>MAX+1||
    value<0||value>=range)throw new RangeError('interpolative value out of range');
  if(range===1)return;
  const bits=Math.floor(Math.log2(range)),threshold=2**(bits+1)-range;
  if(value<threshold)w.bits(value,bits);
  else w.bits(value+threshold,bits+1);
}
function readBounded(r,range){
  if(range===1)return 0;
  if(!Number.isSafeInteger(range)||range<1||range>MAX+1)
    throw new RangeError('invalid bounded range');
  const bits=Math.floor(Math.log2(range)),threshold=2**(bits+1)-range;
  const v=r.bits(bits);
  return v<threshold?v:2*v+r.bits(1)-threshold;
}
// Sentinel indices -1,n and sentinel values -1,universe yield strict
// ascending-value lower/upper bounds for each interpolated midpoint.
function encodeInterpolative(values,universe){
  validate(values,universe);
  const w=writer();
  function rec(li,ri,lv,rv){
    if(ri-li<=1)return;
    const mid=Math.floor((li+ri)/2),
      lo=lv+(mid-li),hi=rv-(ri-mid),value=values[mid];
    if(value<lo||value>hi)throw new RangeError('inconsistent sorted input');
    writeBounded(w,value-lo,hi-lo+1);
    rec(li,mid,lv,value);rec(mid,ri,value,rv);
  }
  rec(-1,values.length,-1,universe);
  return Object.freeze({kind:'interpolative-truncated-binary-v1',
    universe,count:values.length,...w.result()});
}
function decodeInterpolative(data){
  if(data?.kind!=='interpolative-truncated-binary-v1'||
     !Number.isInteger(data.count)||data.count<0||data.count>MAX_COUNT||
     !Number.isInteger(data.universe)||data.universe<1||data.universe>MAX)
    throw new TypeError('unknown or malformed interpolative format');
  if(data.count>data.universe)throw new RangeError('more values than universe');
  const r=reader(data),values=Array(data.count);
  function rec(li,ri,lv,rv){
    if(ri-li<=1)return;
    const mid=Math.floor((li+ri)/2),
      lo=lv+(mid-li),hi=rv-(ri-mid);
    if(lo>hi)throw new RangeError('invalid interpolative interval');
    const value=lo+readBounded(r,hi-lo+1);
    values[mid]=value;
    rec(li,mid,lv,value);rec(mid,ri,value,rv);
  }
  rec(-1,data.count,-1,data.universe);r.done();validate(values,data.universe);
  return values;
}
function encodeDeltaVarint(values,universe){
  validate(values,universe);
  const bytes=[];let previous=-1;
  for(const value of values){
    let delta=value-previous-1;
    do{
      const part=delta%128;delta=Math.floor(delta/128);
      bytes.push(part+(delta>0?128:0));
      if(bytes.length>MAX_COUNT*5)throw new RangeError('varint budget exceeded');
    }while(delta>0);
    previous=value;
  }
  return Object.freeze({kind:'ascending-delta-varint-v1',universe,
    count:values.length,bytes});
}
function decodeDeltaVarint(data){
  if(data?.kind!=='ascending-delta-varint-v1'||
     !Number.isInteger(data.count)||data.count<0||data.count>MAX_COUNT||
     !Array.isArray(data.bytes)||data.bytes.length>MAX_COUNT*5||
     !Number.isInteger(data.universe)||data.universe<1||data.universe>MAX)
    throw new TypeError('invalid varint container');
  const out=[];let pos=0,prior=-1;
  while(out.length<data.count){
    let delta=0,multiplier=1;
    for(let count=0;;count++){
      if(count===5||pos>=data.bytes.length)throw new RangeError('truncated/oversized varint');
      const byte=data.bytes[pos++];
      if(!Number.isInteger(byte)||byte<0||byte>255)
        throw new TypeError('invalid varint byte');
      delta+=(byte%128)*multiplier;
      if(delta>MAX)throw new RangeError('invalid delta');
      if(byte<128){
        if(count>0&&byte===0)throw new TypeError('nonminimal varint');
        break;
      }
      multiplier*=128;
    }
    const value=prior+delta+1;
    if(value>=data.universe)throw new RangeError('decoded value exceeds universe');
    out.push(value);prior=value;
  }
  if(pos!==data.bytes.length)throw new TypeError('trailing varint bytes');
  return validate(out,data.universe);
}
module.exports={encodeInterpolative,decodeInterpolative,
  encodeDeltaVarint,decodeDeltaVarint,validateSorted:validate};
