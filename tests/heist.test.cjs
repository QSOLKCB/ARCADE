'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../js/core.js');require('../js/draw.js');require('../js/games/heist.js');
const A=globalThis.Arcade,H=A.Heist,command=(props={})=>({...A.emptyInput(),...props});
const start=()=>{const g=new H();g.action('start');return g;};
const tick=(g,n=1,a={})=>{for(let i=0;i<n;i++)g.update(1/60,[command(a)]);};
const use=(g,dt=1/60)=>g.interact(command({interact:true,interactPressed:true}),dt);
function visit(g,room,at){g.enter(room,at);g.interactionCD=0;}

test('all authored floors, doors, equipment and gems are connected; layouts have closed boundaries',()=>{
 const g=new H();assert.equal(g.rooms.length,7);
 for(const r of g.rooms){
  const grid=r.grid,seen=new Set(['1,1']),todo=[{x:1,y:1}];
  for(const p of todo)for(const [x,y]of[[p.x+1,p.y],[p.x-1,p.y],[p.x,p.y+1],[p.x,p.y-1]])if(grid[y]?.[x]===0&&!seen.has(x+','+y)){seen.add(x+','+y);todo.push({x,y});}
  for(const obj of [...r.items,...r.doors,...r.enemies,g.car,g.safe,g.jail,g.warden]){const p=H.cell(obj);assert.ok(seen.has(p.x+','+p.y),r.name+' at '+JSON.stringify(p));}
  assert.ok(grid[0].every(Boolean)&&grid.at(-1).every(Boolean)&&grid.every(row=>row[0]&&row.at(-1)));
  assert.deepEqual(grid,H.layout(r.index));
 }
 assert.equal(g.rooms.reduce((n,r)=>n+r.items.filter(i=>i.kind==='gem').length,0)+4,g.total);
 assert.equal(new Set(g.rooms.map(r=>JSON.stringify(r.grid))).size,7);
});
test('doors are reversible and holding use cannot bounce between screens',()=>{
 const g=start();for(const r of g.rooms)r.enemies=[];const d=g.rooms[0].doors[0];Object.assign(g.player,{x:d.x,y:d.y,target:null});tick(g,1,{interact:true,interactPressed:true});assert.equal(g.room,1);tick(g,80,{interact:true});assert.equal(g.room,1);
});
test('player and police paths cannot cross walls',()=>{
 const g=start();g.rooms[0].enemies=[];const p={...g.player};tick(g,40,{y:-1});assert.equal(g.player.y,p.y);assert.equal(g.player.x,p.x);
 let at={x:1,y:1};for(let i=0;i<200;i++){const n=H.pathStep(g.rooms[0].grid,at,{x:27,y:13});if(!n)break;assert.equal(Math.abs(n.x-at.x)+Math.abs(n.y-at.y),1);assert.equal(g.rooms[0].grid[n.y][n.x],0);at=n;}assert.deepEqual(at,{x:27,y:13});
});
test('service lift requires the permanent key and safe requires the service-floor code',()=>{
 const g=start(),lift=g.rooms[2].doors.find(d=>d.to===5);visit(g,2,lift);use(g);assert.equal(g.room,2);g.key=true;use(g);assert.equal(g.room,5);
 visit(g,2,g.safe);use(g,2);assert.equal(g.safeOpen,false);g.code=true;use(g,1);assert.equal(g.safeOpen,false);g.interact(command(),.1);assert.equal(g.safeProgress,0);use(g,2);assert.equal(g.safeOpen,true);assert.equal(g.bag(),4);assert.equal(g.torch,55);use(g,2);assert.equal(g.bag(),4);
});
test('TNT cannot be wasted and permanently clears the giant ghost gate',()=>{
 const g=start();g.tnt=true;tick(g,1,{specialPressed:true});assert.equal(g.tnt,true);assert.equal(g.wardenGone,false);
 const door=g.rooms[3].doors.find(d=>d.to===6);visit(g,3,door);use(g);assert.equal(g.room,3);g.player.inv=3;tick(g,1,{specialPressed:true});assert.equal(g.wardenGone,true);assert.equal(g.tnt,false);g.interactionCD=0;use(g);assert.equal(g.room,6);
});
test('torch drains only in darkness, can be recharged, and never locks the return door',()=>{
 const g=start();g.torch=.1;tick(g,12);assert.equal(g.torch,.1);const door=g.rooms[6].doors[0];visit(g,6,door);tick(g,12);assert.equal(g.torch,0);g.interactionCD=0;use(g);assert.equal(g.room,3);g.code=true;g.safeOpen=true;visit(g,2,g.safe);use(g);assert.equal(g.torch,55);
});
test('shots remove police and small ghosts; limited rounds replenish only at the car',()=>{
 for(const room of [0,3]){const g=start();visit(g,room,H.center(3,1));const r=g.rooms[room];r.enemies=[g.enemy(H.center(4,1),room===3?'ghost':'cop')];tick(g,6,{fire:true});assert.equal(r.enemies.length,0);assert.equal(g.ammo,7);}
 const g=start();g.rooms[0].enemies=[];tick(g,150,{fire:true});assert.equal(g.ammo,0);visit(g,0,g.car);use(g);assert.equal(g.ammo,8);
});
test('police reinforcements are announced, bounded and cannot spawn on the player',()=>{
 const g=start(),r=g.rooms[0];r.enemies=[];r.spawnTimer=0;g.patrols(.1,r);assert.ok(r.pending);assert.equal(r.enemies.length,0);const door=r.pending.door;g.player.x=door.x;g.player.y=door.y;g.patrols(3,r);assert.equal(r.enemies.length,0);Object.assign(g.player,g.car);g.patrols(1,r);assert.equal(r.enemies.length,1);
 for(let i=0;i<50;i++)g.patrols(20,r);assert.equal(r.enemies.length,4);
});
test('caught loot remains recoverable; bank and tools survive; station restores captured lives',()=>{
 const g=start(),item=g.rooms[1].items[0];item.taken=true;g.carry=[item];g.bank=5;g.key=g.code=g.tnt=true;visit(g,3,H.center(3,1));g.player.inv=0;g.catchPlayer();assert.equal(g.room,0);assert.equal(g.bank,5);assert.equal(g.bag(),0);assert.ok(g.key&&g.code&&g.tnt);assert.ok(g.rooms[3].items.includes(item));assert.equal(item.taken,false);assert.equal(g.lives,2);assert.equal(g.captured,1);
 visit(g,4,g.jail);use(g);assert.equal(g.lives,3);use(g);assert.equal(g.lives,3);
});
test('all 22 gems bank for victory and a fresh run restores every puzzle',()=>{
 const g=start();g.code=true;visit(g,2,g.safe);use(g,2);for(const r of g.rooms)for(const i of r.items)if(i.kind==='gem'){i.taken=true;g.carry.push(i);}visit(g,0,g.car);use(g);assert.equal(g.bank,22);assert.equal(g.state,'victory');const fresh=new H();assert.equal(fresh.bank,0);assert.equal(fresh.code,false);assert.equal(fresh.safeOpen,false);assert.equal(fresh.wardenGone,false);assert.ok(fresh.rooms.every(r=>r.items.every(i=>!i.taken)));
});
test('last-life capture ends the heist even if every gem is carried',()=>{const g=start();g.lives=1;g.player.inv=0;g.carry=[g.rooms[0].items[0]];g.catchPlayer();assert.equal(g.state,'gameover');});
test('helicopter announces its row before crossing; moving out of its path avoids capture',()=>{
 const g=start();g.rooms[0].enemies=[];g.chopperTimer=0;tick(g);assert.ok(g.chopper.warning>0);const y=g.chopper.y;tick(g,70,{y:1});assert.equal(g.lives,3);assert.notEqual(g.player.y,y);assert.equal(g.chopper.x,-24);
});
