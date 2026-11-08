/* Original chip arrangements and synthesized effects; no recordings. SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const midi=n=>440*Math.pow(2,(n-69)/12);
  // Original 32-step phrases. Zero is a rest, not a sustained note.
  const SONGS={
    iron:{step:.135,bass:[40,40,0,40,43,40,47,0,38,38,0,38,45,38,43,0,36,36,0,36,43,36,48,0,38,38,45,38,47,45,43,38],lead:[0,64,0,67,0,71,69,67,0,62,0,66,0,69,67,66,0,60,0,64,0,67,72,71,69,0,67,66,64,0,62,0]},
    ninja:{step:.15,bass:[38,0,38,0,45,0,38,0,41,0,41,0,48,0,41,0,43,0,43,0,50,0,43,0,45,0,45,0,52,50,48,45],lead:[74,0,77,81,0,77,74,0,72,0,69,72,77,0,74,0,79,0,81,84,81,0,79,77,74,0,72,69,72,0,74,0]},
    heist:{step:.23,bass:[40,0,0,0,0,0,47,0,0,0,0,0,38,0,0,0,40,0,0,0,0,0,43,0,0,0,0,0,47,0,0,0],lead:[0,0,0,0,76,0,0,0,0,0,0,0,0,0,74,0,0,0,0,0,79,0,0,0,0,0,0,0,0,0,78,0]}
  };
  // Six short, original arrangements; Void stays sparse and percussion-free.
  for(const [id,root,step,pattern] of [
    ['hockey',45,.14,[0,7,12,10,7,3,5,7]],
    ['brawl',38,.16,[0,0,3,5,0,7,5,3]],
    ['chrono',48,.13,[0,4,7,12,9,7,4,2]],
    ['breaker',50,.15,[0,7,9,14,12,9,7,4]],
    ['void',36,.32,[0,7,0,10,0,5,0,7]],
    ['kestrel',43,.12,[0,3,7,10,12,10,7,5]]
  ]){
    SONGS[id]={step,bass:Array.from({length:32},(_,i)=>i%4===0?root+pattern[Math.floor(i/4)]:0),lead:Array.from({length:32},(_,i)=>i%(id==='void'?8:2)===0?root+24+pattern[Math.floor(i/4)]:0)};
  }
  // Deterministic effects bank rendered with QSOLKCB/VANILLAJS audio2d (js/vanilla2d.js): integer,
  // sample-indexed 48 kHz PCM16 scores on four non-overlapping lanes. Each is rendered once on first
  // use, then replayed from an AudioBuffer through the same bounded voice pool and effects bus.
  const RATE=48000,ms=n=>Math.round(n*RATE/1000);
  function score(build){let id=1;const events=[];const at=(lane,start,dur,frequency,wave='square',gain=6000,seed=0)=>{events.push({id:id++,sample:ms(start),duration:ms(dur),channel:lane,frequency:Math.round(frequency),wave,gain,seed});};
    const run=(lane,start,notes,dur,wave,gain)=>notes.forEach((f,i)=>at(lane,start+i*dur,dur,f,wave,gain));
    const frames=build(at,run);return{frames:ms(frames),events};}
  const sweep=(f0,f1,steps)=>Array.from({length:steps},(_,i)=>f0*Math.pow(f1/f0,i/(steps-1)));
  const SFX2D={
    boom:score((at,run)=>{at(3,0,520,90,'noise',9500,7);run(0,0,sweep(150,38,8),45,'square',5200);at(1,0,420,55,'triangle',7000);return 540;}),
    hit:score((at)=>{at(0,0,28,240,'square',4200);at(0,28,40,120,'square',3600);at(3,0,60,90,'noise',4200,3);return 70;}),
    pickup:score((at,run)=>{run(0,0,[660,880,1320],50,'triangle',7000);at(1,100,90,1320,'square',1800);return 200;}),
    bank:score((at,run)=>{run(0,0,[523,659,784,1046],70,'triangle',7000);at(1,210,160,1046,'square',1600);return 380;}),
    win:score((at,run)=>{run(0,0,[523,659,784,1046,1318],110,'triangle',7500);run(1,0,[262,330,392,523,659],110,'square',1800);return 600;}),
    alert:score((at,run)=>{run(0,0,[740,988,740,988],70,'square',3600);return 290;}),
    bomb:score((at,run)=>{at(3,0,950,70,'noise',11000,11);run(0,0,sweep(220,36,12),70,'saw',5200);at(1,0,900,48,'triangle',8000);run(2,120,sweep(900,120,8),80,'square',1800);return 960;}),
    power:score((at,run)=>{run(0,0,sweep(330,1320,8),35,'triangle',7000);at(1,280,120,1320,'square',2200);return 410;}),
    medal:score((at)=>{at(0,0,60,1568,'square',3200);at(0,60,140,2093,'square',3000);at(1,0,200,784,'triangle',2600);return 210;}),
    loop:score((at,run)=>{run(0,0,sweep(260,900,6),40,'triangle',5200);run(0,240,sweep(900,300,6),40,'triangle',4200);at(3,0,480,60,'noise',1800,5);return 490;}),
    key:score((at)=>{at(0,0,18,1760,'square',2600);at(1,0,30,880,'triangle',2000);return 35;}),
    order:score((at,run)=>{run(0,0,[988,1319],45,'square',3000);return 95;})
  };
  const PCM=new Map(),data=name=>SFX2D[name].frames/RATE;
  function pcm(name){if(!PCM.has(name)){const def=SFX2D[name];PCM.set(name,A.V2D.createSound2D(def).renderAll());}return PCM.get(name);}
  A.Audio=class{
    static get SFX2D(){return SFX2D;}
    static pcm(name){return pcm(name);}
    constructor(){this.enabled=false;this.ctx=null;this.beat=0;this.timer=0;this.voices=0;this.track='';this.active=new Set();this.musicLevel=.55;this.fxLevel=.8;}
    unlock(){
      if(!this.enabled)return;
      try{
        if(!this.ctx){
          const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
          this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.3;this.master.connect(this.ctx.destination);
          this.music=this.ctx.createGain();this.fx=this.ctx.createGain();this.music.connect(this.master);this.fx.connect(this.master);this.setLevels(this.musicLevel,this.fxLevel);
          this.noiseBuffer=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);
          const data=this.noiseBuffer.getChannelData(0),rand=A.rng(14591);for(let i=0;i<data.length;i++)data[i]=rand()*2-1;
        }
        if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
      }catch(_){if(this.ctx?.close)this.ctx.close().catch(()=>{});this.ctx=null;}
    }
    setEnabled(value){this.enabled=value;if(value)this.unlock();else this.suspend();}
    setLevels(music,fx){this.musicLevel=A.clamp(Number.isFinite(music)?music:.55,0,1);this.fxLevel=A.clamp(Number.isFinite(fx)?fx:.8,0,1);if(this.music)this.music.gain.value=this.musicLevel;if(this.fx)this.fx.gain.value=this.fxLevel;}
    setTrack(id){this.silence();this.track=id;this.beat=0;this.timer=0;}
    silence(){for(const source of [...this.active]){try{source.stop();}catch(_){}source.onended();}}
    suspend(){this.silence();if(this.ctx)this.ctx.suspend().catch(()=>{});}
    ready(bus){return this.enabled&&this.ctx?.state==='running'&&this.voices<32&&(bus==='music'?this.musicLevel:this.fxLevel)>0;}
    voice(source,duration,volume,bus){
      const t=this.ctx.currentTime,g=this.ctx.createGain();this.voices++;this.active.add(source);
      g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume,t+.004);g.gain.exponentialRampToValueAtTime(.001,t+Math.max(.01,duration));
      source.connect(g);g.connect(bus==='music'?this.music:this.fx);source.onended=()=>{if(!this.active.delete(source))return;source.disconnect();g.disconnect();this.voices=Math.max(0,this.voices-1);};source.start(t);source.stop(t+duration+.015);
    }
    tone(freq,duration,type='square',volume=.1,end=freq,bus='fx'){
      if(!this.ready(bus))return;const t=this.ctx.currentTime,o=this.ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);this.voice(o,duration,volume,bus);
    }
    noise(duration,volume,rate=1,bus='fx'){
      if(!this.ready(bus))return;const n=this.ctx.createBufferSource();n.buffer=this.noiseBuffer;n.playbackRate.value=rate;this.voice(n,duration,volume,bus);
    }
    // PCM effects from the audio2d bank. Returns true when this name is served by the bank.
    sample(name,volume=.9){
      if(!SFX2D[name]||!A.V2D)return false;if(!this.ready('fx'))return true;
      try{
        this.buffers??=new Map();
        if(!this.buffers.has(name)){const data=pcm(name),buffer=this.ctx.createBuffer(1,data.length,RATE),out=buffer.getChannelData(0);for(let i=0;i<data.length;i++)out[i]=data[i]/32768;this.buffers.set(name,buffer);}
        const source=this.ctx.createBufferSource();source.buffer=this.buffers.get(name);this.voice(source,data(name),volume,'fx');
      }catch(_){/* Audio is optional. */}
      return true;
    }
    effect(name){
      if(this.sample(name))return;
      const sounds={fire:[200,.07,'square',.15,55],carbine:[290,.05,'square',.11,90],scatter:[105,.15,'sawtooth',.22,32],rocket:[180,.23,'sawtooth',.19,40],star:[1050,.09,'triangle',.2,380],slash:[600,.09,'triangle',.15,100],hit:[150,.075,'square',.14,38],hurt:[130,.24,'sawtooth',.15,35],boom:[85,.48,'triangle',.65,22],pickup:[660,.18,'sine',.24,1320],jump:[260,.16,'triangle',.18,540],land:[78,.07,'triangle',.1,40],win:[440,.65,'triangle',.28,880],lose:[230,.8,'triangle',.3,55],select:[510,.08,'sine',.22,730],magic:[170,.65,'sawtooth',.14,1360],heistShot:[380,.07,'square',.15,80],empty:[80,.035,'square',.11,60],alert:[740,.28,'square',.06,980],lift:[150,.35,'triangle',.13,460],bank:[520,.35,'triangle',.3,1040],safe:[392,.5,'triangle',.25,1568]};
      if(sounds[name])this.tone(...sounds[name]);
      if(['fire','carbine','scatter','rocket','hit','slash'].includes(name))this.noise(name==='scatter'?.13:.045,name==='scatter'?.22:.09,1.7);
      if(name==='boom')this.noise(.5,.35,.45);
      if(name==='magic'){this.noise(.35,.12,.7);this.tone(510,.5,'sine',.18,2040);}
      if(['win','safe','bank'].includes(name))this.tone(660,.5,'sine',.12,1320);
    }
    tick(dt,id){
      if(this.track!==id)this.setTrack(id);this.timer-=dt;if(this.timer>0)return;
      const s=SONGS[id]||SONGS.iron;this.timer+=s.step;if(this.timer<0)this.timer=s.step;
      const step=this.beat%32,b=s.bass[step],n=s.lead[step];
      if(b)this.tone(midi(b),s.step*1.3,'triangle',['heist','void'].includes(id)?.13:.24,midi(b),'music');
      if(n)this.tone(midi(n),s.step*.8,id==='ninja'?'triangle':'square',['heist','void'].includes(id)?.035:.055,midi(n),'music');
      if(!['heist','void'].includes(id)){
        if(step%8===0||step%8===3)this.tone(110,.14,'sine',.42,35,'music');
        if(step%8===4){this.noise(.09,.14,1.4,'music');this.tone(180,.07,'triangle',.1,80,'music');}
        if(step%2===0)this.noise(.025,.035,2,'music');
        if(this.beat>=32&&step%4===2)this.tone(midi((b||s.bass[step-2])+24),.09,'sine',.045,undefined,'music');
      }
      this.beat++;
    }
  };
})(globalThis.Arcade);
