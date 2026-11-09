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
  if(id==='canal'){
   // Hold the middle of the channel ahead, line up on targets to shoot them, skim buoys
   // when the cell runs low (holding fire so as not to sink them) and ease off near hazards.
   const x=g.x,d=g.dist,ahead=f=>f.wy-d,HALF={barge:18,drone:11,jet:14,buoy:12};
   // Islands are centred on x 320, so the skimmer keeps to the side it is already on.
   const side=wy=>{const chs=g.channels(wy);return chs.length>1?chs[x<320?0:1]:chs[0];};
   const ch=side(d+70);let lo=ch[0]+12,hi=ch[1]-12;
   for(let k=0;k<=90;k+=10){const c2=side(d+k);lo=Math.max(lo,c2[0]+11);hi=Math.min(hi,c2[1]-11);}
   if(lo>hi){const m=(lo+hi)/2;lo=hi=m;}
   let want=(ch[0]+ch[1])/2;
   const low=g.fuel<1600,buoy=g.foes.filter(f=>f.kind==='buoy'&&ahead(f)>-4&&ahead(f)<240&&f.x>=ch[0]&&f.x<=ch[1]).sort((u,v)=>ahead(u)-ahead(v))[0];
   const threats=g.foes.filter(f=>HALF[f.kind]&&f.kind!=='buoy'&&ahead(f)>-14&&ahead(f)<260).sort((u,v)=>ahead(u)-ahead(v));
   const close=threats.find(f=>ahead(f)<70&&Math.abs(f.x-x)<HALF[f.kind]+16);
   if(low&&buoy)want=buoy.x;
   else if(threats.length){const f=threats.find(f=>f.kind!=='jet')||threats[0];if(ahead(f)>50)want=f.x+(f.vx||0)*Math.round(ahead(f)/12);}
   if(close){
    // Dodge to the side with room that the threat is not drifting toward.
    const left=close.x-HALF[close.kind]-18,right=close.x+HALF[close.kind]+18,v=close.vx||0;
    const cost=(w,dir)=>(w<lo||w>hi?999:0)+Math.abs(w-x)+(sign(v)===dir?60:0);
    want=cost(left,-1)<=cost(right,1)?left:right;
   }
   want=Math.max(lo,Math.min(hi,want));
   if(Math.abs(want-x)>2)a.x=sign(want-x);
   const bridge=g.foes.find(f=>f.kind==='bridge'&&ahead(f)<300);
   a.a=!(buoy&&low&&Math.abs(buoy.x-x)<16&&!threats.some(f=>Math.abs(f.x-x)<HALF[f.kind]&&ahead(f)<ahead(buoy)));
   a.y=bridge&&ahead(bridge)<220||close||(low&&buoy&&ahead(buoy)<60)?1:0;
   if(!a.y&&!threats.length&&!bridge&&g.fuel>800&&!(low&&buoy))a.y=0;
  }
  if(id==='skyline'){
   // Line up on the nearest target; break away from any round or airframe whose
   // predicted crossing point is near the jet.
   const p=g.p;a.a=true;a.bPressed=g.locks.length>0&&t%4===0;
   const targets=g.foes.filter(f=>f.z>520).sort((u,v)=>u.z-v.z),f=targets.find(f=>f.kind==='gunship')||targets[0];
   let tx=f?f.x:0,ty=f?f.y:0;
   const hits=[];
   for(const b of g.flak){const steps=Math.max(0,(b.z-300)/54);if(steps>18)continue;hits.push([b.x+b.vx*steps,b.y+b.vy*steps]);}
   for(const e of g.foes)if(e.kind!=='gunship'&&e.z<1000)hits.push([e.x,e.y]);
   const bad=(x,y)=>hits.some(([hx,hy])=>Math.abs(hx-x)<110&&Math.abs(hy-y)<80);
   if(bad(p.x,p.y)||bad(tx,ty)){
    // Pick the nearest safe point on a coarse grid around the jet.
    let best=null;
    for(let dx=-360;dx<=360;dx+=60)for(let dy=-240;dy<=240;dy+=60){const x=p.x+dx,y=p.y+dy;
     if(x<-580||x>580||y<-270||y>270||bad(x,y))continue;const cost=Math.abs(dx)/12+Math.abs(dy)/9+(Math.abs(x-tx)+Math.abs(y-ty))/400;if(!best||cost<best[2])best=[x,y,cost];}
    if(best){tx=best[0];ty=best[1];}
   }
   a.x=Math.abs(tx-p.x)>14?sign(tx-p.x):0;a.y=Math.abs(ty-p.y)>12?sign(ty-p.y):0;
  }
  if(id==='stratos'){
   // Try nine moves, project every bullet and airframe forward on its current velocity,
   // and keep the move with the most clearance; break ties by lining up under a target.
   const p=g.p,x=px(p.x),y=px(p.y);a.a=true;
   const bs=g.bullets.map(b=>[px(b.x),px(b.y),px(b.vx),px(b.vy),5.5]).filter(([bx,by])=>Math.abs(bx-x)<120&&Math.abs(by-y)<160);
   for(const f of g.foes)if(f.kind==='heli'||f.kind==='jet'||f.kind==='carrier')bs.push([px(f.x),px(f.y),px(f.vx),px(f.vy),14]);
   const tgt=g.foes.filter(f=>f.hp>0&&px(f.y)>-10&&px(f.y)<y-20).sort((u,v)=>(px(v.y)-px(u.y))-(Math.abs(px(u.x)-x)-Math.abs(px(v.x)-x))/3)[0];
   const item=g.items.filter(it=>(it.kind!=='crystal'||p.level<4)&&px(it.y)>60).sort((u,v)=>Math.abs(px(u.x)-x)-Math.abs(px(v.x)-x))[0];
   let best=null;
   for(const mx of [-1,0,1])for(const my of [-1,0,1]){
    let clear=99;
    for(let k=1;k<=22;k++){const cx=Math.max(150,Math.min(490,x+mx*3*Math.min(k,12))),cy=Math.max(40,Math.min(340,y+my*3*Math.min(k,12)));
     for(const [bx,by,vx,vy,r] of bs){const d=Math.max(Math.abs(bx+vx*k-cx),Math.abs(by+vy*k-cy))-r;if(d<clear)clear=d+k*0.15;}}
    const nx=x+mx*12,ny=y+my*12,gx=item?px(item.x):tgt?px(tgt.x):320,gy=item?px(item.y):g.boss?250:285;
    const score=Math.min(clear,14)*10-Math.abs(nx-gx)/4-Math.abs(ny-gy)/6;
    if(!best||score>best[2])best=[mx,my,score,clear];
   }
   a.x=best[0];a.y=best[1];
   if(best[3]<2&&p.bombs>0&&!g.bomb&&!g.inv)a.bPressed=true;
  }
  if(id==='feud'){
   // Drive and shoot when open, pass out of a double team, elbow the ball carrier on
   // defence, and crash the boards on every shot.
   const m=g.men[0],mate=g.men[1],b=g.ball,x=px(m.x),y=px(m.y),h=b.holder;
   const dist=(u,v)=>Math.max(Math.abs(px(u.x)-px(v.x)),Math.abs(px(u.y)-px(v.y))*2);
   const go=(tx,ty)=>{a.x=Math.abs(tx-x)>3?sign(tx-x):0;a.y=Math.abs(ty-y)>3?sign(ty-y):0;};
   const rivals=g.men.slice(2).filter(o=>!o.stun);
   if(h===0){
    const d=Math.abs(x-574)+Math.abs(y-276)*2,guard=rivals.find(o=>dist(o,m)<30),mateOpen=!mate.stun&&!rivals.some(o=>dist(o,mate)<44);
    if(d<56&&g.turbo>10){a.c=true;a.aPressed=true;}
    else if(d<(g.clock<300&&g.scores[0]<=g.scores[1]?260:150)&&!guard)a.aPressed=true;
    else if(guard&&mateOpen&&px(mate.x)>x-20&&t%6===0)a.bPressed=true;
    else{go(548,276);a.c=g.turbo>12;} // Bodies do not collide: burn straight past the defence.
   }else if(h===1){go(500,y<276?310:244);if(rivals.some(o=>dist(o,mate)<26)&&!rivals.some(o=>dist(o,m)<44))a.bPressed=true;}
   else if(h>=2){const c=g.men[h];go(px(c.x)-12,px(c.y));a.c=dist(c,m)>60&&g.turbo>30;if(dist(c,m)<26&&!m.cd)a.bPressed=true;}
   else if(b.flight&&b.flight.kind!=='pass'){const f=b.flight;go(px(f.to[0])+(px(f.to[0])>320?-36:36),px(f.to[1]));}
   else go(px(b.x),px(b.y));
  }
  return a;
 };
}
module.exports={policy};
