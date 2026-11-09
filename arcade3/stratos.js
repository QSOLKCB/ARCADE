/* SPDX-License-Identifier: Apache-2.0 */
// Stratos Ward: an original vertical shooter. Three weapon colours that level up when
// you catch a crystal, screen-clearing ward bombs, medals that grow in value, and a
// dreadnought guarding the end of each of three stages.
(function (A) {
  'use strict';
  const {q, px, clamp, Engine: E, Draw: D} = A;
  const LEFT = 140, RIGHT = 500, LEN = [3600, 4200, 4800];
  const HP = {heli: 3, tank: 6, jet: 2, carrier: 14, turret: 10};
  const COLORS = ['red', 'blue', 'violet'], TONE = {red: '#ff6a5a', blue: '#5ad8ff', violet: '#c88aff'};
  A.Stratos = class extends A.Game {
    constructor(mode = 'extended') { super('stratos', 9901, mode); this.lives = 3; this.p = {weapon: 'red', level: 1}; this.medal = 500; this.setup(); }
    setup() {
      const s = this.stage, p = this.p;
      this.p = {x: q(320), y: q(310), cd: 0, weapon: p.weapon, level: p.level, bombs: 3};
      Object.assign(this, {scroll: 0, foes: [], shots: [], bullets: [], items: [], bomb: 0, inv: 120, uid: 0, boss: null, bossDead: false});
      // The spawn plan for the whole stage, drawn once from the stage seed.
      this.plan = [];
      for (let at = 120; at < LEN[s] - 300; at += 70 + this.random(50)) {
        const roll = this.random(20), x = LEFT + 30 + this.random(RIGHT - LEFT - 60);
        const kind = roll < 7 ? 'heli' : roll < 11 ? 'tank' : roll < 15 ? 'jet' : roll < 17 ? 'carrier' : s ? 'turret' : 'tank';
        const count = kind === 'heli' || kind === 'jet' ? 2 + this.random(2) : 1;
        for (let i = 0; i < count; i++) this.plan.push({at: at + i * 14, kind, x: clamp(x + (i - 1) * 36, LEFT + 20, RIGHT - 20)});
      }
      this.cursor = 0;
      this.announce(['STAGE 1 // CLOUD FARMS', 'STAGE 2 // THE ORE COAST', 'STAGE 3 // STRATOS GATE'][s], 140);
    }
    add(kind, x, y) {
      if (this.foes.length >= 24) return;
      const f = {kind, x: q(x), y: q(y), vx: 0, vy: kind === 'jet' ? q(3) : q(1), hp: HP[kind], age: 0, cd: 50 + this.random(50), flash: 0, uid: ++this.uid};
      if (kind === 'jet') f.vx = x < 320 ? q(1) : -q(1);
      this.foes.push(f);
    }
    aim(f, speed, spread = 0) {
      const p = this.p, dx = p.x - f.x, dy = p.y - f.y, ax = Math.abs(dx), ay = Math.abs(dy);
      const dist = Math.max(q(1), Math.max(ax, ay) + (Math.min(ax, ay) >> 1));
      const vx = E.mulDiv(dx, speed, dist), vy = E.mulDiv(dy, speed, dist);
      for (let k = -spread; k <= spread; k++) this.shoot(f.x, f.y, vx - E.mulDiv(vy, k, 5), vy + E.mulDiv(vx, k, 5));
    }
    shoot(x, y, vx, vy) { if (this.bullets.length < 90) this.bullets.push({x, y, vx, vy}); }
    ring(f, n, speed, turn) {
      for (let i = 0; i < n; i++) { const a = Math.trunc(i * A.Trig.STEPS / n) + turn; this.shoot(f.x, f.y, E.mulDiv(A.Trig.cos(a), speed, 65536), E.mulDiv(A.Trig.sin(a), speed, 65536)); }
    }
    fire() {
      const p = this.p, lv = p.level, add = (x, vx, vy, dmg, kind) => { if (this.shots.length < 60) this.shots.push({x: p.x + q(x), y: p.y - q(10), vx, vy, dmg, kind}); };
      if (p.weapon === 'red') { for (let k = -lv; k <= lv; k++) add(k * 3, k * q(3, 5), -q(7), 1, 'red'); p.cd = 6; }
      else if (p.weapon === 'blue') { add(0, 0, -q(11), 1 + lv, 'blue'); if (lv >= 3) { add(-14, 0, -q(11), 2, 'blue'); add(14, 0, -q(11), 2, 'blue'); } p.cd = 4; }
      else { for (let k = 0; k < Math.min(lv + 1, 4); k++) add((k - 1.5) * 8 | 0, (k - 1.5) * q(1) | 0, -q(5), 2, 'violet'); p.cd = 8; }
      this.emit('shot');
    }
    lose() {
      if (this.inv || this.bomb || this.status !== 'playing') return;
      const p = this.p;
      this.lives--; this.emit('hurt'); this.burst(p.x, p.y, '#ffd27a', 26);
      if (this.lives <= 0) { this.finish(false); return; }
      p.level = Math.max(1, p.level - 1); p.bombs = 3; p.x = q(320); p.y = q(310); this.inv = 150; this.bullets = [];
    }
    hit(f, dmg) {
      f.hp -= dmg; f.flash = 4;
      if (f.hp > 0) return;
      this.emit('blast'); this.burst(f.x, f.y, f.kind === 'boss' ? '#ff9a5a' : '#ffd27a', f.kind === 'boss' ? 50 : 14);
      this.score += {heli: 200, tank: 300, jet: 150, carrier: 600, turret: 500, boss: 20000}[f.kind] + this.stage * 50;
      const drop = kind => { if (this.items.length < 10) this.items.push({kind, x: f.x, y: f.y, vx: q(1, 2), vy: q(1, 2), age: this.tickCount}); };
      if (f.kind === 'carrier') drop('crystal');
      if (f.kind === 'tank' || f.kind === 'turret') drop('medal');
      if (f.kind === 'carrier' && f.uid % 3 === 0) drop('bomb');
      if (f.kind === 'boss') this.bossDead = true;
    }
    tick(input) {
      if (!this.begin()) return;
      const p = this.p, s = this.stage;
      p.x = clamp(p.x + input.x * q(3), q(LEFT + 10), q(RIGHT - 10)); p.y = clamp(p.y + input.y * q(3), q(40), q(340));
      if (p.cd) p.cd--;
      if (input.a && !p.cd) this.fire();
      if (input.bPressed && p.bombs > 0 && !this.bomb) { p.bombs--; this.bomb = 70; this.bullets = []; this.emit('blast'); this.announce('WARD BOMB', 40); }
      if (this.bomb) { this.bomb--; this.bullets = []; if (this.bomb % 5 === 0) for (const f of this.foes) if (f.hp > 0) this.hit(f, f.kind === 'boss' ? 3 : 2); }
      if (this.scroll < LEN[s]) this.scroll++;
      while (this.cursor < this.plan.length && this.plan[this.cursor].at <= this.scroll) { const e = this.plan[this.cursor++]; this.add(e.kind, e.x, -20); }
      if (this.scroll >= LEN[s] && !this.boss) {
        this.boss = true; this.announce('DREADNOUGHT', 100);
        this.foes.push({kind: 'boss', x: q(320), y: q(-60), vx: 0, vy: q(1), hp: 300 + s * 120, maxHP: 300 + s * 120, age: 0, cd: 60, flash: 0, uid: ++this.uid});
      }
      for (const f of this.foes) {
        if (f.hp <= 0) continue; // killed by a bomb pulse this tick
        f.age++; if (f.flash) f.flash--;
        if (f.kind === 'boss') {
          if (f.y < q(80)) f.y += f.vy; else f.x = q(320) + A.triangle(f.age, 420, q(240)) - q(120);
          if (f.y >= q(80) && --f.cd <= 0) {
            const phase = (f.age / 240 | 0) % 3;
            if (phase === 0) { this.aim(f, q(5, 2) + q(s, 4), 2); f.cd = 34 - s * 4; }
            else if (phase === 1) { this.ring(f, 14 + s * 2, q(2) + q(s, 4), f.age % 64); f.cd = 56 - s * 6; }
            else { this.aim(f, q(3), 0); f.cd = 12; }
          }
          continue;
        }
        if (f.kind === 'heli' && f.y > q(90) && f.age < 400) { f.vy = 0; f.vx = f.age % 200 < 100 ? q(1) : -q(1); }
        if (f.kind === 'heli' && f.age >= 400) { f.vy = q(2); f.vx = 0; }
        if (f.kind === 'tank') f.vx = f.age % 160 < 80 ? q(1, 3) : -q(1, 3);
        f.x = clamp(f.x + f.vx, q(LEFT), q(RIGHT)); f.y += f.vy;
        if (f.y > q(0) && f.y < q(260) && --f.cd <= 0) {
          f.cd = {heli: 80, tank: 100, jet: 999, carrier: 70, turret: 90}[f.kind] - s * 10;
          if (f.kind === 'turret') this.aim(f, q(2), 1); else if (f.kind !== 'jet') this.aim(f, q(2) + q(s, 4));
        }
        if ((f.kind === 'heli' || f.kind === 'jet' || f.kind === 'carrier') && A.near(f, p, 12)) this.lose();
        if (f.y > q(400)) f.hp = -999;
      }
      for (const b of this.bullets) { b.x += b.vx; b.y += b.vy; if (!this.inv && Math.abs(b.x - p.x) < q(5) && Math.abs(b.y - p.y) < q(5)) { b.y = q(999); this.lose(); } }
      for (const b of this.shots) {
        if (b.kind === 'violet') {
          // Plasma threads curve toward the nearest airframe.
          let near = null; for (const f of this.foes) if (f.hp > 0 && f.y > q(-10) && f.y < b.y && (!near || Math.abs(f.x - b.x) + (b.y - f.y) < Math.abs(near.x - b.x) + (b.y - near.y))) near = f;
          if (near) b.vx = clamp(b.vx + (near.x > b.x ? q(1, 2) : -q(1, 2)), -q(4), q(4));
        }
        b.x += b.vx; b.y += b.vy;
        for (const f of this.foes) {
          if (f.hp <= 0 || b.y < -q(50)) continue;
          const w = f.kind === 'boss' ? 70 : f.kind === 'carrier' ? 22 : 14, h = f.kind === 'boss' ? 34 : 14;
          if (Math.abs(f.x - b.x) < q(w) && Math.abs(f.y - b.y) < q(h) && f.y > q(-10)) { b.y = -q(99); this.hit(f, b.dmg); break; }
        }
      }
      for (const it of this.items) {
        it.x += it.vx; it.y += it.vy;
        // Reflect only when moving out of range, so an item dropped outside it drifts back in.
        if ((it.x < q(LEFT + 10) && it.vx < 0) || (it.x > q(RIGHT - 10) && it.vx > 0)) it.vx = -it.vx;
        if (it.kind === 'crystal' && ((it.y < q(30) && it.vy < 0) || (it.y > q(300) && it.vy > 0))) it.vy = -it.vy;
        if (A.near(it, p, 16)) {
          if (it.kind === 'crystal') { const c = COLORS[((this.tickCount - it.age) / 90 | 0) % 3]; p.level = Math.min(4, p.level + 1); p.weapon = c; this.announce(c.toUpperCase() + ' // LEVEL ' + p.level, 60); }
          else if (it.kind === 'bomb') p.bombs = Math.min(5, p.bombs + 1);
          else { this.score += this.medal; this.medal = Math.min(10000, this.medal + 500); }
          it.y = q(999); this.emit('pickup');
        }
      }
      this.bullets = this.bullets.filter(b => b.y > -q(20) && b.y < q(380) && b.x > q(LEFT - 20) && b.x < q(RIGHT + 20));
      this.shots = this.shots.filter(b => b.y > -q(40) && b.x > q(LEFT - 20) && b.x < q(RIGHT + 20));
      this.items = this.items.filter(it => it.y < q(380));
      this.foes = this.foes.filter(f => f.hp > 0);
      if (this.status !== 'playing') return;
      if (this.bossDead) { this.score += this.lives * 1000 + p.bombs * 500; this.clearStage(); }
    }
    hud() { const p = this.p; return {left: 'SHIPS ' + this.lives + '   BOMBS ' + p.bombs, right: 'STAGE ' + (this.stage + 1) + '/3',
      objective: p.weapon.toUpperCase() + ' LV ' + p.level + ' · Z fires · X ward bomb · catch crystals for a colour and a level · medals ' + this.medal}; }
    draw(c) {
      const G = A.Gfx, s = this.stage, tick = this.tickCount, p = this.p;
      const land = [['#2a5a3a', '#3a7a4a', '#8acb6a'], ['#4a3a2a', '#7a5a3a', '#d8a868'], ['#1a2440', '#2a3a6a', '#7a9ae8']][s];
      G.tile(c, 'stratos-land:' + s, 360, 360, ctx => {
        ctx.fillStyle = land[0]; ctx.fillRect(0, 0, 360, 360);
        for (let i = 0; i < 26; i++) { const h = G.hash(i * 29 + s * 5); ctx.fillStyle = G.rgba(land[1], 0.8); ctx.beginPath(); ctx.ellipse(h % 360, (h >>> 9) % 360, 20 + h % 40, 12 + h % 24, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = G.rgba(land[2], 0.35); ctx.lineWidth = 2; for (let y = 0; y < 360; y += 90) { ctx.beginPath(); ctx.moveTo(0, y + 20); ctx.bezierCurveTo(120, y - 10, 240, y + 60, 360, y + 20); ctx.stroke(); }
        for (let i = 0; i < 16; i++) { const h = G.hash(i * 61 + s); ctx.fillStyle = G.shade(land[1], -0.3); ctx.fillRect(h % 340, (h >>> 7) % 340, 14, 10); ctx.fillStyle = G.rgba('#ffe8a0', 0.5); ctx.fillRect(h % 340 + 3, (h >>> 7) % 340 + 3, 3, 3); }
      }, -this.scroll % 360, true, LEFT);
      // Cloud layer drifting faster than the ground: depth without extra state.
      for (let i = 0; i < 4; i++) { const h = G.hash(i * 13 + s), y = ((h % 360) + tick * 2) % 460 - 50; G.glow(c, LEFT + 40 + h % 280, y, 50, '#ffffff', 0.12); }
      for (const f of this.foes) {
        const x = px(f.x), y = px(f.y), hot = f.flash ? '#ffffff' : null;
        if (f.kind === 'tank' || f.kind === 'turret') {
          D.rect(c, x - 13, y - 10, 26, 20, hot || '#5a6050'); D.rect(c, x - 13, y - 10, 26, 3, '#8a9070');
          const dx = px(p.x) - x, dy = px(p.y) - y, d = Math.hypot(dx, dy) || 1; D.ellipse(c, x, y, 7, 7, '#3a4038'); D.line(c, x, y, x + dx / d * 14, y + dy / d * 14, '#c8ccb0', 3);
        } else if (f.kind === 'boss') {
          G.glow(c, x, y, 90, '#ff6a3a', 0.25);
          D.rect(c, x - 74, y - 30, 148, 60, hot || '#4a4a5a'); D.rect(c, x - 74, y - 30, 148, 6, '#8a8aa0'); D.rect(c, x - 90, y - 8, 180, 16, '#3a3a48');
          for (const gx of [-50, -18, 18, 50]) { D.ellipse(c, x + gx, y + 10, 8, 8, '#2a2a34'); G.glow(c, x + gx, y + 10, 8, '#ff5a3a', 0.6); }
          D.ellipse(c, x, y - 6, 14, 10, '#ffb35c');
          D.bar(c, LEFT + 20, 12, RIGHT - LEFT - 40, f.hp, f.maxHP, '#ff8a6a');
        } else if (f.kind === 'carrier') {
          D.rect(c, x - 22, y - 16, 44, 32, hot || '#6a7a8a'); D.rect(c, x - 30, y - 4, 60, 8, '#4a5a6a'); G.glow(c, x, y, 16, '#c2f874', 0.4 + 0.2 * Math.sin(tick * 0.3)); D.ellipse(c, x, y, 6, 6, '#c2f874');
        } else c.save(), c.translate(x, y), c.rotate(Math.PI / 2), D.ship(c, 0, 0, hot || (f.kind === 'jet' ? '#ff8a6a' : '#e8c06a'), tick + f.uid, false, f.kind === 'jet' ? 0.5 : 0.6), c.restore();
      }
      for (const it of this.items) {
        const x = px(it.x), y = px(it.y);
        if (it.kind === 'crystal') { const col = TONE[COLORS[((tick - it.age) / 90 | 0) % 3]]; G.glow(c, x, y, 16, col, 0.7); c.fillStyle = col; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x + 7, y); c.lineTo(x, y + 10); c.lineTo(x - 7, y); c.closePath(); c.fill(); }
        else if (it.kind === 'bomb') { D.ellipse(c, x, y, 9, 9, '#ffcc4a'); D.text(c, 'B', x, y + 4, '#3a2a08', 10, 'center'); }
        else { D.ellipse(c, x, y, 8, 10, '#ffd96a'); D.ellipse(c, x, y, 5, 7, '#fff3c4'); }
      }
      for (const b of this.shots) { const x = px(b.x), y = px(b.y), col = TONE[b.kind];
        if (b.kind === 'blue') { G.glow(c, x, y, 8, col, 0.6); D.rect(c, x - 2, y - 10, 4, 18, '#e8faff'); } else { G.glow(c, x, y, 6, col, 0.6); D.ellipse(c, x, y, 3, 5, '#fff0e8'); } }
      if (this.status !== 'lost' && this.inv % 8 < 5) {
        const x = px(p.x), y = px(p.y); G.glow(c, x, y + 14, 16, '#ff8a3a', 0.6);
        c.save(); c.translate(x, y); c.rotate(-Math.PI / 2); D.ship(c, 0, 0, TONE[p.weapon], tick, false, 0.7); c.restore();
        D.ellipse(c, x, y, 2.5, 2.5, '#ffffff');
      }
      for (const b of this.bullets) { const x = px(b.x), y = px(b.y); G.glow(c, x, y, 7, '#ff4a8a', 0.7); D.ellipse(c, x, y, 3.5, 3.5, '#ffd0e8'); }
      if (this.bomb) { c.save(); c.globalAlpha = this.bomb / 90; G.glow(c, px(p.x), px(p.y), 300 - this.bomb * 3, '#c2f874', 0.6); c.restore(); }
      this.drawEffects(c);
      // Cabinet side panels framing the vertical playfield.
      G.layer(c, 'stratos-frame', 640, 360, ctx => {
        for (const [x0, w] of [[0, LEFT], [RIGHT, 640 - RIGHT]]) {
          ctx.fillStyle = G.linear(ctx, x0, 0, x0 + w, 0, [[0, '#06080e'], [1, '#121826']]); ctx.fillRect(x0, 0, w, 360);
          ctx.fillStyle = '#c88aff'; ctx.fillRect(x0 === 0 ? w - 2 : x0, 0, 2, 360);
        }
      });
      D.text(c, 'WEAPON', 20, 150, '#9fb3c4', 10); D.text(c, p.weapon.toUpperCase(), 20, 168, TONE[p.weapon], 14); D.bar(c, 20, 176, 100, p.level, 4, TONE[p.weapon]);
      D.text(c, 'BOMBS', 20, 210, '#9fb3c4', 10); for (let i = 0; i < p.bombs; i++) D.ellipse(c, 26 + i * 16, 222, 6, 6, '#ffcc4a');
      D.text(c, 'MEDAL', 520, 150, '#9fb3c4', 10); D.text(c, String(this.medal), 520, 168, '#ffd96a', 14);
      D.text(c, 'DEPTH', 520, 210, '#9fb3c4', 10); D.bar(c, 520, 218, 100, this.scroll, LEN[s], '#c88aff');
    }
  };
  A.register({id: 'stratos', title: 'Stratos Ward', subtitle: 'Catch the colour. Hold the sky.', genre: 'VERTICAL SHOOTER', color: '#c88aff', number: '07',
    modes: ['extended'], inspiredBy: 'Raiden II',
    controls: ['Move', 'Z · fire', 'X · ward bomb', 'Crystals change colour as they drift'],
    description: 'Three stages of vertical assault. Red spreads, blue punches through, violet curves in; catch crystals to level up, collect medals and break each dreadnought.'},
  () => new A.Stratos());
})(globalThis.Arcade2);
