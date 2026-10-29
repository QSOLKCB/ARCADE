'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
for(const file of ['core','draw','games/void','games/brawl','games/breaker','games/chrono'])require('../js/'+file+'.js');
const A=globalThis.Arcade;
// Replays issue only normal player inputs / commands, with real damage, costs and lives.
function voidRun(mission,difficulty){
 const g=new A.Void({difficulty});g.action('mission'+mission);g.action('start');let orders=0;
 const order=s=>{orders++;if(!g.command(s))throw Error(s+' '+g.lastMessage);};
 function dock(){
   // Known depot positions are broadcast at the beginning; prefer already-clear depots.
   const ports=[[0,0],[4,3],[7,7]].filter(([x,y])=>!g.chart[y*8+x]?.enemies);
   ports.sort((a,b)=>Math.hypot(a[0]-g.ship.qx,a[1]-g.ship.qy)-Math.hypot(b[0]-g.ship.qx,b[1]-g.ship.qy));
   const [x,y]=ports[0];if(g.ship.qx!==x||g.ship.qy!==y)order(`JUMP ${x+1} ${y+1}`);
   if(g.sector.enemies.some(e=>e.hp>0))order('BEAM '+Math.min(1500,g.sector.enemies.filter(e=>e.hp>0).length*400));
   const p=g.ship,d=g.sector.depot,queue=[{x:p.x,y:p.y,path:[]}],seen=new Set([p.y*8+p.x]);let steps;
   for(let i=0;i<queue.length;i++){const q=queue[i];if(Math.hypot(q.x-d.x,q.y-d.y)<=1.5){steps=q.path;break;}for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const nx=q.x+dx,ny=q.y+dy,k=ny*8+nx;if(nx<0||nx>7||ny<0||ny>7||seen.has(k)||g.objectAt(g.sector,nx,ny))continue;seen.add(k);queue.push({x:nx,y:ny,path:[...q.path,[nx,ny]]});}}
   if(!steps)throw Error('No port path');
   // Compress straight courses where the public movement command reaches the waypoint.
   while(steps.length){let n=steps.length-1;for(;n>0;n--){const q={x:steps[n][0],y:steps[n][1]},ray=g.ray(g.ship,q);let reachable=false;for(const cell of ray){if(g.objectAt(g.sector,cell.x,cell.y))break;if(cell.x===q.x&&cell.y===q.y){reachable=true;break;}}if(reachable)break;}const q=steps[n];order(`MOVE ${q[0]+1} ${q[1]+1}`);steps=steps.slice(n+1);}
   order('DOCK');
 }
 while(g.state==='playing'&&orders<300){
   if(g.sector.enemies.some(e=>e.hp>0)){order('BEAM '+Math.min(1500,g.sector.enemies.filter(e=>e.hp>0).length*400));continue;}
   if(g.ship.energy<1600||g.ship.shield<180||g.ship.hull<50){dock();if(g.state!=='playing')break;}
   const known=g.chart.map((q,i)=>({...q,x:i%8,y:Math.floor(i/8)})).filter(q=>q.enemies>0);
   known.sort((a,b)=>Math.hypot(a.x-g.ship.qx,a.y-g.ship.qy)-Math.hypot(b.x-g.ship.qx,b.y-g.ship.qy));
   if(known.length){const q=known[0];order(`JUMP ${q.x+1} ${q.y+1}`);continue;}
   let best=null;
   for(let y=0;y<8;y++)for(let x=0;x<8;x++){let unknown=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const q=g.chart[(y+dy)*8+x+dx];if(x+dx>=0&&x+dx<8&&y+dy>=0&&y+dy<8&&(q===null||q.knownDepot))unknown++;}const value=unknown*10-Math.hypot(x-g.ship.qx,y-g.ship.qy);if(!best||value>best.value)best={x,y,value,unknown};}
   if(!best.unknown)break;
   if(g.ship.qx!==best.x||g.ship.qy!==best.y)order(`JUMP ${best.x+1} ${best.y+1}`);
   order('SCAN');
 }
 return g;
}

for(const difficulty of ['arcade','relaxed'])for(const mission of [1,2,3])test('Void campaign '+mission+' completes with chart-driven commands in '+difficulty,()=>{const g=voidRun(mission,difficulty);assert.equal(g.state,'victory');assert.equal(g.kills,g.total);assert.ok(g.ship.hull>0);assert.ok(g.days>0);});

for(const difficulty of ['arcade','relaxed'])for(const choice of [0,1,2])test('Basement Brawl fighter '+choice+' completes all five bouts in '+difficulty,()=>{
  const g=new A.Brawl({difficulty});g.action('fighter'+choice);g.action('start');let frames=0;
  while(g.state!=='victory'&&g.state!=='gameover'&&frames<30000){
    if(g.state==='stageclear'){g.action('start');continue;}
    const p=g.player,e=g.enemies.filter(e=>e.hp>0).sort((a,b)=>A.dist(a,p)-A.dist(b,p))[0],dx=e.x-p.x,dy=e.y-p.y;
    const a=A.emptyInput();a.x=Math.abs(dx)>31?Math.sign(dx):0;a.y=Math.abs(dy)>5?Math.sign(dy):0;
    a.fire=true;a.specialPressed=frames%40===0;a.jumpPressed=p.z===0;a.interact=e.windup>0&&p.z===0;
    if(dx*p.face<0)a.x=Math.sign(dx);
    g.update(1/60,[a]);frames++;
  }
  assert.equal(g.state,'victory');assert.equal(g.round,4);assert.ok(g.player.hp>0);
});

for(const difficulty of ['arcade','relaxed'])test('Prism Break clears all five boards with paddle input and real ball collisions in '+difficulty,()=>{
  const g=new A.Breaker({difficulty});g.action('start');let frames=0;
  while(g.state!=='victory'&&g.state!=='gameover'&&frames<60000){
    if(g.state==='stageclear'){g.action('start');continue;}
    const balls=g.balls.filter(b=>b.vy>0).sort((a,b)=>b.y-a.y),b=balls[0]||g.balls[0];let target=b.x;
    if(!b.attached&&b.vy>0){
      const projected=b.x+b.vx*(237-b.y)/b.vy,width=436;
      const folded=((projected-22)%(width*2)+width*2)%(width*2);
      target=22+(folded>width?2*width-folded:folded)+Math.sin(frames/300)*15;
    }
    g.update(1/60,[{...A.emptyInput(),aim:{x:target,y:240},fire:true}]);frames++;
  }
  assert.equal(g.state,'victory');assert.equal(g.stage,4);assert.ok(g.lives>0);
});

test('Chrono Wing completes five eras through steering, firing and evasive rolls in Relaxed',()=>{
  const g=new A.Chrono({difficulty:'relaxed'});g.action('start');let frames=0;
  while(g.state!=='victory'&&g.state!=='gameover'&&frames<30000){
    if(g.state==='stageclear'){g.action('start');continue;}
    const p=g.player,e=g.enemies.filter(e=>e.hp>0).sort((a,b)=>(A.dist(a,p)-(a.boss?70:0))-(A.dist(b,p)-(b.boss?70:0)))[0];
    const a=A.emptyInput();a.fire=true;
    if(e){const lead=A.dist(e,p)/340,speed=e.boss?60:66+g.stage*9;const d=A.unit(e.x+Math.cos(e.angle)*speed*lead-p.x,e.y+Math.sin(e.angle)*speed*lead-p.y);a.x=d.x;a.y=d.y;}
    else{a.x=Math.cos(p.angle+.005);a.y=Math.sin(p.angle+.005);}
    a.specialPressed=g.bullets.some(b=>b.enemy&&A.dist(b,p)<55)||g.enemies.some(e=>A.dist(e,p)<35);
    g.update(1/60,[a]);frames++;
  }
  assert.equal(g.state,'victory');assert.equal(g.stage,4);assert.ok(g.lives>0);
});
