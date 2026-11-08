/* SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const {q, px, clamp, Draw:D} = A;
  const RIVALS = ['CRON REAPER', 'MERGE CONFLICT', 'ROOT CAUSE'];
  A.Kombat = class extends A.Game {
    constructor() { super('kombat', 9001); this.meter = 40; this.setup(); }
    setup() {
      this.hp = this.maxHP = 100; this.enemyHP = 100 + this.stage * 15;
      this.enemyMax = this.enemyHP; this.roundTime = 60 * 60;
      this.p = {x:q(190),y:q(292),vy:0,face:1,attack:null,stun:0,cd:0,guard:false};
      this.enemy = {x:q(450),y:q(292),vy:0,face:-1,attack:null,stun:0,cd:60,guard:false,poise:0};
      this.bolts = []; this.inv = 0; this.announce('INCIDENT ' + (this.stage + 1) + ' // ' + RIVALS[this.stage], 130);
    }
    attack(fighter, kind) {
      if (fighter.attack || fighter.cd || fighter.stun) return;
      const heavy = kind === 'kick';
      fighter.attack = {kind,age:0,wind:heavy?12:6,hit:false}; fighter.cd = heavy?36:24;
      this.emit('shot');
    }
    impact(attacker, defender, enemyAttack) {
      const attack = attacker.attack, range = attack.kind === 'kick' ? 86 : 65;
      if (Math.abs(attacker.x - defender.x) > q(range) || Math.abs(attacker.y - defender.y) > q(45)) return;
      const facing = (defender.x - attacker.x) * attacker.face >= 0;
      if (!facing) return;
      const guarded = defender.guard && (attacker.x - defender.x) * defender.face >= 0;
      const base = attack.kind === 'kick' ? 16 : 10, damage = guarded ? 2 : base;
      if (enemyAttack) { this.hp = Math.max(0, this.hp-damage); }
      else { this.enemyHP = Math.max(0,this.enemyHP-damage); this.meter = Math.min(100,this.meter+(guarded?5:14)); this.score += damage*10; }
      defender.x = clamp(defender.x + q(attacker.face*(guarded?5:15)),q(45),q(595));
      if (!guarded && (!defender.poise || enemyAttack)) {
        defender.stun = 12; defender.attack = null; if (!enemyAttack) defender.poise = 50;
      }
      this.burst(defender.x,defender.y-q(42),guarded?'#a1edf0':'#ffb65d',8); this.emit(guarded?'block':'hurt');
    }
    tick(input) {
      if (!this.begin()) return;
      const p=this.p,e=this.enemy;
      if (this.roundTime) this.roundTime--;
      for (const f of [p,e]) {
        if (f.stun) f.stun--; if (f.cd) f.cd--; if (f.poise) f.poise--;
        f.face = (f===p?e.x-p.x:p.x-e.x)>=0?1:-1;
        f.vy += q(2,5); f.y += f.vy;
        if (f.y>=q(292)) { f.y=q(292); f.vy=0; }
      }
      p.guard=input.y>0 && p.y===q(292) && !p.attack;
      if (!p.stun) {
        if (!p.guard && !p.attack) p.x = clamp(p.x+input.x*q(5,2),q(45),q(595));
        if (input.cPressed && p.y===q(292) && !p.guard) { p.vy=q(-8); this.emit('jump'); }
        if (!p.guard) {
          if (input.a) this.attack(p,'punch');
          else if (input.b) this.attack(p,'kick');
          if (input.dPressed && this.meter>=100) {
            this.meter=0; p.attack=null; p.cd=24; this.bolts.push({x:p.x,y:p.y-q(37),vx:q(p.face*8),life:85});
            this.announce('ROLLBACK!',70); this.emit('blast');
          }
        }
      }
      e.guard = !e.attack && !e.stun && this.tickCount%180<40 && Math.abs(e.x-p.x)<q(115);
      if (!e.stun && !e.attack && !e.guard) {
        if (Math.abs(e.x-p.x)>q(62)) e.x += A.sign(p.x-e.x)*q(13+this.stage*2,10);
        if (!e.cd && Math.abs(e.x-p.x)<q(110)) this.attack(e,this.tickCount%3===0?'punch':'kick');
      }
      // Prevent grounded fighters occupying the same space while still allowing jump crossovers.
      if (Math.abs(e.x-p.x)<q(35) && Math.abs(e.y-p.y)<q(35)) {
        const s=p.x<e.x?-1:1; p.x=clamp(e.x+q(s*35),q(45),q(595));
      }
      for (const f of [p,e]) if (f.attack) {
        const a=f.attack; a.age++;
        if (a.age>=a.wind && !a.hit) { a.hit=true; this.impact(f,f===p?e:p,f===e); }
        if (f.attack && a.age>a.wind+9) f.attack=null;
      }
      for (const b of this.bolts) {
        b.x+=b.vx; b.life--;
        if (Math.abs(b.x-e.x)<q(28) && Math.abs(b.y-(e.y-q(37)))<q(45)) {
          b.life=0; this.enemyHP=Math.max(0,this.enemyHP-28); e.stun=22; e.attack=null;
          this.burst(e.x,e.y-q(35),'#bcfa6c',25); this.score+=280;
        }
      }
      this.bolts=this.bolts.filter(b=>b.life>0 && b.x>0 && b.x<q(640));
      // A simultaneous KO is a defeat; a timeout cannot overwrite fatal damage.
      if (this.hp<=0) this.finish(false);
      else if (this.enemyHP<=0) { this.score+=1500; this.clearStage(); }
      else if (!this.roundTime && this.hp!==this.enemyHP) {
        if (this.hp>this.enemyHP) { this.score+=800; this.clearStage(); } else this.finish(false);
      }
    }
    hud() { return {left:'SRE ' + this.hp + '   ROLLBACK ' + this.meter + '%',right:'INCIDENT ' + (this.stage+1) + '/3 · ' + Math.ceil(this.roundTime/60),objective:'Defeat three production incidents · down guards · C unleashes rollback at 100%'}; }
    draw(c) {
      D.rect(c,0,0,640,360,'#10131e');
      for (let x=25;x<640;x+=102) {
        D.rect(c,x,58,76,223,'#1e2935'); D.rect(c,x+5,63,66,210,'#0a111c');
        for (let r=0;r<9;r++) { D.rect(c,x+10,71+r*22,56,15,'#263342'); D.rect(c,x+16,76+r*22,23,3,'#557582'); D.rect(c,x+54,76+r*22,4,4,(r+this.stage)%4?'#87dca8':'#f47686'); }
      }
      D.rect(c,0,285,640,75,'#202c3a');
      for (let x=-200;x<900;x+=70) D.line(c,320+(x-320)*.5,285,x,360,'#3a4e59');
      for (const y of [292,310,335]) D.line(c,0,y,640,y,'#3a4e59');
      D.text(c,'PRODUCTION IS THE ARENA',320,250,'#77919e',11,'center');
      D.text(c,'S R E',28,33,'#bff676',16); D.text(c,RIVALS[this.stage],612,33,'#ff879e',16,'right');
      D.bar(c,28,43,240,this.hp,100,'#bff676'); D.bar(c,372,43,240,this.enemyHP,this.enemyMax,'#ff879e');
      D.text(c,Math.ceil(this.roundTime/60),320,44,'#fff1d3',24,'center');
      for (const [f,color] of [[this.p,'#b9ee76'],[this.enemy,'#d77c98']]) {
        const x=px(f.x),y=px(f.y);
        D.person(c,x,y,f.stun?'#ffdda0':color,f.face,this.tickCount,'trooper',4.2);
        if (f.guard) { D.line(c,x+f.face*25,y-60,x+f.face*25,y-20,'#b7e6ec',5); D.text(c,'GUARD',x,y-74,'#b7e6ec',9,'center'); }
        if (f.attack) {
          const active=f.attack.age>=f.attack.wind, reach=f.attack.kind==='kick'?75:55;
          if (active) { D.rect(c,x+(f.face>0?15:-reach),y-(f.attack.kind==='kick'?27:48),reach-15,9,color); D.ellipse(c,x+f.face*reach,y-(f.attack.kind==='kick'?23:44),7,6,'#fff3d2'); }
          else if (f===this.enemy) D.text(c,f.attack.kind==='kick'?'KICK!':'STRIKE!',x,y-83,'#ffbd6a',12,'center');
        }
      }
      for (const b of this.bolts) { D.ellipse(c,px(b.x),px(b.y),17,12,'#bafa67'); D.rect(c,px(b.x)-9,px(b.y)-3,18,6,'#fff7d5'); }
      this.drawEffects(c); D.bar(c,180,331,280,this.meter,100,'#c5fc73');
      D.text(c,this.meter===100?'C  //  ROLLBACK READY':'ROLLBACK BUFFER',320,350,'#d2e4c9',10,'center');
    }
  };
  A.register({id:'kombat',title:'DevOps Kombat',subtitle:'Finish the incident.',genre:'1-ON-1 FIGHTER',color:'#fe829b',number:'04',controls:['Move · down guards','Z · punch','X · kick','Space · jump · C · rollback'],description:'SRE versus Cron Reaper, Merge Conflict and Root Cause. Block the windup. Build your meter. Finish the incident.'},()=>new A.Kombat());
})(globalThis.Arcade2);
