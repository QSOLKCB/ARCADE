'use strict';
// Kestrel Strike, the ninth cabinet: rules, campaign, failure, bounds and determinism.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
for(const file of ['core','draw','vanilla2d','games/kestrel'])require(path.join(__dirname,'../js',file+'.js'));
const A=globalThis.Arcade,K=A.Kestrel;
const start=(options={})=>{const g=new K(options,()=>{});g.action('start');return g;};
const tick=(g,n=1,a={})=>{for(let i=0;i<n;i++)g.update(1/60,[{...A.emptyInput(),...a}]);};
const clearEnemies=g=>{g.enemies=[];g.bullets=[];g.pending=[];};

test('the plane moves through motion2d integer subunits, 2 px per tick, and stays inside the field',()=>{
  const g=start();clearEnemies(g);g.plan=[];const x=g.player.x;tick(g,10,{x:1});assert.equal(g.player.x,x+20);assert.ok(Number.isInteger(g.player.body.x));
  tick(g,400,{x:1,y:-1});assert.equal(g.player.x,230);assert.equal(g.player.y,215);tick(g,400,{x:-1,y:1});assert.equal(g.player.x,10);assert.equal(g.player.y,12);
});
test('firepower adds streams, capped at five; bombs clear bullets and are finite',()=>{
  const g=start();clearEnemies(g);g.plan=[];tick(g,1,{fire:true});const one=g.shots.length;
  g.player.cd=0;g.power=5;tick(g,1,{fire:true});assert.ok(g.shots.length-one>=5);
  g.collect({kind:'P'});assert.equal(g.power,5);
  for(let i=0;i<30;i++)g.bullet(100,100,-Math.PI/2,50);const bombs=g.bombs;tick(g,1,{specialPressed:true});
  assert.equal(g.bullets.length,0);assert.equal(g.bombs,bombs-1);
  g.bombs=0;g.bombCD=0;for(let i=0;i<5;i++)g.bullet(100,100,0,1);tick(g,1,{specialPressed:true});assert.ok(g.bullets.length>0);
});
test('the loop maneuver grants brief invulnerability and recharges',()=>{
  const g=start();clearEnemies(g);g.plan=[];g.player.inv=0;tick(g,1,{jumpPressed:true});assert.ok(g.player.loop>0);
  const lives=g.lives;g.hitPlayer();assert.equal(g.lives,lives);tick(g,60);g.player.inv=0;g.hitPlayer();assert.equal(g.lives,lives-1);
  tick(g,1,{jumpPressed:true});assert.equal(g.player.loop,0,'loop is still recharging');
});
test('bullets hit a small core, grazes score once, and a lost plane respawns with a power penalty',()=>{
  const g=start();clearEnemies(g);g.plan=[];g.player.inv=0;g.power=3;
  g.bullets.push({x:g.player.x+9,y:g.player.y,vx:0,vy:0,r:2.5,grazed:false});tick(g);assert.equal(g.graze,1);tick(g);assert.equal(g.graze,1,'graze counted once');
  g.bullets=[{x:g.player.x,y:g.player.y,vx:0,vy:0,r:2.5,grazed:false}];const lives=g.lives;tick(g);assert.equal(g.lives,lives-1);assert.equal(g.power,2);assert.equal(g.player.alive,false);
  tick(g,80);assert.equal(g.player.alive,true);assert.ok(g.player.inv>0);
});
test('carriers drop power-ups, ground targets drop medals, a missed medal resets the chain',()=>{
  const g=start();clearEnemies(g);g.plan=[];const c=g.addEnemy('carrier',{x:120,y:150,vx:0,vy:0,drop:'B'});g.damage(c,99);assert.equal(g.items[0].kind,'B');
  const t=g.addEnemy('tank',{x:60,y:150,vx:0,vy:0});g.damage(t,99);assert.equal(g.items.at(-1).kind,'M');
  g.collect({kind:'M'});g.collect({kind:'M'});assert.equal(g.medal,300);g.items=[{x:60,y:-6,kind:'M',vy:-40,t:0}];tick(g,10);assert.equal(g.medal,100);
});
test('each front schedules a mid-boss then a boss, and clearing four fronts wins',()=>{
  const g=start();
  for(let front=0;front<4;front++){
    assert.ok(g.plan.some(w=>w.wave==='warden'));assert.ok(g.plan.some(w=>w.wave==='carrier'));
    g.player.inv=1e9;g.clock=K.STAGES[front].length;for(let n=0;n<4&&!g.enemies.some(e=>e.kind==='boss');n++){tick(g);g.enemies=g.enemies.filter(e=>e.kind!=='warden');}
    const boss=g.enemies.find(e=>e.kind==='boss');assert.ok(boss,'boss on front '+(front+1));
    g.damage(boss,1e6);assert.ok(g.wreck,'the boss breaks up before the front clears');
    for(let i=0;i<60*4&&g.state==='playing';i++)tick(g);
    if(front<3){assert.equal(g.state,'stageclear');assert.ok(g.bonus>0);g.action('start');assert.equal(g.stage,front+1);}
  }
  assert.equal(g.state,'victory');
});
test('losing every plane ends the run and a new run starts fresh',()=>{
  const g=start();clearEnemies(g);g.plan=[];for(let i=0;i<10&&g.state==='playing';i++){g.player.inv=0;g.player.loop=0;g.player.alive=true;g.hitPlayer();}
  assert.equal(g.state,'gameover');const fresh=new K();assert.equal(fresh.stage,0);assert.equal(fresh.lives,3);assert.equal(new K({difficulty:'relaxed'}).lives,5);
});
test('a long firefight stays bounded, finite and deterministic',()=>{
  const run=()=>{const g=start();const log=[];for(let f=0;f<60*120;f++){g.player.inv=1;tick(g,1,{fire:true,x:Math.sign(Math.sin(f/40)),specialPressed:f%600===300});if(g.state==='stageclear')g.action('start');log.push(g.enemies.length,g.bullets.length);
    assert.ok(g.bullets.length<=260&&g.shots.length<=140&&g.enemies.length<=44&&g.particles.items.length<=220&&g.items.length<=24&&g.blasts.length<=48&&g.debris.length<=64&&g.scorch.length<=24);}
    assert.ok(Number.isFinite(g.score)&&g.score>0);return JSON.stringify([g.score,g.clock,g.player.body,log.slice(-200)]);};
  assert.equal(run(),run());
});
test('a boss breaks up in chained explosions, the plane is safe, then the front clears',()=>{
  const g=start();clearEnemies(g);g.plan=[];g.bossSpawned=true;const boss=g.addEnemy('boss',{x:120,y:190,path:'boss'});const escort=g.addEnemy('gnat',{x:60,y:200});
  for(let i=0;i<20;i++)g.bullet(120,190,-Math.PI/2,40);g.damage(boss,1e6);
  assert.ok(g.wreck);assert.equal(g.state,'playing');assert.equal(g.bullets.length,0);assert.ok(escort.hp<=0,'escorts go down with the boss');
  const lives=g.lives;let peak=0;
  for(let i=0;i<60&&g.state==='playing';i++){g.player.inv=0;g.bullets.push({x:g.player.x,y:g.player.y,vx:0,vy:0,r:2.5,grazed:false});tick(g);peak=Math.max(peak,g.blasts.length);}
  assert.equal(g.lives,lives,'no plane is lost while the boss breaks up');assert.ok(peak>=5,'chained explosions');
  tick(g,60*3);assert.equal(g.state,'stageclear');assert.equal(g.wreck,null);
});
test('explosions, wreckage and scorch marks never consume gameplay randomness and stay bounded',()=>{
  const a=start(),b=start();for(let i=0;i<200;i++)b.explode(100,100,20,{debris:8,sparks:20,ring:true});
  assert.deepEqual([a.rand(),a.rand(),a.rand()],[b.rand(),b.rand(),b.rand()]);
  assert.ok(b.blasts.length<=48&&b.debris.length<=64&&b.particles.items.length<=220);
  clearEnemies(a);a.plan=[];const t=a.addEnemy('tank',{x:60,y:150,vx:0,vy:0});a.damage(t,99);assert.equal(a.scorch.length,1);assert.ok(a.blasts.length>=1);
  tick(a,60*8);assert.equal(a.blasts.length,0);assert.equal(a.debris.length,0);assert.equal(a.scorch.length,0,'scorch marks scroll away with the ground');
});
test('menus are inert and every front renders with finite coordinates',()=>{
  const g=new K();tick(g,60);assert.equal(g.clock,0);
  const methods=new Set(['fillRect','translate','scale','rotate','arc','ellipse','moveTo','lineTo','rect']);
  const c=new Proxy({}, {get:(_,name)=>(...args)=>{if(methods.has(name))assert.ok(args.filter(v=>typeof v==='number').every(Number.isFinite),String(name));},set:()=>true});
  for(let s=0;s<4;s++){const r=start();r.stage=s;r.setup();r.demo();r.addEnemy('boss',{x:120,y:190,path:'boss',phase:0});r.addEnemy('warden',{x:80,y:200,path:'warden'});tick(r,30,{fire:true});r.render(c);r.damage(r.addEnemy('boss',{x:120,y:190,path:'boss',phase:0}),1e6);assert.ok(r.wreck);tick(r,40);r.render(c);}
});
