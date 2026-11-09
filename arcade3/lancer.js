/* SPDX-License-Identifier: Apache-2.0 */
// Lattice Lancer: an original rail shooter. Five light rails run to the horizon. Slide
// between them, lance the drones that ride down, and save your three torpedoes for the
// warden that crosses the sky at the end of every sector.
(function (A) {
  'use strict';
  const {clamp, Draw: D} = A;
  // Depth runs 0 (horizon) to NEAR (the player's plane). State uses plain integers:
  // rail slots are 16 units wide, so slot 32 is the middle rail.
  const NEAR = 1000, HORIZON = 96, FLOOR = 322, SLOT = 16;
  const depthY = z => HORIZON + (FLOOR - HORIZON) * z * z / (NEAR * NEAR);
  // Rail spacing grows with the same (z/NEAR)^2 factor as depthY, so screen x is linear in
  // screen y: the rails are straight lines and every entity sits exactly on its rail.
  const railX = (lane, z) => 320 + (lane - 2) * (22 + 118 * z * z / (NEAR * NEAR));
  const Z_BOTTOM = NEAR * Math.sqrt((360 - HORIZON) / (FLOOR - HORIZON)); // depth at screen y 360
  const scaleAt = z => 0.18 + 0.82 * z * z / (NEAR * NEAR);
  const SECTORS = [{quota: 15, gap: 64, cap: 6}, {quota: 18, gap: 56, cap: 7}, {quota: 21, gap: 48, cap: 8}, {quota: 24, gap: 44, cap: 8}];
  const NAMES = ['SECTOR 1 // GLASS LATTICE', 'SECTOR 2 // AMBER LATTICE', 'SECTOR 3 // VIOLET LATTICE', 'SECTOR 4 // THE WARDEN ROAD'];
  A.Lancer = class extends A.Game {
    constructor(mode = 'extended') { super('lancer', 6611, mode); this.lives = 3; this.setup(); }
    setup() {
      this.p = {lane: 2, pos: 2 * SLOT, cd: 0, torps: 3};
      Object.assign(this, {shots: [], foes: [], kills: 0, stageTicks: 0, inv: 90, uid: 0, warden: false, wardenGone: false});
      this.announce(NAMES[this.stage], 140);
    }
    get sector() { return SECTORS[this.stage]; }
    laneOf(f) { return Math.round(f.pos / SLOT); }
    spawn(kind, lane) {
      const s = this.stage;
      if (this.foes.length >= 10) return;
      this.foes.push({kind, lane, pos: lane * SLOT, z: 0, vz: {drone: 5, block: 7, hopper: 6}[kind] + (s > 1 ? 1 : 0),
        hold: 380 + this.random(380), wait: 200 + this.random(120), hop: 50 + this.random(40), cd: 70 + this.random(50), dive: false, uid: ++this.uid});
    }
    lose() {
      if (this.inv || this.status !== 'playing') return;
      this.lives--; this.inv = 120; this.emit('hurt');
      this.burst(A.q(Math.round(railX(this.p.pos / SLOT, NEAR))), A.q(FLOOR - 14), '#9be9ff', 22);
      // Clear the near field so a respawn is never an instant second hit.
      this.shots = this.shots.filter(b => b.mine); this.foes = this.foes.filter(f => f.kind === 'warden' || f.z < 520);
      if (this.lives <= 0) this.finish(false);
    }
    tick(input) {
      if (!this.begin()) return;
      this.stageTicks++;
      const p = this.p, s = this.stage, sec = this.sector;
      if (p.cd) p.cd--;
      // Slide one rail at a time; holding a direction keeps sliding.
      if (p.pos === p.lane * SLOT && input.x) p.lane = clamp(p.lane + input.x, 0, 4);
      p.pos += clamp(p.lane * SLOT - p.pos, -4, 4);
      const beam = this.shots.find(b => b.kind === 'beam'), torp = this.shots.find(b => b.kind === 'torp');
      if (input.a && !beam && !p.cd) { this.shots.push({kind: 'beam', lane: p.lane, z: NEAR - 40, mine: true}); p.cd = 8; this.emit('shot'); }
      if (input.bPressed && !torp && p.torps > 0) { p.torps--; this.shots.push({kind: 'torp', lane: p.lane, z: NEAR - 40, mine: true}); this.emit('blast'); }
      // Waves ride down the rails until the quota is met; then the warden crosses.
      if (this.kills < sec.quota && this.stageTicks % sec.gap === 0 && this.foes.length < sec.cap) {
        const roll = this.random(10), lane = this.random(5);
        this.spawn(roll < 6 ? 'drone' : roll < 8 || s === 0 ? 'block' : 'hopper', lane);
      }
      if (this.kills >= sec.quota && !this.warden) {
        this.warden = true; this.announce('WARDEN CROSSING // TORPEDOES ONLY', 120);
        this.foes.push({kind: 'warden', lane: -1, pos: -SLOT, z: 70, vz: 0, hp: 1, cd: 90, uid: ++this.uid});
      }
      for (const f of this.foes) {
        if (f.kind === 'warden') {
          if (this.tickCount % 2 === 0) f.pos++;
          if (--f.cd <= 0) { f.cd = 110 - s * 15; this.shots.push({kind: 'spark', lane: clamp(this.laneOf(f), 0, 4), z: 90, vz: 9 + s, mine: false}); }
          if (f.pos > 5 * SLOT) { f.gone = true; this.wardenGone = true; }
          continue;
        }
        if (f.kind === 'drone' && !f.dive) {
          // Ride down to a holding depth, hop rails and spit sparks, then dive.
          f.z = Math.min(f.hold, f.z + f.vz);
          if (f.z === f.hold) {
            if (--f.wait <= 0) f.dive = true;
            if (--f.hop <= 0) { f.hop = 50 + this.random(40); f.lane = clamp(f.lane + (this.random(2) ? 1 : -1), 0, 4); }
            if (--f.cd <= 0) { f.cd = 100 - s * 12; this.shots.push({kind: 'spark', lane: this.laneOf(f), z: f.z + 20, vz: 10 + s, mine: false}); }
          }
        } else {
          f.z += f.dive ? 9 + s : f.vz;
          if (f.kind === 'hopper' && --f.hop <= 0) { f.hop = 34; f.lane = clamp(f.lane + (f.lane >= 4 ? -1 : f.lane <= 0 ? 1 : this.random(2) ? 1 : -1), 0, 4); }
        }
        f.pos += clamp(f.lane * SLOT - f.pos, -2, 2);
        if (f.z >= NEAR - 40 && this.laneOf(f) === Math.round(p.pos / SLOT)) { f.gone = true; this.lose(); }
        if (f.z > NEAR) f.gone = true;
      }
      for (const b of this.shots) {
        if (!b.mine) { b.z += b.vz; if (b.z >= NEAR - 30 && b.lane === Math.round(p.pos / SLOT)) { b.gone = true; this.lose(); } if (b.z > NEAR) b.gone = true; continue; }
        b.z -= b.kind === 'beam' ? 30 : 22;
        if (b.z < 40) b.gone = true;
        for (const f of this.foes) {
          if (f.gone || b.gone) continue;
          if (f.kind === 'warden') {
            if (b.kind === 'torp' && b.z <= 110 && Math.abs(f.pos - b.lane * SLOT) <= 10) {
              f.gone = true; b.gone = true; this.wardenGone = true; this.score += 3000 + s * 1000;
              this.burst(A.q(Math.round(railX(f.pos / SLOT, f.z))), A.q(Math.round(depthY(f.z)) - 6), '#ff8ae8', 40); this.emit('blast');
              this.announce('WARDEN DOWN', 80);
            }
            continue;
          }
          if (this.laneOf(f) !== b.lane || Math.abs(f.z - b.z) > 34) continue;
          b.gone = true;
          if (f.kind === 'block' && b.kind === 'beam') { this.burst(A.q(Math.round(railX(b.lane, b.z))), A.q(Math.round(depthY(b.z))), '#ffe08a', 4); continue; }
          f.gone = true; this.emit('blast');
          this.score += {drone: 150, hopper: 250, block: 400}[f.kind] + s * 50;
          if (f.kind === 'drone') this.kills++;
          this.burst(A.q(Math.round(railX(f.pos / SLOT, f.z))), A.q(Math.round(depthY(f.z))), f.kind === 'block' ? '#ffd27a' : '#9be9ff', 14);
        }
      }
      // Beams also burn out enemy sparks they meet on their rail.
      for (const b of this.shots) if (b.kind === 'beam' && !b.gone) for (const e of this.shots) if (!e.mine && !e.gone && e.lane === b.lane && Math.abs(e.z - b.z) < 30) { e.gone = true; b.gone = true; this.score += 20; }
      this.shots = this.shots.filter(b => !b.gone);
      this.foes = this.foes.filter(f => !f.gone);
      if (this.status !== 'playing') return;
      if (this.wardenGone) { this.score += p.torps * 300 + this.lives * 200; p.torps = 0; this.clearStage(SECTORS.length - 1); }
    }
    hud() { return {left: 'SHIPS ' + this.lives + '   TORPEDOES ' + this.p.torps, right: 'SECTOR ' + (this.stage + 1) + '/' + SECTORS.length,
      objective: this.warden ? 'Torpedo the warden as it crosses (X) · or just survive its pass'
        : 'Left/right slide between rails · Z lances drones · X fires a torpedo (3 per sector) · ' + Math.max(0, this.sector.quota - this.kills) + ' drones left'}; }
    draw(c) {
      const G = A.Gfx, tick = this.tickCount, s = this.stage, p = this.p;
      const tone = ['#7ff3ff', '#ffc36a', '#c79bff', '#ff7aa8'][s];
      G.layer(c, 'lancer-sky:' + s, 640, 360, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 360, [[0, '#02030b'], [0.25, G.shade(tone, -0.86)], [0.27, G.shade(tone, -0.55)], [1, '#020308']]); ctx.fillRect(0, 0, 640, 360);
        for (let i = 0; i < 90; i++) { const h = G.hash(i * 31 + s * 7); ctx.fillStyle = G.rgba('#e6f4ff', 0.2 + (h % 6) / 10); ctx.fillRect(h % 640, (h >>> 9) % (HORIZON - 6), 1 + (h % 13 === 0), 1); }
        // A ringed planet low on the horizon.
        ctx.fillStyle = G.radial(ctx, 470, 60, 4, 46, [[0, G.shade(tone, 0.3)], [0.7, G.shade(tone, -0.4)], [1, G.shade(tone, -0.8)]]);
        ctx.beginPath(); ctx.arc(480, 62, 34, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = G.rgba(tone, 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(480, 62, 58, 9, -0.25, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = G.linear(ctx, 0, HORIZON - 14, 0, HORIZON + 4, [[0, 'rgba(0,0,0,0)'], [1, G.rgba(tone, 0.55)]]); ctx.fillRect(0, HORIZON - 14, 640, 18);
      });
      G.layer(c, 'lancer-rails:' + s, 640, 360, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, HORIZON, 0, 360, [[0, G.shade(tone, -0.82)], [1, '#04060d']]);
        ctx.beginPath(); ctx.moveTo(railX(-0.6, 0), HORIZON); ctx.lineTo(railX(4.6, 0), HORIZON); ctx.lineTo(railX(4.6, Z_BOTTOM), 360); ctx.lineTo(railX(-0.6, Z_BOTTOM), 360); ctx.closePath(); ctx.fill();
        for (let l = 0; l < 5; l++) {
          ctx.strokeStyle = G.rgba(tone, 0.25); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(railX(l, 0), HORIZON); ctx.lineTo(railX(l, Z_BOTTOM), 360); ctx.stroke();
          ctx.strokeStyle = G.rgba(tone, 0.85); ctx.lineWidth = 1.2; ctx.stroke();
        }
      });
      // Cross-beams sweep toward the player: the lattice that gives the rails depth.
      for (let k = 0; k < 6; k++) {
        const z = (k * 180 + tick * (6 + s)) % 1080; if (z < 8) continue;
        const y = depthY(z); if (y > 360) continue;
        D.line(c, railX(-0.5, z), y, railX(4.5, z), y, G.rgba(tone, Math.min(0.75, z / NEAR)), 1 + 2 * z / NEAR);
      }
      const order = [...this.foes].sort((u, v) => u.z - v.z);
      for (const f of order) {
        const x = railX(f.pos / SLOT, f.z), y = depthY(f.z), k = scaleAt(f.z);
        if (f.kind === 'warden') {
          G.glow(c, x, y - 4, 40, '#ff6ad8', 0.5 + 0.2 * Math.sin(tick * 0.2));
          c.save(); c.translate(x, y - 6); c.scale(1.5, 1.2); D.drone(c, 0, 0, '#ff6ad8', true, tick); c.restore();
          D.text(c, 'WARDEN', x, y - 34, '#ffc1f0', 9, 'center');
          continue;
        }
        if (f.kind === 'block') {
          const w = 34 * k, h = 22 * k;
          G.glow(c, x, y - h / 2, w, '#ffcc4a', 0.35);
          D.rect(c, x - w / 2, y - h, w, h, '#b07a1a'); D.rect(c, x - w / 2, y - h, w, h * 0.35, '#ffd86a'); D.rect(c, x - w / 2 + 2, y - h * 0.6, w - 4, 2, '#5a3a08');
          continue;
        }
        G.shadow(c, x, y + 2, 16 * k, 3 * k, 0.35);
        c.save(); c.translate(x, y - 12 * k); c.scale(k * 1.4, k * 1.4);
        D.drone(c, 0, 0, f.kind === 'hopper' ? '#8dff8a' : f.dive ? '#ff8a6a' : '#e8f2ff', false, tick + f.uid * 11); c.restore();
      }
      for (const b of this.shots) {
        const x = railX(b.lane, b.z), y = depthY(b.z);
        if (!b.mine) { G.glow(c, x, y - 4, 10 * scaleAt(b.z) + 4, '#ff5a7a', 0.8); D.ellipse(c, x, y - 4, 4 * scaleAt(b.z) + 1, 3 * scaleAt(b.z) + 1, '#ffd0da'); continue; }
        if (b.kind === 'torp') { G.glow(c, x, y - 4, 12, '#ffb84a', 0.9); D.ellipse(c, x, y - 4, 5 * scaleAt(b.z) + 2, 5 * scaleAt(b.z) + 2, '#fff2c0'); continue; }
        const z2 = Math.min(NEAR, b.z + 90), x2 = railX(b.lane, z2), y2 = depthY(z2);
        D.line(c, x, y - 3, x2, y2 - 6, G.rgba(tone, 0.5), 6); D.line(c, x, y - 3, x2, y2 - 6, '#ffffff', 2);
      }
      if (this.inv % 8 < 5 && this.status !== 'lost') {
        const x = railX(p.pos / SLOT, NEAR);
        G.glow(c, x, FLOOR - 4, 34, tone, 0.35);
        D.ship(c, x, FLOOR - 14, '#b8ecff', tick, true, 0.85);
      }
      this.drawEffects(c);
      for (let i = 0; i < p.torps; i++) { D.ellipse(c, 26 + i * 16, 334, 5, 5, '#ffb84a'); D.ellipse(c, 26 + i * 16, 334, 2, 2, '#fff2c0'); }
      D.bar(c, 420, 331, 200, Math.min(this.kills, this.sector.quota), this.sector.quota, tone);
    }
  };
  A.Lancer.project = (lane, z) => [railX(lane, z), depthY(z)]; // presentation helper (tests)
  A.register({id: 'lancer', title: 'Lattice Lancer', subtitle: 'Five rails to the horizon.', genre: 'RAIL SHOOTER', color: '#9be9ff', number: '04',
    modes: ['extended'], inspiredBy: 'Beamrider',
    controls: ['Left / right · change rail', 'Z · lance beam', 'X · torpedo (3 per sector)', 'Four sectors · three ships'],
    description: 'Lance a quota of drones in each of four lattice sectors, dodge the indestructible cargo blocks, then torpedo the warden as it crosses.'},
  () => new A.Lancer());
})(globalThis.Arcade2);
