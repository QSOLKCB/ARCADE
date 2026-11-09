'use strict';
// Control-only playthrough policies for ARCADE 3. They read state to choose input
// packets; they never change world state, health, timers or stage transitions.
const A=globalThis.Arcade2,px=A.px,q=A.q;
const sign=v=>v<0?-1:v>0?1:0;
function aimTo(dx,dy){const ax=Math.abs(dx)<12?0:sign(dx),ay=Math.abs(dy)>Math.abs(dx)*0.45?sign(dy):0;return [ax,ay];}
function policy(id){
 return(g,t)=>{
  const a=A.empty();
  if(id==='commando'){
   const p=g.p,x=px(p.x),y=px(p.y);
   const threats=g.foes.filter(f=>Math.abs(px(f.x)-x)<(f.kind==='runner'?330:440)&&f.kind!=='core').sort((u,v)=>Math.abs(u.x-p.x)-Math.abs(v.x-p.x));
   const core=g.foes.find(f=>f.kind==='core'),target=threats[0]||(core&&Math.abs(px(core.x)-x)<440?core:null);
   const item=g.items.find(i=>Math.abs(px(i.x)-x)<200);
   a.a=true;
   if(target){
    const dx=px(target.x)-x,dy=(px(target.y)-(target.kind==='turret'?10:20))-(y-22);
    const [ax,ay]=aimTo(dx,dy);
    if(target.kind==='runner'){a.x=sign(dx);a.y=0;if(Math.abs(dx)<60&&p.grounded&&t%2===0){a.y=1;a.x=0;}}
    else if(target.kind==='gun'||target.kind==='core'){
     // Stand where a horizontal or 45-degree shot meets the target, then plant and fire.
     // The player cannot pass the boss wall (2,420 px); a 45-degree shot from there still lands.
     const rise=Math.max(0,(y-22)-(px(target.y)-(target.kind==='gun'?18:25))),want=rise<12?x:Math.min(2420,px(target.x)-rise);
     if(Math.abs(want-x)>3&&rise>=12){a.x=sign(want-x);}else{a.b=true;a.x=1;a.y=rise<12?0:-1;}
    }
    else{a.b=true;a.x=ax;a.y=ay>0&&p.grounded?0:ay;if(ay>0&&!a.x)a.x=sign(dx)||1;}
   }else a.x=item?sign(px(item.x)-x):1;
   const pod=g.pods.find(pd=>Math.abs(px(pd.x)-x)<260&&px(pd.x)>x);
   if(pod&&!target&&g.p.weapon==='rifle'){a.b=true;a.x=1;a.y=-1;}
   // Enemy fire aims at chest height: drop prone to let an incoming round pass over.
   // Predict where each enemy round crosses this column; drop prone only if it would hit a
   // standing body but pass over a prone one.
   // Rounds that cross high go over a prone body; rounds that cross low (descending
   // sniper fire) are jumped instead.
   let dodge=null;
   for(const b of g.shots){if(b.mine)continue;const dx=px(b.x)-x,vx=px(b.vx);
    if(Math.abs(dx)>90)continue;const steps=Math.abs(vx)<0.2?0:Math.max(0,-dx/vx);if(steps>16&&Math.abs(dx)>14)continue;
    const at=px(b.y)+px(b.vy)*steps;if(at>y-34&&at<y-15)dodge=dodge||'prone';else if(at>=y-15&&at<y+2)dodge='jump';}
   if(dodge==='prone'&&p.grounded){a.x=0;a.y=1;a.b=false;}
   if(dodge==='jump'&&p.grounded){a.x=0;a.y=0;a.b=false;a.cPressed=true;}
   const gap=g.pits.find(([l,r])=>x>=l-40&&x<r+10);
   if(gap){a.b=false;a.y=0;a.x=1;if(p.grounded&&x>=gap[0]-26&&x<gap[0]-6)a.cPressed=true;}
  }
  if(id==='lantern'){
   const p=g.p,x=px(p.x),y=px(p.y);
   // Fight what is ahead (or very close behind); slow risers behind are simply outpaced.
   const w=g.foes.find(f=>f.kind==='warden'),near=g.foes.filter(f=>{const d=px(f.x)-x;return !f.rise&&f.kind!=='warden'&&(d>0?d<220:d>-80);}).sort((u,v)=>Math.abs(u.x-p.x)-Math.abs(v.x-p.x))[0];
   a.a=true;a.x=1;
   // Face the nearest threat; close in only while it is still far, tapping to turn when close.
   if(near){const d=px(near.x)-x;a.x=Math.abs(d)>90||t%3===0?sign(d):0;if(Math.abs(d)<40&&sign(d)===p.face)a.x=0;}
   if(w&&px(w.x)-x<330){const d=px(w.x)-x;a.x=d<170?-1:d>210?1:0;if(a.x===0||d<170)a.x=a.x||-1;if(d>=170&&d<=210)a.x=0;
    if(g.slag.some(m=>Math.abs(px(m.x)-x)<40&&px(m.y)>y-60))a.x=-1;}
   // Jump straight up over an approaching wraith orb (jumps cannot be steered).
   const orb=g.slag.find(m=>!m.g&&Math.abs(px(m.x)-x)<46&&sign(px(m.vx))===-sign(px(m.x)-x||1)&&px(m.y)>y-36&&px(m.y)<y+2);
   if(orb&&p.grounded){a.x=0;a.cPressed=true;}
   const gap=g.pits.find(([l,r])=>x>=l-40&&x<r+6);
   if(gap&&p.grounded&&!orb){a.x=1;if(x>=gap[0]-30&&x<gap[0]-4)a.cPressed=true;}
   if(a.x)a.a=a.a;
  }
  if(id==='sleepwalker'){
   // Priorities: a pit's take-off window first; then walls and inkblots, but only when no
   // moth-owl is overhead (wait for it to pass); near a pit, stomp an approaching inkblot.
   const p=g.p,x=px(p.x),y=px(p.y);
   a.x=1;a.c=true;a.aPressed=t%20===0;
   const pit=g.pits.find(([l])=>l-x>-8&&l-x<150),takeoff=pit&&x>=pit[0]-38&&x<pit[0]-8;
   const wall=g.blocks.find(k=>k.kind!=='gone'&&k.x>x&&k.x-x<34&&k.y+24>y-28&&k.y<y);
   const ink=g.foes.find(f=>f.kind==='ink'&&px(f.x)-x>0&&px(f.x)-x<84);
   const moth=g.foes.find(f=>f.kind==='moth'&&Math.abs(px(f.x)-x)<110);
   let jump=false;
   if(takeoff)jump=true;
   else if(ink&&pit){const d=px(ink.x)-x;if(d<52)jump=true;else a.x=0;}
   else if((wall||ink)&&!moth)jump=true;
   else if(wall&&moth){a.x=0;}
   else if(ink&&moth){const d=px(ink.x)-x;if(d<40)jump=true;else a.x=-1;}
   if(jump&&p.grounded)a.cPressed=true;
  }
  if(id==='lancer'){
   // Rate each rail by the hazards riding down it, prefer a safe rail with a drone to lance,
   // and lead the warden's crossing with a torpedo.
   const p=g.p,lane=p.lane,laneOf=f=>Math.round(f.pos/16);
   const danger=l=>g.foes.some(f=>f.kind!=='warden'&&laneOf(f)===l&&(f.kind==='block'||f.dive||f.kind==='hopper')&&f.z>560)
    ||g.foes.some(f=>f.kind!=='warden'&&f.lane===l&&f.z>760)||g.shots.some(b=>!b.mine&&b.lane===l&&b.z>620);
   const prey=g.foes.filter(f=>f.kind==='drone'||f.kind==='hopper').sort((u,v)=>v.z-u.z);
   const w=g.foes.find(f=>f.kind==='warden');
   let want=lane;
   if(w&&p.torps>0){want=Math.max(0,Math.min(4,Math.round((w.pos+22)/16)));}
   else if(prey.length){const f=prey.find(f=>!danger(laneOf(f)))||prey[0];want=laneOf(f);}
   // Step toward the wanted rail only through safe rails; flee a dangerous one.
   const step=Math.sign(want-lane);
   if(step&&!danger(lane+step))a.x=step;
   if(danger(lane)){const opts=[lane-1,lane+1].filter(l=>l>=0&&l<=4&&!danger(l));if(opts.length)a.x=opts.sort((u,v)=>Math.abs(u-want)-Math.abs(v-want))[0]-lane;}
   a.a=p.pos===lane*16&&g.foes.some(f=>f.kind!=='warden'&&laneOf(f)===lane);
   if(w&&p.torps>0&&p.pos===lane*16&&Math.abs(w.pos+20-lane*16)<=4)a.bPressed=true;
   const block=g.foes.find(f=>f.kind==='block'&&laneOf(f)===lane&&f.z>640);
   if(block&&danger(lane-1)!==false&&danger(lane+1)!==false&&p.torps>1&&!w)a.bPressed=true;
  }
  return a;
 };
}
module.exports={policy};
