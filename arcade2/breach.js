/* SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const {q,px,clamp,Draw:D}=A;
  A.Breach=class extends A.Game {
    constructor(){super('breach',6503);this.setup();}
    setup(){
      this.p={x:q(320),y:q(324),roll:0,rollCD:0,face:1};
      this.aim={x:q(320),y:q(170)};this.cd=0;this.bombs=3;this.stageTicks=0;this.spawned=0;this.kills=0;
      this.enemies=[];this.tracers=[];this.cover=[{x:155,hp:100},{x:320,hp:100},{x:485,hp:100}];
      this.quota=12+this.stage*4;this.bossSpawned=false;
      this.announce('BREACH '+(this.stage+1)+' // KEEP YOUR HEAD DOWN',120);
    }
    spawn(boss=false){
      if(this.enemies.length>=16)return false;
      const x=boss?320:80+this.random(480),y=boss?135:100+this.random(130);
      this.enemies.push({x:q(x),y:q(y),hp:boss?180+this.stage*40:28,maxHP:boss?180+this.stage*40:28,
        boss,cd:90+this.random(75),wind:0,target:0,flash:0});
      return true;
    }
    damage(e,amount){
      if(e.hp<=0)return;e.hp=Math.max(0,e.hp-amount);e.flash=7;
      if(!e.hp){this.kills++;this.score+=e.boss?2000:200;this.burst(e.x,e.y,'#f8bf77',20);this.emit('blast');}
    }
    tick(input){
      if(!this.begin())return;this.stageTicks++;
      const p=this.p;
      if(this.cd)this.cd--;if(p.roll)p.roll--;if(p.rollCD)p.rollCD--;
      if(input.aim){this.aim.x=q(Math.round(clamp(input.aim.x,20,620)));this.aim.y=q(Math.round(clamp(input.aim.y,65,255)));}
      else {this.aim.x=clamp(this.aim.x+input.x*q(4),q(20),q(620));this.aim.y=clamp(this.aim.y+input.y*q(3),q(65),q(255));}
      p.x=A.approach(p.x,this.aim.x,q(p.roll?8:3));
      if(input.x)p.face=input.x;
      if(input.bPressed&&!p.rollCD){p.roll=28;p.rollCD=100;this.emit('dash');}
      if(p.roll)p.x=clamp(p.x+q(p.face*4),q(28),q(612));
      this.duck=input.y>0&&!p.roll;
      if(input.a&&!this.cd&&!this.duck&&!p.roll){
        this.cd=7;this.emit('shot');this.tracers.push({x:p.x,y:q(300),tx:this.aim.x,ty:this.aim.y,life:5});
        const target=this.enemies.filter(e=>e.hp>0&&Math.abs(e.x-this.aim.x)<q(e.boss?62:24)&&Math.abs(e.y-this.aim.y)<q(e.boss?40:28)).sort((a,b)=>b.y-a.y)[0];
        if(target)this.damage(target,14);
      }
      if(input.cPressed&&this.bombs>0){this.bombs--;for(const e of this.enemies)this.damage(e,70);this.burst(this.aim.x,this.aim.y,'#ffad65',35);this.emit('blast');}
      // Reclaim defeated slots before testing capacity, especially after a grenade.
      this.enemies=this.enemies.filter(e=>e.hp>0);
      if(this.stageTicks%100===1&&this.spawned<this.quota&&this.spawn())this.spawned++;
      if(this.spawned===this.quota&&!this.enemies.length&&!this.bossSpawned&&this.spawn(true)){
        this.bossSpawned=true;this.announce('HEAVY RESPONSE // AIM FOR THE CORE',110);
      }
      for(const e of this.enemies){
        if(e.hp<=0)continue;if(e.flash)e.flash--;
        if(e.wind){
          e.wind--;
          if(!e.wind){
            this.tracers.push({x:e.x,y:e.y,tx:e.target,ty:q(310),life:8,enemy:true});
            if(Math.abs(p.x-e.target)<q(e.boss?65:40)&&!p.roll){
              const wall=this.cover.find(b=>b.hp>0&&Math.abs(q(b.x)-p.x)<q(50));
              if(wall&&this.duck){wall.hp=Math.max(0,wall.hp-(e.boss?40:22));this.emit('block');}
              else this.hurt(e.boss?22:12);
            }
            e.cd=e.boss?60:110-this.stage*15;
          }
        }else if(--e.cd<=0){e.wind=e.boss?50:42;e.target=p.x;}
      }
      this.tracers=this.tracers.filter(t=>--t.life>0).slice(-32);
      if(this.bossSpawned&&!this.enemies.length)this.clearStage();
    }
    hud(){return{left:'ARMOUR '+this.hp+'   GRENADES '+this.bombs,right:'BREACH '+(this.stage+1)+'/3',objective:'Aim with arrows or mouse · Z fires · down takes cover · X rolls · Space grenades'};}
    draw(c){
      D.rect(c,0,0,640,360,'#1a2027');D.rect(c,0,52,640,185,'#31383c');
      for(let x=0;x<640;x+=80){D.rect(c,x+5,61,68,161,'#252a32');D.rect(c,x+13,68,52,40,'#53656a');D.rect(c,x+15,71,48,5,'#84a7a0');D.rect(c,x+13,158,52,58,'#151c28');}
      D.rect(c,0,236,640,124,'#4b4140');
      for(let x=-200;x<900;x+=90)D.line(c,320+(x-320)*.4,236,x,360,'#6e5b50');
      D.text(c,'RESTRICTED // AUTHORISED PERSONNEL ONLY',320,44,'#e7b57b',12,'center');
      for(const e of this.enemies){const x=px(e.x),y=px(e.y);
        if(e.boss){D.rect(c,x-65,y-25,130,50,e.flash?'#fff4cd':'#777b71');D.rect(c,x-48,y+25,96,14,'#18222b');D.drone(c,x,y,'#e8a066',true,this.tickCount);}
        else D.person(c,x,y+15,e.flash?'#fff':'#ba9b7b',1,this.tickCount,'trooper',2);
        D.bar(c,x-(e.boss?58:18),y-(e.boss?36:29),e.boss?116:36,e.hp,e.maxHP,'#ffb278');
        if(e.wind){D.text(c,'!',x,y-43,'#ff756e',23,'center');D.ellipse(c,px(e.target),316,e.boss?60:35,8,'#ff545444');D.text(c,'MOVE',px(e.target),344,'#ffb276',10,'center');}
      }
      for(const wall of this.cover){
        D.rect(c,wall.x-46,wall.hp>0?275:305,92,wall.hp>0?39:9,wall.hp>0?'#707e76':'#3e4849');
        if(wall.hp>0){D.rect(c,wall.x-46,275,92,5,'#acaa86');for(let i=0;i<4;i++)D.rect(c,wall.x-40+i*22,289,15,3,'#3f554f');D.bar(c,wall.x-35,268,70,wall.hp,100,'#a7d391');}
      }
      const p=this.p;
      if(this.inv%8<5)D.person(c,px(p.x),px(p.y)+(this.duck?10:0),p.roll?'#fff6cd':'#8ce0d8',1,p.roll?this.tickCount*2:0,'trooper',this.duck?1.7:2.4);
      for(const t of this.tracers)D.line(c,px(t.x),px(t.y),px(t.tx),px(t.ty),t.enemy?'#ff8d73':'#f8f6ba',2);
      const ax=px(this.aim.x),ay=px(this.aim.y);c.strokeStyle='#aef4bf';c.lineWidth=2;c.strokeRect(ax-13,ay-13,26,26);
      D.line(c,ax-20,ay,ax-7,ay,'#dbffb1');D.line(c,ax+7,ay,ax+20,ay,'#dbffb1');D.line(c,ax,ay-20,ax,ay-7,'#dbffb1');D.line(c,ax,ay+7,ax,ay+20,'#dbffb1');
      this.drawEffects(c);D.text(c,'ROLL '+(p.rollCD?'RECHARGING':'READY'),20,348,'#d7c5a0',11);
    }
  };
  A.register({id:'breach',title:'Breach Protocol',subtitle:'Cover is a finite resource.',genre:'GALLERY SHOOTER',color:'#e3bc8d',number:'06',controls:['Aim · arrows / mouse','Z · fire · down · cover','X · dodge roll','Space · grenade'],description:'Three fortified compounds. Shoot marked targets, duck behind destructible cover and roll clear of incoming fire.'},()=>new A.Breach());
})(globalThis.Arcade2);
