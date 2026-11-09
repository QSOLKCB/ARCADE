/* SPDX-License-Identifier: Apache-2.0 */
// Knockout Circuit: original behind-the-boxer boxing. Read each rival's tell, slip or
// duck the punch, then counter into the opening. Pick body or head around their guard
// and cash a full power meter for a haymaker. Three knockdowns win a bout.
(function (A) {
  'use strict';
  const {q, clamp, Draw: D} = A;
  // How each punch is beaten: which defences avoid it, and whether a high guard blocks it.
  const MOVES = {
    hookL: {avoid: ['right', 'duck'], label: 'LEFT HOOK', dmg: 16},
    hookR: {avoid: ['left', 'duck'], label: 'RIGHT HOOK', dmg: 16},
    upper: {avoid: ['left', 'right'], label: 'UPPERCUT', dmg: 22},
    jab: {avoid: ['left', 'right', 'guard'], label: 'JAB', dmg: 8},
    body: {avoid: ['left', 'right'], label: 'BODY SHOT', dmg: 12},
  };
  const RIVALS = [
    {name: 'BRICK BELLAMY', from: 'Harbour Ward', skin: '#c88a5a', trunks: '#ff6a3a', hp: 120, tell: 44, open: 44, rest: 70, guard: ['high', 'low'],
      pattern: ['hookL', 'jab', 'hookR', 'body', 'hookL', 'upper']},
    {name: 'VOLTA VEX', from: 'The Switchyard', skin: '#e8b48b', trunks: '#5ad8ff', hp: 140, tell: 34, open: 36, rest: 56, guard: ['high', 'low', 'high'],
      pattern: ['jab', 'jab', 'upper', 'hookR', 'body', 'jab', 'hookL'], combo: 2},
    {name: 'MADAME MOTH', from: 'Lantern Row', skin: '#d8a070', trunks: '#c88aff', hp: 150, tell: 28, open: 32, rest: 48, guard: ['low', 'high', 'both'],
      pattern: ['hookR', 'hookL', 'body', 'upper', 'jab', 'hookR', 'upper'], combo: 3},
    {name: 'THE IRON ABBOT', from: 'Old Foundry', skin: '#9a6a4a', trunks: '#ffd96a', hp: 170, tell: 24, open: 28, rest: 42, guard: ['both', 'high', 'low'],
      pattern: ['upper', 'body', 'hookL', 'hookR', 'jab', 'upper', 'body', 'hookL'], combo: 3},
  ];
  const CLOCK = 3 * 60 * 60;
  A.Knockout = class extends A.Game {
    constructor(mode = 'extended') { super('knockout', 4242, mode); this.lives = 3; this.setup(); }
    setup() {
      const r = this.rival;
      this.p = {state: 'idle', t: 0, punch: null, hp: 100, meter: 0, streak: 0};
      this.r = {state: 'intro', t: 120, attack: null, guard: r.guard[0], hp: r.hp, downs: 0, step: 0, combo: 0, flinch: 0, gi: 0};
      Object.assign(this, {clock: CLOCK, landed: 0});
      this.announce(r.name + ' // ' + r.from.toUpperCase(), 140);
    }
    get rival() { return RIVALS[this.stage]; }
    defence() { const s = this.p.state; return s === 'dodgeL' ? 'left' : s === 'dodgeR' ? 'right' : s === 'duck' ? 'duck' : s === 'guard' ? 'guard' : null; }
    tick(input) {
      if (!this.begin()) return;
      const p = this.p, r = this.r, R = this.rival;
      if (r.flinch) r.flinch--;
      if (r.state !== 'down' && r.state !== 'intro') this.clock--;
      // The boxer: dodges and ducks commit for a moment; punches commit until they land.
      if (p.t) p.t--;
      if (p.t === 0 && p.state !== 'idle' && p.state !== 'guard' && p.state !== 'duck') p.state = 'idle';
      if (p.state === 'duck' && input.y <= 0 && p.t === 0) p.state = 'idle';
      if (p.state === 'idle' || p.state === 'guard') {
        p.state = input.y < 0 ? 'guard' : 'idle';
        if (input.x < 0) Object.assign(p, {state: 'dodgeL', t: 22});
        else if (input.x > 0) Object.assign(p, {state: 'dodgeR', t: 22});
        else if (input.y > 0) Object.assign(p, {state: 'duck', t: 16});
        else if (input.cPressed && p.meter >= 100) Object.assign(p, {state: 'punch', t: 18, punch: 'super', meter: 0});
        else if (input.aPressed) Object.assign(p, {state: 'punch', t: 11, punch: 'body'});
        else if (input.bPressed) Object.assign(p, {state: 'punch', t: 11, punch: 'head'});
      }
      if (p.state === 'punch' && p.t === (p.punch === 'super' ? 8 : 5)) this.land(p.punch);
      // The rival.
      if (r.t) r.t--;
      if (r.state === 'intro' && !r.t) Object.assign(r, {state: 'idle', t: R.rest});
      else if (r.state === 'idle' && !r.t) {
        r.attack = R.pattern[r.step++ % R.pattern.length];
        r.combo = R.combo && this.random(3) === 0 ? R.combo - 1 : 0;
        Object.assign(r, {state: 'tell', t: R.tell});
      } else if (r.state === 'tell' && !r.t) this.strike();
      else if (r.state === 'recover' && !r.t) {
        if (r.combo > 0) { r.combo--; r.attack = R.pattern[r.step++ % R.pattern.length]; Object.assign(r, {state: 'tell', t: Math.max(14, R.tell - 12)}); }
        else Object.assign(r, {state: 'idle', t: R.rest + this.random(30), guard: R.guard[r.gi++ % R.guard.length]});
      } else if (r.state === 'open' && !r.t) Object.assign(r, {state: 'idle', t: R.rest, guard: R.guard[r.gi++ % R.guard.length]});
      else if (r.state === 'down' && !r.t) {
        if (r.downs >= 3) { this.score += 5000 + this.lives * 1000 + Math.trunc(this.clock / 60) * 20; this.clearStage(RIVALS.length - 1); return; }
        Object.assign(r, {state: 'idle', t: R.rest, hp: Math.trunc(R.hp * [100, 75, 55][r.downs] / 100)}); this.announce('UP AT NINE!', 50);
      }
      if (this.clock <= 0 && this.status === 'playing') this.decision();
    }
    strike() {
      const p = this.p, r = this.r, move = MOVES[r.attack], def = this.defence();
      if (def && move.avoid.includes(def) && !(def === 'guard' && r.attack !== 'jab')) {
        if (def === 'guard') { Object.assign(r, {state: 'recover', t: 16}); this.emit('shot'); return; }
        // A clean slip or duck: the rival over-commits and is wide open.
        p.meter = Math.min(100, p.meter + 10);
        Object.assign(r, {state: 'open', t: this.rival.open, combo: 0}); this.emit('pickup');
        return;
      }
      p.hp = Math.max(0, p.hp - move.dmg - this.stage * 2); p.meter = 0; p.streak = 0;
      Object.assign(p, {state: 'hurt', t: 18}); this.emit('hurt'); this.burst(q(320), q(250), '#ff6a6a', 12);
      Object.assign(r, {state: 'recover', t: 22});
      if (p.hp <= 0) {
        this.lives--; this.announce(this.lives > 0 ? 'DOWN! ... AND BACK UP' : 'COUNTED OUT', 90);
        if (this.lives <= 0) { this.finish(false); return; }
        Object.assign(p, {hp: 70, state: 'hurt', t: 90}); Object.assign(r, {state: 'idle', t: 140, combo: 0});
      }
    }
    land(kind) {
      const r = this.r, p = this.p;
      if (r.state === 'down' || r.state === 'intro') return;
      const open = r.state === 'open', guard = r.state === 'idle' || r.state === 'recover' ? r.guard : 'none';
      const blocked = !open && kind !== 'super' && (guard === 'both' || (guard === 'high' && kind === 'head') || (guard === 'low' && kind === 'body'));
      if (blocked) {
        this.emit('shot'); p.streak = 0;
        // Pound on a guard and the rival punishes it.
        if (r.state === 'idle' && r.t > 12 && this.random(3) === 0) r.t = 12;
        return;
      }
      const dmg = kind === 'super' ? 34 : (kind === 'head' ? 7 : 6) * (open ? 2 : 1);
      r.hp -= dmg; r.flinch = 8; p.streak++; this.score += dmg * 10; this.emit('blast');
      this.burst(q(320), q(kind === 'body' ? 170 : 120), kind === 'super' ? '#ffd27a' : '#fff3c4', kind === 'super' ? 30 : 8);
      if (open) p.meter = Math.min(100, p.meter + 12);
      // Three clean shots in a row and the rival covers up where you have been hitting.
      if (!open && p.streak >= 3 && r.state === 'idle') { r.guard = kind === 'head' ? 'high' : 'low'; p.streak = 0; }
      if (r.hp <= 0) {
        r.downs++; Object.assign(r, {state: 'down', t: r.downs >= 3 ? 150 : 200, hp: 0, combo: 0}); this.emit('win');
        this.announce(r.downs >= 3 ? 'KNOCKOUT!' : 'DOWN! ' + r.downs + ' OF 3', 120);
        Object.assign(p, {state: 'idle', t: 0, hp: Math.min(100, p.hp + 20)});
      }
    }
    decision() {
      this.lives--; this.announce('TIME // DECISION GOES TO ' + this.rival.name, 120); this.emit('lose');
      if (this.lives <= 0) { this.finish(false); return; }
      this.setup();
    }
    hud() { const t = Math.max(0, Math.ceil(this.clock / 60)); return {left: 'GUTS ' + this.lives + '   ' + (t / 60 | 0) + ':' + String(t % 60).padStart(2, '0'),
      right: 'BOUT ' + (this.stage + 1) + '/' + RIVALS.length + '  DOWNS ' + this.r.downs + '/3',
      objective: 'Left/right slip · down ducks · up guards jabs · Z body · X head · Space haymaker at full power'}; }
    draw(c) {
      const G = A.Gfx, s = this.stage, tick = this.tickCount, p = this.p, r = this.r, R = this.rival;
      G.layer(c, 'knockout-arena:' + s, 640, 360, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 360, [[0, '#05060c'], [0.55, ['#1a1030', '#0e1a2a', '#200e1a', '#1a1408'][s]], [1, '#05060c']]); ctx.fillRect(0, 0, 640, 360);
        for (let i = 0; i < 700; i++) { const h = G.hash(i * 11 + s * 3), y = 40 + (h >>> 10) % 150; ctx.fillStyle = G.rgba(['#ffd2a0', '#a0c8ff', '#ffa0c8', '#e8e8e8'][h % 4], 0.12 + y / 900); ctx.fillRect(h % 640, y, 3, 3); }
        for (const x of [160, 480]) { ctx.fillStyle = G.linear(ctx, x, 0, 320, 300, [[0, 'rgba(255,250,220,0.22)'], [1, 'rgba(255,250,220,0)']]); ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(420, 320); ctx.lineTo(220, 320); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = G.linear(ctx, 0, 220, 0, 360, [[0, '#3a4a6a'], [1, '#1a2234']]); ctx.beginPath(); ctx.moveTo(60, 220); ctx.lineTo(580, 220); ctx.lineTo(640, 360); ctx.lineTo(0, 360); ctx.closePath(); ctx.fill();
        for (const [y, col] of [[150, '#ff5a6a'], [178, '#f1f6ee'], [206, '#5a8aff']]) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(580, y); ctx.stroke(); }
        for (const x of [60, 580]) { ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x - 5, 130, 10, 100); }
      });
      // The rival, facing you. Pose follows state: guard, tell, strike, open, down.
      const shake = r.flinch ? (tick % 2 ? 3 : -3) : 0, bob = Math.round(Math.sin(tick * 0.08) * 3);
      let cx = 320 + shake, cy = 150 + bob, lean = 0;
      if (r.state === 'tell') { lean = r.attack === 'hookL' ? -16 : r.attack === 'hookR' ? 16 : 0; cy += r.attack === 'upper' ? 10 : r.attack === 'body' ? 6 : 0; }
      if (r.state === 'down') {
        G.shadow(c, 320, 238, 90, 10, 0.5);
        D.ellipse(c, 320, 228, 80, 16, R.trunks); D.ellipse(c, 250, 226, 18, 14, R.skin); D.ellipse(c, 392, 230, 16, 12, '#c8302a');
        D.text(c, String(Math.min(10, 1 + Math.trunc((200 - r.t) / 18))), 320, 110, '#ffd27a', 40, 'center');
      } else {
        const tone = r.state === 'tell' && tick % 6 < 3 ? '#fff0c8' : R.skin;
        G.shadow(c, cx, 240, 70, 10, 0.5);
        D.rect(c, cx - 40, cy + 70, 80, 40, R.trunks); D.rect(c, cx - 40, cy + 70, 80, 6, G.shade(R.trunks, 0.3));
        c.fillStyle = G.linear(c, cx - 60, 0, cx + 60, 0, [[0, G.shade(R.skin, -0.35)], [0.5, R.skin], [1, G.shade(R.skin, -0.35)]]);
        c.beginPath(); c.moveTo(cx - 62 + lean, cy + 2); c.lineTo(cx + 62 + lean, cy + 2); c.lineTo(cx + 42, cy + 74); c.lineTo(cx - 42, cy + 74); c.closePath(); c.fill();
        D.ellipse(c, cx + lean, cy - 18, 26, 30, tone); D.rect(c, cx - 12 + lean, cy - 24, 8, 4, '#1a1010'); D.rect(c, cx + 4 + lean, cy - 24, 8, 4, '#1a1010');
        if (r.state === 'open') { D.text(c, '@ @', cx + lean, cy - 18, '#1a1010', 10, 'center'); for (let k = 0; k < 3; k++) D.text(c, '*', cx - 30 + k * 30 + Math.sin(tick * 0.2 + k) * 8, cy - 56, '#ffd27a', 14, 'center'); }
        // Gloves.
        const arm = G.shade(R.skin, -0.2);
        const glove = (gx, gy, big = 1) => {
          // Upper arm from the near shoulder, then the glove.
          const sx = cx + lean + (gx < cx + lean ? -48 : 48), sy = cy + 12;
          D.line(c, sx, sy, gx, gy, arm, 15 * Math.min(big, 1.4)); D.ellipse(c, sx, sy, 10, 10, arm);
          G.glow(c, gx, gy, 18 * big, '#ff4a3a', 0.25); D.ellipse(c, gx, gy, 17 * big, 15 * big, '#c8302a'); D.ellipse(c, gx - 4 * big, gy - 5 * big, 6 * big, 4 * big, '#ff8a7a');
        };
        if (r.state === 'recover' && r.attack) {
          const side = r.attack === 'hookL' ? -1 : r.attack === 'hookR' ? 1 : 0;
          glove(cx + side * 40, cy + 70 + (r.attack === 'upper' ? -30 : 0), 2.2); glove(cx - side * 30 + (side ? 0 : 36), cy + 10);
        } else if (r.state === 'tell') {
          const back = r.attack === 'hookL' ? [-78, -4] : r.attack === 'hookR' ? [78, -4] : r.attack === 'upper' ? [-40, 70] : r.attack === 'body' ? [40, 60] : [-30, -6];
          glove(cx + back[0] + lean, cy + back[1]); glove(cx - back[0] / 3 + lean, cy - 6);
          G.glow(c, cx + back[0] + lean, cy + back[1], 30, '#ffd27a', 0.3 + 0.3 * Math.sin(tick * 0.5));
        } else if (r.state === 'open') { glove(cx - 50, cy + 66); glove(cx + 50, cy + 66); }
        else if (r.guard === 'high') { glove(cx - 22, cy - 14); glove(cx + 22, cy - 14); }
        else if (r.guard === 'low') { glove(cx - 24, cy + 44); glove(cx + 24, cy + 44); }
        else { glove(cx - 22, cy - 10); glove(cx + 24, cy + 46); }
      }
      // You, from behind.
      const px0 = 320 + (p.state === 'dodgeL' ? -86 : p.state === 'dodgeR' ? 86 : 0), py0 = 300 + (p.state === 'duck' ? 34 : p.state === 'hurt' ? 8 : 0);
      c.save(); c.globalAlpha = 0.92;
      c.fillStyle = G.linear(c, px0 - 70, 0, px0 + 70, 0, [[0, '#5a3a2a'], [0.5, '#a07050'], [1, '#5a3a2a']]);
      c.beginPath(); c.moveTo(px0 - 74, py0 + 70); c.lineTo(px0 - 58, py0 - 4); c.lineTo(px0 + 58, py0 - 4); c.lineTo(px0 + 74, py0 + 70); c.closePath(); c.fill();
      D.ellipse(c, px0, py0 - 26, 22, 26, '#3a2418'); D.rect(c, px0 - 14, py0 - 4, 28, 10, '#a07050');
      const punching = p.state === 'punch', reach = punching ? (p.punch === 'super' ? 70 : 52) : 0, high = p.punch === 'head' || p.punch === 'super';
      const pg = (gx, gy, big) => {
        const sx = px0 + (gx < px0 ? -50 : 50), sy = py0 + 4;
        D.line(c, sx, sy, gx, gy, '#8a5a3a', 16); D.ellipse(c, gx, gy, 18 * big, 16 * big, '#2a8a5a'); D.ellipse(c, gx - 4, gy - 5, 7 * big, 4 * big, '#7affb0');
      };
      if (punching) { pg(px0 + 40, py0 - reach - (high ? 50 : 0), p.punch === 'super' ? 1.5 : 1.1); pg(px0 - 52, py0 - 10, 1); }
      else if (p.state === 'guard') { pg(px0 - 26, py0 - 46, 1.1); pg(px0 + 26, py0 - 46, 1.1); }
      else { pg(px0 - 54, py0 - 14, 1); pg(px0 + 54, py0 - 14, 1); }
      c.restore();
      if (r.state === 'tell') D.text(c, MOVES[r.attack].label, 320, 80, '#ffd27a', 12, 'center');
      // Bars: you, rival, power.
      D.text(c, 'YOU', 20, 40, '#7affb0', 10); D.bar(c, 20, 46, 200, p.hp, 100, '#7affb0');
      D.text(c, R.name, 620, 40, R.trunks, 10, 'right'); D.bar(c, 420, 46, 200, Math.max(0, r.hp), R.hp, R.trunks);
      for (let k = 0; k < 3; k++) D.ellipse(c, 590 + k * 12, 60, 4, 4, k < r.downs ? '#ffd27a' : '#2a3442');
      D.text(c, 'POWER', 20, 334, '#ffd27a', 10); D.bar(c, 70, 328, 150, p.meter, 100, p.meter >= 100 && tick % 20 < 10 ? '#ffffff' : '#ffd27a');
      this.drawEffects(c);
    }
  };
  A.register({id: 'knockout', title: 'Knockout Circuit', subtitle: 'Read the tell. Make them pay.', genre: 'BOXING', color: '#7affb0', number: '09',
    modes: ['extended'], inspiredBy: 'Super Punch-Out!!',
    controls: ['Left / right · slip  ·  down · duck', 'Up · guard (stops jabs)', 'Z · body  ·  X · head', 'Space · haymaker at full power'],
    description: 'Four rivals, each with tells to learn. Slip and duck to open them up, hit around the guard, and put each one down three times.'},
  () => new A.Knockout());
})(globalThis.Arcade2);
