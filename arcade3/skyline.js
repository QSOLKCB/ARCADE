/* SPDX-License-Identifier: Apache-2.0 */
// Skyline Overdrive: an original into-the-screen jet shooter. Bank across a banking
// horizon, gun down interceptors, lock missiles onto anything inside the reticle and
// jink out of the way of incoming flak. Each sortie ends with a gunship.
(function (A) {
  'use strict';
  const {q, clamp, Draw: D} = A;
  // World units: lateral x ±600, height y ±300 (+y down), depth z ahead of the camera.
  // The player's jet flies at depth PLANE; everything is projected with focal length F.
  const F = 300, PLANE = 300, FAR = 4200, GROUND = 520;
  // The reticle: a screen box of half-size RET_W x RET_H around the point straight ahead
  // of the jet at depth RET_Z. Lock-on uses exactly this box, so what you see is what locks.
  const RET_Z = 1800, RET_W = 36, RET_H = 28;
  // The jet flies JET_DY world units below its aim point (at depth PLANE one world unit is
  // one pixel), so it never hides the reticle. Collisions, enemy aim, the muzzle and the
  // drawing all use this one jet position; cannon rounds climb to cross the reticle.
  const JET_DY = 40, ROUND_VY = -2;
  const SORTIES = [{quota: 32, gap: 110, hp: 30}, {quota: 40, gap: 96, hp: 44}, {quota: 48, gap: 84, hp: 60}];
  A.Skyline = class extends A.Game {
    constructor(mode = 'extended') { super('skyline', 8807, mode); this.lives = 4; this.setup(); }
    setup() {
      this.p = {x: 0, y: 0, vx: 0, vy: 0, cd: 0, mcd: 0, missiles: 16};
      Object.assign(this, {foes: [], shots: [], flak: [], missiles: [], kills: 0, stageTicks: 0, inv: 90, uid: 0, boss: false, bossDead: false, locks: []});
      this.announce(['SORTIE 1 // COASTLINE', 'SORTIE 2 // RED CANYON', 'SORTIE 3 // NIGHT CITY'][this.stage], 140);
    }
    get cam() { return {x: Math.trunc(this.p.x * 6 / 10), y: Math.trunc(this.p.y * 6 / 10)}; }
    project(x, y, z) { const c = this.cam, k = F / Math.max(40, z); return [320 + (x - c.x) * k, 180 + (y - c.y) * k, k]; }
    // Whether a target's projected screen position lies inside the drawn reticle. Integer
    // form of |(f - c)·F/z − (p − c)·F/RET_Z| < half-size, multiplied through by z·RET_Z
    // (all terms stay far below 2^53, so the comparison is exact).
    inReticle(f) {
      const c = this.cam, p = this.p, zz = f.z * RET_Z;
      return Math.abs((f.x - c.x) * F * RET_Z - (p.x - c.x) * F * f.z) < RET_W * zz &&
        Math.abs((f.y - c.y) * F * RET_Z - (p.y - c.y) * F * f.z) < RET_H * zz;
    }
    spawnWave() {
      const s = this.stage, kind = this.random(4) === 0 && s ? 'bomber' : 'fighter', n = kind === 'bomber' ? 2 : 3;
      const bx = this.random(900) - 450, by = this.random(360) - 180, phase = this.random(120);
      for (let i = 0; i < n && this.foes.length < 12; i++)
        this.foes.push({kind, x: bx + (i - 1) * 140, y: by, bx: bx + (i - 1) * 140, by, z: FAR + i * 160, vz: kind === 'bomber' ? 26 : 34 + s * 3,
          hp: kind === 'bomber' ? 3 : 1, age: phase + i * 20, cd: 50 + this.random(60), uid: ++this.uid});
    }
    crash() {
      if (this.inv || this.status !== 'playing') return;
      this.lives--; this.inv = 120; this.emit('hurt');
      const [sx, sy] = this.project(this.p.x, this.p.y + JET_DY, PLANE); this.burst(q(Math.round(sx)), q(Math.round(sy)), '#ffb35c', 24);
      this.flak = [];
      if (this.lives <= 0) this.finish(false);
    }
    tick(input) {
      if (!this.begin()) return;
      this.stageTicks++;
      const p = this.p, s = this.stage, so = SORTIES[s];
      p.vx = A.approach(p.vx, input.x * 12, 2); p.vy = A.approach(p.vy, input.y * 9, 2);
      p.x = clamp(p.x + p.vx, -600, 600); p.y = clamp(p.y + p.vy, -280, 280);
      if (p.cd) p.cd--; if (p.mcd) p.mcd--;
      if (input.a && !p.cd && this.shots.length < 12) { this.shots.push({x: p.x, y: p.y + JET_DY, vy: ROUND_VY, z: PLANE + 40}); p.cd = 5; this.emit('shot'); }
      // Lock-on: up to two targets inside the reticle cone (the box straight ahead of the jet).
      this.locks = this.foes.filter(f => f.z > 600 && f.z < 3400 && this.inReticle(f) && !this.missiles.some(m => m.target === f.uid))
        .sort((u, v) => u.z - v.z).slice(0, 2).map(f => f.uid);
      if (input.bPressed && !p.mcd && p.missiles > 0 && this.locks.length) {
        for (const uid of this.locks) if (p.missiles > 0) { p.missiles--; this.missiles.push({target: uid, x: p.x, y: p.y + JET_DY, z: PLANE, eta: 22}); }
        p.mcd = 20; this.emit('blast');
      }
      if (!this.boss && this.kills < so.quota && this.stageTicks % so.gap === 0 && this.foes.length < 9) this.spawnWave();
      if (!this.boss && this.kills >= so.quota) {
        this.boss = true; this.announce('GUNSHIP INBOUND', 100);
        this.foes.push({kind: 'gunship', x: 0, y: -120, bx: 0, by: -120, z: FAR, vz: 30, hp: so.hp, maxHP: so.hp, age: 0, cd: 80, uid: ++this.uid});
      }
      for (const f of this.foes) {
        f.age++;
        if (f.kind === 'gunship') {
          // Close to a holding range, then weave and fire volleys.
          f.z = Math.max(2000, f.z - f.vz);
          f.x = f.bx + A.triangle(f.age, 360, 800) - 400; f.y = f.by + A.triangle(f.age, 200, 160) - 80;
          if (--f.cd <= 0) { f.cd = 64 - s * 8; for (const dx of [-120, 0, 120]) this.fire(f, p.x + dx, p.y + JET_DY); }
          continue;
        }
        f.z -= f.vz;
        f.x = f.bx + A.triangle(f.age, 160, 240) - 120; f.y = f.by + A.triangle(f.age + 40, 130, 100) - 50;
        if (f.z < 2600 && f.z > 1100 && --f.cd <= 0) { f.cd = 110 - s * 15; this.fire(f, p.x, p.y + JET_DY); }
        if (f.z <= PLANE) {
          if (Math.abs(f.x - p.x) < 70 && Math.abs(f.y - p.y - JET_DY) < 45) { f.hp = 0; this.crash(); }
          f.gone = true;
        }
      }
      for (const b of this.flak) {
        b.x += b.vx; b.y += b.vy; b.z -= 54;
        if (b.z <= PLANE) { b.gone = true; if (Math.abs(b.x - p.x) < 52 && Math.abs(b.y - p.y - JET_DY) < 38) this.crash(); }
      }
      for (const b of this.shots) {
        b.z += 90; b.y += b.vy; if (b.z > 3400) b.gone = true;
        for (const f of this.foes) {
          if (b.gone || f.gone || f.hp <= 0) continue;
          const big = f.kind === 'gunship', w = big ? 170 : f.kind === 'bomber' ? 90 : 70, h = big ? 90 : 50;
          if (Math.abs(f.x - b.x) < w && Math.abs(f.y - b.y) < h && Math.abs(f.z - b.z) < 100) { b.gone = true; this.damage(f, 1); }
        }
      }
      for (const m of this.missiles) {
        const f = this.foes.find(g => g.uid === m.target && g.hp > 0 && !g.gone);
        if (!f) { m.gone = true; continue; }
        m.x += Math.trunc((f.x - m.x) / m.eta); m.y += Math.trunc((f.y - m.y) / m.eta); m.z += Math.trunc((f.z - m.z) / m.eta);
        if (--m.eta <= 0) { m.gone = true; this.damage(f, f.kind === 'gunship' ? 4 : 3); }
      }
      this.foes = this.foes.filter(f => !f.gone && f.hp > 0);
      this.shots = this.shots.filter(b => !b.gone);
      this.flak = this.flak.filter(b => !b.gone);
      this.missiles = this.missiles.filter(m => !m.gone);
      if (this.status !== 'playing') return;
      if (this.bossDead) { this.score += this.lives * 500 + p.missiles * 50; this.clearStage(); }
    }
    fire(f, tx, ty) {
      if (this.flak.length >= 18) return;
      const t = Math.max(1, Math.trunc((f.z - PLANE) / 54));
      this.flak.push({x: f.x, y: f.y, z: f.z, vx: Math.trunc((tx - f.x) / t), vy: Math.trunc((ty - f.y) / t)});
    }
    damage(f, n) {
      f.hp -= n; this.emit('blast');
      const [sx, sy] = this.project(f.x, f.y, f.z);
      if (f.hp > 0) { this.burst(q(Math.round(sx)), q(Math.round(sy)), '#ffe08a', 3); return; }
      this.score += {fighter: 200, bomber: 500, gunship: 5000}[f.kind] + this.stage * 50;
      this.burst(q(Math.round(sx)), q(Math.round(sy)), f.kind === 'gunship' ? '#ff7a3a' : '#ffb35c', f.kind === 'gunship' ? 48 : 16);
      if (f.kind === 'gunship') this.bossDead = true; else this.kills++;
    }
    hud() { return {left: 'JETS ' + this.lives + '   MISSILES ' + this.p.missiles, right: 'SORTIE ' + (this.stage + 1) + '/3',
      objective: this.boss ? 'Bring down the gunship' : 'Move to bank and climb · Z guns · X fires missiles at locked targets · ' + Math.max(0, SORTIES[this.stage].quota - this.kills) + ' to go'}; }
    draw(c) {
      const G = A.Gfx, tick = this.tickCount, s = this.stage, p = this.p, cam = this.cam;
      const pal = [{sky: ['#0d2a5a', '#3a7ac8', '#ffd3a0'], ground: ['#0a3a5a', '#1d6a8a'], line: '#9fe8ff'},
        {sky: ['#2a0e1a', '#a0402a', '#ffc070'], ground: ['#4a2010', '#8a4a20'], line: '#ffd29a'},
        {sky: ['#03040e', '#1a1a4a', '#5a2a6a'], ground: ['#0a0a18', '#1a1a34'], line: '#ff7ad8'}][s];
      // The horizon banks with lateral speed and drops as the jet climbs.
      const roll = -p.vx * 0.022, horizon = 180 + (GROUND - cam.y) * F / 6000;
      c.save(); c.translate(320, horizon); c.rotate(roll);
      G.layer(c, 'skyline-sky:' + s, 900, 420, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 420, [[0, pal.sky[0]], [0.7, pal.sky[1]], [1, pal.sky[2]]]); ctx.fillRect(0, 0, 900, 420);
        for (let i = 0; i < 14; i++) { const h = G.hash(i * 19 + s); ctx.fillStyle = G.rgba('#ffffff', s === 2 ? 0.05 : 0.18); ctx.beginPath(); ctx.ellipse(h % 900, 200 + (h >>> 8) % 180, 40 + h % 70, 6 + h % 8, 0, 0, Math.PI * 2); ctx.fill(); }
        if (s === 2) for (let i = 0; i < 80; i++) { const h = G.hash(i * 7); ctx.fillStyle = '#e6eeff'; ctx.fillRect(h % 900, (h >>> 9) % 300, 1, 1); }
        ctx.fillStyle = G.rgba(pal.sky[2], 0.9); ctx.fillRect(0, 414, 900, 6);
      }, -450, -420);
      G.layer(c, 'skyline-ground:' + s, 900, 380, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 380, [[0, pal.ground[1]], [1, pal.ground[0]]]); ctx.fillRect(0, 0, 900, 380);
        if (s === 2) for (let i = 0; i < 160; i++) { const h = G.hash(i * 13 + 5); ctx.fillStyle = G.rgba(['#ffd98a', '#7ff3ff', '#ff7ad8'][h % 3], 0.7); ctx.fillRect(h % 900, 4 + Math.pow((h >>> 8) % 100 / 100, 2) * 376, 2, 1); }
      }, -450, 0);
      // Speed stripes: ground lines rushing toward the camera.
      for (let k = 0; k < 9; k++) {
        const z = 4200 - ((tick * 46 + k * 470) % 4200); if (z < 120) continue;
        const y = (GROUND - cam.y) * F / z - (GROUND - cam.y) * F / 6000; if (y > 260) continue;
        D.line(c, -460, y, 460, y, G.rgba(pal.line, Math.min(0.55, 160 / z)), 1 + 300 / z);
      }
      for (let k = -4; k <= 4; k++) D.line(c, k * 30, 0, k * 30 * 14 - (cam.x * F / 600), 260, G.rgba(pal.line, 0.14), 1);
      c.restore();
      const sprite = (x, y, z, kind, flash) => {
        const [sx, sy, k] = this.project(x, y, z), size = k * (kind === 'gunship' ? 2.4 : kind === 'bomber' ? 1.4 : 1);
        if (sx < -120 || sx > 760 || sy < -120 || sy > 480) return;
        G.glow(c, sx, sy, 34 * size, kind === 'gunship' ? '#ff5a3a' : '#ff9a6a', 0.25);
        c.save(); c.translate(sx, sy); c.scale(size, size);
        G.sprite(c, 'skyline-jet:' + kind, 130, 60, ctx => {
          ctx.translate(65, 30); const tone = kind === 'gunship' ? '#5a6070' : kind === 'bomber' ? '#6a7a5a' : '#8a92a6';
          ctx.fillStyle = G.linear(ctx, 0, -20, 0, 20, [[0, G.shade(tone, 0.4)], [1, G.shade(tone, -0.5)]]); ctx.strokeStyle = '#0a0f17'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-60, 6); ctx.lineTo(-10, -4); ctx.lineTo(0, -16); ctx.lineTo(10, -4); ctx.lineTo(60, 6); ctx.lineTo(10, 8); ctx.lineTo(0, 14); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ff6a5a'; ctx.fillRect(-58, 4, 6, 3); ctx.fillRect(52, 4, 6, 3);
          ctx.fillStyle = '#1a2a3a'; ctx.beginPath(); ctx.ellipse(0, -3, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
          if (kind === 'gunship') { ctx.fillStyle = '#3a404c'; ctx.fillRect(-40, 8, 80, 10); ctx.fillStyle = '#ffb35c'; for (const gx of [-30, 0, 30]) ctx.fillRect(gx - 3, 16, 6, 4); }
        }, -65, -30);
        if (flash) D.ellipse(c, 0, 0, 20, 10, G.rgba('#ffffff', 0.6));
        c.restore();
        return [sx, sy, size];
      };
      const all = [...this.foes].sort((u, v) => v.z - u.z);
      for (const f of all) {
        const at = sprite(f.x, f.y, f.z, f.kind, false);
        if (at && this.locks.includes(f.uid)) { const r = 26 * Math.max(0.6, at[2]); c.strokeStyle = '#ff4d6a'; c.lineWidth = 2; c.strokeRect(at[0] - r, at[1] - r, r * 2, r * 2); D.text(c, 'LOCK', at[0], at[1] - r - 3, '#ff8a9a', 9, 'center'); }
        if (at && f.kind === 'gunship') D.bar(c, at[0] - 60, at[1] - 50 * at[2], 120, f.hp, f.maxHP, '#ff8a6a');
      }
      for (const b of this.flak) { const [sx, sy, k] = this.project(b.x, b.y, b.z); G.glow(c, sx, sy, 10 + 30 * k, '#ff4a2a', 0.8); D.ellipse(c, sx, sy, 2 + 8 * k, 2 + 8 * k, '#ffd0a0'); }
      for (const m of this.missiles) { const [sx, sy, k] = this.project(m.x, m.y, m.z); G.glow(c, sx, sy, 8 + 10 * k, '#c2f874', 0.8); D.ellipse(c, sx, sy, 2 + 4 * k, 2 + 4 * k, '#f4ffd0'); }
      for (const b of this.shots) { const [sx, sy, k] = this.project(b.x, b.y, b.z); D.rect(c, sx - 1, sy - 1, 2 + 3 * k, 2 + 3 * k, '#fff3c4'); }
      // The reticle (lock cone) straight ahead of the jet.
      const [rx, ry] = this.project(p.x, p.y, RET_Z), rw = RET_W * 2, rh = RET_H * 2;
      c.strokeStyle = G.rgba('#c2f874', 0.7); c.lineWidth = 1.5; c.strokeRect(rx - rw / 2, ry - rh / 2, rw, rh); D.line(c, rx - 6, ry, rx + 6, ry, '#c2f874', 1); D.line(c, rx, ry - 6, rx, ry + 6, '#c2f874', 1);
      if (this.status !== 'lost' && this.inv % 8 < 5) {
        const [sx, sy] = this.project(p.x, p.y + JET_DY, PLANE);
        // Drawn exactly where the collision checks place the jet (JET_DY below the aim point).
        c.save(); c.translate(sx, sy); c.rotate(p.vx * 0.04);
        G.glow(c, 0, 10, 24 + (tick % 5), '#ff8a3a', 0.8);
        G.sprite(c, 'skyline-player', 110, 50, ctx => {
          ctx.translate(55, 25); ctx.strokeStyle = '#0a0f17'; ctx.lineWidth = 1.5;
          ctx.fillStyle = G.linear(ctx, 0, -20, 0, 20, [[0, '#e8f0ff'], [1, '#4a5a7a']]);
          ctx.beginPath(); ctx.moveTo(-52, 10); ctx.lineTo(-12, -2); ctx.lineTo(-8, -18); ctx.lineTo(0, -22); ctx.lineTo(8, -18); ctx.lineTo(12, -2); ctx.lineTo(52, 10); ctx.lineTo(12, 12); ctx.lineTo(0, 18); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#5ad8ff'; ctx.beginPath(); ctx.ellipse(0, -10, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#3a4458'; ctx.fillRect(-14, 6, 10, 10); ctx.fillRect(4, 6, 10, 10);
        }, -55, -25);
        D.ellipse(c, -9, 13, 4, 3 + tick % 3, '#fff3c4'); D.ellipse(c, 9, 13, 4, 3 + (tick + 1) % 3, '#fff3c4');
        c.restore();
      }
      this.drawEffects(c);
      D.bar(c, 420, 343, 200, Math.min(this.kills, SORTIES[s].quota), SORTIES[s].quota, '#c2f874');
    }
  };
  A.register({id: 'skyline', title: 'Skyline Overdrive', subtitle: 'Full throttle. Bank hard.', genre: 'INTO-THE-SCREEN SHOOTER', color: '#c2f874', number: '06',
    modes: ['extended'], inspiredBy: 'After Burner',
    controls: ['Move · bank and climb', 'Z · cannon', 'X · missiles at locked targets', 'Three sorties · four jets'],
    description: 'Three sorties over coast, canyon and city. Gun down interceptors, ripple missiles into the reticle, and break each sortie\'s gunship.'},
  () => new A.Skyline());
})(globalThis.Arcade2);
