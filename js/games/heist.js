/* Velvet Heist — original connected-maze heist. SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const D=A.Draw, TILE=16, COLS=29, ROWS=15;
  const center=(x,y)=>({x:(x+.5)*TILE,y:(y+.5)*TILE});
  const cell=p=>({x:Math.floor(p.x/TILE),y:Math.floor(p.y/TILE)});
  function maze(seed) {
    const rand=A.rng(seed), grid=Array.from({length:ROWS},()=>Array(COLS).fill(1));
    const stack=[[1,1]]; grid[1][1]=0;
    while(stack.length) { const [x,y]=stack[stack.length-1]; const choices=[[2,0],[-2,0],[0,2],[0,-2]].filter(([dx,dy])=>x+dx>0&&x+dx<COLS-1&&y+dy>0&&y+dy<ROWS-1&&grid[y+dy][x+dx]); if(!choices.length) {stack.pop();continue;} const [dx,dy]=choices[Math.floor(rand()*choices.length)];grid[y+dy/2][x+dx/2]=0;grid[y+dy][x+dx]=0;stack.push([x+dx,y+dy]); }
    // Loops make pursuit escapable; odd-cell fixture positions remain connected.
    for(let y=1;y<ROWS-1;y++) for(let x=1;x<COLS-1;x++) if(grid[y][x]&&((x%2) !== (y%2))&&rand()<.21) grid[y][x]=0;
    return grid;
  }
  function pathStep(grid, from, to) {
    const start=from.y*COLS+from.x, goal=to.y*COLS+to.x, queue=[start], seen=new Map([[start,-1]]);
    for(let i=0;i<queue.length;i++){ const n=queue[i];if(n===goal)break;const x=n%COLS,y=Math.floor(n/COLS);for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy,k=ny*COLS+nx;if(grid[ny]?.[nx]===0&&!seen.has(k)){seen.set(k,n);queue.push(k);}} }
    if(!seen.has(goal)||start===goal) return null;
    let k=goal;while(seen.get(k)!==start)k=seen.get(k);return {x:k%COLS,y:Math.floor(k/COLS)};
  }
  function stepActor(actor, dir, speed, dt, grid) {
    if(!actor.target && (dir.x||dir.y)) { const p=cell(actor), dx=Math.sign(dir.x),dy=dx?0:Math.sign(dir.y); if(grid[p.y+dy]?.[p.x+dx]===0) actor.target=center(p.x+dx,p.y+dy); }
    if(actor.target){ const dx=actor.target.x-actor.x,dy=actor.target.y-actor.y,n=Math.hypot(dx,dy),step=Math.min(speed*dt,n);if(n) {actor.x+=dx/n*step;actor.y+=dy/n*step;actor.walk=(actor.walk||0)+dt;} if(n<=speed*dt+.001){actor.x=actor.target.x;actor.y=actor.target.y;actor.target=null;} }
  }
  const ROOMS = [
    {name:'MOONLIT COURTYARD',floor:'#334653',wall:'#49655b',top:'#6d8a72',seed:813,loot:0},
    {name:'DIAMOND EXCHANGE',floor:'#3b3b54',wall:'#716779',top:'#a194a4',seed:814,loot:6},
    {name:'UPPER VAULT',floor:'#37475a',wall:'#687c8b',top:'#99adac',seed:815,loot:5},
    {name:'THE HOLLOW MINE',floor:'#37394d',wall:'#5a5265',top:'#7d7082',seed:816,loot:7},
    {name:'NIGHT WATCH LOCKUP',floor:'#2f4059',wall:'#576a83',top:'#8c9caa',seed:817,loot:0}
  ];
  A.Heist = class extends A.Game {
    constructor(options,sound) {
      super({...options,players:1},sound);this.id='heist';this.room=0;this.lives=this.relaxed?5:3;this.captured=0;this.bank=0;this.carry=[];this.codes=new Set();this.ammo=8;this.smokes=3;this.smoke=0;this.safeProgress=0;this.safeOpen=false;this.total=22;this.bullets=[];this.cd=0;this.interactionCD=0;this.facing={x:1,y:0};this.rand=A.rng(700);
      this.rooms=ROOMS.map((r,index)=>({ ...r, grid:maze(r.seed),doors:[],items:[],enemies:[],index }));
      this.connect(0,27,1,1,1,13,'EXCHANGE','COURTYARD'); this.connect(1,27,1,2,1,13,'UPSTAIRS','EXCHANGE'); this.connect(0,27,13,3,1,1,'MINE','COURTYARD');this.connect(0,1,13,4,27,1,'LOCKUP','COURTYARD');
      this.car={...center(1,1),kind:'car',label:'GETAWAY CAR'};this.safe={...center(27,1),kind:'safe',label:'THE BIG SAFE'};this.jail={...center(1,13),kind:'jail',label:'HOLDING CELL'};
      for(const r of this.rooms){
        const occupied=[...r.doors,this.car,this.safe,this.jail]; const floors=[];
        for(let y=1;y<ROWS-1;y+=2)for(let x=1;x<COLS-1;x+=2){const p=center(x,y);if(occupied.every(o=>A.dist(o,p)>30))floors.push(p);}
        // Stable shuffle: distinct, reachable loot and code positions.
        for(let i=floors.length-1;i>0;i--){const j=Math.floor(this.rand()*(i+1));[floors[i],floors[j]]=[floors[j],floors[i]];}
        for(let i=0;i<r.loot;i++)r.items.push({...floors[i],kind:'gem',value:1,taken:false});
        if([1,3,4].includes(r.index))r.items.push({...floors[r.loot],kind:'code',value:0,taken:false});
        for(let i=0;i<(r.index===0?2:3);i++) { const pos=floors[floors.length-1-i];r.enemies.push({...pos,home:{...pos},target:null,kind:r.index===3?'ghost':'cop',walk:0,stun:0,think:0,goal:null}); }
      }
      this.player={...this.car,face:1,walk:0,inv:3,hp:1,target:null};
    }
    connect(a,x,y,b,xx,yy,label,backLabel) { this.rooms[a].doors.push({...center(x,y),to:b,spawn:center(xx,yy),label});this.rooms[b].doors.push({...center(xx,yy),to:a,spawn:center(x,y),label:backLabel}); }
    menu() {return {eyebrow:'THE NIGHT SHIFT · ONE PLAYER',title:'Take the gems. Leave quietly.',description:'Collect 18 loose diamonds and 3 code scraps across the exchange, mine and lockup. Crack the upper safe for 4 more gems. Bank all 22 at your getaway car.',details:'WASD / arrows move · J fires limited stun rounds · K smoke · E enters doors, banks loot, or holds to crack the safe. The car refills supplies. Ghosts ignore bullets. Rescue captured lives at the lockup.',button:'Start the heist',action:'start'};}
    action(id){if(id==='start'&&this.state==='briefing'){this.state='playing';this.say('E AT DOORS · BANK LOOT AT THE CAR · FIND 3 CODES',5);}}
    enter(index,spawn){this.room=index;this.player.x=spawn.x;this.player.y=spawn.y;this.player.target=null;this.player.inv=2;this.bullets=[];this.smoke=0;this.safeProgress=0;this.interactionCD=.4;this.say(ROOMS[index].name);}
    catchPlayer(){
      if(this.player.inv>0||this.state!=='playing')return;
      for(const item of this.carry){item.taken=false;item.x=this.player.x;item.y=this.player.y;const old=this.rooms.find(r=>r.items.includes(item));old.items.splice(old.items.indexOf(item),1);this.rooms[this.room].items.push(item);}
      this.carry=[];this.lives--;this.captured++;this.sound('hurt');
      if(this.lives<=0){this.finish(false);return;}
      this.enter(0,this.car);this.say('BUSTED! LOOT DROPPED. RESCUE A LIFE AT THE LOCKUP.',5);
    }
    interact(a,dt){
      const p=this.player,r=this.rooms[this.room];let near=null;
      for(const door of r.doors)if(A.dist(p,door)<17)near=door;
      if(this.room===0&&A.dist(p,this.car)<21)near=this.car;
      if(this.room===2&&A.dist(p,this.safe)<21)near=this.safe;
      if(this.room===4&&A.dist(p,this.jail)<21)near=this.jail;
      this.prompt=near?'E · '+near.label:'';
      if(!near||near.kind!=='safe'||!a.interact)this.safeProgress=0;
      if(!near||this.interactionCD>0)return;
      if(near.to!==undefined&&a.interactPressed){this.enter(near.to,near.spawn);return;}
      if(near.kind==='car'&&a.interactPressed){const n=this.carry.reduce((s,q)=>s+q.value,0);this.bank+=n;this.score+=n*500;this.carry=[];this.ammo=8;this.smokes=3;this.sound('pickup');this.say(n?'BANKED '+n+' GEMS. SUPPLIES REFILLED.':'SUPPLIES REFILLED. ALL 22 GEMS MUST COME HOME.');if(this.bank>=this.total)this.finish(true);}
      if(near.kind==='safe'&&!this.safeOpen&&a.interact){if(this.codes.size===3){this.safeProgress+=dt;this.prompt='CRACKING SAFE '+Math.floor(this.safeProgress/1.5*100)+'%';if(this.safeProgress>=1.5){this.safeOpen=true;const item={...this.safe,kind:'crown',value:4,taken:true};r.items.push(item);this.carry.push(item);this.score+=2000;this.sound('win');this.say('SAFE OPEN! TAKE THE 4 CROWN GEMS TO THE CAR.',5);}}else if(a.interactPressed)this.say('FIND ALL 3 CODE SCRAPS: EXCHANGE, MINE, LOCKUP.',4);}
      if(near.kind==='jail'&&a.interactPressed){if(this.captured>0){this.captured--;this.lives++;this.sound('pickup');this.say('ONE CREW MEMBER FREED. LIFE RESTORED.');}else this.say('NO CREW MEMBERS IN CUSTODY.');}
    }
    update(dt,inputs){
      if(this.state!=='playing')return;this.common(dt);const a=inputs[0]||A.emptyInput(),p=this.player,r=this.rooms[this.room];this.cd-=dt;this.interactionCD-=dt;p.inv=Math.max(0,p.inv-dt);this.smoke=Math.max(0,this.smoke-dt);
      if(a.x||a.y){this.facing=Math.abs(a.x)>=Math.abs(a.y)?{x:Math.sign(a.x),y:0}:{x:0,y:Math.sign(a.y)};if(a.x)p.face=Math.sign(a.x);}
      stepActor(p,{x:a.x,y:a.y},this.relaxed?79:71,dt,r.grid);
      if(a.fire&&this.cd<=0&&this.ammo>0){this.cd=.28;this.ammo--;this.bullets.push({x:p.x,y:p.y,vx:this.facing.x*175,vy:this.facing.y*175,life:1.3});this.sound('fire');}
      if(a.specialPressed&&this.smokes>0){this.smokes--;this.smoke=4;this.smokeAt={x:p.x,y:p.y};this.sound('boom');}
      for(const item of r.items)if(!item.taken&&A.dist(p,item)<10){item.taken=true;if(item.kind==='code'){this.codes.add(r.index);this.score+=300;this.say('CODE SCRAP FOUND · '+this.codes.size+'/3');}else this.carry.push(item);this.sound('pickup');}
      for(const e of r.enemies){
        e.stun=Math.max(0,e.stun-dt);if(e.stun>0)continue;
        if(this.smoke>0&&A.dist(e,this.smokeAt)<60&&e.kind==='cop')continue;
        if(e.kind==='ghost'){const target=A.dist(e,p)<110?p:e.home;const dir=A.unit(target.x-e.x,target.y-e.y);e.x+=dir.x*(this.relaxed?15:22)*dt;e.y+=dir.y*(this.relaxed?15:22)*dt;}
        else if(!e.target){e.think-=dt;if(e.think<=0){e.think=.15;const target=A.dist(e,p)<145?p:e.goal||e.home;const next=pathStep(r.grid,cell(e),cell(target));if(next){const at=cell(e);stepActor(e,{x:next.x-at.x,y:next.y-at.y},0,dt,r.grid);}else{const candidates=[];for(let y=1;y<ROWS;y+=2)for(let x=1;x<COLS;x+=2)if(!r.grid[y][x])candidates.push(center(x,y));e.goal=candidates[Math.floor(this.rand()*candidates.length)];}}}
        if(e.kind==='cop')stepActor(e,{x:0,y:0},this.relaxed?28:39,dt,r.grid);
        if(A.dist(p,e)<10){this.catchPlayer();if(this.room!==r.index||this.state!=='playing')return;}
      }
      for(const b of this.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;const at=cell(b);if(r.grid[at.y]?.[at.x]!==0)b.life=0;if(b.life>0)for(const e of r.enemies)if(e.kind==='cop'&&A.dist(e,b)<9){e.stun=4.5;b.life=0;this.score+=25;this.sound('hit');break;}}
      this.bullets=this.bullets.filter(b=>b.life>0);this.interact(a,dt);
    }
    status(){return ROOMS[this.room].name+' · Lives '+this.lives+' · Banked '+this.bank+'/22 · Bag '+this.carry.reduce((s,q)=>s+q.value,0)+' · Codes '+this.codes.size+'/3 · Rounds '+this.ammo+' · Smoke '+this.smokes;}
    render(c){
      const r=this.rooms[this.room];D.rect(c,0,0,480,270,'#142431');c.save();c.translate(8,26);
      D.rect(c,0,0,464,240,r.floor);
      for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        if(r.grid[y][x]){D.rect(c,x*16,y*16,16,16,r.wall);D.rect(c,x*16,y*16,16,3,r.top);D.rect(c,x*16+2,y*16+7,10,1,'#151e332b');D.rect(c,x*16+14,y*16+3,2,13,'#17233560');}
        else {D.rect(c,x*16+7,y*16+7,2,2,'#aec3c316');}
      }
      for(const door of r.doors){D.rect(c,door.x-7,door.y-7,14,14,'#dcb47d');D.rect(c,door.x-5,door.y-5,10,10,'#374b5c');D.text(c,'E',door.x,door.y-4,'#fee3b0',8,'center');const tx=A.clamp(door.x,44,420);D.text(c,door.label,tx,door.y>160?door.y-18:door.y+11,'#fff0c9',6,'center');}
      if(this.room===0){const p=this.car;D.rect(c,p.x-9,p.y-7,20,13,'#e3c084');D.rect(c,p.x-4,p.y-6,10,5,'#476376');D.rect(c,p.x-7,p.y+5,4,4,'#172331');D.rect(c,p.x+5,p.y+5,4,4,'#172331');D.text(c,'CAR',p.x,p.y+12,'#ffe2a4',6,'center');}
      if(this.room===2){const p=this.safe;D.rect(c,p.x-7,p.y-9,14,17,this.safeOpen?'#ada687':'#c5c4bb');D.rect(c,p.x-4,p.y-6,8,11,'#526575');D.text(c,this.safeOpen?'✓':'◉',p.x,p.y-4,'#ebde9e',7,'center');}
      if(this.room===4){const p=this.jail;D.rect(c,p.x-7,p.y-7,14,14,'#182b3d');for(let i=-5;i<8;i+=4)D.rect(c,p.x+i,p.y-8,1,16,'#abbfc5');}
      for(const item of r.items)if(!item.taken){if(item.kind==='code'){D.rect(c,item.x-5,item.y-5,10,11,'#f4d7ad');D.rect(c,item.x-3,item.y-2,6,2,'#675a67');}else D.gem(c,item.x,item.y,'#9ae8d6',.7);}
      for(const e of r.enemies){if(e.kind==='ghost'){const yy=e.y+Math.sin(this.time*3+e.x)*2;c.globalAlpha=.65;D.rect(c,e.x-6,yy-10,12,13,'#b4a5de');D.rect(c,e.x-4,yy-13,8,3,'#b4a5de');D.rect(c,e.x-3,yy-8,2,3,'#403751');D.rect(c,e.x+2,yy-8,2,3,'#403751');c.globalAlpha=1;}else{D.person(c,{...e,face:this.player.x<e.x?-1:1},'soldier',e.stun>0?'#5e7a83':'#8babc9',.55);if(e.stun>0)D.text(c,'z z',e.x,e.y-22,'#f8d29a',7,'center');}}
      for(const b of this.bullets)D.rect(c,b.x-1,b.y-1,3,3,'#fff0bb');
      D.person(c,this.player,'thief','#e4c494',.6);
      if(this.smoke>0){c.globalAlpha=.35;for(let i=0;i<7;i++){c.fillStyle='#c6d3ca';c.beginPath();c.arc(this.smokeAt.x+Math.sin(i*9)*23,this.smokeAt.y+Math.cos(i*4)*20,22,0,Math.PI*2);c.fill();}c.globalAlpha=1;}
      c.restore();
      D.hud(c,this,'VELVET HEIST  ♥ '+this.lives,'BANK '+this.bank+'/22  BAG '+this.carry.reduce((s,q)=>s+q.value,0)+'  CODE '+this.codes.size+'/3');
      if(this.prompt&&this.messageTime<=0){D.rect(c,128,246,224,20,'#101b2ae8');D.text(c,this.prompt,240,252,'#ffdfa0',8,'center');}
    }
  };
  A.Heist.maze=maze; A.Heist.pathStep=pathStep; A.Heist.cell=cell; A.Heist.center=center;
})(globalThis.Arcade);
