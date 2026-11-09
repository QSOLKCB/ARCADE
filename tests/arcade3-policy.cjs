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
  return a;
 };
}
module.exports={policy};
