/* Original software-projected 3D table and physics. SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const D = A.Draw, R = 7, MALLET = 16, END = 160, SIDE = 100, GOAL = 38;
  const AI = {
    rookie: { name: 'Rookie', speed: 125, reaction: .24, error: 25, predict: false },
    club: { name: 'Club', speed: 215, reaction: .12, error: 12, predict: true },
    expert: { name: 'Expert', speed: 295, reaction: .055, error: 4, predict: true }
  };
  // Camera at the near end, tilted down. Every surface uses the same 3D projection.
  function project(x, z, h = 0) {
    const scale = 500 / (540 - z * .78 - h * .62);
    return { x: 240 + x * scale, y: 132 + (z * .62 - h * .78) * scale, scale };
  }
  function unproject(p) {
    const v = p.y - 132, z = 540 * v / (310 + .78 * v);
    return { x: (p.x - 240) * (540 - z * .78) / 500, y: z };
  }
  function poly(c, points, color, line) {
    c.fillStyle = color; c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill();
    if (line) { c.strokeStyle = line; c.lineWidth = 1; c.stroke(); }
  }
  function slab(c, x1, z1, x2, z2, h, color) {
    const top = [[x1,z1],[x2,z1],[x2,z2],[x1,z2]].map(([x,z]) => project(x,z,h));
    poly(c, [top[1], project(x2,z1,-15),project(x2,z2,-15),top[2]], '#101d31');
    poly(c, [top[2],project(x2,z2,-15),project(x1,z2,-15),top[3]], '#172941');
    poly(c, top, color, '#6eb6c94a');
  }
  function cylinder(c, x, z, r, h, color, topColor) {
    const n=24;
    for(let i=0;i<n;i++) {
      const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;
      if(Math.sin((a+b)/2)<0)continue;
      poly(c,[project(x+Math.cos(a)*r,z+Math.sin(a)*r),project(x+Math.cos(b)*r,z+Math.sin(b)*r),project(x+Math.cos(b)*r,z+Math.sin(b)*r,h),project(x+Math.cos(a)*r,z+Math.sin(a)*r,h)],color);
    }
    poly(c,Array.from({length:n},(_,i)=>project(x+Math.cos(i/n*Math.PI*2)*r,z+Math.sin(i/n*Math.PI*2)*r,h)),topColor);
  }
  A.Hockey = class extends A.Game {
    constructor(options, sound) {
      super(options, sound); this.id='hockey'; this.options.players=1;
      this.options.aiDifficulty=AI[this.options.aiDifficulty]?this.options.aiDifficulty:(this.relaxed?'rookie':'club');
      this.ai=AI[this.options.aiDifficulty]; this.rand=A.rng(4127); this.goals=[0,0]; this.think=0; this.target={x:0,y:-112}; this.trail=[]; this.resetRally(1);
    }
    resetRally(direction) {
      this.player={x:0,y:112,vx:0,vy:0}; this.opponent={x:0,y:-112,vx:0,vy:0};
      this.puck={x:0,y:0,vx:(this.rand()-.5)*90,vy:direction*165};
      this.serve=1.2; this.jab=0; this.stall=0; this.trail=[];
    }
    menu() { return {eyebrow:'NEON AIR · '+this.ai.name.toUpperCase()+' OPPONENT',title:'Own your half. Find the angle.',description:'First to seven goals wins. Bank the puck off the rails, guard your slot, then step forward and strike. Your opponent has limited reaction time and movement speed.',details:'Mouse moves the cyan mallet · WASD / arrows or stick also work · J / A strikes toward goal when the puck is close. Choose Rookie, Club or Expert on the cabinet card.',button:'Take the table',action:'start'}; }
    action(id) { if(id==='start'&&this.state==='briefing')this.state='playing'; }
    moveMallet(p, target, speed, dt) {
      const dx=target.x-p.x,dy=target.y-p.y,n=Math.hypot(dx,dy),step=Math.min(n,speed*dt);
      p.vx=n?dx/n*step/dt:0; p.vy=n?dy/n*step/dt:0; p.x+=p.vx*dt; p.y+=p.vy*dt;
    }
    collide(p) {
      const b=this.puck,dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy),reach=MALLET+R;
      if(d>=reach)return;
      const nx=d>1e-8?dx/d:0,ny=d>1e-8?dy/d:(p.y>0?-1:1);
      b.x=p.x+nx*(reach+.01); b.y=p.y+ny*(reach+.01);
      const toward=(b.vx-p.vx)*nx+(b.vy-p.vy)*ny;
      if(toward<0){b.vx-=1.9*toward*nx;b.vy-=1.9*toward*ny;this.sound('hit');}
      const speed=Math.hypot(b.vx,b.vy);if(speed>680){b.vx*=680/speed;b.vy*=680/speed;}
    }
    scoreGoal(player) {
      this.goals[player]++;if(player===0)this.score+=1000;
      this.sound(player===0?'bank':'hurt');this.say(player===0?'GOAL!  NICE ANGLE.':'OPPONENT SCORES.  RESET.',1.2);
      if(this.goals[player]>=7){if(player===0)this.score+=(7-this.goals[1])*150;this.finish(player===0);return;}
      this.resetRally(player===0?1:-1);
    }
    update(dt, inputs) {
      if(this.state!=='playing')return;this.common(dt);const a=inputs[0]||A.emptyInput();this.jab-=dt;
      let target=a.aim&&!(a.x||a.y)?unproject(a.aim):{x:this.player.x+a.x*330*dt,y:this.player.y+a.y*330*dt};
      target={x:A.clamp(target.x,-SIDE+MALLET,SIDE-MALLET),y:A.clamp(target.y,MALLET,END-MALLET)};
      this.think-=dt;
      if(this.think<=0){
        this.think=this.ai.reaction;const b=this.puck;let x=b.x,y=-115;
        if(b.y<12){
          if(b.vy<0&&this.ai.predict){const t=Math.max(0,(-112-b.y)/b.vy);x+=b.vx*t;const width=2*(SIDE-R);let folded=((x+SIDE-R)%(width*2)+width*2)%(width*2);x=(folded>width?2*width-folded:folded)-(SIDE-R);}
          if(b.y<-30&&Math.abs(b.vy)<220)y=A.clamp(b.y+18,-140,-MALLET);
        }else x*=.45;
        this.target={x:A.clamp(x+(this.rand()-.5)*this.ai.error,-84,84),y};
      }
      if(this.serve>0){this.serve=Math.max(0,this.serve-dt);this.moveMallet(this.player,target,400,dt);this.moveMallet(this.opponent,this.target,this.ai.speed,dt);return;}
      for(let i=0;i<4;i++){
        const step=dt/4;this.moveMallet(this.player,target,400,step);this.moveMallet(this.opponent,this.target,this.ai.speed,step);
        const b=this.puck;b.x+=b.vx*step;b.y+=b.vy*step;
        this.collide(this.player);this.collide(this.opponent);
        if(a.fire&&this.jab<=0&&A.dist(this.player,b)<37&&b.y<this.player.y+2){b.vy=-440;b.vx+=(b.x-this.player.x)*8;this.jab=.4;this.sound('slash');}
        if(Math.abs(b.x)>SIDE-R){b.x=Math.sign(b.x)*(SIDE-R);b.vx=-Math.sign(b.x)*Math.abs(b.vx)*.995;this.sound('hit');}
        if(Math.abs(b.y)>END-R){
          if(Math.abs(b.x)<GOAL-R&&Math.abs(b.y)>END+R){this.scoreGoal(b.y<0?0:1);return;}
          if(Math.abs(b.x)>=GOAL-R){b.y=Math.sign(b.y)*(END-R);b.vy=-Math.sign(b.y)*Math.abs(b.vy)*.995;this.sound('hit');}
        }
        const speed=Math.hypot(b.vx,b.vy);if(speed>680){b.vx*=680/speed;b.vy*=680/speed;}
        b.vx*=Math.exp(-.025*step);b.vy*=Math.exp(-.025*step);
      }
      const speed=Math.hypot(this.puck.vx,this.puck.vy);this.stall=speed<25?this.stall+dt:0;
      if(this.stall>4){this.puck.vy=this.puck.y<0?-110:110;this.stall=0;this.say('PUCK RELEASED',1);}
      this.trail.push({x:this.puck.x,y:this.puck.y});if(this.trail.length>12)this.trail.shift();
    }
    status(){return 'You '+this.goals[0]+' : '+this.goals[1]+' '+this.ai.name+' · First to 7 · Mouse / arrows move · J strike';}
    render(c){
      D.rect(c,0,0,480,270,'#080e1b');
      for(let i=0;i<13;i++){D.rect(c,i*40,25,1,245,'#102337');D.rect(c,0,40+i*20,480,1,'#102337');}
      D.text(c,'NEON',32,75,'#5ad9dc',15);D.text(c,'AIR',39,94,'#f0c3ee',20);
      D.text(c,this.ai.name.toUpperCase(),402,100,'#e5a8da',8,'center');D.text(c,'FIRST TO 7',405,115,'#617b91',7,'center');
      slab(c,-112,-172,112,172,0,'#163e53');
      slab(c,-100,-160,100,160,1,'#123144');
      const line=(a,b,color)=>{c.strokeStyle=color;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();};
      for(let z=-140;z<160;z+=20)for(let x=-80;x<100;x+=20){const p=project(x,z,1);D.rect(c,p.x,p.y,1,1,'#2d6171');}
      line(project(-100,0,2),project(100,0,2),'#67e2df');
      c.strokeStyle='#427587';c.beginPath();for(let i=0;i<=48;i++){const p=project(Math.cos(i/48*Math.PI*2)*40,Math.sin(i/48*Math.PI*2)*40,2);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}c.stroke();
      slab(c,-112,-172,-GOAL,-160,10,'#dc7ac4');slab(c,GOAL,-172,112,-160,10,'#dc7ac4');
      for(const side of[-1,1])slab(c,side===-1?-112:100,-160,side===-1?-100:112,160,10,'#477e96');
      for(let i=0;i<this.trail.length;i++){const t=this.trail[i],p=project(t.x,t.y,2);c.globalAlpha=i/this.trail.length*.25;D.rect(c,p.x-2,p.y-1,4,2,'#fff1ae');}c.globalAlpha=1;
      const actors=[{...this.player,kind:'player'},{...this.opponent,kind:'opponent'},{...this.puck,kind:'puck'}].sort((a,b)=>a.y-b.y);
      for(const p of actors){
        const s=project(p.x+3,p.y+4,1);c.fillStyle='#0007';c.beginPath();c.ellipse(s.x,s.y,(p.kind==='puck'?10:19)*s.scale,6*s.scale,0,0,Math.PI*2);c.fill();
        if(p.kind==='puck')cylinder(c,p.x,p.y,R,5,'#a77e3f','#ffedb1');
        else{const human=p.kind==='player';cylinder(c,p.x,p.y,MALLET,8,human?'#167d90':'#9f397b',human?'#67e9e4':'#f39dd6');cylinder(c,p.x,p.y,7,18,human?'#2a9da6':'#bf5b9e',human?'#c9ffef':'#ffdaef');}
      }
      slab(c,-112,160,-GOAL,172,10,'#75dcd6');slab(c,GOAL,160,112,172,10,'#75dcd6');
      D.text(c,String(this.goals[0]).padStart(2,'0'),43,151,'#79ede2',25);D.text(c,String(this.goals[1]).padStart(2,'0'),395,151,'#f09cd9',25);
      if(this.serve>0&&this.state==='playing')D.text(c,'READY '+Math.ceil(this.serve),240,116,'#fff4d5',14,'center');
      D.hud(c,this,'NEON AIR / '+this.ai.name.toUpperCase(),'YOU '+this.goals[0]+' : '+this.goals[1]+' AI');
    }
  };
  A.Hockey.AI=AI;A.Hockey.project=project;A.Hockey.unproject=unproject;
})(globalThis.Arcade);
