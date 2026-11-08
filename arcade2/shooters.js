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
    draw(c){
      const hot=this.id==='ember',color=hot?'#ffb780':'#9be9f0';D.space(c,this.tickCount,this.vertical,hot);
      if(!this.vertical){for(let i=0;i<22;i++){const x=(i*41-this.stageTicks*2%41);D.rect(c,x,42,28,7+(i%4)*5,hot?'#774250':'#254455');D.rect(c,x,330-(i%3)*4,30,30,hot?'#773a48':'#254455');}}
      for(const w of this.walls){const pos=px(w.pos),gap=px(w.gap),half=w.width/2;
        if(this.vertical){D.rect(c,0,pos-12,gap-half,24,'#76495b');D.rect(c,gap+half,pos-12,640-gap-half,24,'#76495b');D.line(c,0,pos-12,gap-half,pos-12,'#f59b75',3);}
        else{D.rect(c,pos-12,40,24,Math.max(0,gap-half-40),'#4e6071');D.rect(c,pos-12,gap+half,24,340-gap-half,'#4e6071');D.line(c,pos-12,40,pos-12,gap-half,'#f59b75',3);}
      }
      for(const e of this.enemies){const x=px(e.x),y=px(e.y);
        if(e.boss){
          c.save();c.translate(x,y);if(this.vertical)c.rotate(Math.PI/2);
          D.ellipse(c,10,0,62,49,hot?'#6f354e':'#3b5064');
          for(let i=-1;i<=1;i++){D.rect(c,-35,i*29-7,72,14,e.flash?'#fff2d5':hot?'#bd5c74':'#6f8e98');D.rect(c,-55,i*29-4,35,8,'#edbb98');}
          D.ellipse(c,-9,0,19,22,e.shield?'#6b8c9b':hot?'#ffd18d':'#bafb9a');
          D.ellipse(c,-12,0,8,12,'#192637');c.restore();D.bar(c,x-55,y-65,110,e.hp,e.maxHP,'#ffa18b');
          D.text(c,e.shield?'SHIELDED':'CORE OPEN',x,y-73,e.shield?'#a0b9c5':'#f8d08f',10,'center');
        }else D.drone(c,x,y,e.flash?'#fff7de':hot?'#e08caa':'#ed9b8e',false,this.tickCount);
      }
      for(const item of this.items){D.ellipse(c,px(item.x),px(item.y),11,11,'#b8f375');D.text(c,'+',px(item.x),px(item.y)+5,'#14382f',17,'center');}
      if(this.inv%8<5)D.ship(c,px(this.p.x),px(this.p.y),color,this.tickCount,this.vertical);
      if(this.id==='vector'){const pod=this.pod();D.ellipse(c,px(pod.x),px(pod.y),11,11,this.podCD?'#586b74':'#c7f98c');D.ellipse(c,px(pod.x),px(pod.y),5,6,'#274b50');}
      else for(let i=1;i<this.power;i++)D.ship(c,px(this.p.x)+(this.vertical?(i%2?1:-1)*i*9:-i*20),px(this.p.y)+(this.vertical?i*18:(i%2?1:-1)*i*10),color,this.tickCount,this.vertical,.45);
      for(const b of this.shots){const x=px(b.x),y=px(b.y);
        if(b.beam){D.ellipse(c,x,y,this.vertical?9:30,this.vertical?30:9,'#b6fbea');D.rect(c,x-7,y-3,14,6,'#fff');}
        else D.ellipse(c,x,y,b.enemy?4:5,b.enemy?4:2,b.enemy?'#ff808c':'#d1ffe8');
      }
      this.drawEffects(c);D.bar(c,20,347,600,Math.min(this.stageTicks,1800),1800,color);
      if(this.charge){D.bar(c,px(this.p.x)-25,px(this.p.y)+24,50,this.charge,90,'#d8ff9a');D.text(c,this.charge>=25?'BEAM READY':'CHARGING',px(this.p.x),px(this.p.y)+40,'#dbffc3',9,'center');}
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
    draw(c){
      D.space(c,this.tickCount,false,false);D.rect(c,0,335,640,25,'#243532');D.line(c,0,335,640,335,'#a9e17d',2);
      for(const b of this.shield)if(b.hp)D.rect(c,px(b.x)-3,px(b.y)-3,6,6,b.hp===2?'#aedb8c':'#6c9371');
      const sprite=['00100100','00011000','01111110','11011011','11111111','10111101','00100100','01000010'];
      for(const e of this.enemies){const x=px(e.x),y=px(e.y);for(let row=0;row<8;row++)for(let col=0;col<8;col++)if(sprite[row][col]==='1')D.rect(c,x+(col-4)*3,y+(row-4)*3,3,3,['#e6aad6','#b6f18b','#92dfdd','#d8c581'][e.row]);}
      if(this.ufo){D.drone(c,px(this.ufo.x),px(this.ufo.y),'#f6a7c2');D.text(c,'LOST?',px(this.ufo.x),px(this.ufo.y)-16,'#ffc1d8',9,'center');}
      if(this.inv%8<5){const x=px(this.p.x);D.rect(c,x-16,309,32,14,'#a7e4c4');D.rect(c,x-10,304,20,5,'#a7e4c4');D.rect(c,x-3,297,6,9,'#e6f9c8');}
      for(const b of this.shots)D.rect(c,px(b.x)-2,px(b.y)-4,4,9,b.enemy?'#ff9bad':'#d9f7b8');this.drawEffects(c);
    }
  };
  A.register({id:'invaders',title:'Spaced Invaders',subtitle:'They took a wrong turn at Mars.',genre:'FIXED SHOOTER',color:'#bded91',number:'07',controls:['Move','Z · fire','X · column pulse','Four waves · three craft'],description:'Four confused invasions, crumbling bunkers and one very lost saucer. Stop the landing before the last craft goes.'},()=>new A.Invaders());
  A.register({id:'vector',title:'Null Vector',subtitle:'Charge. Release. Obliterate.',genre:'HORIZONTAL SHOOTER',color:'#9be9f0',number:'09',controls:['Move','Hold / release Z · beam','X · front / rear pod','Space · burst'],description:'A charge beam, a movable shield pod and three hostile sectors. Thread the bulkheads and hit each exposed core.'},()=>new A.Shmup('vector'));
  A.register({id:'ember',title:'Ember Wing',subtitle:'Through the heart of the furnace.',genre:'MULTI-SCROLL SHOOTER',color:'#f1a0ba',number:'10',controls:['Move','Z · fire','X · burst','Space · dodge'],description:'Horizontal assault becomes vertical ascent. Collect wingmen, cross living firewalls and silence three furnace cores.'},()=>new A.Shmup('ember'));
})(globalThis.Arcade2);
