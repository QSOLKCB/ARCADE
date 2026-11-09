/* SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const E = A.Engine;
  Object.assign(A, {
    W: 640, H: 360, q: E.fromRatio, px: E.toNumber,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    sign: v => v < 0 ? -1 : v > 0 ? 1 : 0,
    empty: () => ({x: 0, y: 0, a: false, b: false, c: false, d: false,
      aPressed: false, bPressed: false, cPressed: false, dPressed: false, aReleased: false, aim: null}),
    registry: [],
  });
  const {q, px, clamp} = A;
  // Authoritative positions/velocities use Q16.16 pixels and pixels/tick, +Y down.
  // Convert only at rendering/input boundaries. Distances use bounded integer deltas.
  A.near = (a, b, r) => Math.abs(a.x - b.x) < q(r) && Math.abs(a.y - b.y) < q(r);
  A.approach = (value, target, speed) => value + clamp(target - value, -speed, speed);
  A.triangle = (tick, period, range) => {
    const phase = tick % period, half = period / 2;
    return E.mulDiv(phase < half ? phase : period - phase, range, half);
  };
  // Rule sets (v0.7.0). 'legacy' is the v0.6.0 game exactly: it adds no state
  // fields, consumes the same RNG and reproduces tests/arcade2-parity.test.cjs.
  // 'extended' lengthens stages and refines play; 'remix' adds one twist per cabinet.
  A.MODES = Object.freeze(['extended', 'remix', 'legacy']);
  A.rulesFor = mode => {
    const m = A.MODES.includes(mode) ? mode : 'legacy';
    return Object.freeze({mode: m, legacy: m === 'legacy', extended: m !== 'legacy', remix: m === 'remix'});
  };
  A.Game = class {
    constructor(id, seed = 731, mode = 'legacy') {
      Object.assign(this, {id, rng: seed >>> 0, tickCount: 0, stage: 0, status: 'playing',
        score: 0, hp: 100, maxHP: 100, message: '', messageTicks: 0, effects: [], events: [], inv: 0});
      // Non-enumerable, so it never enters serialised state or replay hashes.
      Object.defineProperty(this, 'rules', {value: A.rulesFor(mode), enumerable: false});
    }
    random(n) { this.rng = E.nextRandom(this.rng); return this.rng % n; }
    begin() {
      if (this.status !== 'playing') return false;
      this.tickCount++;
      if (this.inv) this.inv--;
      if (this.messageTicks) this.messageTicks--;
      for (const e of this.effects) { e.life--; e.x += e.vx; e.y += e.vy; }
      this.effects = this.effects.filter(e => e.life > 0);
      return true;
    }
    cancelInput() { if (Object.hasOwn(this, 'charge')) this.charge = 0; if (this.p) this.p.guard = false; }
    emit(name) { if (this.events.length < 8) this.events.push(name); }
    announce(text, duration = 100) { this.message = text; this.messageTicks = duration; }
    burst(x, y, color = '#ffb348', count = 12) {
      // Cosmetic values derive from tick/index, never consume gameplay RNG.
      for (let i = 0; i < count && this.effects.length < 96; i++) {
        const k = (i * 17 + this.tickCount * 7) % 31;
        this.effects.push({x, y, vx: q(k % 7 - 3, 2), vy: q((k * 3) % 7 - 3, 2), life: 18 + k, color});
      }
    }
    hurt(amount) {
      if (this.inv || this.status !== 'playing') return;
      this.hp = Math.max(0, this.hp - amount); this.inv = 50; this.emit('hurt');
      if (!this.hp) this.finish(false);
    }
    finish(won) {
      if (this.status !== 'playing') return;
      this.status = won ? 'won' : 'lost'; this.emit(won ? 'win' : 'lose');
    }
    clearStage(last = 2) {
      if (this.status !== 'playing') return;
      if (this.stage >= last) this.finish(true);
      else { this.status = 'stageclear'; this.emit('win'); }
    }
    next() {
      if (this.status !== 'stageclear') return;
      this.stage++; this.status = 'playing'; this.hp = Math.min(this.maxHP, this.hp + 25);
      this.effects = []; this.setup();
    }
    drawEffects(ctx, offset = 0) { A.Gfx.sparks(ctx, this.effects, offset); }
    hud() { return {left: 'HULL ' + this.hp, right: 'SECTOR ' + (this.stage + 1), objective: ''}; }
  };

  const D = A.Draw = {};
  D.rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  D.text = (c, text, x, y, color = '#f1f6ee', size = 12, align = 'left') => {
    c.fillStyle = color; c.font = `bold ${size}px monospace`; c.textAlign = align;
    c.fillText(String(text), Math.round(x), Math.round(y)); c.textAlign = 'left';
  };
  D.line = (c, x, y, xx, yy, color, width = 1) => {
    c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(xx, yy); c.stroke();
  };
  D.ellipse = (c, x, y, rx, ry, color) => { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
  D.bar = (c, x, y, w, value, max, color = '#bbf765') => {
    D.rect(c, x, y, w, 5, '#24323a'); D.rect(c, x, y, w * clamp(value / max, 0, 1), 5, color);
  };
  // Sprites, scenery and post effects live in gfx.js (presentation only).
  // create(mode) builds a fresh game; the default for players is 'extended'.
  A.register = (meta, factory) => A.registry.push(Object.freeze({...meta,
    modes: Object.freeze(['extended', 'remix', 'legacy']),
    create: (mode = 'extended') => factory(A.MODES.includes(mode) ? mode : 'extended')}));

  // Integer trigonometry. Ported from QSOLKCB/GALAXY retro/src/lib.rs (Apache-2.0):
  // 24-stage CORDIC over 32-bit binary angles (BAM), Q2.30 output. All values stay
  // below 2^31, and shifts are exact power-of-two floors, so results are integers on
  // every engine. A 1,024-step Q16.16 table is materialised once (OPT-FAN-001).
  const BAM_QUARTER = 0x40000000, BAM_HALF = 0x80000000, CORDIC_K_Q30 = 652032874;
  const CORDIC_ATAN_BAM = [536870912, 316933406, 167458907, 85004756, 42667331, 21354465,
    10679838, 5340245, 2670163, 1335087, 667544, 333772, 166886, 83443, 41722, 20861,
    10430, 5215, 2608, 1304, 652, 326, 163, 81];
  const floorShift = (v, i) => Math.floor(v / 2 ** i);
  A.sinCosQ30 = angle => {
    angle = angle >>> 0;
    let z = angle < BAM_HALF ? angle : angle - 2 ** 32, x = CORDIC_K_Q30, y = 0;
    if (z > BAM_QUARTER) { z -= BAM_HALF; x = -x; } else if (z < -BAM_QUARTER) { z += BAM_HALF; x = -x; }
    for (let i = 0; i < CORDIC_ATAN_BAM.length; i++) {
      const oldX = x;
      if (z >= 0) { x -= floorShift(y, i); y += floorShift(oldX, i); z -= CORDIC_ATAN_BAM[i]; }
      else { x += floorShift(y, i); y -= floorShift(oldX, i); z += CORDIC_ATAN_BAM[i]; }
    }
    return [x, y];
  };
  const STEPS = 1024, COS = new Int32Array(STEPS), SIN = new Int32Array(STEPS);
  for (let i = 0; i < STEPS; i++) { const [c, s] = A.sinCosQ30(i * 2 ** 22); COS[i] = floorShift(c, 14); SIN[i] = floorShift(s, 14); }
  A.Trig = Object.freeze({STEPS, cos: i => COS[((i % STEPS) + STEPS) % STEPS], sin: i => SIN[((i % STEPS) + STEPS) % STEPS]});
  // A (2,3) torus knot (trefoil), projected to the plane:
  // x = (2 + cos 3t) cos 2t, y = (2 + cos 3t) sin 2t, with x, y in [-3, 3].
  // The geometry follows QSOLKCB/GLUBALL's (2,3) knot laboratory (MPL-2.0); this is an
  // independent integer implementation of the public mathematics, not GLUBALL code.
  // Returns Q16.16 offsets scaled so |x| <= ax and |y| <= ay pixels.
  A.trefoil = (step, ax, ay) => {
    const T = A.Trig, r = 2 * 65536 + T.cos(3 * step);
    return [E.mulDiv(E.mulDiv(r, T.cos(2 * step), 65536), q(ax), 3 * 65536),
      E.mulDiv(E.mulDiv(r, T.sin(2 * step), 65536), q(ay), 3 * 65536)];
  };
})(globalThis.Arcade2);
