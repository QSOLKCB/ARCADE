/* SPDX-License-Identifier: Apache-2.0 */
// Hard Court Feud: original two-on-two street basketball where shoving is part of the
// game. Shoot, pass, turbo to the rim, and throw an elbow to knock the ball loose.
// Win the game against each of three rival crews; losing a game costs a credit.
(function (A) {
  'use strict';
  const {q, px, clamp, Draw: D} = A;
  const TOP = 222, BOTTOM = 330, LEFT = 40, RIGHT = 600, RIM_Z = 74, CLOCK = 4800;
  const HOOPS = [[66, 276], [574, 276]]; // [0] is the rivals' target, [1] is yours
  const CREWS = [
    {name: 'THE DOCKSIDE DUKES', colors: ['#ff8a5a', '#ffb35c'], speed: q(18, 10), shove: 44, aim: 0},
    {name: 'THE ROOFTOP RIOT', colors: ['#c88aff', '#ff7ad8'], speed: q(21, 10), shove: 26, aim: 9},
    {name: 'THE OVERTIME CLUB', colors: ['#ff5a6a', '#ffd96a'], speed: q(23, 10), shove: 18, aim: 15},
  ];
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y) * 2);
  A.Feud = class extends A.Game {
    constructor(mode = 'extended') { super('feud', 1212, mode); this.lives = 3; this.setup(); }
    setup() {
      const crew = CREWS[this.stage];
      const man = (team, i, x, y) => ({team, i, x: q(x), y: q(y), z: 0, vz: 0, face: team ? -1 : 1, stun: 0, cd: 0, shot: 0});
      this.men = [man(0, 0, 250, 300), man(0, 1, 230, 248), man(1, 0, 390, 300), man(1, 1, 410, 248)];
      Object.assign(this, {clock: CLOCK, scores: [0, 0], turbo: 100, turboOn: false, inv: 0, ball: null, pause: 90});
      this.giveBall(0);
      this.announce('VS ' + crew.name, 140);
    }
    get crew() { return CREWS[this.stage]; }
    giveBall(team) {
      // Possession restarts from the team's own back court.
      const [a, b] = team ? [2, 3] : [0, 1];
      Object.assign(this.men[a], {x: q(team ? 470 : 170), y: q(276), z: 0, vz: 0}); Object.assign(this.men[b], {x: q(team ? 420 : 220), y: q(236), z: 0, vz: 0});
      const [c, d] = team ? [0, 1] : [2, 3];
      Object.assign(this.men[c], {x: q(team ? 300 : 340), y: q(290), z: 0}); Object.assign(this.men[d], {x: q(team ? 320 : 320), y: q(244), z: 0});
      this.ball = {holder: a, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, flight: null, safe: 75};
    }
    holder() { return this.ball.holder >= 0 ? this.men[this.ball.holder] : null; }
    move(m, dx, dy, speed) {
      if (m.stun) return;
      m.x = clamp(m.x + dx * speed, q(LEFT), q(RIGHT)); m.y = clamp(m.y + E2(dy, speed), q(TOP), q(BOTTOM));
      if (dx) m.face = dx;
    }
    shoot(m) {
      const [hx, hy] = HOOPS[m.team ? 0 : 1], d = Math.abs(px(m.x) - hx) + Math.abs(px(m.y) - hy) * 2;
      const guard = this.men.some(o => o.team !== m.team && dist(o, m) < q(30) && !o.stun);
      const dunk = d < 56 && (m.team || this.turboOn);
      let chance = dunk ? 92 : d < 110 ? 74 : d < 200 ? 56 : 38;
      if (guard) chance -= 26;
      if (m.team) chance -= 6 - this.crew.aim;
      const made = this.random(100) < chance, value = d >= 200 ? 3 : 2;
      this.ball = {holder: -1, x: m.x, y: m.y, z: q(30), vx: 0, vy: 0, vz: 0, safe: 0,
        flight: {kind: dunk ? 'dunk' : 'shot', from: [m.x, m.y, q(30)], to: [q(hx), q(hy), q(RIM_Z)], t: 0, T: dunk ? 14 : 34 + (d / 10 | 0), made, value, team: m.team}};
      if (dunk) { m.vz = q(5); this.announce(m.team ? 'REJECTED THE D' : 'SLAM!', 40); }
      this.emit('shot');
    }
    pass(m) {
      const mate = this.men.find(o => o.team === m.team && o !== m);
      this.ball = {holder: -1, x: m.x, y: m.y, z: q(26), vx: 0, vy: 0, vz: 0, safe: 0, flight: {kind: 'pass', from: [m.x, m.y, q(26)], to: [mate.x, mate.y, q(26)], t: 0, T: 16, target: this.men.indexOf(mate)}};
    }
    shove(m) {
      // An elbow: stuns whoever is in reach and may knock a held ball loose. A ball carrier
      // can ride it out (tougher crews more often, and always just after an inbound);
      // a whiff leaves you slow to recover.
      if (m.cd || m.stun) return;
      m.cd = 50;
      for (const o of this.men) if (o.team !== m.team && !o.stun && dist(o, m) < q(28)) {
        m.cd = 34;
        const held = this.ball.holder === this.men.indexOf(o), keep = this.ball.safe ? 100 : o.team ? 50 + this.stage * 10 : 45;
        if (held && this.random(100) < keep) { o.cd = 0; this.burst(o.x, o.y - q(30), '#9fb3c4', 4); this.announce(o.team ? 'SHRUGGED IT OFF' : 'HELD ON', 30); continue; }
        o.stun = 46; this.emit('hurt'); this.burst(o.x, o.y - q(30), '#ffd27a', 8);
        if (held) { this.ball = {holder: -1, x: o.x, y: o.y, z: q(30), vx: (m.face || 1) * q(2), vy: 0, vz: q(3), flight: null, safe: 0}; this.emit('blast'); }
      }
    }
    tick(input) {
      if (!this.begin()) return;
      if (this.pause) { this.pause--; return; }
      const men = this.men, me = men[0], ball = this.ball;
      this.clock--;
      this.turboOn = input.c && this.turbo > 0;
      this.turbo = clamp(this.turbo + (this.turboOn ? -1 : 1), 0, 100);
      for (const m of men) { if (m.stun) m.stun--; if (m.cd) m.cd--; if (m.shot) m.shot--; m.vz -= q(1, 2); m.z = Math.max(0, m.z + m.vz); if (!m.z) m.vz = 0; }
      // You.
      this.move(me, input.x, input.y, this.turboOn ? q(16, 5) : q(2));
      if (ball.holder === 0) { if (input.aPressed) this.shoot(me); else if (input.bPressed) this.pass(me); }
      else if (input.bPressed) { if (ball.holder === 1) this.pass(men[1]); else this.shove(me); }
      // Your teammate and the rival crew.
      for (let k = 1; k < 4; k++) this.think(men[k], k);
      this.flyBall();
      if (this.clock <= 0 && this.ball.holder >= 0 && !this.ball.flight) this.endGame();
      else if (this.clock <= -240) this.endGame();
    }
    think(m, k) {
      const ball = this.ball, h = this.holder(), mate = this.men.find(o => o.team === m.team && o !== m), crew = this.crew;
      const speed = m.team ? crew.speed : q(18, 10), [hx, hy] = HOOPS[m.team ? 0 : 1];
      const go = (x, y, s = speed) => { const dx = x - m.x, dy = y - m.y; this.move(m, Math.abs(dx) > q(3) ? Math.sign(dx) : 0, Math.abs(dy) > q(3) ? Math.sign(dy) : 0, s); };
      if (h === m) {
        const d = Math.abs(px(m.x) - hx) + Math.abs(px(m.y) - hy) * 2, guarded = this.men.some(o => o.team !== m.team && !o.stun && dist(o, m) < q(26));
        if (m.shot === 0 && (d < 70 || (d < 210 && this.random(guarded ? 80 : 30) === 0))) { m.shot = 60; this.shoot(m); return; }
        if (guarded && this.random(m.team ? 50 : 30) === 0 && !mate.stun) { this.pass(m); return; }
        // Drive at the rim, sliding away from a defender in the lane.
        const block = this.men.find(o => o.team !== m.team && !o.stun && dist(o, m) < q(40));
        go(q(hx + (m.team ? 30 : -30)), block ? q(clamp(Math.round(px(m.y)) + (block.y > m.y ? -30 : 30), TOP, BOTTOM)) : q(hy));
        return;
      }
      if (h && h.team === m.team) {
        // Rival enforcers clear the way: they hunt whoever is hounding their ball carrier.
        const hound = m.team && this.men.find(o => o.team !== m.team && !o.stun && dist(o, h) < q(44));
        if (hound) { go(hound.x, hound.y); if (dist(m, hound) < q(28) && this.random(crew.shove) === 0) this.shove(m); return; }
        go(q(hx + (m.team ? 110 : -110)), q(k % 2 ? 240 : 312)); return;
      }
      if (ball.holder < 0 && !ball.flight) { const near = this.men.filter(o => !o.stun).sort((u, v) => dist(u, ball) - dist(v, ball)); if (near[0] === m || near[1] === m) go(ball.x, ball.y); return; }
      if (h) {
        // Defend: one man takes the ball, the other the open man.
        const mark = k % 2 ? h : this.men.find(o => o.team === h.team && o !== h);
        go(mark.x + q(m.team ? 18 : -18), mark.y);
        if (mark === h && m.team && dist(m, h) < q(28) && this.random(crew.shove) === 0) this.shove(m);
        if (mark === h && !m.team && dist(m, h) < q(28) && this.random(150) === 0) this.shove(m);
        return;
      }
      if (ball.flight && ball.flight.kind !== 'pass') go(q(hx + (m.team ? 40 : -40)), q(hy + (k % 2 ? -20 : 20)));
    }
    flyBall() {
      const b = this.ball, f = b.flight;
      if (b.holder >= 0) { if (b.safe) b.safe--; const h = this.men[b.holder]; b.x = h.x + q(h.face * 8); b.y = h.y; b.z = h.z + q(22); return; }
      if (f) {
        f.t++;
        const k = f.t, T = f.T, lerp = i => f.from[i] + Math.trunc((f.to[i] - f.from[i]) * k / T);
        b.x = lerp(0); b.y = lerp(1); b.z = lerp(2) + (f.kind === 'shot' ? Math.trunc(q(60) * 4 * k * (T - k) / (T * T)) : 0);
        if (k < T) return;
        b.flight = null;
        if (f.kind === 'pass') {
          const to = this.men[f.target];
          // A rival standing on the lane picks the pass off.
          const thief = this.men.find(o => o.team !== to.team && !o.stun && dist(o, to) < q(14));
          b.holder = this.men.indexOf(thief || to); return;
        }
        if (f.made) {
          this.scores[f.team] += f.value; this.score += f.team ? 0 : f.value * 100; this.emit(f.team ? 'hurt' : 'win');
          this.burst(b.x, b.y - b.z, f.team ? '#ff8a6a' : '#c2f874', 18);
          this.announce((f.team ? 'RIVALS ' : '') + '+' + f.value + (f.value === 3 ? ' FROM DOWNTOWN' : ''), 50);
          this.pause = 30; this.giveBall(f.team ? 0 : 1); return;
        }
        // A miss caroms off the rim.
        b.vx = (this.random(2) ? 1 : -1) * q(1 + this.random(2)); b.vy = q(this.random(3) - 1); b.vz = q(2);
        return;
      }
      b.vz -= q(1, 4); b.x = clamp(b.x + b.vx, q(LEFT), q(RIGHT)); b.y = clamp(b.y + b.vy, q(TOP), q(BOTTOM)); b.z += b.vz;
      if (b.z <= 0) { b.z = 0; b.vz = Math.trunc(-b.vz / 2); b.vx = Math.trunc(b.vx * 3 / 4); b.vy = Math.trunc(b.vy * 3 / 4); }
      if (b.z < q(34)) for (let i = 0; i < 4; i++) { const m = this.men[i]; if (!m.stun && dist(m, b) < q(14)) { b.holder = i; b.vx = b.vy = b.vz = 0; this.emit('pickup'); break; } }
    }
    endGame() {
      const [mine, theirs] = this.scores;
      if (mine > theirs) { this.score += (mine - theirs) * 50 + 1000; this.clearStage(); return; }
      this.lives--; this.emit('lose');
      if (this.lives <= 0) { this.finish(false); return; }
      this.setup(); this.announce('REMATCH // ' + this.crew.name, 120);
    }
    hud() { const t = Math.max(0, Math.ceil(this.clock / 60)); return {left: 'YOU ' + this.scores[0] + ' — ' + this.scores[1] + ' RIVALS   ' + (t / 60 | 0) + ':' + String(t % 60).padStart(2, '0'),
      right: 'GAME ' + (this.stage + 1) + '/3  CREDITS ' + this.lives,
      objective: 'Z shoots · X passes, or throws an elbow on defence · hold Space for turbo (dunk from close) · lead at the buzzer'}; }
    draw(c) {
      const G = A.Gfx, s = this.stage, tick = this.tickCount, crew = this.crew;
      G.layer(c, 'feud-arena:' + s, 640, 360, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 220, [[0, '#06070c'], [1, ['#1a1220', '#10182a', '#20100e'][s]]]); ctx.fillRect(0, 0, 640, 222);
        for (let i = 0; i < 520; i++) { const h = G.hash(i * 7 + s * 13), y = 60 + (h >>> 10) % 150; ctx.fillStyle = G.rgba(['#ffd2a0', '#a0c8ff', '#ffa0c8', '#c2f874'][h % 4], 0.25 + y / 600); ctx.fillRect(h % 640, y, 3, 4); }
        for (const x of [120, 320, 520]) { ctx.fillStyle = G.radial(ctx, x, 20, 2, 120, [[0, 'rgba(255,250,220,0.5)'], [1, 'rgba(255,250,220,0)']]); ctx.fillRect(x - 120, 0, 240, 200); }
        ctx.fillStyle = G.linear(ctx, 0, TOP - 8, 0, 360, [[0, '#7a4a2a'], [1, '#c88a52']]);
        ctx.beginPath(); ctx.moveTo(30, TOP - 8); ctx.lineTo(610, TOP - 8); ctx.lineTo(640, 360); ctx.lineTo(0, 360); ctx.closePath(); ctx.fill();
        for (let x = 0; x < 640; x += 24) { ctx.strokeStyle = 'rgba(60,30,10,0.25)'; ctx.beginPath(); ctx.moveTo(30 + x * 0.9, TOP - 8); ctx.lineTo(x, 360); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
        ctx.strokeRect(LEFT, TOP - 4, RIGHT - LEFT, BOTTOM - TOP + 12); ctx.beginPath(); ctx.moveTo(320, TOP - 4); ctx.lineTo(320, BOTTOM + 8); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(320, 276, 34, 18, 0, 0, Math.PI * 2); ctx.stroke();
        for (const [hx, side] of [[66, 1], [574, -1]]) { ctx.beginPath(); ctx.ellipse(hx, 276, 200, 62, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2, side > 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke(); ctx.fillStyle = 'rgba(200,60,40,0.35)'; ctx.fillRect(side > 0 ? hx - 26 : hx - 70, 254, 96, 44); }
        ctx.fillStyle = G.rgba(crew.colors[0], 0.9); ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(crew.name, 320, 48);
      });
      const drawHoop = ([hx, hy], side) => {
        D.rect(c, hx - side * 18 - 2, hy - RIM_Z - 70, 4, 80, '#8a98a6'); D.rect(c, hx - side * 14 - 2, hy - RIM_Z - 40, 4, 30, '#e8eef4');
        D.rect(c, hx - side * 14 - 2, hy - RIM_Z - 40, 4, 4, '#ff5a3a');
        c.strokeStyle = '#ff6a3a'; c.lineWidth = 2; c.beginPath(); c.ellipse(hx, hy - RIM_Z, 10, 3, 0, 0, Math.PI * 2); c.stroke();
        for (let k = -8; k <= 8; k += 4) D.line(c, hx + k, hy - RIM_Z + 1, hx + k * 0.6, hy - RIM_Z + 14, 'rgba(255,255,255,0.7)', 1);
        D.rect(c, hx - side * 18 - 6, hy - 2, 12, 6, '#2a3442');
      };
      drawHoop(HOOPS[0], 1); drawHoop(HOOPS[1], -1);
      const order = this.men.map((m, i) => i).sort((u, v) => this.men[u].y - this.men[v].y);
      const b = this.ball;
      for (const i of order) {
        const m = this.men[i], x = px(m.x), y = px(m.y), z = px(m.z);
        const color = m.team ? crew.colors[m.i] : ['#7fe3e0', '#c2f874'][m.i];
        G.shadow(c, x, y + 1, 12, 3);
        D.person(c, x, y - z, m.stun ? '#9aa4b0' : color, m.face, m.stun ? 0 : tick, 'trooper', 2, m.cd > 24);
        if (m.stun) D.text(c, '*', x, y - z - 34 + (tick % 10 < 5 ? 0 : 2), '#ffd27a', 12, 'center');
        if (i === 0) { G.glow(c, x, y + 2, 16, '#7fe3e0', 0.35); D.text(c, 'YOU', x, y - z - 36, '#7fe3e0', 9, 'center'); }
      }
      const bx = px(b.x), by = px(b.y), bz = px(b.z);
      G.shadow(c, bx, by + 1, 5, 2, 0.4); G.glow(c, bx, by - bz, 10, '#ff9a4a', 0.4);
      D.ellipse(c, bx, by - bz, 5, 5, '#e8762a'); D.line(c, bx - 5, by - bz, bx + 5, by - bz, '#5a2a0a', 1);
      this.drawEffects(c);
      D.rect(c, 240, 6, 160, 22, '#05080dcc'); D.text(c, this.scores[0] + '  :  ' + this.scores[1], 320, 22, '#f1f6ee', 14, 'center');
      D.bar(c, 20, 343, 120, this.turbo, 100, '#ffd27a');
    }
  };
  // Fixed-point lateral speed: court depth moves at 70% of the across-court speed.
  const E2 = (dy, speed) => dy * Math.trunc(speed * 7 / 10);
  A.register({id: 'feud', title: 'Hard Court Feud', subtitle: 'No refs. No mercy.', genre: '2-ON-2 BRAWL BALL', color: '#ffb35c', number: '08',
    modes: ['extended'], inspiredBy: 'Arch Rivals',
    controls: ['Move', 'Z · shoot', 'X · pass / elbow on defence', 'Space · turbo'],
    description: 'Two-on-two with elbows. Beat three rival crews; each game you lose costs a credit.'},
  () => new A.Feud());
})(globalThis.Arcade2);
