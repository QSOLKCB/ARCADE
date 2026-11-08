// SPDX-License-Identifier: Apache-2.0
// Tiny, pure and sample-indexed procedural sound effects for 2D games.
// No AudioContext, wall clock, floating synthesis, plugins or ambient randomness.
// Strict demo profile: 48 kHz mono PCM16LE, <= 8 seconds and 4 nonoverlapping lanes.
export const AUDIO2D_RATE=48000;
const LIMIT=8*AUDIO2D_RATE,MAX_EVENTS=128;
const number=(x,name,min,max)=>{
  if(!Number.isSafeInteger(x)||x<min||x>max)throw new RangeError(name+' out of range');
  return x;
};
const WAVEFORMS=Object.freeze(['square','triangle','saw','noise']);
function noiseAt(seed,index){
  let x=(seed^Math.imul(index+1,0x9e3779b9))>>>0;
  x^=x<<13;x^=x>>>17;x^=x<<5;
  return ((x>>>16)&65535)-32768;
}
function sampleAt(event,absolute){
  const local=absolute-event.sample;
  if(local<0||local>=event.duration)return 0;
  const phase=(local*event.frequency)%AUDIO2D_RATE;
  let wave;
  switch(event.wave){
    case 'square':wave=phase<24000?32767:-32767;break;
    case 'saw':wave=Math.trunc(65534*phase/AUDIO2D_RATE)-32767;break;
    case 'triangle':wave=phase<12000?Math.trunc(32767*phase/12000):
      phase<36000?32767-Math.trunc(65534*(phase-12000)/24000):
      -32767+Math.trunc(32767*(phase-36000)/12000);break;
    case 'noise':wave=noiseAt(event.seed,local);break;
  }
  // Integer linear envelope; quantization and clipping are normative.
  const gain=Math.trunc(event.gain*(event.duration-local)/event.duration);
  return Math.trunc(wave*gain/32767);
}
function eventList(events,frames){
  if(!Array.isArray(events)||events.length>MAX_EVENTS)
    throw new RangeError('events must be a bounded array');
  const slots=Array(4).fill(0),ids=new Set();
  return events.map((source,index)=>{
    if(!source||typeof source!=='object'||Array.isArray(source))
      throw new TypeError('invalid sound event');
    const id=number(source.id,'event id',1,65535);
    if(ids.has(id))throw new RangeError('duplicate sound event ID');
    ids.add(id);
    const sample=number(source.sample,'sample',0,frames-1),
      duration=number(source.duration,'duration',1,frames-sample),
      channel=number(source.channel,'channel',0,3),
      frequency=number(source.frequency,'frequency',30,8000),
      gain=number(source.gain??6000,'gain',0,12000),
      seed=number(source.seed??0,'seed',0,4294967295);
    if(!WAVEFORMS.includes(source.wave))
      throw new RangeError('unsupported waveform');
    return Object.freeze({id,sample,duration,channel,frequency,gain,seed,
      wave:source.wave});
  }).sort((a,b)=>a.sample-b.sample||a.channel-b.channel||a.id-b.id)
    .map(event=>{
      if(slots[event.channel]>event.sample)
        throw new RangeError('overlapping events on same sound channel');
      slots[event.channel]=event.sample+event.duration;return event;
    });
}
export function createSound2D({frames=AUDIO2D_RATE,events=[]}={}){
  number(frames,'frames',1,LIMIT);
  const score=eventList(events,frames);
  return Object.freeze({
    frames,sampleRate:AUDIO2D_RATE,eventCount:score.length,
    eventSummary:()=>score.map(e=>({...e})),
    renderRange(start,count){
      number(start,'start',0,frames);
      number(count,'count',0,frames-start);
      const out=new Int16Array(count);
      const active=score.filter(e=>e.sample<start+count&&e.sample+e.duration>start);
      for(let i=0;i<count;i++){
        let mixed=0;
        const n=start+i;
        for(const e of active)mixed+=sampleAt(e,n);
        out[i]=Math.max(-32768,Math.min(32767,mixed));
      }
      return out;
    },
    renderAll(){return this.renderRange(0,frames);},
    wav(){
      const pcm=this.renderRange(0,frames),buf=new ArrayBuffer(44+pcm.length*2);
      const view=new DataView(buf);
      function ascii(offset,s){for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));}
      ascii(0,'RIFF');view.setUint32(4,36+pcm.length*2,true);
      ascii(8,'WAVE');ascii(12,'fmt ');
      view.setUint32(16,16,true);view.setUint16(20,1,true); // PCM
      view.setUint16(22,1,true);view.setUint32(24,AUDIO2D_RATE,true);
      view.setUint32(28,AUDIO2D_RATE*2,true);
      view.setUint16(32,2,true);view.setUint16(34,16,true);
      ascii(36,'data');view.setUint32(40,pcm.length*2,true);
      for(let i=0;i<pcm.length;i++)view.setInt16(44+2*i,pcm[i],true);
      return new Uint8Array(buf);
    }
  });
}
