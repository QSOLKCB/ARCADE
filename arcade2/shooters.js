/* SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  const {q,px,clamp,Engine:E,Draw:D}=A;
  A.Shmup=class extends A.Game{
    constructor(id){super(id,id==='vector'?8117:9103);this.power=1;this.setup();}
    setup(){
      this.vertical=this.id==='ember'&&this.stage===1;this.p={x:q(this.vertical?320:84),y:q(this.vertical?290:180)};
      this.shots=[];this.enemies=[];this.items=[];this.walls=[];this.stageTicks=0;this.charge=0;this.cd=0;this.dodgeCD=0;
      this.bombs=2;this.podFront=true;this.podCD=0;this.bossSpawned=false;this.bossDead=false;this.inv=90;
      this.announce((this.vertical?'VERTICAL ASCENT':'HORIZONTAL ASSAULT')+' // SECTOR '+(this.stage+1),130);
    }
    shot(x,y,vx,vy,enemy=false,damage=12,beam=false){if(this.shots.length<180)this.shots.push({x,y,vx,vy,enemy,damage,beam,life:150});}
    fire(beam=false){
      const p=this.p,speed=q(beam?11:9),damage=beam?65:12,side=this.vertical?0:speed,up=this.vertical?-speed:0;
      this.shot(p.x,p.y,side,up,false,damage,beam);
      if(this.id==='vector'){
        const pod=this.pod();this.shot(pod.x,pod.y,side,up,false,8);
      }else for(let i=1;i<this.power;i++)this.shot(p.x+(this.vertical?q((i%2?1:-1)*i*9):q(-i*20)),p.y+(this.vertical?q(i*18):q((i%2?1:-1)*i*10)),side,up,false,10);
      this.emit(beam?'blast':'shot');
    }
    pod(){return{x:this.p.x+q(this.podFront?32:-32),y:this.p.y};}
    damage(e,amount){
      if(e.hp<=0)return;
      if(e.boss&&e.shield)return;
      e.hp=Math.max(0,e.hp-amount);e.flash=6;
      if(!e.hp){this.score+=e.boss?4000:180;this.burst(e.x,e.y,e.boss?'#ffbc79':'#99f1df',e.boss?48:15);this.emit('blast');
        if(e.boss)this.bossDead=true;else if(e.drop&&this.items.length<12)this.items.push({x:e.x,y:e.y,life:400});}
    }
    bomb(){
      if(this.bombs<=0)return;this.bombs--;this.shots=this.shots.filter(s=>!s.enemy);this.inv=Math.max(this.inv,75);
      for(const e of this.enemies)this.damage(e,e.boss?80:999);this.burst(this.p.x,this.p.y,'#ffcb8f',50);this.emit('blast');
    }
    spawn(boss=false){
      if(this.enemies.length>=28)return;
      const lane=75+this.random(this.vertical?490:220),hp=boss?290+this.stage*70:24+this.stage*6;
      this.enemies.push({x:q(this.vertical?lane:672),y:q(this.vertical?-30:lane),hp,maxHP:hp,boss,age:0,cd:boss?50:70,
        base:q(lane),phase:this.random(100),drop:!boss&&this.stageTicks%270===0,flash:0,shield:false});
      if(boss){const e=this.enemies.at(-1);e.x=q(this.vertical?320:550);e.y=q(this.vertical?95:180);this.announce('CORE EXPOSES BETWEEN VOLLEYS',140);}
    }
    tick(input){
      if(!this.begin())return;this.stageTicks++;
      if(this.cd)this.cd--;if(this.dodgeCD)this.dodgeCD--;if(this.podCD)this.podCD--;
      const speed=input.x&&input.y?E.mulDiv(q(3),181,256):q(3);
      this.p.x=clamp(this.p.x+input.x*speed,q(24),q(616));this.p.y=clamp(this.p.y+input.y*speed,q(55),q(324));
      if(this.id==='vector'){
        if(input.aPressed&&!this.cd){this.fire();this.cd=10;}
        if(input.a)this.charge=Math.min(90,this.charge+1);
        if(input.aReleased){if(this.charge>=25)this.fire(true);this.charge=0;}
        if(input.bPressed)this.podFront=!this.podFront;
        if(input.cPressed)this.bomb();
      }else{
        if(input.a&&!this.cd){this.fire();this.cd=9;}
        if(input.bPressed)this.bomb();
        if(input.cPressed&&!this.dodgeCD){this.inv=Math.max(this.inv,32);this.dodgeCD=210;this.emit('dash');}
      }
      if(this.stageTicks%90===0&&this.stageTicks<1800)this.spawn();
      if(this.stageTicks%420===0&&this.stageTicks<1700){this.walls.push({pos:q(this.vertical?-25:665),gap:q(this.vertical?100+this.random(430):105+this.random(130)),width:145});}
      if(this.stageTicks>=1800&&!this.bossSpawned){this.bossSpawned=true;this.spawn(true);}
      for(const e of this.enemies){
        if(e.hp<=0)continue;e.age++;if(e.flash)e.flash--;
        if(e.boss){
          e.shield=e.age%120<35;
          if(this.vertical)e.x=q(210)+A.triangle(e.age,240,q(220));else e.y=q(110)+A.triangle(e.age,300,q(120));
        }else{
          if(this.vertical){e.y+=q(3,2);e.x=e.base+A.triangle(e.age+e.phase,100,q(44))-q(22);}
          else{e.x-=q(2);e.y=e.base+A.triangle(e.age+e.phase,100,q(44))-q(22);}
        }
        if(--e.cd<=0){
          e.cd=e.boss?45:130;
          const dx=this.p.x-e.x,dy=this.p.y-e.y,dist=Math.max(q(1),Math.abs(dx)+Math.abs(dy));
          const vx=E.mulDiv(dx,q(3),dist),vy=E.mulDiv(dy,q(3),dist);
          this.shot(e.x,e.y,vx,vy,true,12);
          if(e.boss){for(const offset of[-1,1])this.shot(e.x,e.y,vx+(this.vertical?q(offset):0),vy+(this.vertical?0:q(offset)),true,16);}
        }
        if(A.near(e,this.p,e.boss?53:22))this.hurt(e.boss?30:18);
      }
      for(const wall of this.walls){
        wall.pos+=q(this.vertical?2:-2);
        const forward=this.vertical?this.p.y:this.p.x,cross=this.vertical?this.p.x:this.p.y;
        if(Math.abs(forward-wall.pos)<q(23)&&Math.abs(cross-wall.gap)>q(wall.width-24,2))this.hurt(25);
      }
      this.walls=this.walls.filter(w=>this.vertical?w.pos<q(395):w.pos>q(-35));
      const pod=this.pod();
      for(const b of this.shots){
        b.x+=b.vx;b.y+=b.vy;b.life--;
        if(b.enemy){
          if(this.id==='vector'&&!this.podCD&&A.near(b,pod,16)){b.life=0;this.podCD=10;this.burst(pod.x,pod.y,'#baf77a',4);}
          else if(A.near(b,this.p,12)){this.hurt(b.damage);b.life=0;}
        }else{
          for(const e of this.enemies)if(e.hp>0&&Math.abs(b.x-e.x)<q(e.boss?52:24)&&Math.abs(b.y-e.y)<q(e.boss?44:19)){
            this.damage(e,b.damage);b.life=0;break;
          }
        }
      }
      this.shots=this.shots.filter(b=>b.life>0&&b.x>q(-40)&&b.x<q(700)&&b.y>q(-40)&&b.y<q(400));
      this.enemies=this.enemies.filter(e=>e.hp>0&&e.x>q(-50)&&e.y<q(420));
      for(const item of this.items){
        item.life--;if(this.vertical)item.y+=q(1);else item.x-=q(1);
        if(A.near(item,this.p,24)){item.life=0;this.power=Math.min(3,this.power+1);this.hp=Math.min(100,this.hp+12);this.score+=300;this.emit('pickup');this.announce(this.id==='ember'?'OPTION ACQUIRED':'HULL REPAIRED',70);}
      }
      this.items=this.items.filter(i=>i.life>0&&i.x>q(-20));
      if(this.bossDead)this.clearStage();
    }
    hud(){return{left:'HULL '+this.hp+'   BURSTS '+this.bombs,right:'SECTOR '+(this.stage+1)+'/3',objective:this.id==='vector'?'Hold Z to charge · release the beam · X moves the shield pod front / rear':'Collect green cores for wingmen · X clears bullets · Space dodges · stage 2 scrolls vertically'};}
    // Presentation only: reads state, never writes it (see tests/arcade2-parity.test.cjs).
    draw(c){
      const G=A.Gfx,hot=this.id==='ember',color=hot?'#ffb780':'#9be9f0',tick=this.tickCount;D.space(c,tick,this.vertical,hot);
      if(!this.vertical){
        const rock=hot?'#5a2433':'#1d3446',edge=hot?'#ff7a4a':'#5fd3e6',scroll=this.stageTicks*2;
        G.tile(c,'cave-top:'+hot,640,62,ctx=>{
          for(let i=0;i<640;i+=16){const h=G.hash(i*7+(hot?3:1)),depth=36+h%22;
            ctx.fillStyle=G.linear(ctx,0,0,0,depth,[[0,G.shade(rock,-0.5)],[1,rock]]);ctx.fillRect(i,0,16,depth);
            ctx.fillStyle=G.shade(rock,0.35);ctx.fillRect(i,depth-2,16,2);
            if(h%5===0){ctx.fillStyle=edge;ctx.fillRect(i+6,depth-5,4,3);}}
        },scroll,false,0);
        G.tile(c,'cave-floor:'+hot,640,48,ctx=>{
          for(let i=0;i<640;i+=20){const h=G.hash(i*13+(hot?5:2)),top=18-h%16;
            ctx.fillStyle=G.linear(ctx,0,top,0,48,[[0,rock],[1,G.shade(rock,-0.6)]]);ctx.fillRect(i,top,20,48-top);
            ctx.fillStyle=G.shade(rock,0.35);ctx.fillRect(i,top,20,2);
            if(hot&&h%3===0){ctx.fillStyle='#ff9a4a';ctx.fillRect(i+4,top+3,2,6);ctx.fillRect(i+5,top+8,2,4);ctx.fillStyle='#ffd27a';ctx.fillRect(i+4,top+3,1,2);}
            else if(!hot&&h%4===0){ctx.fillStyle='#bdf7ff';ctx.fillRect(i+8,top+4,3,3);}}
        },scroll,false,312);
        G.glow(c,320,360,320,hot?'#ff5a2a':'#2a8cff',0.18);
      }
      for(const w of this.walls){const pos=px(w.pos),gap=px(w.gap),half=w.width/2;
        const metal=hot?'#76495b':'#4e6071',stripe=hot?'#ffb35c':'#f5d36a',field=hot?'#ff8a5a':'#7ff3ff';
        const paint=(len,vertical)=>ctx=>{
          ctx.fillStyle=G.linear(ctx,0,0,vertical?0:24,vertical?24:0,[[0,G.shade(metal,0.35)],[0.5,metal],[1,G.shade(metal,-0.5)]]);
          ctx.fillRect(0,0,vertical?len:24,vertical?24:len);
          ctx.fillStyle=stripe;for(let i=0;i<len;i+=14){if(vertical)ctx.fillRect(i,0,7,3);else ctx.fillRect(0,i,3,7);}
          ctx.fillStyle='#0a0f17';for(let i=6;i<len;i+=22){if(vertical)ctx.fillRect(i,10,3,3);else ctx.fillRect(10,i,3,3);}
        };
        if(this.vertical){
          const l=Math.max(0,gap-half),r=Math.max(0,640-gap-half);
          if(l)G.layer(c,'wallv:'+hot+l,l,24,paint(l,true),0,pos-12);if(r)G.layer(c,'wallv:'+hot+r,r,24,paint(r,true),gap+half,pos-12);
          for(const x of[gap-half,gap+half]){G.glow(c,x,pos,18,field,0.7);D.rect(c,x-2,pos-12,4,24,field);}
          for(let i=0;i<6;i++)D.rect(c,gap-half+((i*29+tick*3)%(half*2)),pos-1,6,2,G.rgba(field,0.45));
        }else{
          const t=Math.max(0,gap-half-40),bt=Math.max(0,340-gap-half);
          if(t)G.layer(c,'wallh:'+hot+t,24,t,paint(t,false),pos-12,40);if(bt)G.layer(c,'wallh:'+hot+bt,24,bt,paint(bt,false),pos-12,gap+half);
          for(const y of[gap-half,gap+half]){G.glow(c,pos,y,18,field,0.7);D.rect(c,pos-12,y-2,24,4,field);}
          for(let i=0;i<6;i++)D.rect(c,pos-1,gap-half+((i*29+tick*3)%(half*2)),2,6,G.rgba(field,0.45));
        }
      }
      for(const e of this.enemies){const x=px(e.x),y=px(e.y);
        if(e.boss){
          const open=!e.shield,core=open?(hot?'#ffd18d':'#bafb9a'):'#6b8c9b';
          G.glow(c,x,y,110,hot?'#ff5a3a':'#3aa8ff',0.22);
          c.save();c.translate(Math.round(x),Math.round(y));if(this.vertical)c.rotate(Math.PI/2);
          G.sprite(c,'core-boss:'+hot+(e.flash?'f':''),150,120,ctx=>{
            ctx.translate(70,60);ctx.strokeStyle='#0a0f17';ctx.lineWidth=2;
            ctx.fillStyle=G.radial(ctx,-10,-15,10,70,[[0,hot?'#a8506e':'#5d7a92'],[1,hot?'#3a1626':'#1b2838']]);
            ctx.beginPath();ctx.ellipse(10,0,62,49,0,0,Math.PI*2);ctx.fill();ctx.stroke();
            for(let i=-1;i<=1;i++){
              ctx.fillStyle=e.flash?'#fff2d5':G.linear(ctx,0,i*29-7,0,i*29+7,[[0,hot?'#e07a92':'#9ab7c0'],[1,hot?'#7a3448':'#4b6670']]);
              ctx.fillRect(-35,i*29-7,72,14);ctx.strokeRect(-35,i*29-7,72,14);
              ctx.fillStyle='#edbb98';ctx.fillRect(-60,i*29-4,35,8);ctx.fillStyle='#3a2b26';ctx.fillRect(-62,i*29-2,6,4);
            }
            for(let a=0;a<12;a++){ctx.fillStyle=hot?'#ffb35c':'#7ff3ff';ctx.fillRect(10+Math.cos(a/12*Math.PI*2)*52-1,Math.sin(a/12*Math.PI*2)*40-1,3,3);}
          },-70,-60);
          G.glow(c,-9,0,open?44:24,core,open?0.6+0.3*Math.sin(tick*0.25):0.3);
          D.ellipse(c,-9,0,19,22,core);D.ellipse(c,-12,0,8,12,'#192637');D.ellipse(c,-14,-5,3,4,'#ffffff');
          if(e.shield){c.strokeStyle=G.rgba('#bfe9ff',0.7);c.lineWidth=2;for(let r=0;r<2;r++){c.beginPath();c.ellipse(-9,0,30+r*6+(tick%10)/3,34+r*6+(tick%10)/3,0,0,Math.PI*2);c.stroke();}}
          c.restore();D.bar(c,x-55,y-65,110,e.hp,e.maxHP,'#ffa18b');
          D.text(c,e.shield?'SHIELDED':'CORE OPEN',x,y-73,e.shield?'#a0b9c5':'#f8d08f',10,'center');
        }else D.drone(c,x,y,e.flash?'#fff7de':hot?'#e08caa':'#ed9b8e',false,tick);
      }
      for(const item of this.items){const x=px(item.x),y=px(item.y),spin=tick*0.08;
        G.glow(c,x,y,22,'#b8f375',0.55);
        c.save();c.translate(Math.round(x),Math.round(y));c.strokeStyle='#e2ffb8';c.lineWidth=2;c.beginPath();c.ellipse(0,0,13,6,spin,0,Math.PI*2);c.stroke();c.restore();
        D.ellipse(c,x,y,9,9,'#b8f375');D.ellipse(c,x-2,y-2,4,4,'#efffd6');D.text(c,'+',x,y+5,'#14382f',15,'center');
      }
      for(let i=1;i<this.power;i++)if(this.id!=='vector'){const ox=this.vertical?(i%2?1:-1)*i*9:-i*20,oy=this.vertical?i*18:(i%2?1:-1)*i*10;
        D.ship(c,px(this.p.x)+ox,px(this.p.y)+oy,color,tick+i*3,this.vertical,.45);
        G.glow(c,px(this.p.x)+ox,px(this.p.y)+oy,10,color,0.35);}
      if(this.inv%8<5)D.ship(c,px(this.p.x),px(this.p.y),color,tick,this.vertical);
      if(this.id==='vector'){const pod=this.pod(),x=px(pod.x),y=px(pod.y),ready=!this.podCD;
        G.glow(c,x,y,20,ready?'#c7f98c':'#6b7d86',ready?0.6:0.3);
        D.ellipse(c,x,y,11,11,ready?'#c7f98c':'#586b74');D.ellipse(c,x,y,7,8,'#2a5a4c');D.ellipse(c,x,y,5,6,'#0f2a2a');
        c.save();c.strokeStyle=G.rgba(ready?'#e8ffd0':'#9aa',0.8);c.lineWidth=1.5;c.beginPath();c.arc(x,y,14,tick*0.1,tick*0.1+Math.PI*1.2);c.stroke();c.restore();}
      for(const b of this.shots){const x=px(b.x),y=px(b.y);
        if(b.beam){const hz=!this.vertical;
          G.glow(c,x,y,34,'#7ff3ff',0.8);
          c.fillStyle=G.high()?G.linear(c,hz?x-34:x,hz?y:y+34,hz?x+30:x,hz?y:y-30,[[0,'rgba(120,255,240,0)'],[0.4,'#b6fbea'],[1,'#ffffff']]):'#b6fbea';
          c.beginPath();c.ellipse(x,y,hz?32:9,hz?9:32,0,0,Math.PI*2);c.fill();D.rect(c,x-(hz?10:3),y-(hz?3:10),hz?20:6,hz?6:20,'#ffffff');}
        else if(b.enemy){G.glow(c,x,y,10,'#ff4d6a',0.7);D.ellipse(c,x,y,4.5,4.5,'#ff808c');D.ellipse(c,x,y,2,2,'#fff0f2');}
        else{G.glow(c,x,y,8,color,0.5);D.ellipse(c,x,y,this.vertical?2:6,this.vertical?6:2,'#d1ffe8');D.rect(c,x-1,y-1,2,2,'#ffffff');}
      }
      this.drawEffects(c);D.bar(c,20,347,600,Math.min(this.stageTicks,1800),1800,color);
      D.rect(c,619,343,2,13,this.bossSpawned?'#ffa18b':'#5a6f7a');
      if(this.charge){const ready=this.charge>=25,x=px(this.p.x),y=px(this.p.y);
        G.glow(c,x+22,y,6+this.charge/5,'#d8ff9a',ready?0.9:0.5);
        D.bar(c,x-25,y+24,50,this.charge,90,'#d8ff9a');D.text(c,ready?'BEAM READY':'CHARGING',x,y+40,'#dbffc3',9,'center');}
    }
  };
  A.Invaders=class extends A.Game{
    constructor(){super('invaders',7109);this.lives=3;this.setup();}
    setup(){
      this.p={x:q(320),y:q(315)};this.shots=[];this.cd=0;this.bombs=2;this.waveTicks=0;this.direction=1;this.drop=0;
      this.enemies=[];this.ufo=null;this.shield=[];
      for(let row=0;row<4;row++)for(let col=0;col<9;col++)this.enemies.push({x:q(115+col*45),y:q(78+row*35),hp:row===0?2:1,row});
      for(let base=0;base<4;base++)for(let x=0;x<7;x++)for(let y=0;y<3;y++)if(!(y===2&&x>1&&x<5))this.shield.push({x:q(110+base*135+x*6),y:q(261+y*6),hp:2});
      this.inv=90;this.announce('ORBIT '+(this.stage+1)+'/4 // THE INVASION IS MOSTLY CONFUSED',130);
    }
    hit(){
      if(this.inv||this.status!=='playing')return;this.lives--;this.inv=110;this.emit('hurt');this.burst(this.p.x,this.p.y,'#e9c48d',20);
      if(!this.lives)this.finish(false);
    }
    tick(input){
      if(!this.begin())return;this.waveTicks++;
      this.p.x=clamp(this.p.x+input.x*q(7,2),q(20),q(620));if(this.cd)this.cd--;
      if(input.a&&!this.cd&&this.shots.length<100){this.cd=12;this.shots.push({x:this.p.x,y:q(301),vy:q(-7),enemy:false});this.emit('shot');}
      if(input.bPressed&&this.bombs>0){this.bombs--;this.shots=this.shots.filter(b=>!b.enemy);for(const e of this.enemies)if(Math.abs(e.x-this.p.x)<q(100)){e.hp--;if(e.hp<=0){this.score+=100;this.burst(e.x,e.y,'#c3f37c',8);}}this.emit('blast');}
      const alive=this.enemies.filter(e=>e.hp>0);
      const interval=Math.max(4,25-Math.floor((36-alive.length)/2)-this.stage*3);
      if(this.waveTicks%interval===0&&alive.length){
        const edge=alive.some(e=>e.x+q(this.direction*7)<q(28)||e.x+q(this.direction*7)>q(612));
        if(edge)this.direction*=-1;
        for(const e of alive){if(edge)e.y+=q(12);else e.x+=q(this.direction*7);}
      }
      if(this.waveTicks%Math.max(18,52-this.stage*8)===0&&alive.length&&this.shots.length<100){
        const e=alive[this.random(alive.length)];this.shots.push({x:e.x,y:e.y+q(10),vy:q(5+this.stage,2),enemy:true});
      }
      if(this.waveTicks%600===1)this.ufo={x:q(-30),y:q(47),hp:3};
      if(this.ufo){this.ufo.x+=q(2);if(this.ufo.x>q(680))this.ufo=null;}
      for(const b of this.shots){
        b.y+=b.vy;let used=false;
        for(const block of this.shield)if(block.hp>0&&A.near(b,block,6)){block.hp--;used=true;break;}
        if(!used&&b.enemy&&A.near(b,this.p,14)){this.hit();used=true;}
        if(!used&&!b.enemy){
          for(const e of alive)if(e.hp>0&&Math.abs(e.x-b.x)<q(15)&&Math.abs(e.y-b.y)<q(13)){e.hp--;if(!e.hp){this.score+=100;this.burst(e.x,e.y,'#bdf393',10);this.emit('blast');}used=true;break;}
          if(!used&&this.ufo&&A.near(b,this.ufo,25)){this.ufo.hp--;used=true;if(!this.ufo.hp){this.score+=750;this.burst(this.ufo.x,this.ufo.y,'#f5adbb',24);this.ufo=null;this.emit('pickup');}}
        }
        if(used)b.y=q(-60);
      }
      this.shots=this.shots.filter(b=>b.y>q(-20)&&b.y<q(360));this.enemies=this.enemies.filter(e=>e.hp>0);
      if(this.enemies.some(e=>e.y>=q(300)))this.finish(false);
      else if(!this.enemies.length)this.clearStage(3);
    }
    hud(){return{left:'CRAFT '+this.lives+'   PULSES '+this.bombs,right:'ORBIT '+(this.stage+1)+'/4',objective:'Clear four invasions before they land · Z fires · X pulses a column · bunkers erode'};}
    // Presentation only: reads state, never writes it (see tests/arcade2-parity.test.cjs).
    draw(c){
      const G=A.Gfx,tick=this.tickCount;D.space(c,tick,false,false);
      G.layer(c,'invaders-horizon',640,70,ctx=>{
        ctx.fillStyle=G.linear(ctx,0,0,0,70,[[0,'rgba(80,190,140,0)'],[0.6,'rgba(80,190,140,0.18)'],[1,'#0e1f1c']]);ctx.fillRect(0,0,640,70);
        for(let x=0,i=0;x<640;i++){const h=G.hash(i*53),w=14+h%22,top=36+(h>>>8)%26;
          ctx.fillStyle='#0b1916';ctx.fillRect(x,top,w,70-top);
          for(let wy=top+4;wy<62;wy+=6)for(let wx=x+3;wx<x+w-3;wx+=5)if(G.hash(wx*3+wy)%5===0){ctx.fillStyle='#e8d38a';ctx.fillRect(wx,wy,2,2);}
          x+=w+2;}
      },0,265);
      G.layer(c,'invaders-ground',640,25,ctx=>{
        ctx.fillStyle=G.linear(ctx,0,0,0,25,[[0,'#2c4a3c'],[1,'#0b1512']]);ctx.fillRect(0,0,640,25);
        ctx.fillStyle='#a9e17d';ctx.fillRect(0,0,640,2);ctx.fillStyle='rgba(169,225,125,0.25)';ctx.fillRect(0,2,640,3);
        for(let x=0;x<640;x+=32){ctx.fillStyle='#1d3329';ctx.fillRect(x+4,10,20,3);}
      },0,335);
      for(const b of this.shield)if(b.hp){const x=px(b.x)-3,y=px(b.y)-3;
        D.rect(c,x,y,6,6,b.hp===2?'#8fc472':'#5a7a5c');D.rect(c,x,y,6,1,b.hp===2?'#d8f7b8':'#86a383');
        if(b.hp===1)D.rect(c,x+2,y+2,2,2,'#2a3b2c');}
      const sprites=[['00100100','00011000','01111110','11011011','11111111','10111101','00100100','01000010'],
        ['00100100','10011001','11111111','11011011','11111111','00111100','01000010','10000001']];
      const alive=this.enemies.length,interval=Math.max(4,25-Math.floor((36-alive)/2)-this.stage*3),frame=Math.floor(this.waveTicks/interval)%2;
      const tones=['#e6aad6','#b6f18b','#92dfdd','#d8c581'];
      for(const e of this.enemies){const x=px(e.x),y=px(e.y),tone=tones[e.row];
        G.glow(c,x,y,16,tone,0.28);
        G.sprite(c,'invader:'+e.row+frame+(e.hp>1?'a':'b'),28,28,ctx=>{
          const art=sprites[frame];
          for(let row=0;row<8;row++)for(let col=0;col<8;col++)if(art[row][col]==='1'){
            ctx.fillStyle='#0a0f17';ctx.fillRect(col*3,row*3,5,5);}
          for(let row=0;row<8;row++)for(let col=0;col<8;col++)if(art[row][col]==='1'){
            ctx.fillStyle=row<3?G.shade(tone,0.35):row>5?G.shade(tone,-0.3):tone;ctx.fillRect(col*3+1,row*3+1,3,3);}
          ctx.fillStyle='#ffffff';ctx.fillRect(3*3+1,3*3+1,2,2);ctx.fillRect(5*3+2,3*3+1,2,2);
          if(e.hp>1){ctx.fillStyle='#fff3c4';ctx.fillRect(10,0,6,2);}
        },x-13,y-13);
      }
      if(this.ufo){const x=px(this.ufo.x),y=px(this.ufo.y);
        if(G.high()){c.fillStyle=G.linear(c,0,y,0,y+90,[[0,'rgba(246,167,194,0.25)'],[1,'rgba(246,167,194,0)']]);c.beginPath();c.moveTo(x-8,y+6);c.lineTo(x+8,y+6);c.lineTo(x+30,y+90);c.lineTo(x-30,y+90);c.closePath();c.fill();}
        D.drone(c,x,y,'#f6a7c2',false,tick);D.text(c,'LOST?',x,y-16,'#ffc1d8',9,'center');}
      if(this.inv%8<5){const x=px(this.p.x);
        G.glow(c,x,310,24,'#a7e4c4',0.35);
        G.sprite(c,'cannon',36,30,ctx=>{
          ctx.fillStyle='#0a0f17';ctx.fillRect(0,12,36,16);ctx.fillRect(6,7,24,8);ctx.fillRect(14,0,8,10);
          ctx.fillStyle=G.linear(ctx,0,13,0,27,[[0,'#d6fbe6'],[1,'#4f8f72']]);ctx.fillRect(2,13,32,13);
          ctx.fillStyle='#a7e4c4';ctx.fillRect(8,8,20,6);ctx.fillStyle='#e6f9c8';ctx.fillRect(15,1,6,9);
          ctx.fillStyle='#2a4a3c';for(let i=5;i<32;i+=7)ctx.fillRect(i,22,4,2);ctx.fillStyle='#ffd27a';ctx.fillRect(16,17,4,3);
        },x-18,296);
        if(this.cd>9){G.glow(c,x,295,12,'#fff3c4',0.9);D.rect(c,x-2,290,4,5,'#fff3c4');}
      }
      for(const b of this.shots){const x=px(b.x),y=px(b.y);
        G.glow(c,x,y,9,b.enemy?'#ff6b8a':'#d9f7b8',0.6);
        if(b.enemy){D.rect(c,x-2,y-4,4,9,'#ff9bad');D.rect(c,x-1,y-2,2,5,'#fff0f3');}
        else{D.rect(c,x-1.5,y-5,3,10,'#d9f7b8');D.rect(c,x-0.5,y-4,1,8,'#ffffff');}}
      this.drawEffects(c);
    }
  };
  A.register({id:'invaders',title:'Spaced Invaders',subtitle:'They took a wrong turn at Mars.',genre:'FIXED SHOOTER',color:'#bded91',number:'07',controls:['Move','Z · fire','X · column pulse','Four waves · three craft'],description:'Four confused invasions, crumbling bunkers and one very lost saucer. Stop the landing before the last craft goes.'},()=>new A.Invaders());
  A.register({id:'vector',title:'Null Vector',subtitle:'Charge. Release. Obliterate.',genre:'HORIZONTAL SHOOTER',color:'#9be9f0',number:'09',controls:['Move','Hold / release Z · beam','X · front / rear pod','Space · burst'],description:'A charge beam, a movable shield pod and three hostile sectors. Thread the bulkheads and hit each exposed core.'},()=>new A.Shmup('vector'));
  A.register({id:'ember',title:'Ember Wing',subtitle:'Through the heart of the furnace.',genre:'MULTI-SCROLL SHOOTER',color:'#f1a0ba',number:'10',controls:['Move','Z · fire','X · burst','Space · dodge'],description:'Horizontal assault becomes vertical ascent. Collect wingmen, cross living firewalls and silence three furnace cores.'},()=>new A.Shmup('ember'));
})(globalThis.Arcade2);
