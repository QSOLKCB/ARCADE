/* SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const {q, px, clamp, Draw:D} = A;
  const RIVALS = ['CRON REAPER', 'MERGE CONFLICT', 'ROOT CAUSE', 'MEMORY LEAK'];
  A.Kombat = class extends A.Game {
    constructor(mode = 'legacy') { super('kombat', 9001, mode); this.meter = 40; this.setup(); }
    // Extended adds a fourth incident, Memory Leak, and a 75-second clock.
    get lastIncident() { return this.rules.extended ? 3 : 2; }
    setup() {
      this.hp = this.maxHP = 100; this.enemyHP = 100 + this.stage * 15;
      this.enemyMax = this.enemyHP; this.roundTime = (this.rules.extended ? 75 : 60) * 60;
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
      else { this.enemyHP = Math.max(0,this.enemyHP-damage); this.meter = Math.min(100,this.meter+(guarded?5:14)*(this.rules.remix?2:1)); this.score += damage*10; }
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
          b.life=0; this.enemyHP=Math.max(0,this.enemyHP-(this.rules.remix?40:28)); e.stun=22; e.attack=null;
          this.burst(e.x,e.y-q(35),'#bcfa6c',25); this.score+=280;
        }
      }
      this.bolts=this.bolts.filter(b=>b.life>0 && b.x>0 && b.x<q(640));
      // A simultaneous KO is a defeat; a timeout cannot overwrite fatal damage.
      if (this.hp<=0) this.finish(false);
      else if (this.enemyHP<=0) { this.score+=1500; this.clearStage(this.lastIncident); }
      else if (!this.roundTime && this.hp!==this.enemyHP) {
        if (this.hp>this.enemyHP) { this.score+=800; this.clearStage(this.lastIncident); } else this.finish(false);
      }
    }
    hud() { return {left:'SRE ' + this.hp + '   ROLLBACK ' + this.meter + '%',right:'INCIDENT ' + (this.stage+1) + '/' + (this.lastIncident+1) + ' · ' + Math.ceil(this.roundTime/60),
      objective:(this.rules.remix ? 'Hotfix: the meter fills twice as fast and rollback hits harder · ' : '') + 'Defeat ' + (this.rules.extended ? 'four' : 'three') + ' production incidents · down guards · C unleashes rollback at 100%'}; }
    // Presentation only: reads state, never writes it (see tests/arcade2-parity.test.cjs).
    draw(c) {
      const G = A.Gfx, tick = this.tickCount, stage = this.stage;
      const tint = ['#3aa8ff', '#b46cff', '#ff5a5a', '#3affc8'][stage], rivalColor = ['#d77c98', '#b98cff', '#ff7a5c', '#7fd8ff'][stage];
      G.layer(c, 'kombat-room:' + stage, 640, 360, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 285, [[0, '#070910'], [1, G.mix('#10131e', tint, 0.12)]]); ctx.fillRect(0, 0, 640, 285);
        ctx.fillStyle = '#0b0e16'; for (let x = 0; x < 640; x += 32) ctx.fillRect(x, 0, 2, 50);
        ctx.fillStyle = G.rgba(tint, 0.35); ctx.fillRect(0, 50, 640, 2);
        for (let x = 25; x < 640; x += 102) {
          ctx.fillStyle = G.linear(ctx, x, 0, x + 76, 0, [[0, '#26313e'], [0.5, '#1e2935'], [1, '#141b25']]); ctx.fillRect(x, 58, 76, 223);
          ctx.fillStyle = '#0a111c'; ctx.fillRect(x + 5, 63, 66, 210);
          for (let r = 0; r < 9; r++) {
            ctx.fillStyle = G.linear(ctx, 0, 71 + r * 22, 0, 86 + r * 22, [[0, '#2f3d4e'], [1, '#1f2a36']]); ctx.fillRect(x + 10, 71 + r * 22, 56, 15);
            ctx.fillStyle = '#557582'; ctx.fillRect(x + 16, 76 + r * 22, 23, 3);
            ctx.fillStyle = '#121a24'; for (let v = 0; v < 4; v++) ctx.fillRect(x + 42 + v * 2, 74 + r * 22, 1, 9);
          }
          ctx.fillStyle = G.rgba(tint, 0.18); ctx.fillRect(x + 5, 63, 1, 210);
        }
        ctx.fillStyle = G.linear(ctx, 0, 285, 0, 360, [[0, G.mix('#202c3a', tint, 0.1)], [1, '#0a0f17']]); ctx.fillRect(0, 285, 640, 75);
        ctx.strokeStyle = '#3a4e59'; ctx.lineWidth = 1;
        for (let x = -200; x < 900; x += 70) { ctx.beginPath(); ctx.moveTo(320 + (x - 320) * 0.5, 285); ctx.lineTo(x, 360); ctx.stroke(); }
        for (const y of [292, 310, 335]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke(); }
        ctx.fillStyle = G.rgba(tint, 0.5); ctx.fillRect(0, 285, 640, 2);
        ctx.fillStyle = '#77919e'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('PRODUCTION IS THE ARENA', 320, 250); ctx.textAlign = 'left';
      });
      // Rack LEDs blink from the frame tick (presentation only).
      for (let x = 25, k = 0; x < 640; x += 102, k++) for (let r = 0; r < 9; r++) {
        const h = G.hash(k * 97 + r * 13 + Math.floor(tick / (12 + (k + r) % 5)));
        const alert = (r + stage) % 4 === 0, on = h % 3 !== 0;
        D.rect(c, x + 54, 76 + r * 22, 4, 4, alert ? (on ? '#f47686' : '#4a1f2a') : on ? '#87dca8' : '#1f3a2c');
        D.rect(c, x + 60, 76 + r * 22, 2, 4, (h >>> 4) % 2 ? '#7ff3ff' : '#163038');
      }
      G.glow(c, 320, 230, 260, tint, 0.12);
      D.text(c, 'S R E', 28, 33, '#bff676', 16); D.text(c, RIVALS[stage], 612, 33, rivalColor, 16, 'right');
      D.rect(c, 290, 22, 60, 30, '#05080d'); D.rect(c, 292, 24, 56, 26, '#141b26');
      D.bar(c, 28, 43, 240, this.hp, 100, '#bff676'); D.bar(c, 372, 43, 240, this.enemyHP, this.enemyMax, '#ff879e');
      D.text(c, Math.ceil(this.roundTime / 60), 320, 44, this.roundTime < 600 ? '#ff9a7a' : '#fff1d3', 24, 'center');
      // Cron Reaper and Root Cause wear hoods; Merge Conflict shares the SRE's helmet.
      const rivalKind = stage === 1 ? 'trooper' : 'ninja';
      // Memory Leak drips: presentation only, from the frame tick.
      if (stage === 3) for (let i = 0; i < 6; i++) {
        const ex = px(this.enemy.x) + ((i * 37) % 50) - 25, drop = (tick * 2 + i * 23) % 70;
        D.rect(c, ex, px(this.enemy.y) - 70 + drop, 2, 5, G.rgba('#7fd8ff', 1 - drop / 70));
      }
      const fighters = [[this.p, '#b9ee76', 'trooper'], [this.enemy, rivalColor, rivalKind]];
      if (G.high()) for (const [f, color, kind] of fighters) {
        c.save(); c.globalAlpha = 0.16; c.translate(0, 2 * 292 + 2); c.scale(1, -1);
        D.person(c, px(f.x), px(f.y), f.stun ? '#ffdda0' : color, f.face, tick, kind, 4.2, !!(f.attack && f.attack.age >= f.attack.wind)); c.restore();
      }
      for (const [f, color, kind] of fighters) {
        const x = px(f.x), y = px(f.y), air = (292 - y) / 60;
        G.shadow(c, x, 294, 26 - air * 8, 5 - air, 0.5 - air * 0.2);
        if (f.stun) G.glow(c, x, y - 40, 40, '#ffdda0', 0.4);
        D.person(c, x, y, f.stun ? '#ffdda0' : color, f.face, tick, kind, 4.2, !!(f.attack && f.attack.age >= f.attack.wind));
        if (f.guard) {
          G.glow(c, x + f.face * 26, y - 40, 30, '#9fe8ff', 0.5);
          c.save(); c.strokeStyle = G.rgba('#b7e6ec', 0.9); c.lineWidth = 3; c.beginPath();
          c.arc(x, y - 40, 30, f.face > 0 ? -0.9 : Math.PI - 0.9, f.face > 0 ? 0.9 : Math.PI + 0.9); c.stroke(); c.restore();
          D.text(c, 'GUARD', x, y - 74, '#b7e6ec', 9, 'center');
        }
        if (f.attack) {
          const active = f.attack.age >= f.attack.wind, kick = f.attack.kind === 'kick', reach = kick ? 75 : 55, hy = y - (kick ? 27 : 48);
          if (active) {
            c.save(); c.globalAlpha = 0.45; D.rect(c, x + (f.face > 0 ? 15 : -reach), hy - 2, reach - 15, 13, G.shade(color, 0.4)); c.restore();
            D.rect(c, x + (f.face > 0 ? 15 : -reach), hy, reach - 15, 9, color);
            G.glow(c, x + f.face * reach, hy + 4, 22, '#fff3d2', 0.8);
            D.ellipse(c, x + f.face * reach, hy + 4, 7, 6, '#fff3d2');
          } else if (f === this.enemy) {
            G.glow(c, x, y - 88, 24, '#ffbd6a', 0.5 + 0.4 * (tick % 6 < 3));
            D.text(c, kick ? 'KICK!' : 'STRIKE!', x, y - 83, '#ffbd6a', 12, 'center');
          }
        }
      }
      for (const b of this.bolts) {
        const x = px(b.x), y = px(b.y), dir = Math.sign(px(b.vx)) || 1;
        G.glow(c, x, y, 40, '#bafa67', 0.8);
        for (let k = 1; k <= 4; k++) D.ellipse(c, x - dir * k * 9, y + Math.sin(tick * 0.6 + k) * 3, 10 - k * 2, 7 - k, G.rgba('#bafa67', 0.5 - k * 0.1));
        D.ellipse(c, x, y, 17, 12, '#bafa67'); D.ellipse(c, x, y, 11, 7, '#eaffc4'); D.rect(c, x - 9, y - 3, 18, 6, '#fff7d5');
        D.text(c, '<<', x - dir * 2, y + 4, '#2a4a10', 9, 'center');
      }
      this.drawEffects(c);
      const full = this.meter === 100;
      if (full) G.glow(c, 320, 334, 90, '#c5fc73', 0.25 + 0.2 * Math.sin(tick * 0.2));
      D.bar(c, 180, 331, 280, this.meter, 100, '#c5fc73');
      D.text(c, full ? 'C  //  ROLLBACK READY' : 'ROLLBACK BUFFER', 320, 350, full ? '#eaffc4' : '#d2e4c9', 10, 'center');
    }
  };
  A.register({id:'kombat', remix:{name:'Hotfix',summary:'The rollback meter fills twice as fast and the rollback hits harder.'},title:'DevOps Kombat',subtitle:'Finish the incident.',genre:'1-ON-1 FIGHTER',color:'#fe829b',number:'04',controls:['Move · down guards','Z · punch','X · kick','Space · jump · C · rollback'],description:'SRE versus Cron Reaper, Merge Conflict and Root Cause. Block the windup. Build your meter. Finish the incident.'},mode=>new A.Kombat(mode));
})(globalThis.Arcade2);
