/* Velvet Heist — original C64-style arcade adventure. SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const D = A.Draw, TILE = 16, COLS = 29, ROWS = 15;
  const center = (x,y) => ({x:(x+.5)*TILE,y:(y+.5)*TILE});
  const cell = p => ({x:Math.floor(p.x/TILE),y:Math.floor(p.y/TILE)});
  // Original, authored floor plans: recognisable landmarks and escape loops,
  // rather than a new procedural labyrinth in every building.
  const PLANS = [
    [[4,3,6,3],[14,3,3,5],[21,4,5,4],[4,9,6,3],[12,10,7,2]],
    [[3,4,7,2],[13,2,2,4],[18,4,8,2],[5,8,8,3],[17,9,3,3],[23,10,3,2]],
    [[3,3,7,2],[13,2,3,3],[19,5,7,2],[4,8,6,3],[13,9,4,3],[23,9,3,3]],
    [[3,3,7,1],[13,2,2,5],[19,3,7,2],[5,6,4,4],[11,9,4,3],[19,8,3,4]],
    [[3,3,9,2],[16,2,2,5],[21,3,5,3],[4,7,7,2],[13,10,11,2]],
    [[4,3,6,3],[14,2,2,8],[20,3,6,2],[4,9,7,3],[20,8,5,4]],
    [[4,2,2,7],[10,4,7,2],[21,2,2,8],[9,9,8,3],[25,6,1,4]]
  ];
  const ROOMS = [
    {name:'THE GARDEN',wall:'#59a14f',loot:[[3,7]],police:true},
    {name:'EXCHANGE / GROUND FLOOR',wall:'#8b7ac7',loot:[[3,3],[9,1],[15,7],[21,11],[27,9]],police:true},
    {name:'EXCHANGE / SAFE FLOOR',wall:'#6c86c8',loot:[[7,1],[13,7],[21,3],[21,11]],police:true},
    {name:'THE GHOST MINE',wall:'#986d50',loot:[[5,1],[11,5],[17,9]],ghosts:true},
    {name:'POLICE STATION',wall:'#698ad0',loot:[],police:true},
    {name:'EXCHANGE / SERVICE FLOOR',wall:'#93908b',loot:[[13,1]],police:true},
    {name:'THE DARK GALLERY',wall:'#78649c',loot:[[1,1],[3,11],[15,7],[25,13]],ghosts:true,dark:true}
  ];
  function layout(index) {
    const grid=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>x===0||y===0||x===COLS-1||y===ROWS-1?1:0));
    for(const [x,y,w,h] of PLANS[index])for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)grid[yy][xx]=1;
    return grid;
  }
  function pathStep(grid, from, to) {
    const start=from.y*COLS+from.x,goal=to.y*COLS+to.x,queue=[start],seen=new Map([[start,-1]]);
    for(let i=0;i<queue.length;i++){
      const n=queue[i];if(n===goal)break;const x=n%COLS,y=Math.floor(n/COLS);
      for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy,k=ny*COLS+nx;if(grid[ny]?.[nx]===0&&!seen.has(k)){seen.set(k,n);queue.push(k);}}
    }
    if(!seen.has(goal)||start===goal)return null;
    let k=goal;while(seen.get(k)!==start)k=seen.get(k);return{x:k%COLS,y:Math.floor(k/COLS)};
  }
  function stepActor(actor,dir,speed,dt,grid){
    if(!actor.target&&(dir.x||dir.y)){const at=cell(actor),dx=Math.sign(dir.x),dy=dx?0:Math.sign(dir.y);if(grid[at.y+dy]?.[at.x+dx]===0)actor.target=center(at.x+dx,at.y+dy);}
    if(actor.target){const dx=actor.target.x-actor.x,dy=actor.target.y-actor.y,n=Math.hypot(dx,dy),step=Math.min(speed*dt,n);if(n){actor.x+=dx/n*step;actor.y+=dy/n*step;actor.walk=(actor.walk||0)+dt;}if(n<=speed*dt+.001){actor.x=actor.target.x;actor.y=actor.target.y;actor.target=null;}}
  }
  A.Heist = class extends A.Game {
    constructor(options,sound){
      super({...options,players:1},sound);this.id='heist';this.room=0;this.lives=this.relaxed?5:3;this.captured=0;this.bank=0;this.carry=[];this.ammo=8;this.key=false;this.tnt=false;this.code=false;this.torch=0;this.safeOpen=false;this.wardenGone=false;this.safeProgress=0;this.total=22;this.heat=0;this.bullets=[];this.cd=0;this.interactionCD=0;this.facing={x:1,y:0};this.turn=null;this.turnTime=0;this.transition=0;this.chopper=null;this.chopperTimer=20;this.rand=A.rng(700);
      this.rooms=ROOMS.map((r,index)=>({...r,index,grid:layout(index),doors:[],items:r.loot.map(([x,y])=>({...center(x,y),kind:'gem',value:1,taken:false})),enemies:[],spawnTimer:10,pending:null}));
      this.connect(0,15,13,1,1,13,'EXCHANGE','GARDEN');
      this.connect(0,27,1,4,1,13,'POLICE','GARDEN');
      this.connect(0,1,13,3,27,1,'MINE','GARDEN');
      this.connect(1,27,1,2,1,13,'LIFT UP','LIFT DOWN','lift');
      this.connect(2,27,13,5,1,13,'SERVICE LIFT','LIFT DOWN','lift','key');
      this.connect(3,1,13,6,27,1,'DARK GALLERY','MINE','door','warden');
      this.car={...center(1,1),kind:'car',label:'BANK / RELOAD'};
      this.safe={...center(27,1),kind:'safe',label:'HOLD E: SAFE'};
      this.jail={...center(27,1),kind:'jail',label:'FREE A CREWMATE'};
      this.warden={...center(1,11)};
      this.rooms[4].items.push({...center(1,1),kind:'key',taken:false});
      this.rooms[3].items.push({...center(25,11),kind:'tnt',taken:false});
      this.rooms[5].items.push({...center(27,1),kind:'code',taken:false});
      for(const r of this.rooms){
        const positions=r.index===0?[[27,3]]:r.ghosts?[[11,7],[27,9]]:[[27,7],[11,13]];
        for(const [x,y] of positions)r.enemies.push(this.enemy(center(x,y),r.ghosts?'ghost':'cop'));
      }
      this.player={...this.car,face:1,walk:0,inv:3,hp:1,target:null};
    }
    enemy(p,kind){return{...p,home:{...p},kind,target:null,walk:0,grace:1,think:0};}
    connect(a,x,y,b,xx,yy,label,backLabel,kind='door',lock=null){
      this.rooms[a].doors.push({...center(x,y),to:b,spawn:center(xx,yy),label,kind,lock});
      this.rooms[b].doors.push({...center(xx,yy),to:a,spawn:center(x,y),label:backLabel,kind});
    }
    menu(){return{eyebrow:'THE NIGHT SHIFT · ONE PLAYER',title:'One more diamond. One less bullet.',description:'Rob the exchange and haunted mine, then bank all 22 gems at the car. Police pursue you through the buildings. Shots buy space, but the next patrol is never far behind.',details:'WASD / arrows move · J fire (8 rounds; reload at car) · E doors / lifts / bank / safe · K TNT near the giant ghost. Find the key in the police station, the safe code upstairs, and a torch inside the safe. Free captured lives at the station.',button:'Start the heist',action:'start'};}
    action(id){if(id==='start'&&this.state==='briefing'){this.state='playing';this.say('8 ROUNDS. BANK AT THE CAR. KEY IN THE POLICE STATION.',5);}}
    enter(index,spawn){
      this.room=index;Object.assign(this.player,{x:spawn.x,y:spawn.y,target:null,inv:2});this.turn=null;this.bullets=[];this.safeProgress=0;this.interactionCD=.5;this.transition=.28;this.chopper=null;
      const r=this.rooms[index];r.spawnTimer=Math.max(r.spawnTimer,4);r.pending=null;
      for(const e of r.enemies)if(A.dist(e,spawn)<45){Object.assign(e,center(15,1));e.target=null;e.grace=2;}
      this.say(r.name,2);
    }
    bag(){return this.carry.reduce((n,item)=>n+item.value,0);}
    goal(){
      if(this.bank+this.bag()>=this.total)return'ALL GEMS FOUND — GET TO THE CAR';
      if(!this.key)return'POLICE STATION → FIND THE LIFT KEY';
      if(!this.code)return'SERVICE LIFT → FIND THE SAFE CODE';
      if(!this.safeOpen)return'SAFE FLOOR → HOLD E AT THE SAFE';
      if(!this.wardenGone)return'MINE → FIND TNT, THEN K NEAR THE GIANT GHOST';
      if(this.torch<=0&&this.rooms[6].items.some(i=>!i.taken))return'RECHARGE THE TORCH AT THE OPEN SAFE';
      return'COLLECT THE REMAINING GEMS AND BANK AT THE CAR';
    }
    catchPlayer(){
      if(this.player.inv>0||this.state!=='playing')return;
      // Drop at a reachable cell centre, even when caught mid-step.
      const dropped=center(cell(this.player).x,cell(this.player).y);
      for(const item of this.carry){const old=this.rooms.find(r=>r.items.includes(item));if(old)old.items.splice(old.items.indexOf(item),1);Object.assign(item,dropped,{taken:false,dropped:true});this.rooms[this.room].items.push(item);}
      this.carry=[];this.lives--;this.captured++;this.heat=Math.max(0,this.heat-1);this.sound('hurt');
      if(this.lives<=0){this.finish(false);return;}
      this.enter(0,this.car);this.ammo=8;this.say('BUSTED! BAG DROPPED. FREE YOUR CREW AT THE STATION.',5);
    }
    interact(a,dt){
      const p=this.player,r=this.rooms[this.room];let near=r.doors.find(d=>A.dist(p,d)<15);
      if(this.room===0&&A.dist(p,this.car)<20)near=this.car;
      if(this.room===2&&A.dist(p,this.safe)<20)near=this.safe;
      if(this.room===4&&A.dist(p,this.jail)<20)near=this.jail;
      this.prompt=near?'E · '+near.label:'';
      if(!near||near.kind!=='safe'||!a.interact)this.safeProgress=0;
      if(!near||this.interactionCD>0)return;
      if(near.to!==undefined&&a.interactPressed){
        if(near.lock==='key'&&!this.key){this.say('SERVICE LIFT LOCKED. THE KEY IS IN THE POLICE STATION.');return;}
        if(near.lock==='warden'&&!this.wardenGone){this.say('THE GIANT GHOST BLOCKS THE GALLERY. FIND TNT.');return;}
        this.sound(near.kind==='lift'?'lift':'select');this.enter(near.to,near.spawn);return;
      }
      if(near.kind==='car'&&a.interactPressed){const n=this.bag();this.bank+=n;this.score+=n*500;this.carry=[];this.ammo=8;this.heat=Math.max(0,this.heat-1);this.sound('bank');this.say(n?'BANKED '+n+' GEMS · 8 ROUNDS READY':'8 ROUNDS READY · '+this.bank+'/22 GEMS HOME');if(this.bank>=this.total)this.finish(true);}
      if(near.kind==='safe'&&a.interact){
        if(!this.code){if(a.interactPressed)this.say('THE SAFE CODE IS ON THE SERVICE FLOOR.');return;}
        if(this.safeOpen){if(a.interactPressed){this.torch=this.relaxed?85:55;this.sound('pickup');this.say('TORCH RECHARGED. RETURN TO THE DARK GALLERY.');}return;}
        this.safeProgress+=dt;this.prompt='SAFE 4–1–7 · HOLD E '+Math.min(100,Math.floor(this.safeProgress/1.8*100))+'%';
        if(this.safeProgress>=1.8){this.safeOpen=true;this.torch=this.relaxed?85:55;const item={...this.safe,kind:'crown',value:4,taken:true};r.items.push(item);this.carry.push(item);this.score+=1000;this.sound('safe');this.say('SAFE OPEN! 4 GEMS + TORCH. BANK THEM OR PUSH ON?',5);}
      }
      if(near.kind==='jail'&&a.interactPressed){if(this.captured>0){this.captured--;this.lives++;this.sound('pickup');this.say('CREWMATE FREED. LIFE RESTORED.');}else this.say('NO CREW IN CUSTODY. THE KEY IS AT THE FAR END.');}
    }
    patrols(dt,r){
      if(!r.police)return;
      r.spawnTimer-=dt;
      if(r.pending){
        r.pending.time-=dt;
        if(r.pending.time<=0){const door=r.pending.door;if(A.dist(this.player,door)>40&&r.enemies.length<4){r.enemies.push(this.enemy(door,'cop'));r.pending=null;r.spawnTimer=(this.relaxed?17:12)-this.heat;}else r.pending.time=.6;}
      }else if(r.spawnTimer<=0&&r.enemies.length<4){
        const doors=r.doors.filter(d=>A.dist(this.player,d)>64);
        if(doors.length){const door=doors[Math.floor(this.rand()*doors.length)];r.pending={door,time:2};this.sound('alert');}else r.spawnTimer=1;
      }
    }
    update(dt,inputs){
      if(this.state!=='playing')return;this.common(dt);
      const a=inputs[0]||A.emptyInput(),p=this.player,r=this.rooms[this.room];
      this.cd-=dt;this.interactionCD-=dt;this.transition=Math.max(0,this.transition-dt);p.inv=Math.max(0,p.inv-dt);this.heat=Math.max(0,this.heat-dt*.018);
      if(r.dark)this.torch=Math.max(0,this.torch-dt);
      // Remember a requested turn briefly so intersections do not require pixel-perfect timing.
      if(a.x||a.y){this.turn=Math.abs(a.x)>=Math.abs(a.y)?{x:Math.sign(a.x),y:0}:{x:0,y:Math.sign(a.y)};this.turnTime=.22;}
      else this.turnTime-=dt;
      if(this.turn&&this.turnTime>0&&!p.target){this.facing={...this.turn};if(this.turn.x)p.face=this.turn.x;}
      stepActor(p,this.turnTime>0&&this.turn?this.turn:{x:0,y:0},this.relaxed?79:71,dt,r.grid);
      if(a.fire&&this.cd<=0){this.cd=.24;if(this.ammo>0){this.ammo--;this.heat=Math.min(4,this.heat+.2);this.bullets.push({x:p.x,y:p.y,vx:this.facing.x*205,vy:this.facing.y*205,life:1.6});this.sound('heistShot');}else{this.sound('empty');this.say('EMPTY! GET BACK TO THE CAR.',1);}}
      if(a.specialPressed){
        if(this.room===3&&!this.wardenGone&&A.dist(p,this.warden)<68&&this.tnt){this.tnt=false;this.wardenGone=true;this.effects.add('blast',this.warden.x,this.warden.y,'#ffffff',30,.35);this.sound('boom');this.say('GALLERY OPEN. TAKE A TORCH INTO THE DARK.');}
        else this.say(this.tnt?'K NEAR THE GIANT GHOST TO USE TNT.':'FIND TNT IN THE MINE.',2);
      }
      for(const item of r.items)if(!item.taken&&A.dist(p,item)<9){
        item.taken=true;this.sound('pickup');
        if(item.kind==='key'){this.key=true;this.say('LIFT KEY. THE SERVICE FLOOR IS ABOVE THE SAFE.');}
        else if(item.kind==='tnt'){this.tnt=true;this.say('TNT FOUND. K NEAR THE GIANT GHOST.');}
        else if(item.kind==='code'){this.code=true;this.say('SAFE COMBINATION: 4–1–7. RETURN TO THE SAFE FLOOR.');}
        else{this.carry.push(item);this.heat=Math.min(4,this.heat+.12);}
      }
      for(const b of this.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;const at=cell(b);if(r.grid[at.y]?.[at.x]!==0)b.life=0;if(b.life>0)for(const e of r.enemies)if(!e.dead&&A.dist(e,b)<10){e.dead=true;b.life=0;this.effects.add('ring',e.x,e.y,e.kind==='ghost'?'#bba7ff':'#9dccff',10,.22);this.sound('hit');break;}}
      this.bullets=this.bullets.filter(b=>b.life>0).slice(-12);r.enemies=r.enemies.filter(e=>!e.dead);
      for(const e of r.enemies){
        e.grace=Math.max(0,e.grace-dt);
        if(e.kind==='ghost'){const target=A.dist(e,p)<150?p:e.home,dir=A.unit(target.x-e.x,target.y-e.y);e.x+=dir.x*(this.relaxed?18:26)*dt;e.y+=dir.y*(this.relaxed?18:26)*dt;}
        else{
          if(!e.target){e.think-=dt;if(e.think<=0){e.think=.12;const next=pathStep(r.grid,cell(e),cell(p));if(next){const at=cell(e);stepActor(e,{x:next.x-at.x,y:next.y-at.y},0,dt,r.grid);}}}
          stepActor(e,{x:0,y:0},this.relaxed?37:49+Math.min(4,this.bag()*.4),dt,r.grid);
        }
        if(e.grace<=0&&A.dist(p,e)<9){this.catchPlayer();if(this.room!==r.index||this.state!=='playing')return;}
      }
      if(this.room===3&&!this.wardenGone&&A.dist(p,this.warden)<15){this.catchPlayer();if(this.room!==r.index||this.state!=='playing')return;}
      this.patrols(dt,r);
      if(this.room===0){
        this.chopperTimer-=dt;
        if(!this.chopper&&this.chopperTimer<=0){this.chopper={x:-24,y:p.y,warning:2};this.chopperTimer=this.relaxed?32:24;this.sound('alert');this.say('CHOPPER INBOUND — CLEAR THE MARKED ROW!',2);}
        if(this.chopper){const h=this.chopper;if(h.warning>0)h.warning-=dt;else{h.x+=150*dt;if(A.dist(p,h)<13){this.catchPlayer();return;}if(h.x>490)this.chopper=null;}}
      }
      this.interact(a,dt);
    }
    status(){const r=this.rooms[this.room];return r.name+' · Lives '+this.lives+' · Bank '+this.bank+'/22 · Bag '+this.bag()+' · Rounds '+this.ammo+' · '+(this.key?'Key ✓ · ':'')+(this.code?'Code 417 · ':'')+(this.tnt?'TNT · ':'')+(this.safeOpen?'Torch '+Math.ceil(this.torch)+'s · ':'')+this.goal();}
    visible(p){return !this.rooms[this.room].dark||A.dist(p,this.player)<(this.torch>0?86:27);}
    render(c){
      const r=this.rooms[this.room];D.rect(c,0,0,480,270,'#090914');
      D.text(c,'LIVES '+this.lives+'  BANK '+this.bank+'/22+'+this.bag(),8,6,'#e6e1cf',8);
      D.text(c,'ROUNDS '+this.ammo+'  '+(this.key?'KEY ':'')+(this.tnt?'TNT ':'')+(this.code?'417 ':''),472,6,this.ammo<3?'#ef967f':'#a9c6ee',8,'right');
      D.text(c,r.name,8,19,r.wall,7);D.text(c,r.dark?'TORCH '+Math.ceil(this.torch)+'s':'LOOSE GEMS '+r.items.filter(i=>!i.taken&&i.kind!=='key'&&i.kind!=='tnt'&&i.kind!=='code').reduce((n,i)=>n+i.value,0),472,19,'#b5b2bc',7,'right');
      c.save();c.translate(8,30);
      for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        const p=center(x,y);if(!this.visible(p))continue;
        if(r.grid[y][x])D.rect(c,x*16,y*16,15,15,r.wall);
        else if(!r.dark)D.rect(c,x*16+7,y*16+7,1,1,'#3b3546');
      }
      for(const door of r.doors)if(this.visible(door)){
        const locked=door.lock==='key'&&!this.key||door.lock==='warden'&&!this.wardenGone;
        D.rect(c,door.x-7,door.y-7,14,14,locked?'#9b6176':'#baae70');D.text(c,door.kind==='lift'?'↕':'E',door.x,door.y-5,'#090914',10,'center');
        D.text(c,door.label,A.clamp(door.x,40,424),door.y>160?door.y-17:door.y+10,'#ded79e',6,'center');
      }
      if(this.room===0){const p=this.car;D.rect(c,p.x-9,p.y-6,21,12,'#d9d98f');D.rect(c,p.x-3,p.y-5,8,5,'#4e67aa');D.rect(c,p.x-7,p.y+5,4,3,'#a8a8a8');D.rect(c,p.x+6,p.y+5,4,3,'#a8a8a8');D.text(c,'CAR',p.x,p.y+11,'#ece9a9',6,'center');}
      if(this.room===2){const p=this.safe;D.rect(c,p.x-7,p.y-8,14,16,'#b8c1c9');D.rect(c,p.x-5,p.y-6,10,12,'#424258');D.text(c,this.safeOpen?'T':'S',p.x,p.y-4,'#e4dfae',8,'center');if(this.safeProgress>0&&!this.safeOpen)D.bar(c,p.x-16,p.y+10,32,this.safeProgress,1.8,'#efe6a3');}
      if(this.room===4){const p=this.jail;for(let i=-7;i<8;i+=4)D.rect(c,p.x+i,p.y-8,2,16,'#b9c3d7');D.text(c,'CREW '+this.captured,p.x-4,p.y+11,'#a7c1ef',6,'right');}
      if(this.room===3&&!this.wardenGone){this.drawGhost(c,this.warden,2.1);D.text(c,'TNT',this.warden.x+20,this.warden.y-5,'#efbfb4',7);}
      for(const item of r.items)if(!item.taken&&this.visible(item)){
        if(item.kind==='gem'||item.kind==='crown'){D.gem(c,item.x,item.y,'#a9e4e2',.65);if(item.dropped)D.rect(c,item.x-6,item.y+7,12,1,'#f3c78f');}
        else{D.rect(c,item.x-6,item.y-6,12,12,'#e5ca8c');D.text(c,item.kind==='key'?'K':item.kind==='tnt'?'T':'C',item.x,item.y-4,'#262136',8,'center');}
      }
      for(const e of r.enemies)if(this.visible(e)){if(e.kind==='ghost')this.drawGhost(c,e);else D.person(c,{...e,face:this.player.x<e.x?-1:1},'soldier','#8aade8',.6);}
      for(const b of this.bullets)if(this.visible(b))D.rect(c,b.x-1,b.y-1,3,3,'#fff7ca');
      D.person(c,this.player,'thief','#e1ddd1',.6);this.effects.draw(c);
      if(r.pending){const p=r.pending.door;if(Math.floor(this.time*6)%2)D.text(c,'!',p.x,p.y-20,'#fa9a86',13,'center');}
      if(this.chopper){const h=this.chopper;if(h.warning>0){c.globalAlpha=.35;D.rect(c,0,h.y-3,464,6,'#f7c16f');c.globalAlpha=1;}else{D.rect(c,h.x-12,h.y-6,24,12,'#aab4ca');D.rect(c,h.x+11,h.y-2,13,3,'#8d99b0');D.rect(c,h.x-7,h.y-5,6,7,'#4b6295');D.rect(c,h.x-18,h.y-10,36,2,'#e0dfd1');}}
      if(this.transition>0){c.globalAlpha=this.transition;D.rect(c,0,0,464,240,'#101020');c.globalAlpha=1;}
      c.restore();
      const text=this.messageTime>0?this.message:this.prompt||this.goal();
      D.rect(c,0,251,480,19,'#090914ed');D.text(c,text,240,257,'#e7dfb7',7,'center');
    }
    drawGhost(c,p,scale=1){
      c.save();c.translate(p.x,p.y+Math.sin(this.time*4+p.x)*2);c.scale(scale,scale);D.rect(c,-6,-9,12,12,'#b6a0e2');D.rect(c,-4,-12,8,3,'#b6a0e2');D.rect(c,-5,-6,3,3,'#20203e');D.rect(c,2,-6,3,3,'#20203e');for(let i=-6;i<6;i+=4)D.rect(c,i,3,2,3,'#b6a0e2');c.restore();
    }
  };
  A.Heist.layout=layout;A.Heist.pathStep=pathStep;A.Heist.cell=cell;A.Heist.center=center;
})(globalThis.Arcade);
