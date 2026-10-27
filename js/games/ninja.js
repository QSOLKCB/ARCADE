/* Neon Ronin — original belt-scrolling action game. SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  const D=A.Draw;
  const STAGES=[{name:'LANTERN DISTRICT',title:'A city under borrowed light.',boss:'THE LANTERN WARDEN',sky:['#362b44','#9f6c70','#9f6c70','#edc28b']},{name:'RAIL YARD',title:'Follow the midnight freight.',boss:'IRON JACKAL',sky:['#182d43','#4e6978','#4e6978','#b0cec1']},{name:'OBSIDIAN ROOFTOP',title:'Put the night back in its place.',boss:'THE GLASS REGENT',sky:['#2c3045','#626784','#626784','#f1d6b3']}];
  A.Ninja=class extends A.Game{
    constructor(options,sound){super(options,sound);this.id='ninja';this.stage=0;this.combo=0;this.comboTime=0;this.setup();}
    setup(){
      this.cam=0;this.wave=0;this.gates=[465,965,1465,1940];this.bullets=[];this.pickups=[];this.enemies=[];this.particles.items=[];this.effects.items=[];this.defeated=[];this.rand=A.rng(9100+this.stage);
      this.players=Array.from({length:this.options.players},(_,i)=>({x:65+i*44,y:212+i*18,hp:this.relaxed?180:120,maxHP:this.relaxed?180:120,inv:1,face:1,walk:0,z:0,vz:0,cd:0,attack:0,energy:100,power:0,staff:0,revive:0}));this.spawnWave();
    }
    menu(){return{eyebrow:'CHAPTER '+(this.stage+1)+' / 3 · '+STAGES[this.stage].name,title:this.state==='stageclear'?'District liberated. Keep moving.':STAGES[this.stage].title,description:this.state==='stageclear'?'The next district is waiting. Your team returns with full health and energy.':'Break the night syndicate across three districts. Throw stars at range, strike up close, jump over attacks, and release a storm when surrounded.',details:'WASD / arrows move along the street · J attack · Space jump · K storm (60 energy) · hold E to revive a partner. Collect staffs, fire stars and food. Clear each wave to advance.',button:this.state==='stageclear'?'Enter the next district':'Enter the district',action:'start'};}
    action(id){if(id!=='start')return;if(this.state==='stageclear'){this.stage++;this.setup();this.state='playing';this.say(STAGES[this.stage].name);}else if(this.state==='briefing'){this.state='playing';this.say('J ATTACK · SPACE JUMP · K STORM · CLEAR AND MOVE RIGHT',5);}}
    spawnWave(){
      const base=this.wave*500;
      if(this.wave===3){this.enemies.push({x:base+270,y:210,hp:650+this.stage*150,maxHP:650+this.stage*150,kind:'boss',cd:1.2,windup:0,face:-1,walk:0,attack:0,hurt:0});for(let i=0;i<2;i++)this.addEnemy(base+180+i*130,190+i*40,'thrower');this.say(STAGES[this.stage].boss,4);}
      else{const n=4+this.stage+Math.floor(this.options.players/2);for(let i=0;i<n;i++)this.addEnemy(base+215+i*38,182+(i*23)%63,i%3===2?'thrower':i%3===1?'brute':'runner');if(this.wave)this.say('BLOCK '+(this.wave+1)+' · KEEP YOUR GUARD UP');}
      this.pickups.push({x:base+270,y:241,kind:this.wave%2?'staff':'power',taken:false});this.pickups.push({x:base+420,y:201,kind:'health',taken:false});
    }
    addEnemy(x,y,kind){const hp=kind==='brute'?110:60;this.enemies.push({x,y,hp,maxHP:hp,kind,cd:.8+this.rand(),windup:0,face:-1,walk:0,attack:0,hurt:0});}
    damage(e,amount,face){
      if(e.hp<=0)return;e.hp-=amount;e.hurt=.12;e.x=A.clamp(e.x+face*5,20,1980);this.particles.burst(e.x,e.y-15,'#f5cc94',7,60);this.sound('hit');
      if(e.hp<=0){this.defeated.push({...e,hp:1,life:.45});this.effects.add('ring',e.x,e.y-15,'#f8d4af',24,.3);this.combo++;this.comboTime=3;this.score+=(e.kind==='boss'?3000:150)*Math.min(5,1+Math.floor(this.combo/4));for(const p of this.players)p.energy=Math.min(100,p.energy+5);if(this.rand()<.2)this.pickups.push({x:e.x,y:e.y,kind:'health',taken:false});}
    }
    attack(p){
      p.cd=p.staff>0?.3:.22;p.attack=.15;
      const reach=p.staff>0?65:p.z>8?58:39;
      const targets=this.enemies.filter(e=>e.hp>0&&Math.abs(e.y-p.y)<19&&Math.abs(e.x-p.x)<reach&&(e.x-p.x)*p.face>-8);
      this.effects.add('slash',p.x+p.face*13,p.y-p.z-16,p.staff>0?'#ffdb93':'#c8f2e8',p.staff>0?42:26,.18,p.face);
      if(targets.length){this.sound('slash');for(const e of targets)this.damage(e,p.staff>0?65:p.z>8?48:35,p.face);this.sound('hit');}
      else{this.bullets.push({x:p.x+p.face*14,y:p.y,z:15,vx:p.face*(p.power>0?280:235),life:1.8,damage:p.power>0?34:22,enemy:false,power:p.power>0});this.sound('star');}
    }
    enemyStrike(e,p){
      const direction=p.x>=e.x?1:-1;
      if(e.kind==='boss'){
        const type=this.stage%3;
        for(let i=-1;i<=1;i++)this.bullets.push({x:e.x,y:A.clamp(p.y+i*22,178,246),z:type===1?6:15,vx:direction*(type===2?150:115),life:4,damage:this.relaxed?12:22,enemy:true});
        if(A.dist(e,p)<65)this.hitPlayer(p,this.relaxed?12:24);this.particles.burst(e.x,e.y-18,'#f3ab8d',18);this.sound('boom');
      }else if(e.kind==='thrower')this.bullets.push({x:e.x+direction*12,y:e.y,z:15,vx:direction*135,life:3,damage:this.relaxed?8:15,enemy:true});
      else if(Math.abs(p.x-e.x)<34&&Math.abs(p.y-e.y)<19)this.hitPlayer(p,this.relaxed?8:16);
      e.cd=(e.kind==='boss'?1.8:e.kind==='thrower'?1.7:1.25)*(this.relaxed?1.35:1);e.attack=.18;
    }
    update(dt,inputs){
      if(this.state!=='playing')return;this.common(dt);for(const d of this.defeated)d.life-=dt;this.defeated=this.defeated.filter(d=>d.life>0);this.comboTime-=dt;if(this.comboTime<=0)this.combo=0;
      for(let i=0;i<this.players.length;i++){
        const p=this.players[i],a=inputs[i]||A.emptyInput();if(p.hp<=0)continue;
        p.inv=Math.max(0,p.inv-dt);p.cd-=dt;p.attack-=dt;p.power=Math.max(0,p.power-dt);p.staff=Math.max(0,p.staff-dt);p.energy=Math.min(100,p.energy+dt*4);
        if(a.x){p.face=Math.sign(a.x);p.walk+=dt;}if(a.y)p.walk+=dt;
        p.x=A.clamp(p.x+a.x*101*dt,this.cam+16,this.gates[this.wave]);p.y=A.clamp(p.y+a.y*72*dt,178,246);
        const previousZ=p.z;
        if(a.jumpPressed&&p.z===0){p.vz=260;this.sound('jump');}p.z=Math.max(0,p.z+p.vz*dt);p.vz-=760*dt;if(p.z===0){p.vz=0;if(previousZ>0){this.particles.burst(p.x,p.y,'#bea4ab',6,35,{life:.2,size:2});this.sound('land');}}
        if(a.fire&&p.cd<=0)this.attack(p);
        if(a.specialPressed&&p.energy>=60){p.energy-=60;p.inv=Math.max(p.inv,1);this.shake=.2;this.effects.add('storm',p.x,p.y-20,'#b3f9e5',220,.65);for(const e of this.enemies)if(e.hp>0&&Math.abs(e.x-p.x)<310)this.damage(e,95,p.face);for(const b of this.bullets)if(b.enemy)b.life=0;this.particles.burst(p.x,p.y-20,'#a7f2de',90,220);this.sound('magic');this.say('TEMPEST ART');}
        const down=this.players.find(q=>q!==p&&q.hp<=0&&A.dist(p,q)<32);
        if(down&&a.interact){down.revive+=dt;if(down.revive>1.2){down.hp=60;down.inv=2;down.revive=0;this.say('PARTNER REVIVED');}}
        for(const q of this.pickups)if(!q.taken&&A.dist(p,q)<20){q.taken=true;this.effects.add('ring',q.x,q.y-6,'#f6dfab',20,.4);if(q.kind==='health')p.hp=Math.min(p.maxHP,p.hp+35);if(q.kind==='staff')p.staff=18;if(q.kind==='power')p.power=20;this.sound('pickup');this.say(q.kind==='staff'?'STAFF · EXTENDED MELEE RANGE':q.kind==='power'?'EMBER STARS · POWER UP':'HEALTH RESTORED');}
      }
      const living=this.players.filter(p=>p.hp>0);if(!living.length){this.finish(false);return;}
      const desired=A.clamp(Math.min(...living.map(p=>p.x))-165,0,1520);this.cam+=(desired-this.cam)*Math.min(1,dt*7);for(const p of living)p.x=Math.min(p.x,this.cam+460);
      for(const e of this.enemies){
        if(e.hp<=0)continue;e.cd-=dt;e.attack-=dt;e.hurt-=dt;const p=living.reduce((best,q)=>A.dist(q,e)<A.dist(best,e)?q:best,living[0]);e.face=p.x>=e.x?1:-1;const dx=p.x-e.x,dy=p.y-e.y;
        if(e.windup>0){e.windup-=dt;if(e.windup<=0)this.enemyStrike(e,p);continue;}
        if(e.hurt>0)continue;
        const reach=e.kind==='thrower'?155:e.kind==='boss'?110:26;
        if(Math.abs(dx)>reach || Math.abs(dy)>10){const speed=e.kind==='boss'?23:e.kind==='brute'?31:47;e.x+=Math.sign(dx)*Math.max(0,Math.abs(dx)-reach)*Math.min(1,dt*speed/40);e.y=A.clamp(e.y+Math.sign(dy)*Math.min(Math.abs(dy),30*dt),178,246);e.walk+=dt;}
        if(Math.abs(dx)<reach+10&&Math.abs(dy)<15&&e.cd<=0)e.windup=e.kind==='boss'?.85:.45;
      }
      for(const b of this.bullets){if(b.life<=0)continue;b.x+=b.vx*dt;b.life-=dt;if(b.enemy){for(const p of living)if(Math.abs(p.x-b.x)<11&&Math.abs(p.y-b.y)<11&&p.z<18){this.hitPlayer(p,b.damage);b.life=0;break;}}else{for(const e of this.enemies)if(e.hp>0&&Math.abs(e.x-b.x)<(e.kind==='boss'?20:11)&&Math.abs(e.y-b.y)<13){this.damage(e,b.damage,Math.sign(b.vx));b.life=0;break;}}}
      this.bullets=this.bullets.filter(b=>b.life>0&&b.x>this.cam-100&&b.x<this.cam+650).slice(-150);this.pickups=this.pickups.filter(q=>!q.taken);
      if(this.players.every(p=>p.hp<=0)){this.finish(false);return;}
      if(this.enemies.every(e=>e.hp<=0)){
        if(this.wave===3){this.score+=4000;if(this.stage===2)this.finish(true);else{this.state='stageclear';this.sound('win');}}
        else if(living.some(p=>p.hp>0&&p.x>this.gates[this.wave]-65)){this.wave++;this.enemies=[];this.spawnWave();}
      }
    }
    status(){const p=this.players[0];return STAGES[this.stage].name+' · Block '+(this.wave+1)+'/4 · Health '+Math.ceil(p.hp)+' · Storm '+Math.floor(p.energy)+'/100'+(p.staff>0?' · Staff':p.power>0?' · Ember stars':'')+' · Score '+this.score;}
    render(c){
      const stage=STAGES[this.stage];D.city(c,this.cam,stage.sky,this.stage);D.rect(c,0,165,480,105,'#49465a');D.rect(c,0,165,480,8,'#a78584');for(let i=0;i<9;i++){c.globalAlpha=.08;D.rect(c,(i*73-this.cam*.6)%480,181+(i*13)%70,30,3,stage.sky[3]);}c.globalAlpha=1;
      for(let y=184;y<270;y+=24){D.rect(c,0,y,480,1,'#b3948a50');for(let x=-(this.cam%56);x<480;x+=56)D.rect(c,x+(y%48?20:0),y,1,24,'#b3948a38');}
      c.save();c.translate(-Math.round(this.cam),0);
      for(let x=0;x<2100;x+=160){
        if(x<this.cam-180||x>this.cam+500)continue;
        if(this.stage===0){D.rect(c,x+12,85,8,92,'#392d42');D.rect(c,x+126,85,8,92,'#392d42');D.rect(c,x,84,146,8,'#483047');D.rect(c,x+8,78,130,6,'#d3a089');c.save();c.globalAlpha=.09;for(let n=3;n>0;n--)D.rect(c,x+62-n*7,102-n*7,23+n*14,23+n*14,'#ffc98a');c.restore();D.rect(c,x+62,102,23,23,'#f0ba7a');D.rect(c,x+65,106,3,15,'#ffe1a1');D.rect(c,x+71,93,5,10,'#765258');D.rect(c,x+67,110,12,2,'#995f60');}
        else if(this.stage===1){D.rect(c,x+10,110,128,55,'#294754');D.rect(c,x+15,114,118,3,'#9eb7ab');for(let xx=22;xx<128;xx+=18)D.rect(c,x+xx,120,3,40,'#4e727a');D.text(c,'NIGHT FREIGHT',x+75,130,'#c0b89b',8,'center');}
        else{D.rect(c,x+15,130,125,34,'#394d62');D.rect(c,x+10,127,135,5,'#a4a4a8');for(let xx=25;xx<133;xx+=22)D.rect(c,x+xx,135,5,24,'#657b8b');D.rect(c,x+75,50,5,77,'#3c4058');D.rect(c,x+58,58,40,45,'#819b9a');D.text(c,'夜',x+77,74,'#f8dcc2',15,'center');}
      }
      for(const q of this.pickups){D.shadow(c,q.x,q.y,8);if(q.kind==='health'){D.rect(c,q.x-6,q.y-9,12,9,'#eccb97');D.rect(c,q.x-4,q.y-8,8,2,'#fff0c0');}else if(q.kind==='staff'){D.rect(c,q.x-16,q.y-5,32,3,'#d9c491');D.rect(c,q.x-2,q.y-6,4,5,'#cf9a7b');}else D.star(c,q.x,q.y-6,this.time,'#ffbd7b');}
      for(const d of this.defeated){c.save();c.globalAlpha=d.life/.45;c.translate(d.x,d.y);c.rotate((.45-d.life)*d.face*2);D.person(c,{...d,x:0,y:0,hurt:0},'ninja','#bd8f9f',d.kind==='boss'?1.9:1);c.restore();}
      const actors=[...this.enemies.filter(e=>e.hp>0),...this.players].sort((a,b)=>a.y-b.y);
      for(const p of actors){
        const enemy=this.enemies.includes(p);if(!enemy&&p.hp<=0){D.text(c,'HOLD E / H',p.x,p.y-10,'#f3d69b',7,'center');continue;}
        if(enemy&&p.windup>0){D.rect(c,p.x-17,p.y+3,34,3,'#f5be79');D.text(c,'!',p.x,p.y-(p.kind==='boss'?61:34),'#ffd6a1',14,'center');}
        const scale=enemy&&p.kind==='boss'?1.9:enemy&&p.kind==='brute'?1.2:1;
        const color=enemy?(p.kind==='boss'?'#d6a292':p.kind==='thrower'?'#bda6d3':'#b57e91'):(this.players.indexOf(p)?'#e5c189':'#92d1cc');
        D.person(c,p,'ninja',color,scale);
        if(!enemy){D.text(c,'P'+(this.players.indexOf(p)+1),p.x,p.y+6,'#f1e7c5',6,'center');if(p.staff>0)D.rect(c,p.x+(p.face===1?5:-39),p.y-p.z-16,34,3,'#dfca9b');}
        if(enemy&&p.kind==='boss'){D.bar(c,p.x-32,p.y-64,64,p.hp,p.maxHP,'#f4b38f');}
      }
      for(const b of this.bullets){for(let i=3;i>0;i--){c.globalAlpha=.1*(4-i);D.rect(c,b.x-Math.sign(b.vx)*i*5,b.y-b.z-1,3,2,b.enemy?'#f59b8e':b.power?'#ffbc7a':'#b5e5de');}c.globalAlpha=1;D.star(c,b.x,b.y-b.z,this.time*15,b.enemy?'#f59b8e':b.power?'#ffc482':'#c1f0e1');}
      this.effects.draw(c);this.particles.draw(c);c.restore();
      c.save();for(let i=0;i<18;i++){const x=(i*79+this.time*12-this.cam*.15)%480,y=(i*39+this.time*(this.stage===2?80:13))%270;c.globalAlpha=.25;D.rect(c,x,y,this.stage===0?3:1,this.stage===2?7:2,this.stage===0?'#f7be95':'#b8d4db');}c.restore();
      this.players.forEach((p,i)=>{D.rect(c,8+i*117,29,110,31,'#101b2cdd');D.text(c,'P'+(i+1)+'  '+Math.ceil(p.hp)+' / '+p.maxHP,13+i*117,33,i?'#e8c48f':'#ade7dc',7);D.bar(c,13+i*117,44,100,p.hp,p.maxHP,i?'#e0bc87':'#8dccc2');D.bar(c,13+i*117,52,100,p.energy,100,'#b6a3db');});
      D.hud(c,this,'NEON RONIN / '+(this.stage+1),'BLOCK '+(this.wave+1)+'/4  '+String(this.score).padStart(6,'0'));
      const boss=this.enemies.find(e=>e.kind==='boss'&&e.hp>0);if(boss){D.rect(c,139,65,202,21,'#15182cdd');D.text(c,STAGES[this.stage].boss,240,69,'#f4c4ae',7,'center');D.bar(c,146,79,188,boss.hp,boss.maxHP,'#d999a1');}
      if(this.combo>1){D.text(c,this.combo+' CHAIN',465,36,'#ffdb9e',11,'right');D.bar(c,406,51,58,Math.max(0,this.comboTime),3,'#ffdb9e');}
      if(this.enemies.every(e=>e.hp<=0)&&this.wave<3){D.text(c,'GO →',452,105,'#ffe0a2',14,'right');}
      if(this.messageTime<=0)D.text(c,STAGES[this.stage].name,240,255,'#ead4b9',7,'center');
    }
  };
  A.Ninja.STAGES=STAGES;
})(globalThis.Arcade);
