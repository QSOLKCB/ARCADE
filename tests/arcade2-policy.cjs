'use strict';
const A=globalThis.Arcade2,px=A.px,q=A.q;
// These policies read state to choose control packets. They never change world state,
// grant health, kill targets, teleport, alter timers or bypass stage transitions.
// They establish finite completion in the simulation, not human/device usability.
function policy(id){
 let phase=0,charge=0,stage=-1;
 const waypoints=[[330,250],[900,247],[960,247],[1140,211],[1720,241],[1970,303],[2140,303]];
 return(g,t)=>{
  if(stage!==g.stage){stage=g.stage;phase=0;charge=0;}
  const a=A.empty();
  if(id==='shadow'||id==='iron'){
   const p=g.p,x=px(p.x),target=g.enemies.find(e=>e.hp>0&&Math.abs(e.y-p.y)<q(40)&&e.x>p.x&&e.x-p.x<q(id==='shadow'?140:150));
   const gap=g.pits.find(([l,r])=>x>=l-35&&x<r);
   a.x=target?0:1;a.a=true;a.bPressed=t%(id==='shadow'?40:70)===0;
   a.cPressed=p.grounded&&((gap&&x<gap[0])||(id==='shadow'&&target&&t%90===0));
  }else if(id==='cache'){
   const p=g.p,x=px(p.x),y=px(p.y),[tx,ty]=waypoints[phase];
   a.a=true;a.bPressed=t%65===0;a.x=Math.abs(tx-x)>2?A.sign(tx-x):0;
   const gap=g.pits.find(([l,r])=>x>=l-35&&x<r);
   a.cPressed=p.grounded&&((gap&&x<gap[0])||(Math.abs(tx-x)<10&&y>ty+10)||(phase===3&&x>950&&y<=248));
   const enemy=g.enemies.find(e=>e.hp>0&&Math.abs(px(e.y)-y)<30&&px(e.x)>=x&&px(e.x)-x<125);
   if(enemy&&![1,2,3].includes(phase))a.x=0;
   if(Math.abs(tx-x)<6&&Math.abs(ty-y)<12&&phase<waypoints.length-1)phase++;
   if(phase===6&&!g.bossDead)a.x=0;
  }else if(id==='kombat'){
   a.x=Math.abs(g.enemy.x-g.p.x)>q(62)?A.sign(g.enemy.x-g.p.x):0;
   a.y=g.enemy.attack&&g.enemy.attack.age<g.enemy.attack.wind?1:0;a.a=!a.y;a.dPressed=g.meter===100;
  }else if(id==='breach'){
   const e=g.enemies[0];if(e)a.aim={x:px(e.x),y:px(e.y)};
   a.a=true;a.bPressed=g.enemies.some(e=>e.wind&&e.wind<9);a.cPressed=g.enemies.some(e=>e.boss);
  }else if(id==='invaders'){
   const e=[...g.enemies].sort((a,b)=>b.y-a.y)[0];
   if(e){const interval=Math.max(4,25-Math.floor((36-g.enemies.length)/2)-g.stage*3),lead=7/interval*(301-px(e.y))/7,tx=px(e.x)+g.direction*lead;a.x=Math.abs(tx-px(g.p.x))>3?A.sign(tx-px(g.p.x)):0;}
   const danger=g.shots.find(b=>b.enemy&&px(b.y)>250&&Math.abs(px(b.x-g.p.x))<24);
   if(danger)a.x=px(g.p.x)>580?-1:px(g.p.x)<60?1:A.sign(g.p.x-danger.x)||1;
   a.a=true;a.bPressed=g.enemies.length<15&&t%80===0;
  }else if(id==='vector'||id==='ember'){
   const e=g.enemies.find(e=>e.boss)||g.enemies[0];a.a=id==='ember'||t%40<35;a.aPressed=t%40===0;a.aReleased=t%40===35;
   if(e){if(g.vertical)a.x=Math.abs(e.x-g.p.x)>q(10)?A.sign(e.x-g.p.x):0;else a.y=Math.abs(e.y-g.p.y)>q(id==='vector'?5:10)?A.sign(e.y-g.p.y):0;}
   const w=g.walls.find(w=>g.vertical?px(w.pos)>px(g.p.y)-180&&px(w.pos)<px(g.p.y)+25:px(w.pos)<px(g.p.x)+180&&px(w.pos)>px(g.p.x)-25);
   if(w){if(g.vertical)a.x=A.sign(w.gap-g.p.x);else a.y=A.sign(w.gap-g.p.y);}
   a.cPressed=id==='ember'&&g.inv===0&&t%200===0;
  }else if(!g.serve){
   const p=g.players[g.controlled],b=g.ball;
   if(b.owner===g.controlled){
    a.x=px(p.x)<(id==='soccer'?560:530)?1:0;a.y=px(p.y)<170?1:px(p.y)>205?-1:0;a.c=true;
    if(id==='soccer'){a.aPressed=px(p.x)>550;if(a.aPressed)a.y=-1;}
    else{a.a=px(p.x)>505&&charge<20;a.aReleased=charge===20;if(a.a)charge++;else charge=0;}
   }else{a.x=A.sign(b.x-p.x);a.y=A.sign(b.y-p.y);a.aPressed=t%38===0;a.c=true;charge=0;}
  }
  return a;
 };
}
module.exports={policy};
