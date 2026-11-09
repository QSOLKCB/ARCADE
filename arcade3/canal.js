/* SPDX-License-Identifier: Apache-2.0 */
// Canal Cutter: an original river-run shooter. Skim a night canal that narrows, forks
// and widens; shoot barges, hover-drones and interceptors; skim charge buoys to keep
// your cell topped up; and burn through each firewall bridge, which becomes your restart point.
(function (A) {
  'use strict';
  const {q, clamp, Draw: D} = A;
  // World distance runs upstream (integer px). The skimmer sits at screen y 300.
  const SHIP_Y = 300, SECTION = 400, REACH = 4, CELL = 2400;
  // Bank templates [left, right, island half-width]; every channel is at least 60 px wide.
  const SHAPES = [[150, 490, 0], [200, 440, 0], [120, 520, 64], [230, 410, 0], [170, 470, 0], [100, 540, 96], [210, 430, 0], [130, 510, 40]];
  const GATE = [250, 390, 0];
  const REACHES = [4, 5, 6];
  const HALF = {barge: 18, drone: 11, jet: 14, buoy: 12};
  A.Canal = class extends A.Game {
    constructor(mode = 'extended') { super('canal', 7703, mode); this.lives = 4; this.setup(); }
    setup() {
      const s = this.stage, reaches = REACHES[s];
      this.length = reaches * REACH * SECTION;
      // Nodes at every section boundary; each reach ends on a narrow gate under a bridge.
      this.nodes = [GATE];
      for (let r = 0; r < reaches; r++) {
        for (let k = 1; k < REACH; k++) this.nodes.push(SHAPES[(this.random(SHAPES.length) + r + k) % SHAPES.length]);
        this.nodes.push(GATE);
      }
      this.nodes.push(GATE);
      // The spawn plan: everything that will appear, by world distance, rebuilt on a restart.
      this.plan = [];
      for (let wy = 300; wy < this.length - 120; wy += 110 + this.random(60)) {
        if (wy % SECTION < 80 || wy % SECTION > SECTION - 60) continue;
        const roll = this.random(12), kind = roll < 4 ? 'barge' : roll < 7 ? 'drone' : roll < 9 && s ? 'jet' : roll < 11 ? 'buoy' : 'barge';
        const ch = this.channels(wy), [l, r] = ch[this.random(ch.length)];
        const x = kind === 'jet' ? (this.random(2) ? -30 : 670) : l + 24 + this.random(Math.max(1, r - l - 48));
        this.plan.push({kind, wy, x, uid: this.plan.length + 1});
      }
      // A charge buoy mid-way through every other section, one in each channel of a fork.
      for (let wy = 200; wy < this.length; wy += 2 * SECTION) {
        this.plan = this.plan.filter(f => Math.abs(f.wy - wy) > 40);
        for (const [l, r] of this.channels(wy)) this.plan.push({kind: 'buoy', wy, x: (l + r) >> 1, uid: 700 + this.plan.length});
      }
      for (let r = 1; r <= reaches; r++) this.plan.push({kind: 'bridge', wy: r * REACH * SECTION, x: 320, hp: 3 + s, uid: 900 + r});
      this.plan.sort((u, v) => u.wy - v.wy);
      Object.assign(this, {checkpoint: 0, stageTicks: 0, inv: 60});
      this.restart();
      this.announce(['RUN 1 // LOW CANAL', 'RUN 2 // FOUNDRY CUT', 'RUN 3 // THE FLOODGATES'][s], 140);
    }
    restart() {
      const wy = this.checkpoint;
      this.dist = wy; this.speed = 2; this.fuel = CELL; this.shots = []; this.foes = []; this.cd = 0;
      this.cursor = this.plan.findIndex(f => f.wy > wy + 120); if (this.cursor < 0) this.cursor = this.plan.length;
      const [l, r] = this.channels(wy + 1).sort((u, v) => (v[1] - v[0]) - (u[1] - u[0]))[0];
      this.x = (l + r) >> 1;
    }
    // Bank geometry at a world distance, linearly interpolated between nodes.
    banks(wy) {
      const i = clamp(Math.floor(wy / SECTION), 0, this.nodes.length - 2), t = clamp(wy - i * SECTION, 0, SECTION);
      const a = this.nodes[i], b = this.nodes[i + 1], mix = k => a[k] + Math.trunc((b[k] - a[k]) * t / SECTION);
      return [mix(0), mix(1), mix(2)];
    }
    channels(wy) { const [l, r, isl] = this.banks(wy); return isl ? [[l, 320 - isl], [320 + isl, r]] : [[l, r]]; }
    wet(x, wy, half) { return this.channels(wy).some(([l, r]) => x - half >= l && x + half <= r); }
    crash() {
      if (this.status !== 'playing') return;
      this.lives--; this.emit('hurt'); this.burst(q(this.x), q(SHIP_Y), '#ffb35c', 26);
      if (this.lives <= 0) { this.finish(false); return; }
      this.inv = 90; this.restart(); this.announce('RESTART AT THE LAST BRIDGE', 80);
    }
    tick(input) {
      if (!this.begin()) return;
      this.stageTicks++;
      const s = this.stage;
      this.speed = input.y < 0 ? 4 : input.y > 0 ? 1 : 2;
      this.x = clamp(this.x + input.x * 3, 20, 620);
      this.dist += this.speed;
      this.fuel -= 1;
      if (this.cd) this.cd--;
      if (input.a && !this.cd && this.shots.length < 3) { this.shots.push({x: this.x, wy: this.dist + 14}); this.cd = 7; this.emit('shot'); }
      while (this.cursor < this.plan.length && this.plan[this.cursor].wy < this.dist + 330) {
        const f = {...this.plan[this.cursor++]};
        Object.assign(f, {vx: f.kind === 'jet' ? (f.x < 0 ? 4 + s : -4 - s) : 0, hp: f.hp || 1, wake: false});
        if (this.foes.length < 24) this.foes.push(f);
      }
      if (!this.wet(this.x, this.dist, 7)) { this.crash(); return; }
      for (const f of this.foes) {
        const ahead = f.wy - this.dist;
        // Barges and drones start patrolling once the skimmer draws near.
        if (!f.wake && ahead < 200 - s * 30 && (f.kind === 'barge' || f.kind === 'drone')) { f.wake = true; f.vx = (f.uid % 2 ? 1 : -1) * (f.kind === 'drone' ? 2 : 1); }
        if (f.vx) {
          const nx = f.x + f.vx;
          if (f.kind !== 'jet' && !this.wet(nx, f.wy, HALF[f.kind])) f.vx = -f.vx; else f.x = nx;
        }
        if (ahead < -60 || f.x < -60 || f.x > 700) f.gone = true;
        if (f.kind === 'bridge') { if (ahead < 10 && ahead > -8) { this.crash(); return; } continue; }
        if (f.kind === 'buoy') { if (Math.abs(f.x - this.x) < 16 && Math.abs(ahead) < 14) { if (this.fuel < CELL) this.emit('pickup'); this.fuel = Math.min(CELL, this.fuel + 30); } continue; }
        if (!this.inv && Math.abs(f.x - this.x) < HALF[f.kind] + 6 && Math.abs(ahead) < 12) { this.crash(); return; }
      }
      for (const b of this.shots) {
        b.wy += 9 + this.speed;
        if (b.wy - this.dist > 320) b.gone = true;
        for (const f of this.foes) {
          if (f.gone || b.gone) continue;
          const hit = f.kind === 'bridge' ? b.wy >= f.wy - 6 && b.wy <= f.wy + 14 : Math.abs(f.x - b.x) < HALF[f.kind] && Math.abs(f.wy - b.wy) < 12;
          if (!hit) continue;
          b.gone = true;
          if (--f.hp > 0) { this.burst(q(b.x), q(SHIP_Y - (f.wy - this.dist)), '#ff9a5a', 4); continue; }
          f.gone = true; this.emit('blast');
          this.score += {barge: 60, drone: 120, jet: 200, buoy: 80, bridge: 500}[f.kind] + s * 20;
          this.burst(q(f.x), q(SHIP_Y - (f.wy - this.dist)), f.kind === 'bridge' ? '#ff6a3a' : '#ffd27a', f.kind === 'bridge' ? 34 : 14);
          if (f.kind === 'bridge') { this.checkpoint = f.wy; this.announce('FIREWALL DOWN // CHECKPOINT', 70); }
        }
      }
      this.shots = this.shots.filter(b => !b.gone);
      this.foes = this.foes.filter(f => !f.gone);
      if (this.fuel <= 0) { this.announce('CELL EMPTY', 70); this.crash(); return; }
      if (this.dist >= this.length) { this.score += this.lives * 400; this.clearStage(); }
    }
    hud() { return {left: 'SKIMMERS ' + this.lives + '   CELL ' + Math.ceil(this.fuel * 100 / CELL) + '%', right: 'RUN ' + (this.stage + 1) + '/3',
      objective: 'Left/right steer · up throttles, down eases off · Z fires · skim CHG buoys to recharge · shoot each firewall bridge'}; }
    draw(c) {
      const G = A.Gfx, s = this.stage, tick = this.tickCount, d = this.dist;
      const tone = [['#0b2a3a', '#1d6f8a', '#3a7a4a'], ['#2a1a10', '#8a5a24', '#5a4a3a'], ['#1a1030', '#5a3aa0', '#2a4a5a']][s];
      // Water: a scrolling ripple tile under the banks.
      G.tile(c, 'canal-water:' + s, 640, 180, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 640, 0, [[0, G.shade(tone[0], -0.2)], [0.5, tone[0]], [1, G.shade(tone[0], -0.2)]]); ctx.fillRect(0, 0, 640, 180);
        for (let i = 0; i < 70; i++) { const h = G.hash(i * 13 + s); ctx.fillStyle = G.rgba(tone[1], 0.25 + (h % 4) / 10); ctx.fillRect(h % 640, (h >>> 8) % 180, 6 + h % 14, 1); }
      }, -(d % 180), true);
      // Banks as two polygons sampled every 24 screen px (plus the island).
      const left = [], right = [], isle = [];
      for (let sy = -24; sy <= 384; sy += 24) { const [l, r, isl] = this.banks(d + SHIP_Y - sy); left.push([l, sy]); right.push([r, sy]); isle.push([isl, sy]); }
      const quay = G.shade(tone[2], -0.35);
      c.fillStyle = quay; c.beginPath(); c.moveTo(0, -24); for (const [x, y] of left) c.lineTo(x, y); c.lineTo(0, 384); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(640, -24); for (const [x, y] of right) c.lineTo(x, y); c.lineTo(640, 384); c.closePath(); c.fill();
      if (isle.some(([w]) => w)) { c.beginPath(); for (const [w, y] of isle) c.lineTo(320 - w, y); for (let i = isle.length - 1; i >= 0; i--) c.lineTo(320 + isle[i][0], isle[i][1]); c.closePath(); c.fill(); }
      c.strokeStyle = G.rgba(tone[1], 0.9); c.lineWidth = 2;
      c.beginPath(); for (const [x, y] of left) c.lineTo(x, y); c.stroke();
      c.beginPath(); for (const [x, y] of right) c.lineTo(x, y); c.stroke();
      // Quayside towers with lit windows, anchored to world cells so they scroll with the banks.
      for (let cell = Math.floor((d - 60) / 90); cell < (d + 420) / 90; cell++) {
        const h = G.hash(cell * 7 + s * 101), wy = cell * 90, sy = SHIP_Y - (wy - d), [l, r] = this.banks(wy);
        const w = 26 + h % 22, tall = 30 + (h >>> 5) % 40;
        for (const [x0, room] of [[l - 16 - w, l - 16], [r + 16, 640 - r - 16]]) {
          if (room < w + 6) continue;
          D.rect(c, x0, sy - tall, w, tall, G.shade(tone[2], -0.6)); D.rect(c, x0, sy - tall, w, 2, G.rgba(tone[1], 0.8));
          for (let k = 0; k < 4; k++) if ((h >>> k) & 1) D.rect(c, x0 + 5 + k * 5, sy - tall + 8 + (k % 2) * 9, 3, 4, '#ffd98a');
        }
      }
      for (const f of this.foes) {
        const y = SHIP_Y - (f.wy - d), x = f.x; if (y < -30 || y > 390) continue;
        if (f.kind === 'bridge') {
          const [l, r] = this.banks(f.wy);
          D.rect(c, l - 30, y - 8, r - l + 60, 16, '#2a1a1a');
          for (let k = l; k < r; k += 12) D.rect(c, k, y - 6, 8, 12, (k + tick) % 24 < 12 ? '#ff5a3a' : '#ffb35c');
          G.glow(c, (l + r) / 2, y, (r - l) / 1.5, '#ff4a2a', 0.25 + 0.1 * Math.sin(tick * 0.2));
          D.text(c, 'FIREWALL ' + f.hp, (l + r) / 2, y - 12, '#ffd2b0', 9, 'center');
        } else if (f.kind === 'buoy') {
          G.glow(c, x, y, 16, '#7dff9b', 0.45); D.ellipse(c, x, y, 11, 11, '#1c4a2c'); D.ellipse(c, x, y, 8, 8, '#7dff9b'); D.text(c, 'CHG', x, y + 3, '#0c2414', 8, 'center');
        } else if (f.kind === 'barge') {
          D.rect(c, x - 18, y - 6, 36, 12, '#5a6878'); D.rect(c, x - 10, y - 9, 16, 6, '#9fb3c4'); D.rect(c, x + 12 * Math.sign(f.vx || 1), y - 2, 4, 4, '#ffcc66');
          D.line(c, x - 18, y + 7, x + 18, y + 7, G.rgba('#cfefff', 0.4), 2);
        } else if (f.kind === 'drone') D.drone(c, x, y, '#ff8a6a', false, tick + f.uid * 9);
        else { c.save(); c.translate(x, y); c.rotate(f.vx > 0 ? Math.PI / 2 : -Math.PI / 2); D.ship(c, 0, 0, '#ff6a8a', tick, false, 0.55); c.restore(); }
      }
      for (const b of this.shots) { const y = SHIP_Y - (b.wy - d); G.glow(c, b.x, y, 6, '#ffe08a', 0.6); D.rect(c, b.x - 1, y - 6, 3, 10, '#fff3c4'); }
      if (this.status !== 'lost' && this.inv % 8 < 5) { G.glow(c, this.x, SHIP_Y + 18, 14, '#7ff3ff', 0.4); D.ship(c, this.x, SHIP_Y, '#c8f4ff', tick + this.speed * 3, true, 0.6); }
      this.drawEffects(c);
      D.bar(c, 20, 343, 200, this.fuel, CELL, this.fuel < CELL / 4 ? '#ff6a6a' : '#7dff9b');
      D.bar(c, 420, 343, 200, d, this.length, '#7ff3ff');
    }
  };
  A.register({id: 'canal', title: 'Canal Cutter', subtitle: 'Keep the cell charged.', genre: 'RIVER-RUN SHOOTER', color: '#7ff3ff', number: '05',
    modes: ['extended'], inspiredBy: 'River Raid',
    controls: ['Left / right · steer', 'Up / down · throttle', 'Z · fire', 'Skim CHG buoys to recharge'],
    description: 'Three night runs up a forking canal. Throttle through the narrows, recharge at buoys and burn down every firewall bridge.'},
  () => new A.Canal());
})(globalThis.Arcade2);
