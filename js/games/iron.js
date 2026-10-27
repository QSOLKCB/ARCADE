/* Iron Meridian — original mercenary arcade game. SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const D = A.Draw;
  const CONTRACTS = [
    { name: 'BREAKWATER', title: 'The coast is not clear.', task: 'Rescue 3 engineers. Destroy the roadblock. Reach extraction.', reward: 600, ground: '#697b60', track: '#a2a482', wall: '#69746d' },
    { name: 'DUST SIGNAL', title: 'Bring the signal home.', task: 'Recover 3 field radios. Destroy the crawler. Reach extraction.', reward: 800, ground: '#8c8064', track: '#b5a17b', wall: '#7c6d5b' },
    { name: 'NIGHT RELAY', title: 'One final transmission.', task: 'Recover 3 power cores. Silence the sentinel. Reach extraction.', reward: 1000, ground: '#435b62', track: '#63757a', wall: '#4c5b69' }
  ];
  const WEAPONS = [
    { name:'SIDEARM', delay:.26, damage:24, speed:270, ammo:Infinity, count:1 },
    { name:'CARBINE', delay:.11, damage:20, speed:310, ammo:220, count:1 },
    { name:'SCATTER', delay:.42, damage:24, speed:250, ammo:65, count:5 },
    { name:'LAUNCHER', delay:.65, damage:100, speed:180, ammo:24, count:1 }
  ];
  A.Iron = class extends A.Game {
    constructor(options, sound) { super(options, sound); this.id = 'iron'; this.stage = 0; this.credits = 400; this.owned = [0]; this.armour = false; this.extraGrenades = false; this.setup(); }
    setup() {
      this.rand = A.rng(1100 + this.stage); this.height = 1370; this.cam = 1100; this.bullets = []; this.grenades = []; this.pickups = []; this.particles.items = []; this.objectives = []; this.effects.items=[]; this.wrecks=[];
      this.walls = [];
      for (let row = 0; row < 6; row++) { const y = 220 + row * 158; this.walls.push({x:38+(row%2)*28,y,w:65,h:38},{x:354-(row%2)*18,y:y+46,w:74,h:33}); }
      this.players = Array.from({length:this.options.players}, (_, i) => ({x:218+i*42,y:1260,hp:this.maxHP(),maxHP:this.maxHP(),inv:1.5,angle:-Math.PI/2,walk:0,attack:0,cd:0,dash:0,dashCD:0,weapon:this.owned[this.owned.length-1],ammo:WEAPONS.map(w=>w.ammo),grenades:this.extraGrenades?6:3,revive:0}));
      for (let i = 0; i < 3; i++) this.objectives.push({x:[147,324,190][i],y:990-i*290,done:false});
      this.enemies = [];
      for(let row=0;row<6;row++) for(let col=0;col<3;col++) {
        const p={x:135+col*100+(this.rand()-.5)*35,y:1030-row*147+(this.rand()-.5)*36,hp:row>3?70:44,maxHP:row>3?70:44,cd:.6+this.rand(),angle:Math.PI/2,walk:0,attack:0,kind:col===1&&row%2===1?'turret':'guard',active:false};
        if (this.walls.some(w=>A.inside(p,w,12))) p.x=240;
        this.enemies.push(p);
      }
      this.enemies.push({x:240,y:153,hp:500+this.stage*120,maxHP:500+this.stage*120,cd:1.2,angle:Math.PI/2,kind:'tank',walk:0,attack:0,active:false});
      for(let i=0;i<3;i++) { this.pickups.push({x:250,y:1050-i*310,kind:'ammo'}); this.pickups.push({x:300,y:870-i*295,kind:'health'}); }
    }
    maxHP() { return (this.relaxed?160:110)+(this.armour?40:0); }
    menu() {
      const c=CONTRACTS[this.stage];
      return { eyebrow:'CONTRACT '+(this.stage+1)+' / 3 · '+c.name, title:c.title, description:c.task+' Buy a loadout or deploy with your unlimited sidearm.', details:'WASD / arrows move · J fire · K grenade · Space dash · E switch / revive. Mouse aim is optional. Purchases equip the whole team; ammo refills each contract.', shop:[{id:'buy1',name:'Carbine',detail:'Rapid fire · 220 rounds',cost:200,owned:this.owned.includes(1)},{id:'buy2',name:'Scattergun',detail:'Close range · 65 shells',cost:300,owned:this.owned.includes(2)},{id:'buy3',name:'Launcher',detail:'Blast damage · 24 rockets',cost:400,owned:this.owned.includes(3)},{id:'armour',name:'Field armour',detail:'+40 health · all contracts',cost:150,owned:this.armour},{id:'grenades',name:'Grenade rig',detail:'6 grenades per contract',cost:100,owned:this.extraGrenades}], credits:this.credits, button:'Deploy to '+c.name, action:'deploy' };
    }
    action(id) {
      if (this.state!=='briefing') return;
      if(id==='deploy') { this.setup(); this.state='playing'; this.say('FOLLOW THE ROAD. RECOVER ALL 3 OBJECTIVES.',4); return; }
      const item=this.menu().shop.find(s=>s.id===id);
      if(!item || item.owned || item.cost>this.credits) return;
      this.credits-=item.cost; if(id.startsWith('buy')) this.owned.push(Number(id.slice(3))); if(id==='armour') this.armour=true; if(id==='grenades') this.extraGrenades=true; this.sound('select');
    }
    fire(p) {
      let wi=p.weapon;
      if(p.ammo[wi]<=0) { wi=0; p.weapon=0; this.say('AMMO EMPTY — SIDEARM READY'); }
      const w=WEAPONS[wi]; p.cd=w.delay; p.attack=.06; if(Number.isFinite(p.ammo[wi])) p.ammo[wi]--;
      for(let i=0;i<w.count&&this.bullets.length<160;i++) { const angle=p.angle+(i-(w.count-1)/2)*.14; this.bullets.push({x:p.x+Math.cos(angle)*14,y:p.y+Math.sin(angle)*14,vx:Math.cos(angle)*w.speed,vy:Math.sin(angle)*w.speed,life:1.5,damage:w.damage,enemy:false,rocket:wi===3}); }
      this.sound(['fire','carbine','scatter','rocket'][wi]); this.particles.burst(p.x+Math.sin(p.angle)*6,p.y-Math.cos(p.angle)*6,'#ddbf77',1,25,{life:.3,size:1});
    }
    explode(x,y,radius,damage) {
      this.effects.add('blast',x,y,'#ffcf8a',radius,.45); this.particles.burst(x,y,'#f5a56d',18,65,{size:4,life:.6}); this.particles.burst(x,y,'#fff0ba',28,120,{size:2,life:.45}); this.particles.burst(x,y,'#58615c',10,30,{size:5,life:1}); this.shake=.17; this.sound('boom');
      for(const e of this.enemies) if(e.hp>0 && Math.hypot(e.x-x,e.y-y)<radius+(e.kind==='tank'?20:0)) this.damage(e,damage);
    }
    damage(e, amount) {
      if(e.hp<=0) return; e.hp-=amount; e.hurt=.1; e.active=true; this.particles.burst(e.x,e.y,'#dbb878',4);
      if(e.hp<=0) { this.wrecks.push({x:e.x,y:e.y,kind:e.kind}); this.effects.add('blast',e.x,e.y,e.kind==='tank'?'#ffda99':'#e9bd8c',e.kind==='tank'?62:18,.4); this.score+=e.kind==='tank'?1200:e.kind==='turret'?150:100; this.particles.burst(e.x,e.y,'#fbd094',14); if(e.kind==='tank') this.say('ROADBLOCK CLEARED. RECOVER OBJECTIVES, THEN EXTRACT.',4); else if(this.rand()<.2) this.pickups.push({x:e.x,y:e.y,kind:this.rand()<.6?'ammo':'health'}); }
    }
    update(dt, inputs) {
      if(this.state!=='playing') return; this.common(dt);
      for(let i=0;i<this.players.length;i++) {
        const p=this.players[i], a=inputs[i]||A.emptyInput(); if(p.hp<=0) continue;
        p.inv=Math.max(0,p.inv-dt); p.cd-=dt; p.attack-=dt; p.dashCD-=dt; p.dash=Math.max(0,p.dash-dt);
        if(a.jumpPressed && p.dashCD<=0) { p.dash=.19; p.dashCD=1.3; p.inv=Math.max(p.inv,.23); this.sound('jump'); }
        A.move(p,a.x*(p.dash>0?265:100)*dt,a.y*(p.dash>0?265:100)*dt,this.walls,480,this.height);
        if((a.x||a.y)&&p.dash>0)this.particles.burst(p.x,p.y,'#b6b399',1,16,{size:3,life:.25});
        if(a.x||a.y) { p.walk+=dt; p.angle=Math.atan2(a.y,a.x); }
        if(a.aim) p.angle=Math.atan2(a.aim.y+this.cam-p.y,a.aim.x-p.x);
        if(a.fire && p.cd<=0) this.fire(p);
        if(a.specialPressed && p.grenades>0) { p.grenades--; this.grenades.push({x:p.x,y:p.y,vx:Math.cos(p.angle)*140,vy:Math.sin(p.angle)*140,life:.68}); this.sound('select'); }
        const down=this.players.find(q=>q!==p&&q.hp<=0&&A.dist(q,p)<26);
        if(down && a.interact) { down.revive+=dt; if(down.revive>1.2) { down.hp=Math.floor(down.maxHP*.45); down.inv=2; down.revive=0; this.say('PARTNER BACK IN ACTION'); } }
        else if(a.interactPressed) p.weapon=this.owned[(this.owned.indexOf(p.weapon)+1)%this.owned.length];
        for(const o of this.objectives) if(!o.done && A.dist(o,p)<24) { o.done=true; this.effects.add('ring',o.x,o.y,'#b8e8ce',29,.5); this.score+=500; this.sound('pickup'); this.say(this.stage===0?'ENGINEER RESCUED':'EQUIPMENT RECOVERED'); }
        for(const q of this.pickups) if(!q.taken && A.dist(q,p)<18) { q.taken=true; if(q.kind==='health') p.hp=Math.min(p.maxHP,p.hp+40); else for(const wi of this.owned) if(wi) p.ammo[wi]=Math.min(WEAPONS[wi].ammo,p.ammo[wi]+Math.ceil(WEAPONS[wi].ammo*.4)); this.sound('pickup'); }
      }
      const living=this.players.filter(p=>p.hp>0); if(!living.length) { this.finish(false); return; }
      const desired=A.clamp(Math.max(...living.map(p=>p.y))-185,0,this.height-270);
      this.cam+= (desired-this.cam)*Math.min(1,dt*7);
      for(const p of living) p.y=A.clamp(p.y,this.cam+42,this.cam+250);
      for(const e of this.enemies) {
        if(e.hp<=0) continue;
        const p=living.reduce((best,q)=>A.dist(q,e)<A.dist(best,e)?q:best,living[0]); const dist=A.dist(e,p);
        if(dist<240) e.active=true; if(!e.active || dist>360) continue;
        e.cd-=dt; e.attack-=dt; e.hurt=Math.max(0,(e.hurt||0)-dt); e.angle=Math.atan2(p.y-e.y,p.x-e.x);
        if(e.kind==='guard' && dist>90) { A.move(e,Math.cos(e.angle)*28*dt,Math.sin(e.angle)*28*dt,this.walls,480,this.height,7); e.walk+=dt; }
        if(e.kind==='tank') e.x=240+Math.sin(this.time*.7)*60;
        if(e.cd<0 && dist<260) {
          e.cd=(e.kind==='tank'?.9:1.8-this.stage*.15)*(this.relaxed?1.5:1);
          const count=e.kind==='tank'?5:1;
          for(let i=0;i<count&&this.bullets.length<160;i++){ const angle=e.angle+(i-(count-1)/2)*.19; this.bullets.push({x:e.x+Math.cos(angle)*18,y:e.y+Math.sin(angle)*18,vx:Math.cos(angle)*90,vy:Math.sin(angle)*90,life:3.2,damage:this.relaxed?9:16,enemy:true}); }
          e.attack=.08;
        }
        for(const p2 of living) if(A.dist(p2,e)<(e.kind==='tank'?29:13)) this.hitPlayer(p2,this.relaxed?9:15);
      }
      for(const b of this.bullets) {
        b.life-=dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
        if(this.walls.some(w=>A.inside(b,w,1))) { this.particles.burst(b.x,b.y,'#e6d4a4',3,35,{size:1,life:.2}); if(b.rocket&&b.life>0) this.explode(b.x,b.y,55,b.damage); b.life=0; }
        if(b.life<=0) continue;
        if(b.enemy) { for(const p of living) if(A.dist(p,b)<8) { this.hitPlayer(p,b.damage); b.life=0; break; } }
        else for(const e of this.enemies) if(e.hp>0&&A.dist(e,b)<(e.kind==='tank'?24:10)) { if(b.rocket) this.explode(b.x,b.y,60,b.damage); else this.damage(e,b.damage); b.life=0; break; }
      }
      for(const g of this.grenades) { g.life-=dt; g.x+=g.vx*dt; g.y+=g.vy*dt; g.vx*=.97; g.vy*=.97; if(g.life<=0) this.explode(g.x,g.y,68,150); }
      this.bullets=this.bullets.filter(b=>b.life>0&&b.x>-10&&b.x<490); this.grenades=this.grenades.filter(g=>g.life>0); this.pickups=this.pickups.filter(q=>!q.taken);
      if(this.players.every(p=>p.hp<=0)){this.finish(false);return;}
      if(this.objectives.every(o=>o.done) && !this.enemies.some(e=>e.kind==='tank'&&e.hp>0) && living.some(p=>p.hp>0 && p.y<100 && p.x>155 && p.x<325)) this.completeStage();
    }
    completeStage() {
      if(this.state!=='playing') return;
      this.score+=2000; this.credits+=CONTRACTS[this.stage].reward;
      if(this.stage===2) this.finish(true); else { this.stage++; this.state='briefing'; this.setup(); this.sound('win'); }
    }
    status() { const p=this.players[0]; return CONTRACTS[this.stage].name+' · '+this.objectives.filter(o=>o.done).length+'/3 recovered · '+WEAPONS[p.weapon].name+' '+(p.ammo[p.weapon]===Infinity?'∞':p.ammo[p.weapon])+' · Grenades '+p.grenades+' · Score '+this.score; }
    render(c) {
      const s=CONTRACTS[this.stage]; D.rect(c,0,0,480,270,s.ground); c.save(); c.translate(0,-Math.round(this.cam));
      for(let y=Math.floor(this.cam/24)*24;y<this.cam+294;y+=24) {
        const road=175+Math.sin(y*.008)*21; D.rect(c,road,y,138,25,s.track); D.rect(c,road+3,y,2,20,'#d9cf9730');
        for(let i=0;i<8;i++) { const x=(i*73+y*7)%480; if(x<road-5||x>road+145) D.rect(c,x,y+((i*13)%20),5,2,'#203c3329'); }
        if(y%48===0) D.rect(c,238,y,4,14,'#e7deaa60');
      }
      for(const w of this.wrecks){D.rect(c,w.x-8,w.y-6,16,12,'#28342d');D.rect(c,w.x-5,w.y-3,10,6,'#596451');if(w.kind==='tank'){D.rect(c,w.x-23,w.y-24,46,48,'#283933');D.rect(c,w.x-12,w.y-14,24,28,'#59604e');for(let i=0;i<4;i++){const age=(this.time*.6+i*.25)%1;c.globalAlpha=(1-age)*.35;D.rect(c,w.x-8+Math.sin(i*4+age)*8,w.y-15-age*34,10+age*14,9+age*12,'#9aa394');}c.globalAlpha=1;}}
      D.rect(c,164,50,153,48,'#1d4d45'); D.text(c,'EXTRACTION',240,65,'#b6f1be',11,'center');
      for(const w of this.walls) if(w.y>this.cam-50&&w.y<this.cam+280) { D.rect(c,w.x+3,w.y+5,w.w,w.h,'#142a3250'); D.rect(c,w.x,w.y,w.w,w.h,s.wall); D.rect(c,w.x+3,w.y+3,w.w-6,3,'#c3c5a1'); for(let x=8;x<w.w;x+=18) D.rect(c,w.x+x,w.y+10,10,w.h-16,'#263c3b60'); }
      for(let i=0;i<13;i++){ const y=80+i*110;if(y>this.cam-30&&y<this.cam+310) { D.palm(c,20+(i%3)*9,y); D.palm(c,452-(i%2)*12,y+40); } }
      for(const o of this.objectives) if(!o.done) { D.rect(c,o.x-12,o.y-15,24,24,'#273c3a'); if(this.stage===0) D.person(c,{x:o.x,y:o.y+4},'thief','#e4c584',.65); else D.gem(c,o.x,o.y); D.text(c,'▼',o.x,o.y-25,'#fff0a9',9,'center'); }
      for(const p of this.pickups) { D.rect(c,p.x-7,p.y-6,14,12,p.kind==='health'?'#f6e0b2':'#344b43'); D.text(c,p.kind==='health'?'+':'A',p.x,p.y-4,p.kind==='health'?'#b15150':'#f2dca8',9,'center'); }
      for(const e of this.enemies) if(e.hp>0) { if(e.kind==='tank') { D.rect(c,e.x-25,e.y-25,9,50,'#182c30');D.rect(c,e.x+16,e.y-25,9,50,'#182c30');D.rect(c,e.x-17,e.y-24,34,49,'#6d7562');D.rect(c,e.x-12,e.y-15,24,28,'#8b916f'); c.save();c.translate(e.x,e.y);c.rotate(e.angle-Math.PI/2);D.rect(c,-4,-5,8,42,'#2f423c');c.restore();D.bar(c,e.x-24,e.y-33,48,e.hp,e.maxHP,'#edb17b'); } else { D.topSoldier(c,e,e.kind==='turret'?'#b39b73':'#b07c67'); if(e.kind==='turret') D.rect(c,e.x-13,e.y+7,27,5,'#454f3f'); } }
      this.players.forEach((p,i)=>{ if(p.hp<=0) { D.text(c,'HOLD E / H',p.x,p.y-4,'#ffe1a0',7,'center'); D.rect(c,p.x-8,p.y+4,16,3,'#ffe1a0'); } else { D.topSoldier(c,p,i?'#82c3c7':'#f0d28d'); D.text(c,'P'+(i+1),p.x,p.y+13,i?'#b0e6e4':'#fff0ae',6,'center'); } });
      for(const b of this.bullets){c.strokeStyle=b.enemy?'#fa917f80':'#fff0ab90';c.lineWidth=b.rocket?3:1;c.beginPath();c.moveTo(b.x-b.vx*.027,b.y-b.vy*.027);c.lineTo(b.x,b.y);c.stroke();D.rect(c,b.x-1,b.y-2,b.rocket?4:2,b.rocket?5:4,b.enemy?'#ff8f70':'#fff6c5');}
      for(const g of this.grenades){D.rect(c,g.x-3,g.y-4-Math.sin(g.life/.68*Math.PI)*15,6,6,'#f4d590');}
      this.effects.draw(c); this.particles.draw(c); c.restore();
      c.save();c.globalAlpha=.22;for(let i=0;i<24;i++){const x=(i*71+this.time*(this.stage===1?18:6))%480,y=(i*43+this.time*(this.stage===2?170:8)-this.cam*.2)%270;if(this.stage===2)D.rect(c,x,y,1,7,'#a7c6cf');else D.rect(c,x,y,this.stage===1?4:2,1,'#e2d6a1');}c.restore();
      this.players.forEach((p,i)=>{D.rect(c,10+i*112,30,105,22,'#13252bd9');D.text(c,'P'+(i+1)+'  '+Math.ceil(p.hp),15+i*112,34,i?'#abe0e1':'#f3d394',7);D.bar(c,15+i*112,45,94,p.hp,p.maxHP,i?'#8dcbd0':'#e7ca88');});
      const tank=this.enemies.find(e=>e.kind==='tank');
      const p=this.players[0];D.rect(c,320,30,151,28,'#13252bd9');D.text(c,WEAPONS[p.weapon].name+' '+(p.ammo[p.weapon]===Infinity?'∞':p.ammo[p.weapon]),465,34,'#ffe3a7',8,'right');D.text(c,'GRENADES '+p.grenades+'  DASH '+(p.dashCD<=0?'READY':'…'),465,46,'#bdd9c9',7,'right');
      D.hud(c,this,'IRON MERIDIAN / '+(this.stage+1),'RECOVER '+this.objectives.filter(o=>o.done).length+'/3  '+String(this.score).padStart(6,'0'));
      if(this.messageTime<=0) D.text(c,tank.hp<=0&&this.objectives.every(o=>o.done)?'↑ REACH THE EXTRACTION PAD':'↑ PUSH NORTH · RECOVER MARKED OBJECTIVES',240,255,'#fff0bd',7,'center');
    }
  };
  A.Iron.CONTRACTS=CONTRACTS; A.Iron.WEAPONS=WEAPONS;
})(globalThis.Arcade);
