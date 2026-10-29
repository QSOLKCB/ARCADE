/* Original five-board brick breaker. SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  const D=A.Draw,COLORS=['#de87b6','#edaa7d','#ead281','#a4d69e','#74cbd6','#aaa1e4'];
  const NAMES=['SPECTRUM','CROSSCURRENT','GLASS GARDEN','STAGGERED SIGNAL','THE LAST PRISM'];
  A.Breaker=class extends A.Game{
    constructor(options,sound){super(options,sound);this.id='breaker';this.options.players=1;this.stage=0;this.lives=this.relaxed?5:3;this.rand=A.rng(7841);this.destroyed=0;this.setup();}
    setup(){
      this.paddle={x:240,width:this.relaxed?88:68,vx:0};this.baseWidth=this.paddle.width;this.bricks=[];this.drops=[];this.lasers=[];this.wide=0;this.laser=0;this.laserCD=0;this.slow=0;this.particles.items=[];this.effects.items=[];
      for(let row=0;row<6;row++)for(let col=0;col<10;col++){
        if(this.stage===1&&(row+col)%4===0)continue;
        if(this.stage===2&&Math.abs(col-4.5)>4-row*.4)continue;
        if(this.stage===3&&(col+row*2)%5===0)continue;
        const hp=1+(this.stage>=2&&row<3?1:0)+(this.stage===4&&col%3===0?1:0);
        this.bricks.push({x:25+col*43,y:48+row*18,w:40,h:14,hp,maxHP:hp,row});
      }
      this.attach();
    }
    attach(){this.balls=[{x:this.paddle.x,y:234,vx:0,vy:0,attached:true,trail:[]}];}
    menu(){return{eyebrow:'PRISM BREAK · BOARD '+(this.stage+1)+' / 5',title:this.state==='stageclear'?'Shattered. Keep the ball rolling.':'A paddle. A ball. One more brick.',description:'Clear five original boards. Aim with the edge of your paddle. Catch falling capsules for a wider paddle, slower balls, multiball or twin lasers. Armoured bricks take extra hits.',details:'Mouse or left/right moves · J / Space / A launches · hold J for lasers while powered · WIDE, MULTI, SLOW and LASER capsules fall toward you. Losing all balls costs one life.',button:this.state==='stageclear'?'Next board':'Start breaking',action:'start'};}
    action(id){if(id!=='start')return;if(this.state==='stageclear'){this.stage++;this.setup();this.state='playing';}else if(this.state==='briefing')this.state='playing';}
    hitBrick(brick){
      if(brick.hp<=0)return;brick.hp--;this.score+=25;this.sound('hit');
      if(brick.hp===0){this.score+=75;this.destroyed++;this.particles.burst(brick.x+20,brick.y+7,COLORS[brick.row],10,65);
        if(this.destroyed%6===0&&this.drops.length<6){const kinds=['wide','multi','slow','laser'];this.drops.push({x:brick.x+20,y:brick.y+7,kind:kinds[(this.destroyed/6-1)%4]});}
      }
    }
    power(kind){
      this.sound('pickup');this.say(kind.toUpperCase()+'!',1.3);
      if(kind==='wide')this.wide=18;
      if(kind==='laser')this.laser=16;
      if(kind==='slow')this.slow=15;
      if(kind==='multi'){
        const source=this.balls.find(b=>!b.attached)||this.balls[0];if(!source)return;
        for(const angle of[-2.15,-.98])if(this.balls.length<5)this.balls.push({x:source.x,y:source.y,vx:Math.cos(angle)*240,vy:Math.sin(angle)*240,attached:false,trail:[]});
      }
    }
    updateBall(b,dt){
      const r=4,ox=b.x,oy=b.y,rate=this.slow>0?.72:1;
      b.x+=b.vx*dt*rate;b.y+=b.vy*dt*rate;
      if(b.x<18+r||b.x>462-r){b.x=A.clamp(b.x,18+r,462-r);b.vx=(b.x<240?1:-1)*Math.abs(b.vx);this.sound('hit');}
      if(b.y<31+r){b.y=31+r;b.vy=Math.abs(b.vy);this.sound('hit');}
      const p=this.paddle;
      if(b.vy>0&&oy+r<=243&&b.y+r>=241&&b.x>=p.x-p.width/2-r&&b.x<=p.x+p.width/2+r){
        b.y=237;const offset=A.clamp((b.x-p.x)/(p.width/2),-1,1),angle=-Math.PI/2+offset*1.06,speed=Math.min(350,Math.hypot(b.vx,b.vy)+5);
        b.vx=Math.cos(angle)*speed+p.vx*.06;b.vy=Math.sin(angle)*speed;this.sound('hit');this.effects.add('ring',b.x,241,'#b8e9eb',12,.2);
      }
      for(const brick of this.bricks){
        if(brick.hp<=0||b.x+r<brick.x||b.x-r>brick.x+brick.w||b.y+r<brick.y||b.y-r>brick.y+brick.h)continue;
        if(oy+r<=brick.y){b.y=brick.y-r;b.vy=-Math.abs(b.vy);}
        else if(oy-r>=brick.y+brick.h){b.y=brick.y+brick.h+r;b.vy=Math.abs(b.vy);}
        else if(ox<brick.x){b.x=brick.x-r;b.vx=-Math.abs(b.vx);}
        else{b.x=brick.x+brick.w+r;b.vx=Math.abs(b.vx);}
        this.hitBrick(brick);break;
      }
      const speed=Math.hypot(b.vx,b.vy);if(speed>350){b.vx*=350/speed;b.vy*=350/speed;}
    }
    update(dt,inputs){
      if(this.state!=='playing')return;this.common(dt);const a=inputs[0]||A.emptyInput(),p=this.paddle,old=p.x;
      this.wide=Math.max(0,this.wide-dt);this.laser=Math.max(0,this.laser-dt);this.slow=Math.max(0,this.slow-dt);this.laserCD-=dt;p.width=this.baseWidth+(this.wide>0?40:0);
      const target=a.aim&&!a.x?a.aim.x:p.x+a.x*340*dt;p.x=A.clamp(p.x+A.clamp(target-p.x,-600*dt,600*dt),20+p.width/2,460-p.width/2);p.vx=(p.x-old)/dt;
      for(const b of this.balls){
        if(b.attached){b.x=p.x;b.y=234;if(a.fire||a.jumpPressed){b.attached=false;b.vx=90;b.vy=-220;this.sound('jump');}else continue;}
        for(let sub=0;sub<4;sub++)this.updateBall(b,dt/4);
        b.trail.push({x:b.x,y:b.y});if(b.trail.length>9)b.trail.shift();
      }
      if(this.laser>0&&a.fire&&this.laserCD<=0){this.laserCD=.22;for(const x of[p.x-p.width/2+4,p.x+p.width/2-4])this.lasers.push({x,y:238,life:1});this.sound('star');}
      for(const l of this.lasers){l.y-=300*dt;l.life-=dt;for(const brick of this.bricks)if(l.life>0&&brick.hp>0&&l.x>=brick.x&&l.x<=brick.x+brick.w&&l.y>=brick.y&&l.y<=brick.y+brick.h+5){this.hitBrick(brick);l.life=0;break;}}
      this.lasers=this.lasers.filter(l=>l.life>0&&l.y>28).slice(-30);
      for(const q of this.drops){q.y+=62*dt;if(q.y>=235&&q.y<=253&&Math.abs(q.x-p.x)<p.width/2+7){this.power(q.kind);q.y=300;}}
      this.drops=this.drops.filter(q=>q.y<280);
      this.balls=this.balls.filter(b=>b.y<279);
      if(this.bricks.every(b=>b.hp===0)){this.score+=1500+this.lives*100;if(this.stage===4)this.finish(true);else{this.state='stageclear';this.sound('win');}return;}
      if(!this.balls.length){this.lives--;this.sound('hurt');this.wide=this.laser=this.slow=0;this.drops=[];this.lasers=[];if(this.lives<=0)this.finish(false);else{this.attach();this.say('BALL LOST · J / SPACE TO LAUNCH',2);}}
    }
    status(){return NAMES[this.stage]+' · Board '+(this.stage+1)+'/5 · Lives '+this.lives+' · Bricks '+this.bricks.filter(b=>b.hp>0).length+' · Score '+this.score;}
    render(c){
      D.rect(c,0,0,480,270,'#11172b');
      for(let y=36;y<270;y+=18)for(let x=25;x<460;x+=18)D.rect(c,x,y,1,1,'#263449');
      D.rect(c,16,27,2,243,'#536983');D.rect(c,462,27,2,243,'#536983');D.rect(c,18,28,444,2,'#738fa4');
      D.text(c,NAMES[this.stage],240,178,'#283c58',20,'center');
      for(const b of this.bricks)if(b.hp>0){D.rect(c,b.x,b.y+3,b.w,b.h,'#0a1020');D.rect(c,b.x,b.y,b.w,b.h,COLORS[b.row]);D.rect(c,b.x+2,b.y+2,b.w-4,2,'#fff7d852');D.rect(c,b.x+2,b.y+b.h-3,b.w-4,2,'#101b2940');for(let i=1;i<b.hp;i++)D.rect(c,b.x+13+i*5,b.y+6,3,3,'#1f294b');}
      for(const b of this.balls){for(let i=0;i<b.trail.length;i++){c.globalAlpha=i/b.trail.length*.3;D.rect(c,b.trail[i].x-2,b.trail[i].y-2,4,4,'#f4edcf');}c.globalAlpha=1;c.fillStyle='#fff3cb';c.beginPath();c.arc(b.x,b.y,4,0,Math.PI*2);c.fill();}
      const p=this.paddle;D.rect(c,p.x-p.width/2,242,p.width,8,'#355373');D.rect(c,p.x-p.width/2,240,p.width,5,this.laser>0?'#f0a2be':'#9edcd7');D.rect(c,p.x-p.width/2+8,241,p.width-16,2,'#e3f9ec');
      for(const q of this.drops){D.rect(c,q.x-13,q.y-5,26,11,'#182b45');D.text(c,{wide:'WIDE',multi:'x3',slow:'SLOW',laser:'LASR'}[q.kind],q.x,q.y-3,'#f1d19b',7,'center');}
      for(const l of this.lasers)D.rect(c,l.x,l.y,2,7,'#ffabd1');
      this.particles.draw(c);this.effects.draw(c);D.hud(c,this,'BOARD '+(this.stage+1)+' / 5','LIVES '+this.lives+' / '+this.score);
      const buffs=[this.wide>0?'WIDE '+Math.ceil(this.wide):'',this.slow>0?'SLOW '+Math.ceil(this.slow):'',this.laser>0?'LASER '+Math.ceil(this.laser):''].filter(Boolean).join('  ');D.text(c,buffs,240,31,'#e8c3ac',7,'center');
      if(this.balls.some(b=>b.attached)&&this.state==='playing'&&this.messageTime<=0)D.text(c,'J / SPACE / A TO LAUNCH',240,215,'#b6d8d7',8,'center');
    }
  };
})(globalThis.Arcade);
