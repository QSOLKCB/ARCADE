'use strict';
// Void Command's frame cache is exact only if renderSignature() covers everything draw() reads.
// A recording 2D context logs every drawing call and property write, so over a scripted session
// equal signatures must always produce identical drawing.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=['core','draw','games/void'].map(f=>fs.readFileSync(path.join(__dirname,'../js',f+'.js'),'utf8'));

function recorder(log,extra={}){
  const target={measureText:t=>({width:String(t).length*7}),...extra};
  return new Proxy(target,{
    get:(o,k)=>k in o?o[k]:(...args)=>{log.push(String(k)+'('+JSON.stringify(args)+')');},
    set:(o,k,v)=>{log.push(String(k)+'='+JSON.stringify(v));return true;},
  });
}
function load(globals={}){const context=vm.createContext({console,...globals});for(const src of source)vm.runInContext(src,context);return context.Arcade;}
const ORDERS=['HELP','MAP','SCAN','JUMP 2 1','STATUS','SHIELD 300','MOVE 3 3','BEAM 200','LANCE 4 2','REPAIR','JUMP 1 1','DOCK','WAIT','BOGUS','SOS'];

test('equal render signatures always produce identical terminal drawing',()=>{
  const A=load();
  for(const mission of [1,2,3]){
    const g=new A.Void({mission,difficulty:mission===2?'relaxed':'arcade'},()=>{});g.action('start');
    const bySig=new Map();let repeats=0,frames=0;
    for(let frame=0;frame<2400&&g.state==='playing';frame++){
      if(frame%40===0)g.queue(ORDERS[(frame/40)%ORDERS.length]);
      if(frame%57===0)g.pointer(45+(frame%8)*36+5,88+((frame>>3)%8)*28+5);
      if(frame%131===0)g.pointer(387+(frame%8)*34+5,88+((frame>>2)%8)*28+5);
      g.update(A.STEP,[A.emptyInput()]);
      const log=[];g.draw(recorder(log));const ops=log.join('\n'),sig=g.renderSignature();frames++;
      if(bySig.has(sig)){repeats++;assert.equal(ops,bySig.get(sig),'mission '+mission+' frame '+frame+': same signature, different drawing');}else bySig.set(sig,ops);
    }
    assert.ok(bySig.size>10,'the session reaches many distinct terminal states ('+bySig.size+')');
    assert.ok(repeats>frames/2,'most frames repeat an earlier state, which is what the cache reuses');
  }
});

test('the cache redraws only on change and draws transformed or non-canvas contexts directly',()=>{
  let draws=0;const canvases=[];
  const document={createElement:()=>{const c={width:0,height:0,getContext:()=>recorder([],{canvas:c})};canvases.push(c);return c;}};
  const A=load({document});
  const g=new A.Void({},()=>{});g.action('start');
  const original=g.draw.bind(g);g.draw=c=>{draws++;return original(c);};
  const identity={isIdentity:true},blits=[];
  const screen=(transform=identity)=>recorder([],{canvas:{width:960,height:540},globalAlpha:1,globalCompositeOperation:'source-over',getTransform:()=>transform,drawImage:(img,x,y)=>blits.push([img,x,y])});
  const main=screen();
  for(let i=0;i<10;i++)g.render(main);
  assert.equal(draws,1,'unchanged state is drawn once and then reused');
  assert.equal(blits.length,10);assert.deepEqual(blits[9].slice(1),[0,0]);
  g.queue('SCAN');g.update(A.STEP,[A.emptyInput()]);g.render(main);
  assert.equal(draws,2,'an accepted order redraws');
  g.pointer(45+5*36+5,88+2*28+5);g.render(main);
  assert.equal(draws,3,'a map selection redraws');
  g.render(main);assert.equal(draws,3);
  g.render(screen({isIdentity:false}));
  assert.equal(draws,4,'a shaken (transformed) context is drawn directly, never blitted');
  g.render(recorder([]));
  assert.equal(draws,5,'a test or preview context without drawImage is drawn directly');
  assert.equal(canvases.length,1,'one retained frame per game');
});

test('changing any single drawn input changes the signature whenever it changes the drawing',()=>{
  const A=load();
  const perturb={
    mission:g=>{g.mission=2;},energy:g=>{g.ship.energy-=100;},shield:g=>{g.ship.shield+=50;},hull:g=>{g.ship.hull-=40;},lances:g=>{g.ship.lances--;},
    position:g=>{g.ship.x=5;},sector:g=>{g.ship.qx=4;g.ship.qy=3;},raider:g=>{g.sector.enemies.push({x:6,y:6,hp:100});},star:g=>{g.sector.stars.push({x:7,y:0});},
    chart:g=>{g.chart[9]={enemies:2,depot:false,stars:3};},selected:g=>{g.selected={x:6,y:6};},damage:g=>{g.damage.weapons=2;},
    tow:g=>{g.sos=0;},total:g=>{g.total++;},kills:g=>{g.kills++;},days:g=>{g.days--;},log:g=>{g.log('A new log line');},help:g=>{g.viewHelp=true;},
  };
  for(const [name,change] of Object.entries(perturb)){
    const g=new A.Void({},()=>{});g.action('start');
    const before=[],after=[];g.draw(recorder(before));const sig=g.renderSignature();
    change(g);g.draw(recorder(after));
    assert.notEqual(after.join('\n'),before.join('\n'),name+' should change the drawing');
    assert.notEqual(g.renderSignature(),sig,name+' changes the drawing, so it must change the signature');
  }
});
