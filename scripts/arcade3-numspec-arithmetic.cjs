/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
// NUM-SPEC-001: independent, pure scalar oracles. These functions are NOT
// installed in the game engine and have no ambient state or dependencies.
const MIN=-2147483648,MAX=2147483647,SCALE=65536;
const lower=BigInt(MIN),upper=BigInt(MAX);
function int32(value){
  if(typeof value!=='number'||!Number.isInteger(value)||value<MIN||value>MAX)
    throw new RangeError('signed int32 required');
  return value===0?0:value;
}
function result32(value){
  if(value<lower||value>upper)throw new RangeError('signed int32 quotient overflow');
  return Number(value);
}
function exactMulDiv(a,b,d){
  int32(a);int32(b);int32(d);
  if(d===0)throw new RangeError('zero denominator');
  return result32(BigInt(a)*BigInt(b)/BigInt(d)); // truncates toward zero
}
function guardedFloat64(a,b,d){
  int32(a);int32(b);int32(d);
  if(d===0)throw new RangeError('zero denominator');
  const p=a*b;
  // Admission is for the *true integer product*, not just a rounded quotient.
  // For int32 operands a rounded product beyond 2^53 cannot enter this range.
  if(!Number.isSafeInteger(p))return {admitted:false,reason:'unsafe-product'};
  const q=(p-p%d)/d;
  if(!Number.isSafeInteger(q)||q<MIN||q>MAX)
    throw new RangeError('signed int32 quotient overflow');
  return {admitted:true,value:q===0?0:q};
}
function naiveFloat64(a,b,d){
  int32(a);int32(b);int32(d);
  if(d===0)throw new RangeError('zero denominator');
  const q=Math.trunc(a*b/d);
  if(!Number.isFinite(q)||q<MIN||q>MAX)
    throw new RangeError('signed int32 quotient overflow');
  return q===0?0:q;
}
function normalizeTrits(input){
  if(!Array.isArray(input)||input.length<1||input.length>128||
     input.some(x=>x!==-1&&x!==0&&x!==1)||
     (input.length>1&&input.at(-1)===0))
    throw new TypeError('noncanonical balanced ternary digits');
  return input;
}
function encodeTrits(value){
  if(typeof value!=='bigint')throw new TypeError('BigInt required');
  if(value===0n)return [0];
  const out=[];
  while(value!==0n){
    let digit=value%3n;
    if(digit===2n)digit=-1n;
    else if(digit===-2n)digit=1n;
    out.push(Number(digit));
    value=(value-digit)/3n;
    if(out.length>128)throw new RangeError('ternary capacity');
  }
  return out;
}
function decodeTrits(input){
  const trits=normalizeTrits(input);
  let out=0n;
  for(let i=trits.length-1;i>=0;i--)out=out*3n+BigInt(trits[i]);
  return out;
}
function balancedAdd(x,y){
  normalizeTrits(x);normalizeTrits(y);
  const out=[];let carry=0;
  for(let i=0;i<Math.max(x.length,y.length)||carry!==0;i++){
    const raw=(x[i]??0)+(y[i]??0)+carry;
    let digit=((raw%3)+3)%3;
    if(digit===2)digit=-1;
    carry=(raw-digit)/3;
    out.push(digit);
    if(out.length>128)throw new RangeError('ternary addition capacity');
  }
  while(out.length>1&&out.at(-1)===0)out.pop();
  return normalizeTrits(out.length?out:[0]);
}
function balancedMultiply(x,y){
  normalizeTrits(x);normalizeTrits(y);
  const coeff=Array(x.length+y.length).fill(0);
  for(let i=0;i<x.length;i++)
    for(let j=0;j<y.length;j++)coeff[i+j]+=x[i]*y[j];
  const out=[];let carry=0;
  for(let i=0;i<coeff.length||carry!==0;i++){
    const raw=(coeff[i]??0)+carry;
    let digit=((raw%3)+3)%3;
    if(digit===2)digit=-1;
    carry=(raw-digit)/3;
    out.push(digit);
    if(out.length>128)throw new RangeError('ternary multiply capacity');
  }
  while(out.length>1&&out.at(-1)===0)out.pop();
  return normalizeTrits(out.length?out:[0]);
}
function ternaryMulDiv(a,b,d){
  int32(a);int32(b);int32(d);
  if(d===0)throw new RangeError('zero denominator');
  const aDigits=encodeTrits(BigInt(a)),bDigits=encodeTrits(BigInt(b));
  // Product uses actual trit convolution; quotient still uses BigInt division.
  const p=decodeTrits(balancedMultiply(aDigits,bDigits));
  return result32(p/BigInt(d));
}
function parseDecimal4(value){
  if(typeof value!=='string'||!/^-?(?:0|[1-9]\d{0,12})(?:\.\d{1,4})?$/.test(value))
    throw new TypeError('canonical decimal with at most four places required');
  const negative=value.startsWith('-'),unsigned=negative?value.slice(1):value,
    [whole,part='']=unsigned.split('.');
  const v=BigInt(whole)*10000n+BigInt(part.padEnd(4,'0'));
  return negative?-v:v;
}
function decimal4(value){
  if(typeof value!=='bigint')throw new TypeError('BigInt decimal subunits required');
  const negative=value<0n,raw=negative?-value:value;
  return (negative?'-':'')+String(raw/10000n)+'.'+String(raw%10000n).padStart(4,'0');
}
module.exports={MIN,MAX,SCALE,int32,exactMulDiv,guardedFloat64,naiveFloat64,
  encodeTrits,decodeTrits,balancedAdd,balancedMultiply,ternaryMulDiv,
  parseDecimal4,decimal4};
