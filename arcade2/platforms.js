/* SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const {q, px, clamp, Draw: D, Engine: E} = A;
  const SPECS = {
    shadow: {title: 'SHADOW CIRCUIT', color: '#8ceee1', attack: 'blade', speed: q(16, 5), boss: 'THE SHOGUN PROCESS'},
    cache: {title: 'CACHE NINJA', color: '#e8b0fc', attack: 'star', speed: q(14, 5), boss: 'THE WATCHDOG'},
    iron: {title: 'IRON COMET', color: '#ffc06a', attack: 'gun', speed: q(14, 5), boss: 'AUDIT TANK'},
  };
  A.Platform = class extends A.Game {
    constructor(id, mode = 'legacy') { super(id, {shadow: 1701, cache: 2903, iron: 4109}[id], mode); this.spec = SPECS[id]; this.setup(); }
    // Level length in pixels: 2200 reproduces v0.6.0 exactly; Extended adds a second segment.
    get len() { return this.rules.extended ? 3300 : 2200; }
    setup() {
      const ext = this.rules.extended, remix = this.rules.remix, L = this.len;
      this.p = {x: q(70), y: q(303), vx: 0, vy: 0, face: 1, grounded: true, jumps: 0, cd: 0, special: 0, swing: 0};
      this.camera = 0; this.shots = []; this.grenades = []; this.bombs = 3; this.rescued = 0; this.bossDead = false;
      this.inv = 90; this.stageTicks = 0;
      this.pits = this.id === 'cache' ? [[720, 786], [1475, 1540]] : [[610, 688], [1430, 1510]];
      this.ledges = [[270, 250, 120], [450, 209, 100], [820, 247, 150], [1050, 211, 140], [1320, 252, 100], [1660, 241, 110]];
      this.hostages = this.id === 'cache' ? [{x: q(330), y: q(250), saved: false}, {x: q(1140), y: q(211), saved: false}, {x: q(1720), y: q(241), saved: false}] : [];
      this.crates = [{x: q(980), y: q(303), taken: false}, {x: q(1790), y: q(303), taken: false}];
      if (ext) {
        this.pits.push(...(this.id === 'cache' ? [[2290, 2356], [2880, 2945]] : [[2330, 2405], [2890, 2970]]));
        this.ledges.push([2180, 240, 120], [2470, 212, 110], [2650, 250, 130], [3020, 236, 120]);
        this.crates.push({x: q(2720), y: q(303), taken: false});
        if (this.hostages.length) this.hostages[2] = {x: q(2560), y: q(303), saved: false};
      }
      this.enemies = [380, 560, 880, 1160, 1330, 1630, 1830].map((x, i) => ({
        x: q(x), y: q(i === 3 ? 211 : 303), home: q(x), hp: 28 + this.stage * 5,
        maxHP: 28 + this.stage * 5, cd: 45 + i * 17, flash: 0, boss: false, index: i,
      }));
      if (ext) {
        // Second segment: rushers close distance fast, gunners fire a twin volley.
        [[2120, 303, 'rusher'], [2440, 303, 'gunner'], [2520, 212, 'grunt'], [2640, 303, 'rusher'], [2790, 303, 'gunner'], [3060, 303, 'grunt']]
          .forEach(([x, y, kind], i) => {
            const hp = (kind === 'rusher' ? 20 : 28) + this.stage * 5;
            this.enemies.push({x: q(x), y: q(y), home: q(x), hp, maxHP: hp, cd: 50 + i * 13, flash: 0, boss: false, index: 10 + i, kind});
          });
      }
      if (remix && this.id === 'iron') for (const e of this.enemies) { e.hp = e.maxHP = Math.round(e.hp * 1.4); }
      const bossHP = 130 + this.stage * 35;
      this.enemies.push({x: q(L - 150), y: q(303), home: q(L - 150), hp: bossHP,
        maxHP: bossHP, cd: 75, flash: 0, boss: true, index: 9});
      this.announce(['ROOFTOPS // NIGHT SHIFT', 'FOUNDRY // NO OVERTIME', 'CORE // LAST EXIT'][this.stage], 150);
    }
    fire(owner, x, y, vx, vy, damage, type = 'bolt') {
      if (this.shots.length < 96) this.shots.push({owner, x, y, vx, vy, damage, type, life: 150});
    }
    damage(e, amount) {
      if (e.hp <= 0) return;
      e.hp = Math.max(0, e.hp - amount); e.flash = 8;
      if (!e.hp) { this.score += e.boss ? 2000 : 150; this.burst(e.x, e.y - q(20), this.spec.color, e.boss ? 35 : 10); this.emit('blast'); if (e.boss) this.bossDead = true; }
    }
    tick(input) {
      if (!this.begin()) return;
      this.stageTicks++;
      const p = this.p, crouch = input.y > 0 && p.grounded;
      for (const k of ['cd', 'special', 'swing']) if (p[k]) p[k]--;
      p.vx = crouch ? 0 : input.x * this.spec.speed;
      if (input.x) p.face = input.x;
      if (input.cPressed && (p.grounded || (this.id === 'shadow' && p.jumps < 2))) {
        p.vy = q(-32, 5); p.grounded = false; p.jumps++; this.emit('jump');
      }
      if (input.a && !p.cd) {
        p.cd = this.id === 'iron' ? 8 : 19; this.emit('shot');
        if (this.id === 'shadow') {
          p.swing = 11;
          for (const e of this.enemies) if (e.hp > 0 && Math.abs(e.y - p.y) < q(45) && (e.x - p.x) * p.face > q(-12) && (e.x - p.x) * p.face < q(e.boss ? 88 : 64)) this.damage(e, 22);
        } else {
          const up = this.id === 'iron' && input.y < 0;
          const sx = p.x + q(p.face * 15), sy = p.y - q(crouch ? 11 : 22), vx = up ? 0 : q(p.face * 9), vy = up ? q(-9) : 0;
          this.fire('player', sx, sy, vx, vy, this.id === 'iron' ? 12 : 22, this.spec.attack);
          // Remix (Iron Comet): a three-way spread against tougher troops.
          if (this.rules.remix && this.id === 'iron') for (const k of [-1, 1]) this.fire('player', sx, sy, up ? q(k * 2) : vx, up ? vy : q(k * 2), 9, 'gun');
        }
      }
      if (input.bPressed && !p.special) {
        if (this.id === 'shadow') {
          this.fire('player', p.x + q(p.face * 14), p.y - q(20), q(p.face * 8), 0, 32, 'star'); p.special = 40; this.emit('shot');
        } else if (this.id === 'cache') {
          p.special = this.rules.remix ? 180 : 360; this.inv = Math.max(this.inv, 90); this.burst(p.x, p.y - q(20), '#e8b0fc', 28); this.announce('SMOKE // 1.5 SEC OF COVER', 75); this.emit('dash');
        } else if (this.bombs > 0 && this.grenades.length < 4) {
          this.bombs--; p.special = 30; this.grenades.push({x: p.x, y: p.y - q(20), vx: q(p.face * 4), vy: q(-5), life: 46}); this.emit('shot');
        }
      }
      const oldY = p.y;
      const L = this.len;
      p.x = clamp(E.add(p.x, p.vx), q(18), q(L - 40));
      p.vy = Math.min(q(9), E.add(p.vy, q(3, 10))); p.y = E.add(p.y, p.vy); p.grounded = false;
      if (p.vy >= 0) {
        const landings = [...this.ledges, [0, 303, L]];
        for (const [x, y, w] of landings) {
          if (y === 303 && this.pits.some(([left, right]) => p.x > q(left + 5) && p.x < q(right - 5))) continue;
          if (p.x >= q(x - 7) && p.x <= q(x + w + 7) && oldY <= q(y) && p.y >= q(y)) {
            p.y = q(y); p.vy = 0; p.grounded = true; p.jumps = 0; break;
          }
        }
      }
      if (p.y > q(410)) {
        this.inv = 0; this.hurt(30);
        const gap = this.pits.find(([x, end]) => p.x > q(x - 20) && p.x < q(end + 30));
        p.x = q(gap ? gap[0] - 30 : 70); p.y = q(290); p.vy = 0;
      }
      if (this.status !== 'playing') return;
      for (const h of this.hostages) if (!h.saved && A.near(p, h, 28)) {
        h.saved = true; this.rescued++; this.score += 500; this.announce('WITNESS FREED // ' + this.rescued + '/3'); this.emit('pickup');
        if (this.rules.remix) this.hp = Math.min(this.maxHP, this.hp + 15); // Remix (Cache Ninja): witnesses patch you up.
      }
      for (const c of this.crates) if (!c.taken && A.near(p, c, 24)) { c.taken = true; this.hp = Math.min(this.maxHP, this.hp + 20); this.bombs = Math.min(5, this.bombs + 2); this.emit('pickup'); }
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (e.flash) e.flash--;
        if (Math.abs(e.x - p.x) > q(570)) continue;
        e.cd--;
        const rusher = e.kind === 'rusher';
        if (!e.boss && e.y === q(303) && Math.abs(e.x - p.x) < q(rusher ? 300 : 240)) {
          const target = clamp(p.x, e.home - q(rusher ? 120 : 50), e.home + q(rusher ? 120 : 50)); e.x = A.approach(e.x, target, rusher ? q(14, 10) : q(7, 10));
        }
        if (e.cd <= 0) {
          e.cd = (e.boss ? 63 : 115) - this.stage * 8;
          if (this.rules.remix && this.id === 'shadow') e.cd = Math.floor(e.cd * 4 / 5);
          const dx = p.x - e.x, dy = p.y - q(18) - (e.y - q(e.boss ? 35 : 23));
          const distance = Math.max(q(1), Math.abs(dx) + Math.abs(dy));
          this.fire('enemy', e.x, e.y - q(e.boss ? 35 : 23), E.mulDiv(dx, q(3), distance), E.mulDiv(dy, q(3), distance), e.boss ? 18 : 12);
          if (e.boss) this.fire('enemy', e.x, e.y - q(12), q(-4), 0, 15);
          if (e.kind === 'gunner') this.fire('enemy', e.x, e.y - q(23), E.mulDiv(dx, q(3), distance), E.mulDiv(dy, q(3), distance) - q(1), 10);
        }
        if (A.near(p, e, e.boss ? 32 : 23)) this.hurt(12);
      }
      for (const g of this.grenades) {
        g.x += g.vx; g.vy += q(1, 4); g.y += g.vy; g.life--;
        if (g.y > q(297)) { g.y = q(297); g.vy = -E.mulDiv(g.vy, 1, 2); g.vx = E.mulDiv(g.vx, 3, 4); }
        if (g.life === 0) {
          this.burst(g.x, g.y, '#ffb14c', 26); this.emit('blast');
          for (const e of this.enemies) if (A.near(e, g, 115)) this.damage(e, 65);
        }
      }
      this.grenades = this.grenades.filter(g => g.life > 0);
      // Remix (Shadow Circuit): the blade turns incoming fire around.
      if (this.rules.remix && this.id === 'shadow' && p.swing) for (const b of this.shots) {
        if (b.owner !== 'enemy') continue;
        const dx = (b.x - p.x) * p.face;
        if (dx > q(-10) && dx < q(64) && Math.abs(b.y - (p.y - q(20))) < q(40)) {
          b.owner = 'player'; b.vx = q(p.face * 8); b.vy = 0; b.damage = 20; b.type = 'star'; b.life = 120; this.score += 25;
        }
      }
      for (const b of this.shots) {
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.owner === 'player') {
          for (const e of this.enemies) if (e.hp > 0 && Math.abs(b.x - e.x) < q(e.boss ? 40 : 18) && b.y > e.y - q(e.boss ? 65 : 34) && b.y < e.y + q(3)) { this.damage(e, b.damage); b.life = 0; break; }
        } else if (Math.abs(b.x - p.x) < q(12) && b.y > p.y - q(crouch ? 17 : 30) && b.y < p.y) { this.hurt(b.damage); b.life = 0; }
      }
      this.shots = this.shots.filter(b => b.life > 0 && b.x > 0 && b.x < q(L + 20) && b.y > q(-30) && b.y < q(360));
      this.camera = clamp(p.x - q(230), 0, q(L - 640));
      if (p.x > q(L - 70) && this.bossDead && this.rescued === this.hostages.length) this.clearStage();
      else if (p.x > q(L - 90) && this.hostages.some(h => !h.saved)) this.announce('EXIT LOCKED // FREE ALL THREE WITNESSES', 90);
    }
    hud() {
      return {left: 'HEALTH ' + this.hp + (this.id === 'iron' ? '   GRENADES ' + this.bombs : ''),
        right: 'STAGE ' + (this.stage + 1) + '/3', objective: this.id === 'cache' ? 'Free witnesses ' + this.rescued + '/3 · defeat the watchdog · reach EXIT' : 'Cross the district · defeat the boss · reach EXIT'};
    }
    // Presentation only: reads state, never writes it (see tests/arcade2-parity.test.cjs).
    draw(c) {
      const G = A.Gfx, camera = px(this.camera), p = this.p, color = this.spec.color, tick = this.tickCount, L = this.len;
      const theme = G.cityTheme(this.stage + (this.id === 'iron' ? 1 : 0));
      D.city(c, camera, this.stage + (this.id === 'iron' ? 1 : 0), tick);
      for (const [left, right] of this.pits) {
        const x = left - camera, w = right - left;
        if (x > 660 || x + w < -20) continue;
        G.layer(c, 'pit:' + w, w, 57, ctx => {
          ctx.fillStyle = G.linear(ctx, 0, 0, 0, 57, [[0, '#010307'], [0.55, '#14060a'], [1, '#5a160c']]); ctx.fillRect(0, 0, w, 57);
          for (let i = 0; i < w; i += 6) { ctx.fillStyle = (i / 6) % 2 ? '#e8b23c' : '#1a1d22'; ctx.fillRect(i, 0, 6, 3); }
          ctx.fillStyle = '#0a0d12'; ctx.fillRect(0, 0, 3, 57); ctx.fillRect(w - 3, 0, 3, 57);
        }, x, 303);
        for (let i = 0; i < w; i += 12) {
          const flame = 4 + G.hash(i + Math.floor(tick / 4) * 31 + left) % 7;
          D.rect(c, x + i + 1, 357 - flame, 9, flame, '#ff6b49'); D.rect(c, x + i + 3, 358 - flame / 2, 5, flame / 2, '#ffd27a');
        }
        G.glow(c, x + w / 2, 350, w * 0.55, '#ff5a2a', 0.55);
        // Hazard sign before every pit (the most common way runs lose health).
        G.sprite(c, 'pit-sign', 18, 26, ctx => {
          ctx.fillStyle = '#3a4048'; ctx.fillRect(8, 12, 2, 14);
          ctx.fillStyle = '#0a0f17'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(18, 14); ctx.lineTo(0, 14); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#f5c242'; ctx.beginPath(); ctx.moveTo(9, 2); ctx.lineTo(16, 13); ctx.lineTo(2, 13); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#0a0f17'; ctx.fillRect(8, 5, 2, 5); ctx.fillRect(8, 11, 2, 1);
        }, x - 22, 277);
      }
      for (const [x, y, w] of this.ledges) {
        const lx = x - camera; if (lx > 660 || lx + w < -20) continue;
        D.rect(c, lx + 7, y + 10, 3, 302 - y - 10, '#1b2733'); D.rect(c, lx + 8, y + 10, 1, 302 - y - 10, '#33465a');
        D.rect(c, lx + w - 10, y + 10, 3, 302 - y - 10, '#1b2733');
        G.sprite(c, 'ledge:' + w + color, w, 16, ctx => {
          ctx.fillStyle = G.linear(ctx, 0, 0, 0, 12, [[0, '#4f6577'], [1, '#1d2935']]); ctx.fillRect(0, 0, w, 12);
          ctx.fillStyle = color; ctx.fillRect(0, 0, w, 3); ctx.fillStyle = G.shade(color, 0.5); ctx.fillRect(0, 0, w, 1);
          ctx.fillStyle = '#0b1018'; ctx.fillRect(0, 12, w, 2);
          for (let i = 6; i < w - 4; i += 18) { ctx.fillStyle = '#8395a3'; ctx.fillRect(i, 6, 2, 2); ctx.fillStyle = '#26323e'; ctx.fillRect(i + 5, 5, 8, 4); }
          ctx.fillStyle = G.rgba('#000000', 0.35); ctx.fillRect(0, 14, w, 2);
        }, lx, y);
        G.glow(c, lx + w / 2, y + 1, Math.min(60, w / 2), color, 0.18);
      }
      for (const h of this.hostages) if (!h.saved) {
        const x = px(h.x) - camera, y = px(h.y), pulse = 0.5 + 0.5 * Math.sin(tick * 0.12);
        G.glow(c, x, y - 14, 26, '#f2e08c', 0.25 + pulse * 0.2);
        D.person(c, x, y, '#f2e08c', 1, 0, 'trooper', 1.6);
        for (let i = -2; i <= 2; i++) D.rect(c, x + i * 6 - 1, y - 30, 2, 30, '#8a97a3');
        D.rect(c, x - 14, y - 32, 28, 3, '#5d6b77'); D.rect(c, x - 14, y - 2, 28, 2, '#5d6b77');
        D.text(c, 'FREE ME', x, y - 38 - Math.round(pulse * 2), '#f2e08c', 10, 'center');
      }
      for (const box of this.crates) if (!box.taken) {
        const x = px(box.x) - camera;
        G.glow(c, x, 292, 22, '#b6f78a', 0.25 + 0.15 * Math.sin(tick * 0.1));
        G.sprite(c, 'crate', 22, 22, ctx => {
          ctx.fillStyle = G.linear(ctx, 0, 0, 0, 22, [[0, '#5d7f6c'], [1, '#2d4337']]); ctx.fillRect(0, 0, 22, 22);
          ctx.strokeStyle = '#0b1018'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 20, 20);
          ctx.fillStyle = '#e9fbe0'; ctx.fillRect(4, 8, 14, 6); ctx.fillRect(8, 4, 6, 14);
          ctx.fillStyle = '#7fd85a'; ctx.fillRect(5, 9, 12, 4); ctx.fillRect(9, 5, 4, 12);
        }, x - 11, 281);
      }
      const ex = L - 65 - camera, open = this.bossDead && this.rescued === this.hostages.length, door = open ? '#bdf56b' : '#fa7f80';
      if (ex < 700) {
        G.glow(c, ex + 17, 262, 46, door, open ? 0.55 : 0.3);
        D.rect(c, ex - 4, 228, 43, 75, '#0b1018'); D.rect(c, ex, 233, 35, 70, open ? '#163a2a' : '#3a2230');
        D.rect(c, ex + 3, 236, 29, 64, G.rgba(door, open ? 0.35 : 0.12));
        if (open) for (let i = 0; i < 4; i++) D.rect(c, ex + 6, 296 - ((tick * 2 + i * 16) % 60), 23, 2, G.rgba('#e9ffd0', 0.6));
        else for (let i = 0; i < 5; i++) D.rect(c, ex + 2, 244 + i * 12, 31, 3, '#7a3446');
        D.rect(c, ex + 5, 212, 25, 13, '#0b1018'); D.text(c, 'EXIT', ex + 17, 223, door, 11, 'center');
      }
      for (const e of this.enemies) if (e.hp > 0 && Math.abs(px(e.x) - camera - 320) < 380) {
        const x = px(e.x) - camera, y = px(e.y);
        if (e.boss && this.id === 'iron') this.drawTank(c, x, y, e, tick);
        else {
          if (e.boss) G.glow(c, x, y - 30, 60, '#ed6786', 0.35);
          const tone = e.flash ? '#ffffff' : e.boss ? '#ed6786' : e.kind === 'rusher' ? '#e8a35a' : e.kind === 'gunner' ? '#9fb3dc' : '#c88b74';
          if (e.kind === 'rusher' && Math.abs(px(e.x - e.home)) > 4) for (let k = 1; k <= 3; k++) D.rect(c, x + k * 7, y - 22 + k * 4, 8, 2, G.rgba('#e8a35a', 0.5 - k * 0.12));
          D.person(c, x, y, tone, -1, tick, this.id === 'iron' || e.kind === 'gunner' ? 'trooper' : 'ninja', e.boss ? 3.8 : 2, e.cd < 18);
        }
        D.bar(c, x - (e.boss ? 45 : 16), y - (e.boss ? 73 : 42), e.boss ? 90 : 32, e.hp, e.maxHP, '#ff7e81');
        if (e.boss) D.text(c, this.spec.boss, x, y - 82, '#ffb4c5', 10, 'center');
        if (e.cd < 18) { G.glow(c, x, y - 52, 14, '#ff4d4d', 0.8); D.text(c, '!', x, y - 46, '#ffffff', 17, 'center'); }
      }
      if (this.inv % 8 < 5) {
        const x = px(p.x) - camera, y = px(p.y), smoke = this.id === 'cache' && p.special > 270;
        if (smoke) for (let i = 0; i < 6; i++) G.glow(c, x + Math.sin(tick * 0.2 + i) * 14, y - 12 - i * 5, 18, '#c8a8e8', 0.35);
        const striking = this.id === 'shadow' ? p.swing > 0 : p.cd >= (this.id === 'iron' ? 5 : 14);
        D.person(c, x, y, color, p.face, p.vx ? tick : 0, this.id === 'iron' ? 'trooper' : 'ninja', 2, striking);
        if (this.id === 'iron') {
          const gx = x + (p.face > 0 ? 4 : -24), gy = y - 23;
          D.rect(c, gx, gy, 20, 5, '#d8cfb6'); D.rect(c, gx, gy + 3, 20, 2, '#7d7461'); D.rect(c, gx + (p.face > 0 ? 3 : 9), gy + 5, 6, 4, '#4e4a40');
          if (p.cd >= 6) { const mx = x + p.face * 28; G.glow(c, mx, gy + 2, 14, '#ffd27a', 0.9); D.rect(c, mx - 3, gy - 1, 6, 6, '#fff3c4'); }
        }
        if (p.swing) {
          const t = 1 - p.swing / 11, bx = x + p.face * 10, by = y - 25;
          const arc = this.rules.remix ? '#ffd27a' : '#e7fff0';
          c.save(); c.strokeStyle = G.rgba(arc, 0.35 + 0.5 * (1 - t)); c.lineWidth = 8; c.lineCap = 'round';
          c.beginPath(); c.arc(bx, by + 6, 44, p.face > 0 ? -1.2 + t * 0.9 : Math.PI + 1.2 - t * 0.9, p.face > 0 ? 0.35 + t * 0.4 : Math.PI - 0.35 - t * 0.4, p.face < 0); c.stroke();
          c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke(); c.restore();
          G.glow(c, bx + p.face * 40, by + 4, 26, color, 0.5);
        }
      }
      for (const b of this.shots) {
        const x = px(b.x) - camera, y = px(b.y), mine = b.owner === 'player';
        G.glow(c, x, y, mine ? 12 : 10, mine ? color : '#ff4d5a', 0.7);
        if (b.type === 'star') {
          c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(tick * 0.5);
          D.rect(c, -6, -1.5, 12, 3, '#efffd9'); D.rect(c, -1.5, -6, 3, 12, '#efffd9'); D.rect(c, -2, -2, 4, 4, '#3a4a55'); c.restore();
        } else if (mine) {
          D.rect(c, x - 9 * Math.sign(px(b.vx) || 1), y - 1, 9 * Math.sign(px(b.vx) || 1), 2, G.rgba(color, 0.5));
          D.rect(c, x - 4, y - 2, 9, 4, color); D.rect(c, x - 2, y - 1, 5, 2, '#ffffff');
        } else { D.ellipse(c, x, y, 4, 4, '#ff6f75'); D.ellipse(c, x, y, 2, 2, '#ffe2e2'); }
      }
      for (const g of this.grenades) {
        const x = px(g.x) - camera, y = px(g.y);
        G.glow(c, x, y - 4, 8, '#ffcf6a', 0.6 + 0.4 * (g.life % 6 < 3));
        D.ellipse(c, x, y, 5, 5, '#5c7a3a'); D.ellipse(c, x - 1, y - 1, 2, 2, '#bafc75'); D.rect(c, x - 1, y - 8, 2, 3, '#fff1b3');
      }
      this.drawEffects(c, camera);
      D.bar(c, 20, 340, 600, px(p.x), L - 40, color);
      for (const h of this.hostages) D.rect(c, 20 + px(h.x) / (L - 40) * 600 - 1, 337, 3, 11, h.saved ? '#5a6f5a' : '#f2e08c');
      for (const box of this.crates) if (!box.taken) D.rect(c, 20 + px(box.x) / (L - 40) * 600 - 1, 339, 3, 7, '#b6f78a');
      D.rect(c, 20 + (L - 150) / (L - 40) * 600 - 2, 336, 4, 13, this.bossDead ? '#5a6f5a' : '#ff7e81');
    }
    drawTank(c, x, y, e, tick) {
      const G = A.Gfx;
      G.glow(c, x, y - 30, 70, '#ffb35c', 0.18);
      G.sprite(c, 'tank:' + (e.flash ? 'f' : 'n'), 150, 70, ctx => {
        const body = e.flash ? '#ffffff' : '#847967';
        ctx.translate(75, 66);
        ctx.fillStyle = '#20262c'; ctx.fillRect(-49, -24, 98, 24);
        ctx.fillStyle = G.linear(ctx, 0, -50, 0, -20, [[0, G.shade(body, 0.3)], [1, G.shade(body, -0.35)]]); ctx.fillRect(-41, -50, 82, 30);
        ctx.strokeStyle = '#0a0f17'; ctx.lineWidth = 2; ctx.strokeRect(-41, -50, 82, 30);
        ctx.fillStyle = '#5c6b65'; ctx.fillRect(-20, -66, 44, 18); ctx.strokeRect(-20, -66, 44, 18);
        ctx.fillStyle = G.linear(ctx, 0, -48, 0, -40, [[0, '#d6ded0'], [1, '#7c8579']]); ctx.fillRect(-72, -48, 56, 8);
        ctx.fillStyle = '#ffb35c'; ctx.fillRect(-2, -61, 14, 4);
        ctx.fillStyle = '#e5c84a'; for (let i = -36; i < 36; i += 12) ctx.fillRect(i, -26, 6, 3);
        ctx.fillStyle = '#a7302c'; ctx.font = 'bold 8px monospace'; ctx.fillText('AUDIT', -16, -31);
      }, x - 75, y - 66);
      for (let i = 0; i < 6; i++) {
        const wx = x - 36 + i * 14, wy = y - 9, a = -tick * 0.15 + i;
        D.ellipse(c, wx, wy, 7, 7, '#1b2430'); D.ellipse(c, wx, wy, 4, 4, '#4b5866');
        D.line(c, wx - Math.cos(a) * 4, wy - Math.sin(a) * 4, wx + Math.cos(a) * 4, wy + Math.sin(a) * 4, '#8a98a6', 1.5);
      }
      for (let i = 0; i < 12; i++) D.rect(c, x - 46 + ((i * 8 - tick) % 96 + 96) % 96, y - 2, 4, 2, '#3c4651');
    }
  };
  A.register({id:'shadow', remix:{name:'Ricochet Blade',summary:'Your blade turns enemy fire around, but sentries shoot more often.'}, title:'Shadow Circuit', subtitle:'A blade against the machine.', genre:'NINJA ACTION', color:'#8ceee1', number:'01', controls:['Move / crouch','Z · blade','X · shuriken','Space · double jump'], description:'Three neon districts. Chain aerial jumps, cut through sentries and defeat the shogun process.'}, mode => new A.Platform('shadow', mode));
  A.register({id:'cache', remix:{name:'Shadow Step',summary:'Smoke recharges twice as fast and every freed witness patches you up.'}, title:'Cache Ninja', subtitle:'Leave no witness behind.', genre:'RESCUE PLATFORMER', color:'#e8b0fc', number:'05', controls:['Move / crouch','Z · shuriken','X · smoke','Space · jump'], description:'Free three witnesses per district. Use smoke to cross firing lines, then take down the watchdog.'}, mode => new A.Platform('cache', mode));
  A.register({id:'iron', remix:{name:'Spread Shot',summary:'A three-way spread against troops with 40% more armour.'}, title:'Iron Comet', subtitle:'Heavy metal. Light paperwork.', genre:'RUN & GUN', color:'#ffc06a', number:'08', controls:['Move / crouch / aim up','Z · fire','X · grenade','Space · jump'], description:'Storm three industrial districts. Grab med crates, lob grenades and bring down the audit tanks.'}, mode => new A.Platform('iron', mode));
})(globalThis.Arcade2);
