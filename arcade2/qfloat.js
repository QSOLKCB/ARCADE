/* SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  // QFLOAT-001: float-like authoring, integer-only Q16.16 simulation.
  // All decimal parsing is exact BigInt rational -> explicit truncation
  // toward zero, never an implicit binary floating-point conversion.
  const E=A.Engine;
  if(!E||typeof E.mulDiv!=='function')throw new Error('QFloat requires Arcade2.Engine');
  const S=65536n,DEC=10000000000000000n,UNIT=DEC/S;
  const DECIMAL=/^-?(?:0|[1-9][0-9]{0,4})(?:\.[0-9]{1,16})?$/;
  function fromDecimal(text){
    if(typeof text!=='string'||text.length>24||!DECIMAL.test(text))
      throw new TypeError('expected bounded canonical decimal string');
    const negative=text[0]==='-',plain=negative?text.slice(1):text,
      parts=plain.split('.'),fraction=parts[1]||'';
    const integral=BigInt(parts[0]),den=10n**BigInt(fraction.length),
      numerator=integral*den+BigInt(fraction||'0');
    const raw=(negative?-1n:1n)*numerator*S/den;
    if(raw< -2147483648n||raw>2147483647n)
      throw new RangeError('decimal outside signed Q16.16 range');
    return new Scalar(Number(raw));
  }
  function decimalExact(raw){
    const n=BigInt(E.int32(raw)),a=n<0n?-n:n,
      whole=a/S,fraction=(a%S)*UNIT;
    return (n<0n?'-':'')+whole+'.'+String(fraction).padStart(16,'0');
  }
  function checkScalar(value){
    if(!(value instanceof Scalar))throw new TypeError('QFloat scalar required');
    return value.raw;
  }
  // Author-facing scalar object is immutable. It cannot be silently
  // coerced to a floating-point Number by +, *, Math.*, or comparison.
  // To render a value, explicitly request the presentation-only float.
  class Scalar {
    #raw;
    constructor(raw){this.#raw=E.int32(raw);Object.freeze(this);}
    get raw(){return this.#raw;}
    get number(){return E.toNumber(this.#raw);}
    add(other){return new Scalar(E.add(this.#raw,checkScalar(other)));}
    subtract(other){return new Scalar(E.subtract(this.#raw,checkScalar(other)));}
    multiply(other){return new Scalar(E.multiply(this.#raw,checkScalar(other)));}
    divide(other){return new Scalar(E.divide(this.#raw,checkScalar(other)));}
    sqrt(){return new Scalar(E.sqrt(this.#raw));}
    compare(other){
      const a=this.#raw,b=checkScalar(other);
      return a===b?0:a>b?1:-1;
    }
    exact(){return decimalExact(this.#raw);}
    approx(places=3){
      if(!Number.isInteger(places)||places<0||places>12)
        throw new RangeError('presentation digits must be 0..12');
      return this.number.toFixed(places);
    }
    toJSON(){return {kind:'qsol.qfloat.q16.v1',raw:this.#raw};}
    toString(){return this.exact();}
    valueOf(){throw new TypeError('implicit QFloat -> Float64 conversion prohibited');}
    [Symbol.toPrimitive](hint){
      if(hint==='string')return this.exact();
      throw new TypeError('implicit QFloat -> Float64 conversion prohibited');
    }
  }
  function fromJSON(record){
    if(!record||typeof record!=='object'||Array.isArray(record)||
      Object.keys(record).length!==2||!Object.hasOwn(record,'kind')||
      !Object.hasOwn(record,'raw')||
      record.kind!=='qsol.qfloat.q16.v1')
      throw new TypeError('invalid QFloat serialization');
    return new Scalar(record.raw);
  }
  class Point {
    #x;#y;
    constructor(x,y){
      this.#x=checkScalar(x);this.#y=checkScalar(y);Object.freeze(this);
    }
    get x(){return new Scalar(this.#x);}
    get y(){return new Scalar(this.#y);}
    get raw(){return Object.freeze([this.#x,this.#y]);}
    translate(dx,dy){
      return new Point(new Scalar(E.add(this.#x,checkScalar(dx))),
        new Scalar(E.add(this.#y,checkScalar(dy))));
    }
    toJSON(){return {kind:'qsol.qfloat.point2.v1',x:this.#x,y:this.#y};}
  }
  A.QFloat=Object.freeze({
    SCALE:E.SCALE,
    Scalar,Point,
    fromDecimal,fromRaw:raw=>new Scalar(raw),
    fromRatio:(n,d=1)=>new Scalar(E.fromRatio(n,d)),
    fromJSON,point:(x,y)=>new Point(x,y),
    exactDecimal:decimalExact
  });
})(globalThis.Arcade2=globalThis.Arcade2||{});
