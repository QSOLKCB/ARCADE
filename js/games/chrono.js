/* Original free-flight time-hopping shooter. SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  const D=A.Draw,TAU=Math.PI*2;
  const ERAS=[
    {name:'CANVAS DAWN',year:'1898',sky:'#638f99',ground:'#94b3af',enemy:'#dab483',boss:'THE BRASS WHALE'},
    {name:'RADIO STORM',year:'1936',sky:'#6c8294',ground:'#a8b4b5',enemy:'#c9be8c',boss:'THE IRON ORCHARD'},
    {name:'AFTERBURN',year:'1974',sky:'#5c6889',ground:'#969bb5',enemy:'#e5a59a',boss:'THE THUNDER ENGINE'},
    {name:'GLASS HORIZON',year:'2048',sky:'#293d62',ground:'#536787',enemy:'#b3c8dd',boss:'THE PRISM CARRIER'},
    {name:'LAST TOMORROW',year:'2208',sky:'#10172d',ground:'#33425c',enemy:'#c3a2de',boss:'THE PARALLAX CORE'}
  ];
  const turn=(angle,target,amount)=>angle+A.clamp(Math.atan2(Math.sin(target-angle),Math.cos(target-angle)),-amount,amount);
  function plane(c,x,y,angle,color,era,boss=false){
    c.save();c.translate(x,y);c.rotate(angle+Math.PI/2);if(boss)c.scale(2.5,2.5);
    if(era===4){c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.ellipse(0,0,13,7,0,0,TAU);c.stroke();D.rect(c,-5,-4,10,8,'#e3d7f0');}
    else{
      D.rect(c,-3,-13,6,26,color);D.rect(c,-15,era===0?-5:0,30,5,color);D.rect(c,-8,9,16,4,color);
      if(era===0){D.rect(c,-14,3,28,4,color);D.rect(c,-12,-5,2,11,'#445363');D.rect(c,10,-5,2,11,'#445363');}
      if(era>=2){D.rect(c,-9,5,4,10,color);D.rect(c,5,5,4,10,color);D.rect(c,-2,12,4,6,'#f5ba83');}
      D.rect(c,-2,-6,4,6,'#1d3c53');D.rect(c,-1,-12,2,4,'#f4e6c9');
    }c.restore();
  }
  A.Chrono=class extends A.Game{
    constructor(options,sound){super(options,sound);this.id='chrono';this.options.players=1;this.stage=0;this.lives=this.relaxed?5:3;this.rescues=0;this.nextLife=12000;this.rand=A.rng(19820);this.setup();}
    setup(){this.player={x:0,y:0,angle:-Math.PI/2,inv:2,cd:0,roll:0,rollCD:0,armour:this.relaxed?2:1};this.enemies=[];this.bullets=[];this.pods=[];this.kills=0;this.target=12+this.stage*2;this.bossSpawned=false;this.spawn=.2;this.rescueTimer=5;this.particles.items=[];this.effects.items=[];this.flash=0;}
    menu(){const e=ERAS[this.stage];return{eyebrow:'CHRONO WING · '+e.year+' / '+e.name,title:this.state==='stageclear'?'Another sky is calling.':'Outfly history. Rescue the future.',description:'Fly through five skies, rescue stranded couriers and bring down each era’s flagship. Your craft keeps moving. Defeat the patrol quota to draw out the flagship.',details:'WASD / arrows steer in any direction · hold J / A to fire · K / B evasive roll (recharges) · collect parachutes for points and a repair to your roll cooldown. One replacement craft at each rift; extra life every 12,000 points. Relaxed craft absorb one extra hit.',button:this.state==='stageclear'?'Cross the time rift':'Launch',action:'start'};}
    action(id){if(id!=='start')return;if(this.state==='stageclear'){this.stage++;this.setup();this.state='playing';}else if(this.state==='briefing')this.state='playing';}
    addEnemy(boss=false){
      const p=this.player,a=this.rand()*TAU,r=boss?205:260,hp=boss?190+this.stage*65:20+this.stage*3;
      this.enemies.push({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r,angle:a+Math.PI,hp,maxHP:hp,boss,cd:boss?1.2:1+this.rand()*2,turn:(this.rand()-.5)*.6});
      if(boss){this.bossSpawned=true;this.say(ERAS[this.stage].boss+' APPROACHES',3);this.sound('alert');}
    }
    damage(e,amount){
      if(this.state!=='playing'||e.hp<=0)return;e.hp-=amount;this.sound('hit');
      if(e.hp<=0){this.score+=e.boss?2500:150;this.particles.burst(e.x,e.y,ERAS[this.stage].enemy,e.boss?55:16,e.boss?140:70);this.effects.add('blast',e.x,e.y,'#ffd0a0',e.boss?65:22,.5);this.sound('boom');
        if(e.boss){this.score+=this.rescues*100;if(this.stage<4)this.lives=Math.min(7,this.lives+1);if(this.stage===4)this.finish(true);else this.state='stageclear';}
        else this.kills++;
      }
    }
    hit(){
      const p=this.player;if(p.inv>0||p.roll>0)return;
      if(p.armour>1){p.armour--;p.inv=1.8;this.flash=.12;this.sound('hurt');this.say('ARMOUR LOST · NEXT HIT COSTS A CRAFT',2);return;}
      this.lives--;p.armour=this.relaxed?2:1;p.inv=2.5;this.flash=.2;this.shake=.2;
      this.bullets=this.bullets.filter(b=>!b.enemy);this.sound('hurt');this.particles.burst(p.x,p.y,'#e9dbc4',30,100);
      if(this.lives<=0)this.finish(false);else this.say('HULL LOST · '+this.lives+' CRAFT REMAIN',2);
    }
    update(dt,inputs){
      if(this.state!=='playing')return;this.common(dt);const p=this.player,a=inputs[0]||A.emptyInput();
      p.inv-=dt;p.cd-=dt;p.roll-=dt;p.rollCD-=dt;this.flash-=dt;
      if(a.x||a.y)p.angle=turn(p.angle,Math.atan2(a.y,a.x),dt*3.8);
      if(a.specialPressed&&p.rollCD<=0){p.roll=.75;p.rollCD=4;this.sound('jump');}
      const speed=80+this.stage*8;p.x+=Math.cos(p.angle)*speed*dt;p.y+=Math.sin(p.angle)*speed*dt;
      if(a.fire&&p.cd<=0){p.cd=.14;this.bullets.push({x:p.x+Math.cos(p.angle)*14,y:p.y+Math.sin(p.angle)*14,vx:Math.cos(p.angle)*340,vy:Math.sin(p.angle)*340,life:1.6,enemy:false});this.sound('fire');}
      this.spawn-=dt;if(this.spawn<=0&&!this.bossSpawned){this.spawn=Math.max(.4,1-this.stage*.1);if(this.enemies.filter(e=>e.hp>0).length<7+this.stage)this.addEnemy();}
      if(this.kills>=this.target&&!this.bossSpawned)this.addEnemy(true);
      this.rescueTimer-=dt;if(this.rescueTimer<=0){this.rescueTimer=10;this.pods.push({x:p.x+Math.cos(p.angle)*180+(this.rand()-.5)*150,y:p.y+Math.sin(p.angle)*180+(this.rand()-.5)*150,life:24});}
      for(const pod of this.pods){pod.life-=dt;if(A.dist(p,pod)<20){pod.life=0;this.rescues++;this.score+=500;p.rollCD=0;this.sound('pickup');this.say('COURIER RESCUED +500',1.2);}}
      this.pods=this.pods.filter(q=>q.life>0&&A.dist(q,p)<600).slice(-4);
      for(const e of this.enemies){
        if(e.hp<=0)continue;e.cd-=dt;const distance=A.dist(e,p),target=Math.atan2(p.y-e.y,p.x-e.x)+(e.boss&&distance<140?1.05:e.turn);
        e.angle=turn(e.angle,target,dt*(e.boss?.9:1.2+this.stage*.15));const es=e.boss?60:66+this.stage*9;
        e.x+=Math.cos(e.angle)*es*dt;e.y+=Math.sin(e.angle)*es*dt;
        if(e.cd<=0&&distance<260){
          e.cd=(e.boss?.95:2.5-this.stage*.25)*(this.relaxed?1.6:1);
          const aim=Math.atan2(p.y-e.y,p.x-e.x),spread=e.boss?[-.23,0,.23]:[0];
          for(const offset of spread)this.bullets.push({x:e.x,y:e.y,vx:Math.cos(aim+offset)*(110+this.stage*12),vy:Math.sin(aim+offset)*(110+this.stage*12),life:2.8,enemy:true});
        }
        if(distance<(e.boss?25:15)){this.hit();if(!e.boss)this.damage(e,e.hp);}
      }
      for(const b of this.bullets){
        if(b.life<=0)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
        if(b.enemy){if(A.dist(b,p)<9){this.hit();b.life=0;}}
        else{for(const e of this.enemies)if(e.hp>0&&A.dist(b,e)<(e.boss?29:13)){this.damage(e,14);b.life=0;break;}}
      }
      this.enemies=this.enemies.filter(e=>e.hp>0&&(e.boss||A.dist(e,p)<650));this.bullets=this.bullets.filter(b=>b.life>0&&A.dist(b,p)<650).slice(-180);
      if(this.state!=='gameover'&&this.score>=this.nextLife){this.lives=Math.min(9,this.lives+1);this.nextLife+=12000;this.say('EXTRA CRAFT',2);this.sound('bank');}
    }
    status(){return ERAS[this.stage].name+' · Patrols '+Math.min(this.kills,this.target)+'/'+this.target+' · Craft '+this.lives+(this.relaxed?' · Armour '+this.player.armour+'/2':'')+' · Rescues '+this.rescues+' · Score '+this.score;}
    render(c){
      const e=ERAS[this.stage],p=this.player;D.rect(c,0,0,480,270,e.sky);
      // Stateless tiles: the same world coordinate always has the same cloud or star.
      const ox=Math.floor(p.x/110),oy=Math.floor(p.y/95);
      for(let y=oy-3;y<=oy+3;y++)for(let x=ox-4;x<=ox+4;x++){
        const h=((x*73856093)^(y*19349663))>>>0;
        const wx=x*110-p.x+240+(h%29),wy=y*95-p.y+135+(h%23);
        if(this.stage===4){D.rect(c,wx,wy,1+(h%2),1+(h%2),h%3?'#8e9cb5':'#e2d4ac');}
        else{D.rect(c,wx-17,wy,44,9,e.ground);D.rect(c,wx-7,wy-5,31,18,e.ground);}
      }
      c.save();c.translate(240-p.x,142-p.y);
      for(const pod of this.pods){c.strokeStyle='#f0e6cb';c.beginPath();c.arc(pod.x,pod.y-13,13,Math.PI,0);c.lineTo(pod.x,pod.y+6);c.closePath();c.stroke();D.rect(c,pod.x-3,pod.y+4,6,8,'#f0e6cb');}
      for(const enemy of this.enemies)if(enemy.hp>0)plane(c,enemy.x,enemy.y,enemy.angle,e.enemy,this.stage,enemy.boss);
      for(const b of this.bullets)D.rect(c,b.x-2,b.y-2,b.enemy?4:3,b.enemy?4:6,b.enemy?'#ffc391':'#fff8d6');
      this.particles.draw(c);this.effects.draw(c);
      if(p.inv<=0||Math.floor(p.inv*12)%2){c.save();if(p.roll>0){c.translate(p.x,p.y);c.scale(Math.cos(p.roll/.75*TAU)*.5+.55,1);plane(c,0,0,p.angle,'#8ff4e0',this.stage);}else plane(c,p.x,p.y,p.angle,'#8ff4e0',this.stage);c.restore();}
      c.restore();
      const boss=this.enemies.find(e=>e.boss&&e.hp>0);
      if(boss){D.bar(c,120,32,240,boss.hp,boss.maxHP,'#ebbea1');D.text(c,e.boss,240,40,'#fff0d6',7,'center');}
      D.hud(c,this,e.year+' / '+e.name,'CRAFT '+this.lives+' / '+this.score);
      D.text(c,'PATROLS '+Math.min(this.kills,this.target)+' / '+this.target,10,31,'#f9e6c3',8);
      D.text(c,p.rollCD<=0?'ROLL READY':'ROLL '+Math.ceil(p.rollCD)+'s',470,31,'#baf7ed',8,'right');
      if(this.flash>0){c.globalAlpha=this.flash*.6;D.rect(c,0,0,480,270,'#fff0d2');c.globalAlpha=1;}
    }
  };
})(globalThis.Arcade);
