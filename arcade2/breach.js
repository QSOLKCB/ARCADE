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
    // Presentation only: reads state, never writes it (see tests/arcade2-parity.test.cjs).
    draw(c){
      const G=A.Gfx,tick=this.tickCount,stage=this.stage,tint=['#e7b57b','#9fd0ff','#ff8a6a'][stage];
      G.layer(c,'breach-yard:'+stage,640,360,ctx=>{
        ctx.fillStyle=G.linear(ctx,0,0,0,52,[[0,['#0d1118','#0a0f1a','#170c0c'][stage]],[1,'#1f262e']]);ctx.fillRect(0,0,640,52);
        for(let i=0;i<40;i++){const h=G.hash(i*29+stage);ctx.fillStyle='#4a5566';ctx.fillRect(h%640,(h>>>10)%40,1,1);}
        ctx.fillStyle=G.linear(ctx,0,52,0,237,[[0,'#3a4146'],[1,'#262c31']]);ctx.fillRect(0,52,640,185);
        for(let x=0;x<640;x+=80){
          ctx.fillStyle='#1d2229';ctx.fillRect(x+5,61,68,161);
          ctx.fillStyle=G.linear(ctx,0,68,0,108,[[0,'#6f8790'],[1,'#3d4f56']]);ctx.fillRect(x+13,68,52,40);
          ctx.fillStyle='#9fc0b8';ctx.fillRect(x+15,71,48,4);ctx.fillStyle='#1d2229';ctx.fillRect(x+38,68,2,40);
          ctx.fillStyle='#10161f';ctx.fillRect(x+13,158,52,58);ctx.fillStyle='#2b333d';ctx.fillRect(x+13,158,52,3);
          ctx.fillStyle=G.rgba(tint,0.5);ctx.fillRect(x+36,140,6,4);
        }
        ctx.fillStyle='#14181d';for(let x=0;x<640;x+=12)ctx.fillRect(x,52,6,4);
        ctx.fillStyle=G.linear(ctx,0,236,0,360,[[0,'#5a4c48'],[1,'#2a2120']]);ctx.fillRect(0,236,640,124);
        ctx.strokeStyle='#6e5b50';ctx.lineWidth=1;for(let x=-200;x<900;x+=90){ctx.beginPath();ctx.moveTo(320+(x-320)*0.4,236);ctx.lineTo(x,360);ctx.stroke();}
        for(const y of[250,272,300,334]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(640,y);ctx.stroke();}
        for(let i=0;i<14;i++){const h=G.hash(i*71+stage*3);ctx.fillStyle='rgba(20,14,12,0.35)';ctx.beginPath();ctx.ellipse(h%640,245+(h>>>9)%110,8+h%14,3+h%4,0,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle='#e8c84a';for(let x=0;x<640;x+=20)ctx.fillRect(x,236,10,3);
        ctx.fillStyle='#0a0d12';ctx.fillRect(110,30,420,18);ctx.strokeStyle=tint;ctx.strokeRect(110.5,30.5,419,17);
        ctx.fillStyle=tint;ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('RESTRICTED // AUTHORISED PERSONNEL ONLY',320,44);ctx.textAlign='left';
      });
      for(const x of[40,600])G.glow(c,x,70,50,tint,0.18+0.08*Math.sin(tick*0.05+x));
      for(const e of this.enemies){const x=px(e.x),y=px(e.y);
        if(e.wind){const t=px(e.target),pulse=1-e.wind/(e.boss?50:42),r=(e.boss?60:35);
          G.glow(c,t,316,r,'#ff3b3b',0.3+pulse*0.4);
          c.save();c.strokeStyle=G.rgba('#ff545a',0.5+pulse*0.5);c.lineWidth=2;c.beginPath();c.ellipse(t,316,r*(1.2-pulse*0.2),8,0,0,Math.PI*2);c.stroke();c.restore();
          D.ellipse(c,t,316,r,8,'#ff545444');D.text(c,'MOVE',t,344,'#ffb276',10,'center');}
      }
      for(const e of this.enemies){const x=px(e.x),y=px(e.y);
        if(e.boss){
          G.glow(c,x,y,80,'#e8a066',0.2);
          G.sprite(c,'breach-mech:'+(e.flash?'f':'n'),140,70,ctx=>{
            ctx.fillStyle=G.linear(ctx,0,0,0,50,[[0,e.flash?'#fff4cd':'#9aa092'],[1,e.flash?'#fff4cd':'#5a5e55']]);ctx.fillRect(5,5,130,50);
            ctx.strokeStyle='#0a0f17';ctx.lineWidth=2;ctx.strokeRect(5,5,130,50);
            ctx.fillStyle='#e8c84a';for(let i=10;i<130;i+=16)ctx.fillRect(i,46,8,4);
            ctx.fillStyle='#18222b';ctx.fillRect(22,55,96,14);ctx.fillStyle='#2e3b46';for(let i=26;i<116;i+=12)ctx.fillRect(i,58,6,8);
          },x-70,y-30);
          D.drone(c,x,y,'#e8a066',true,tick);
        }else{
          G.shadow(c,x,y+16,10,3,0.35);
          D.person(c,x,y+15,e.flash?'#ffffff':'#ba9b7b',1,tick,'trooper',2);
        }
        D.bar(c,x-(e.boss?58:18),y-(e.boss?36:29),e.boss?116:36,e.hp,e.maxHP,'#ffb278');
        if(e.wind){G.glow(c,x,y-48,16,'#ff4d4d',0.8);D.text(c,'!',x,y-43,'#ff756e',23,'center');}
      }
      for(const wall of this.cover){
        const up=wall.hp>0,dmg=up?3-Math.min(3,Math.floor(wall.hp/34)):3;
        G.sprite(c,'cover:'+dmg,96,44,ctx=>{
          if(dmg===3){ctx.fillStyle='#3e4849';ctx.fillRect(2,34,92,9);for(let i=0;i<9;i++){ctx.fillStyle=i%2?'#59625f':'#4a5352';ctx.fillRect(4+i*10,30+(i%3),8,6);}return;}
          ctx.fillStyle='#0a0f17';ctx.fillRect(1,3,94,41);
          for(let row=0;row<4;row++)for(let i=0;i<5;i++){
            const gone=G.hash(row*11+i*3)%3<dmg&&row===0;if(gone)continue;
            const x=3+i*18+(row%2?9:0)-(row%2&&i===4?9:0),w=row%2&&i===4?9:17;
            ctx.fillStyle=G.linear(ctx,0,4+row*10,0,13+row*10,[[0,'#a39a76'],[1,'#6e6850']]);ctx.fillRect(x,4+row*10,w,9);
            ctx.fillStyle='#c9bf96';ctx.fillRect(x+2,5+row*10,w-4,1);
          }
          ctx.strokeStyle='#2a2a22';ctx.lineWidth=1;for(let k=0;k<dmg*3;k++){const h=G.hash(k*7+dmg);ctx.beginPath();ctx.moveTo(4+h%86,6+(h>>>8)%30);ctx.lineTo(10+h%80,12+(h>>>12)%28);ctx.stroke();}
        },wall.x-48,272);
        if(up)D.bar(c,wall.x-35,264,70,wall.hp,100,'#a7d391');
      }
      const p=this.p,x=px(p.x),y=px(p.y)+(this.duck?10:0);
      if(this.inv%8<5){
        G.shadow(c,x,px(p.y)+2,14,4,0.45);
        if(p.roll)for(let k=1;k<=3;k++){c.save();c.globalAlpha=0.25/k;D.person(c,x-p.face*k*8,y,'#fff6cd',1,tick*2,'trooper',2.4);c.restore();}
        D.person(c,x,y,p.roll?'#fff6cd':'#8ce0d8',1,p.roll?tick*2:0,'trooper',this.duck?1.7:2.4);
        if(this.cd>=5&&!this.duck&&!p.roll){G.glow(c,x+4,y-40,16,'#ffe08a',0.9);D.rect(c,x+1,y-43,6,6,'#fff3c4');}
      }
      for(const t of this.tracers){
        const color=t.enemy?'#ff8d73':'#f8f6ba';
        if(G.high()){c.save();c.globalCompositeOperation='lighter';D.line(c,px(t.x),px(t.y),px(t.tx),px(t.ty),G.rgba(color,0.35),5);c.restore();}
        D.line(c,px(t.x),px(t.y),px(t.tx),px(t.ty),color,2);
        if(!t.enemy)G.glow(c,px(t.tx),px(t.ty),12,'#fff3c4',0.7);
      }
      const ax=px(this.aim.x),ay=px(this.aim.y),lock=this.enemies.some(e=>Math.abs(e.x-this.aim.x)<q(e.boss?62:24)&&Math.abs(e.y-this.aim.y)<q(e.boss?40:28));
      const ret=lock?'#ff9a7a':'#aef4bf';
      G.glow(c,ax,ay,22,ret,0.35);
      c.save();c.translate(ax,ay);c.rotate(lock?tick*0.05:0);c.strokeStyle=ret;c.lineWidth=2;c.strokeRect(-13,-13,26,26);c.restore();
      D.line(c,ax-20,ay,ax-7,ay,'#dbffb1');D.line(c,ax+7,ay,ax+20,ay,'#dbffb1');D.line(c,ax,ay-20,ax,ay-7,'#dbffb1');D.line(c,ax,ay+7,ax,ay+20,'#dbffb1');
      D.rect(c,ax-1,ay-1,2,2,'#ffffff');
      this.drawEffects(c);D.text(c,'ROLL '+(p.rollCD?'RECHARGING':'READY'),20,348,p.rollCD?'#d7c5a0':'#c2f874',11);
      for(let i=0;i<this.bombs;i++){D.ellipse(c,612-i*14,343,5,5,'#5c7a3a');D.rect(c,611-i*14,336,2,3,'#d8cfb6');}
    }
  };
  A.register({id:'breach',title:'Breach Protocol',subtitle:'Cover is a finite resource.',genre:'GALLERY SHOOTER',color:'#e3bc8d',number:'06',controls:['Aim · arrows / mouse','Z · fire · down · cover','X · dodge roll','Space · grenade'],description:'Three fortified compounds. Shoot marked targets, duck behind destructible cover and roll clear of incoming fire.'},()=>new A.Breach());
})(globalThis.Arcade2);
