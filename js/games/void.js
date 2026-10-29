/* Original turn-based terminal campaign. No franchise assets or source. SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  const D=A.Draw,SIZE=8,GREEN='#79e6a2',CYAN='#6acfd6',AMBER='#edc985';
  const index=(x,y)=>y*SIZE+x,coord=(x,y)=>`${x+1},${y+1}`;
  const valid=n=>Number.isInteger(n)&&n>=0&&n<SIZE;
  A.Void=class extends A.Game{
    constructor(options,sound){super(options,sound);this.id='void';this.options.players=1;this.mission=[1,2,3].includes(this.options.mission)?this.options.mission:1;this.resetMission();}
    resetMission(){
      this.rand=A.rng(7100+this.mission);this.sectors=[];this.chart=Array(64).fill(null);this.logs=[];this.pending=[];this.turns=0;this.days=this.relaxed?180:145;this.kills=0;this.sos=1;this.viewHelp=false;
      this.ship={qx:0,qy:0,x:2,y:1,energy:3000,shield:600,hull:100,lances:10};this.damage={drive:0,sensors:0,weapons:0};this.selected={x:3,y:3};
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const sector={stars:[],enemies:[],depot:null};const reserved=x===0&&y===0?[{x:2,y:1},{x:1,y:1}]:[];
        const used=new Set(reserved.map(p=>index(p.x,p.y)));
        const empty=()=>{for(let n=0;n<128;n++){const cell=Math.floor(this.rand()*64);if(!used.has(cell)){used.add(cell);return{x:cell%8,y:Math.floor(cell/8)};}}for(let cell=0;cell<64;cell++)if(!used.has(cell)){used.add(cell);return{x:cell%8,y:Math.floor(cell/8)};}};
        for(let n=0,count=3+Math.floor(this.rand()*5);n<count;n++)sector.stars.push(empty());
        if(x===0&&y===0)sector.depot={x:1,y:1};else if((x===4&&y===3)||(x===7&&y===7))sector.depot=empty();
        this.sectors.push(sector);
      }
      const count=this.relaxed?16:22;
      for(let n=0;n<count;n++){
        let qi;do{qi=1+Math.floor(this.rand()*63);}while(this.sectors[qi].enemies.length>=3);
        const s=this.sectors[qi];let p;do{p={x:Math.floor(this.rand()*8),y:Math.floor(this.rand()*8)};}while(this.objectAt(s,p.x,p.y));
        s.enemies.push({...p,hp:135+Math.floor(this.rand()*50)});
      }
      this.total=count;this.reveal(0,0);for(const [x,y]of[[0,0],[4,3],[7,7]])this.chart[index(x,y)]={knownDepot:true};
      this.reveal(0,0);this.log('FREE RELAY SERVICE // courier vessel LANTERN // mission '+this.mission);
      this.log('The Cinder Array has seized the relays. Clear all '+count+' raiders before the clock expires.');
      this.log('Start: SCAN, then JUMP x y. HELP lists commands. Coordinates are 1–8.');
    }
    get sector(){return this.sectors[index(this.ship.qx,this.ship.qy)];}
    objectAt(s,x,y){if(s.stars.some(p=>p.x===x&&p.y===y))return 'star';if(s.depot?.x===x&&s.depot?.y===y)return 'depot';return s.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y)||null;}
    log(text){this.logs.push(String(text));if(this.logs.length>30)this.logs.shift();this.lastMessage=String(text);}
    reveal(x,y){if(!valid(x)||!valid(y))return;const s=this.sectors[index(x,y)];this.chart[index(x,y)]={enemies:s.enemies.filter(e=>e.hp>0).length,depot:!!s.depot,stars:s.stars.length};}
    menu(){return{eyebrow:'VOID COMMAND · RELAY CAMPAIGN '+this.mission,title:'A whole frontier. One command line.',description:'Command the independent courier Lantern against the Cinder Array. Scan an 8 × 8 frontier, fight on local tactical grids, transfer shield energy and resupply at relay depots. Every operational command advances time; the enemy only acts when you do.',details:'Type HELP for the command reference. Click a local cell to prepare MOVE or LANCE; click the chart to prepare JUMP. SCAN finds nearby threats. Beam energy is split across local enemies. Stars block lances. Dock beside a depot in a cleared sector.',choices:[1,2,3].map(n=>({label:'Campaign '+n,id:'mission'+n,selected:n===this.mission})),button:'Take command',action:'start'};}
    action(id){if(this.state==='briefing'&&/^mission[1-3]$/.test(id)){this.mission=Number(id.slice(-1));this.options.mission=this.mission;this.resetMission();}if(id==='start'&&this.state==='briefing')this.state='playing';}
    queue(text){if(this.state==='playing'&&this.pending.length<8)this.pending.push(text);}
    update(dt){if(this.state!=='playing')return;this.common(dt);if(this.pending.length)this.command(this.pending.shift());}
    coordinates(args){if(args.length!==2)return null;const p=args.map(Number).map(n=>n-1);return p.every(valid)?{x:p[0],y:p[1]}:null;}
    destroy(e){if(e.hp>0)return;this.kills++;this.score+=700;this.log('Raider at '+coord(e.x,e.y)+' neutralised.');this.sound('boom');}
    command(raw){
      if(this.state!=='playing')return false;
      const tokens=String(raw).trim().toUpperCase().replace(/,/g,' ').split(/\s+/),verb=tokens.shift(),args=tokens;
      if(!verb)return false;
      const fail=text=>{this.log(text);this.sound('empty');return false;};
      const p=this.ship,s=this.sector;let cost=0;
      this.viewHelp=false;
      if(verb==='HELP'||verb==='?'){this.viewHelp=true;this.log('HELP opened. MAP closes it. Reads and invalid orders spend no time.');return true;}
      if(verb==='MAP'||verb==='STATUS'){this.log(this.status());return true;}
      if(verb==='SCAN'){
        if(args.length)return fail('Usage: SCAN');if(this.damage.sensors>0)return fail('Sensors damaged. REPAIR before scanning.');if(p.energy<40)return fail('Scan needs 40 energy.');
        p.energy-=40;for(let y=p.qy-1;y<=p.qy+1;y++)for(let x=p.qx-1;x<=p.qx+1;x++)this.reveal(x,y);
        this.log('Long-range scan: neighbouring sectors charted. Read chart as raiders / depot.');this.sound('safe');cost=1;
      }else if(verb==='JUMP'){
        const q=this.coordinates(args);if(!q)return fail('Usage: JUMP column row (1–8).');
        if(q.x===p.qx&&q.y===p.qy)return fail('Already in that sector. Use MOVE for local travel.');
        const distance=Math.hypot(q.x-p.qx,q.y-p.qy),energy=Math.ceil(100+distance*65)*(this.damage.drive?2:1);
        if(p.energy<energy)return fail('Jump requires '+energy+' energy. Transfer shields or use SOS.');
        p.energy-=energy;p.qx=q.x;p.qy=q.y;
        const dest=this.sector,free=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!this.objectAt(dest,x,y))free.push({x,y});
        free.sort((a,b)=>(Math.abs(a.x-3)+Math.abs(a.y-6))-(Math.abs(b.x-3)+Math.abs(b.y-6))||a.y-b.y||a.x-b.x);
        p.x=free[0].x;p.y=free[0].y;this.log('Arrived in sector '+coord(q.x,q.y)+' at cell '+coord(p.x,p.y)+'. Jump used '+energy+'.');this.sound('lift');cost=Math.max(1,Math.ceil(distance/2));
      }else if(verb==='MOVE'){
        const q=this.coordinates(args);if(!q)return fail('Usage: MOVE column row (1–8).');if(q.x===p.x&&q.y===p.y)return fail('Already at that cell.');
        const path=this.ray(p,q),travel=[];for(const cell of path){if(this.objectAt(s,cell.x,cell.y))break;travel.push(cell);if(cell.x===q.x&&cell.y===q.y)break;}
        if(!travel.length)return fail('Course blocked. Pick a different heading.');
        const energy=travel.length*18;if(p.energy<energy)return fail('Move requires '+energy+' energy.');
        p.energy-=energy;const end=travel[travel.length-1];p.x=end.x;p.y=end.y;this.log('Position '+coord(p.x,p.y)+(p.x!==q.x||p.y!==q.y?' — obstacle stops the course.':'.'));cost=1;
      }else if(verb==='BEAM'){
        const amount=args.length?Number(args[0]):300;
        if(args.length>1||!Number.isInteger(amount)||amount<50||amount>1500)return fail('Usage: BEAM energy (50–1500; default 300).');
        const enemies=s.enemies.filter(e=>e.hp>0);if(!enemies.length)return fail('No raiders in this sector.');if(p.energy<amount)return fail('Insufficient energy.');if(this.damage.weapons>0)return fail('Weapon couplers damaged. REPAIR or retreat.');
        p.energy-=amount;for(const e of enemies){const hit=Math.round(amount*1.6/enemies.length/(1+A.dist(e,p)*.17));e.hp-=hit;this.log('Beam hits '+coord(e.x,e.y)+' for '+hit+'.');if(e.hp<=0)this.destroy(e);}this.sound('magic');cost=1;
      }else if(verb==='LANCE'){
        const q=this.coordinates(args);if(!q)return fail('Usage: LANCE column row (1–8).');if(q.x===p.x&&q.y===p.y)return fail('Choose a target cell other than your ship.');
        if(p.lances<=0)return fail('No lances. Use BEAM or dock for supplies.');if(this.damage.weapons>0)return fail('Weapon couplers damaged. REPAIR or retreat.');
        p.lances--;let result='Lance leaves the sector without a hit.';
        for(const cell of this.ray(p,q)){const obj=this.objectAt(s,cell.x,cell.y);if(obj){if(typeof obj==='object'){obj.hp=0;this.destroy(obj);result='Lance connects.';}else result='Lance absorbed by '+obj+' at '+coord(cell.x,cell.y)+'.';break;}}
        this.log(result);this.sound('rocket');cost=1;
      }else if(verb==='SHIELD'){
        const value=Number(args[0]);if(args.length!==1||!Number.isInteger(value)||value<0||value>1200)return fail('Usage: SHIELD level (0–1200).');const delta=value-p.shield;
        if(delta>p.energy)return fail('Not enough energy for that shield level.');if(!delta)return fail('Shields already at that level.');p.energy=Math.min(3000,p.energy-delta);p.shield=value;this.log('Shield reserve set to '+value+'. Energy '+p.energy+'.');cost=1;
      }else if(verb==='DOCK'){
        if(args.length)return fail('Usage: DOCK');if(!s.depot||A.dist(p,s.depot)>1.5)return fail('Move to a cell beside a depot (+) before docking.');if(s.enemies.some(e=>e.hp>0))return fail('Clear the raiders before docking.');
        p.energy=3000;p.shield=600;p.hull=100;p.lances=10;this.damage={drive:0,sensors:0,weapons:0};this.log('Depot service complete: energy, shields, hull and lances restored. 3 days.');this.sound('bank');cost=3;
      }else if(verb==='REPAIR'){
        if(args.length)return fail('Usage: REPAIR');if(p.energy<100)return fail('Repairs need 100 energy.');if(!Object.values(this.damage).some(Boolean)&&p.hull===100)return fail('All systems operational.');
        p.energy-=100;p.hull=Math.min(100,p.hull+15);for(const key of Object.keys(this.damage))this.damage[key]=Math.max(0,this.damage[key]-1);this.log('Repair shift: hull +15; subsystem damage reduced.');cost=1;
      }else if(verb==='WAIT'){
        if(args.length)return fail('Usage: WAIT');this.log('Holding position for one day.');cost=1;
      }else if(verb==='SOS'){
        if(args.length)return fail('Usage: SOS');if(!this.sos)return fail('Emergency tow already used.');
        this.sos=0;p.qx=0;p.qy=0;p.x=2;p.y=1;p.energy=Math.max(300,p.energy);this.log('Emergency tow to home relay. 12 days lost. DOCK to refit.');cost=12;
      }else return fail('Unknown order. Type HELP for commands.');
      this.days-=cost;this.turns++;this.reveal(p.qx,p.qy);
      if(this.kills>=this.total&&this.days>=0){this.score+=Math.max(0,this.days)*100+p.hull*10;this.log('MISSION COMPLETE. The free relays are open.');this.pending=[];this.finish(true);return true;}
      if(this.days<=0){this.log('Deadline expired. The Array has closed the relay frontier.');this.pending=[];this.finish(false);return true;}
      this.enemyTurn();this.reveal(p.qx,p.qy);
      if(p.hull<=0){this.log('LANTERN LOST. Command link terminated.');this.pending=[];this.finish(false);}
      else if(p.energy===0&&p.shield===0&&!this.sos&&(!this.sector.depot||A.dist(p,this.sector.depot)>1.5)){this.log('No power and no tow available. Mission lost.');this.pending=[];this.finish(false);}
      return true;
    }
    // Grid ray is bounded, skips the origin, and continues beyond the aim cell.
    ray(from,to){
      const dx=to.x-from.x,dy=to.y-from.y,n=Math.max(Math.abs(dx),Math.abs(dy));if(!n)return[];
      const out=[];let last=index(from.x,from.y);
      for(let i=1;i<=64;i++){const x=Math.round(from.x+dx/n*i),y=Math.round(from.y+dy/n*i);if(!valid(x)||!valid(y))break;const k=index(x,y);if(k!==last){out.push({x,y});last=k;}}
      return out;
    }
    enemyTurn(){
      const p=this.ship;
      for(const e of this.sector.enemies){
        if(e.hp<=0)continue;
        const hit=Math.ceil((this.relaxed?38:58)*(0.8+this.rand()*.4)/(1+A.dist(e,p)*.1)),absorbed=Math.min(p.shield,hit);p.shield-=absorbed;
        const hullHit=Math.ceil((hit-absorbed)/3);p.hull=Math.max(0,p.hull-hullHit);
        this.log('Raider '+coord(e.x,e.y)+' fires: shield −'+absorbed+(hullHit?', hull −'+hullHit:'')+'.');
        if(hullHit>0&&this.rand()<.3){const key=['drive','sensors','weapons'][Math.floor(this.rand()*3)];this.damage[key]=Math.min(3,this.damage[key]+1);this.log(key.toUpperCase()+' damaged. REPAIR costs 100 energy.');}
        if(p.hull<=0)break;
      }
    }
    pointer(x,y){
      if(x>=45&&x<333&&y>=88&&y<312){const cx=Math.floor((x-45)/36),cy=Math.floor((y-88)/28);this.selected={x:cx,y:cy};const obj=this.objectAt(this.sector,cx,cy);return(typeof obj==='object'&&obj?'LANCE ':'MOVE ')+(cx+1)+' '+(cy+1);}
      if(x>=387&&x<659&&y>=88&&y<312){return'JUMP '+(Math.floor((x-387)/34)+1)+' '+(Math.floor((y-88)/28)+1);}
      return '';
    }
    status(){const p=this.ship;return 'Sector '+coord(p.qx,p.qy)+' · Energy '+p.energy+' · Shield '+p.shield+' · Hull '+p.hull+' · Raiders '+(this.total-this.kills)+' · Days '+this.days+' · Score '+this.score;}
    render(c){
      D.rect(c,0,0,960,540,'#050e12');
      const text=(t,x,y,color=GREEN,size=13,align='left')=>D.text(c,t,x,y,color,size,align);
      const panel=(x,y,w,h,title)=>{c.strokeStyle='#27514f';c.lineWidth=1;c.strokeRect(x+.5,y+.5,w,h);D.rect(c,x+12,y-6,title.length*8+16,15,'#050e12');text(title,x+20,y-6,CYAN,12);};
      D.rect(c,0,0,960,35,'#13302f');text('VOID COMMAND',18,10,'#b7ffd3',17);text('FREE RELAY SERVICE / LANTERN',250,13,CYAN,12);text('CAMPAIGN 0'+this.mission,940,13,AMBER,12,'right');
      const p=this.ship,enemies=this.sector.enemies.filter(e=>e.hp>0),danger=enemies.length>0;
      panel(12,57,337,287,'TACTICAL / '+coord(p.qx,p.qy));panel(364,57,315,287,'FRONTIER / 8 × 8');panel(695,57,253,287,'SHIP SYSTEMS');
      for(let x=0;x<8;x++){text(x+1,63+x*36,72,'#528977',11,'center');text(x+1,404+x*34,72,'#528977',11,'center');}
      for(let y=0;y<8;y++){
        text(y+1,26,97+y*28,'#528977',11);text(y+1,373,97+y*28,'#528977',11);
        for(let x=0;x<8;x++){
          const sx=45+x*36,sy=88+y*28,obj=this.objectAt(this.sector,x,y),here=p.x===x&&p.y===y;
          if(here)D.rect(c,sx+2,sy+1,32,25,'#123d33');
          if(this.selected.x===x&&this.selected.y===y){c.strokeStyle='#9ac8ad';c.strokeRect(sx+1,sy,34,27);}
          text(here?'▲':obj==='star'?'*':obj==='depot'?'+':obj?'R':'·',sx+18,sy+5,here?'#afffcb':obj==='star'?'#7d9598':obj==='depot'?CYAN:obj?'#f0a283':'#285149',17,'center');
          const q=this.chart[index(x,y)],cx=387+x*34,cy=sy,current=x===p.qx&&y===p.qy;
          if(current)D.rect(c,cx,cy,33,26,'#16483c');
          text(q?.knownDepot?'?+':q===null?'··':q.enemies+(q.depot?'+':'−'),cx+17,cy+7,q?.enemies>0?'#eda28b':q?.depot||q?.knownDepot?CYAN:q===null?'#285149':GREEN,12,'center');
        }
      }
      text('▲ YOU   R RAIDER   + DEPOT   * STAR',28,325,'#79a998',11);text('RAIDERS / + DEPOT   ·· UNCHARTED',380,325,'#79a998',11);
      text(danger?'CONDITION / CONTACT':'CONDITION / CLEAR',712,77,danger?'#f1ae84':GREEN,13);
      const meter=(label,value,max,y,color)=>{text(label,712,y,'#a8b8ae',12);text(value,930,y,color,13,'right');D.rect(c,712,y+18,218,5,'#152d2c');D.rect(c,712,y+18,218*A.clamp(value/max,0,1),5,color);};
      meter('ENERGY',p.energy,3000,108,CYAN);meter('SHIELD',p.shield,1200,147,'#8aafef');meter('HULL',p.hull,100,186,p.hull<35?'#f39888':GREEN);
      text('LANCES   '+String(p.lances).padStart(2,'0')+'   TOW '+this.sos,712,226,AMBER,12);text('RAIDERS  '+String(this.total-this.kills).padStart(2,'0')+'   DAYS '+this.days,712,249,AMBER,12);
      text('DRV '+this.damage.drive+'  SNS '+this.damage.sensors+'  WPN '+this.damage.weapons,712,278,Object.values(this.damage).some(Boolean)?'#ed9a87':'#69948c',11);
      text('0 = OPERATIONAL',712,300,'#69948c',10);
      panel(12,367,936,154,'COMMAND LOG / LATEST');
      this.logs.slice(-6).forEach((line,i)=>text(line.slice(0,112),27,386+i*20,i===Math.min(5,this.logs.length-1)?'#bcf3c7':'#729d8f',12));
      text('ORDERS BELOW  ·  CLICK MAPS TO PREPARE A COURSE  ·  HELP FOR REFERENCE',18,528,'#466f65',10);
      if(this.viewHelp){
        D.rect(c,75,67,810,437,'#091b21');panel(75,67,810,437,'COMMAND REFERENCE / MAP TO CLOSE');
        const lines=[
          ['SCAN','Reveal the surrounding 3 × 3 sectors. 40 energy / 1 day.'],
          ['JUMP x y','Travel to frontier sector (column, row). Cost depends on distance.'],
          ['MOVE x y','Move within the tactical grid. Obstacles stop the course.'],
          ['BEAM [energy]','Split 50–1500 energy among local raiders. Default: 300.'],
          ['LANCE x y','Fire along a heading. First raider / star / depot stops the shot.'],
          ['SHIELD level','Transfer energy to / from shield reserve (0–1200).'],
          ['DOCK','Adjacent to + in a cleared sector: full refit, 3 days.'],
          ['REPAIR','100 energy, 1 day: +15 hull and reduce subsystem damage.'],
          ['WAIT','Pass one day. Local raiders retaliate.'],
          ['SOS','One emergency tow home. 12 days. Dock on arrival.'],
          ['HELP / MAP / STATUS','Read-only. Coordinates are 1–8; column before row.']
        ];
        lines.forEach(([a,b],i)=>{text(a,98,97+i*31,AMBER,12);text(b,287,97+i*31,GREEN,11);});
        text('Each operational order invites local retaliation. Reads and rejected orders are free.',98,460,CYAN,12);
        text('Tip: scan → jump → raise shields → beam / lance → dock. Save your tow for trouble.',98,482,'#93b6ac',11);
      }
    }
  };
})(globalThis.Arcade);
