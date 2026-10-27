'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../js/core.js');require('../js/games/heist.js');
const A=globalThis.Arcade,H=A.Heist;
// A route through the seven screens using ordinary movement/fire/use inputs.
// The runner never grants lives, moves actors directly, removes enemies or opens locks.
function replay(difficulty){
 const g=new H({difficulty});g.action('start');
 const route=[],items=(room,kinds=['gem'])=>{for(const item of g.rooms[room].items)if(kinds.includes(item.kind))route.push({room,at:item,item});};
 const bank=()=>route.push({room:0,at:g.car,action:'bank'});
 items(0);bank();items(4,['key']);items(1);bank();items(2);items(5,['code','gem']);route.push({room:2,at:g.safe,action:'safe'});bank();items(3,['tnt','gem']);route.push({room:3,at:H.center(1,9),action:'tnt'});items(6);bank();
 let index=0,frames=0;
 const completed=q=>q.item?q.item.taken:q.action==='safe'?g.safeOpen:q.action==='tnt'?g.wardenGone:false;
 function doorTo(room){const queue=[[g.room,[]]],seen=new Set([g.room]);for(const [r,path]of queue){if(r===room)return path[0];for(const d of g.rooms[r].doors){if(d.lock==='key'&&!g.key||d.lock==='warden'&&!g.wardenGone||seen.has(d.to))continue;seen.add(d.to);queue.push([d.to,[...path,d]]);}}}
 for(;frames<70000&&g.state==='playing';frames++){
  if(index>=route.length){for(let room=0;room<g.rooms.length;room++)items(room,['gem','crown']);bank();}
  const q=route[index];if(q.item)q.room=g.rooms.find(r=>r.items.includes(q.item)).index;if(completed(q)){index++;continue;}
  const p=g.player,r=g.rooms[g.room],a=A.emptyInput();let banking=g.bag()>=5||g.ammo===0&&g.bag()>0;let target=q.room===g.room?q.at:doorTo(q.room);assert.ok(target,'route has an unlocked path');
  if(banking)target=g.room===0?g.car:doorTo(0);
  // A temporary detour frees lost lives, preserving the original objective list.
  if(g.captured>0&&g.lives<3){if(g.room===4){target=g.jail;if(A.dist(p,target)<6){a.interact=a.interactPressed=true;}}else target=doorTo(4);}
  if(A.dist(p,target)<6&&!p.target){
   if(target.to!==undefined){a.interact=a.interactPressed=true;}
   else if(target===g.jail){a.interact=a.interactPressed=true;}
   else if(target===g.car&&banking){a.interact=a.interactPressed=true;}
   else if(q.action==='bank'){a.interact=a.interactPressed=true;if(g.interactionCD<=0)index++;}
   else if(q.action==='safe'){a.interact=a.interactPressed=true;}
   else if(q.action==='tnt'){a.specialPressed=true;}
  }else{
   const next=p.target?H.cell(p.target):H.pathStep(r.grid,H.cell(p),H.cell(target));
   if(next){const at=p.target?p:H.center(H.cell(p).x,H.cell(p).y),dest=H.center(next.x,next.y);a.x=Math.abs(dest.x-at.x)>.1?Math.sign(dest.x-at.x):0;a.y=a.x?0:Math.sign(dest.y-at.y);}
  }
  // Shoot only when a pursuer is actually in the line of fire.
  const e=r.enemies.find(e=>{
   const dx=e.x-p.x,dy=e.y-p.y;return (Math.abs(dx)<7&&dy*g.facing.y>0&&Math.abs(dy)<115)||(Math.abs(dy)<7&&dx*g.facing.x>0&&Math.abs(dx)<115);
  });
  if(e&&g.ammo>0)a.fire=true;
  g.update(1/60,[a]);
 }
 return{g,index,frames,route};
}
for(const difficulty of ['arcade','relaxed'])test('Velvet Heist completes its equipment, safe, dark-gallery and banking route in '+difficulty,()=>{
 const {g,index,frames,route}=replay(difficulty);
 assert.equal(g.state,'victory',JSON.stringify({index,total:route.length,frames,room:g.room,bag:g.bag(),bank:g.bank,lives:g.lives,ammo:g.ammo,target:route[index],player:H.cell(g.player)}));assert.equal(g.bank,22);assert.ok(g.key&&g.code&&g.safeOpen&&g.wardenGone);
});
