/* Copyright 2026 QSOL-IMC contributors. SPDX-License-Identifier: Apache-2.0 */
(function (root) {
  'use strict';
  const A = root.Arcade = root.Arcade || {};
  A.W = 480; A.H = 270; A.STEP = 1 / 60;
  A.clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  A.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  A.unit = (x, y) => { const n = Math.hypot(x, y); return n ? { x: x / n, y: y / n } : { x: 0, y: 0 }; };
  A.rng = function (seed) {
    let s = seed >>> 0;
    return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };
  A.inside = (p, r, pad = 0) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
  A.move = function (p, dx, dy, walls, width, height, radius = 6) {
    const blocked = () => walls.some(r => A.inside(p, r, radius));
    const ox = p.x; p.x = A.clamp(p.x + dx, radius, width - radius); if (blocked()) p.x = ox;
    const oy = p.y; p.y = A.clamp(p.y + dy, radius, height - radius); if (blocked()) p.y = oy;
  };
  A.emptyInput = () => ({ x: 0, y: 0, fire: false, special: false, jump: false, interact: false, specialPressed: false, jumpPressed: false, interactPressed: false, aim: null });
  A.safeScore = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.min(99999999, Math.floor(n)) : 0;
  A.Storage = class {
    constructor(storage) { this.storage = storage; }
    read(key, fallback) { try { const raw = this.storage.getItem('qsol.arcade.' + key); return raw === null ? fallback : JSON.parse(raw); } catch (_) { return fallback; } }
    write(key, value) { try { this.storage.setItem('qsol.arcade.' + key, JSON.stringify(value)); } catch (_) { /* Private browsing is playable. */ } }
    best(id, mode, score) { const key = 'best.' + id + '.' + mode; const old = A.safeScore(this.read(key, 0)); if (score !== undefined && A.safeScore(score) > old) { this.write(key, A.safeScore(score)); return A.safeScore(score); } return old; }
  };
  A.Particles = class {
    constructor() { this.items = []; this.rand = A.rng(8801); }
    burst(x, y, color, count = 12, speed = 60, style = {}) { for (let i = 0; i < count && this.items.length < 220; i++) { const a = this.rand() * Math.PI * 2, v = speed * (.3 + this.rand()); this.items.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .3 + this.rand() * .4, color, size: 2, gravity: 0, ...style }); } }
    update(dt) { for (const p of this.items) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy = p.vy * .96 + p.gravity * dt; } this.items = this.items.filter(p => p.life > 0); }
    draw(c) { for (const p of this.items) { c.globalAlpha = Math.min(1, p.life * 3); c.fillStyle = p.color; c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); } c.globalAlpha = 1; }
  };
  // Presentation has its own bounded pool and never consumes simulation randomness.
  A.Effects = class {
    constructor() { this.items = []; }
    add(kind, x, y, color = '#ffe0a2', radius = 28, duration = .4, face = 1) {
      if (this.items.length >= 32) this.items.shift();
      this.items.push({kind, x, y, color, radius, duration, life: duration, face});
    }
    update(dt) { for (const e of this.items) e.life -= dt; this.items = this.items.filter(e => e.life > 0); }
    draw(c) {
      for (const e of this.items) {
        const t = 1 - e.life / e.duration, r = e.radius * (.2 + t * .8);
        c.save(); c.translate(e.x, e.y); c.globalAlpha = (1 - t) * .85;
        c.strokeStyle = e.color; c.fillStyle = e.color; c.lineWidth = Math.max(1, 4 * (1 - t));
        if (e.kind === 'slash') {
          c.scale(e.face, 1); c.rotate(-.45 + t * .7); c.beginPath(); c.arc(0, 0, e.radius, -1.3, 1.3); c.stroke();
          c.globalAlpha *= .3; c.beginPath(); c.arc(-4, 0, e.radius - 5, -1.3, 1.3); c.stroke();
        } else if (e.kind === 'storm') {
          c.beginPath(); c.ellipse(0, 16, r, r * .24, 0, 0, Math.PI * 2); c.stroke();
          for (let i = 0; i < 5; i++) { const x = Math.sin(i * 7 + t * 8) * r; c.beginPath(); c.moveTo(x, 16); c.lineTo(x + 10, -10 - r * .25); c.lineTo(x - 4, -24 - r * .4); c.lineTo(x + 5, -40 - r * .5); c.stroke(); }
        } else {
          c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
          if (e.kind === 'blast' && t < .45) { c.globalAlpha *= .5; c.beginPath(); c.arc(0, 0, r * .8, 0, Math.PI * 2); c.fill(); }
        }
        c.restore();
      }
    }
  };
  A.Game = class {
    constructor(options = {}, sound = () => {}) { this.options = { players: 1, difficulty: 'arcade', ...options }; this.sound = sound; this.score = 0; this.time = 0; this.state = 'briefing'; this.particles = new A.Particles(); this.effects = new A.Effects(); this.message = ''; this.messageTime = 0; this.shake = 0; }
    say(text, time = 3) { this.message = text; this.messageTime = time; }
    common(dt) { this.time += dt; this.messageTime = Math.max(0, this.messageTime - dt); this.shake = Math.max(0, this.shake - dt); this.particles.update(dt); this.effects.update(dt); }
    hitPlayer(p, damage) { if (p.hp <= 0 || p.inv > 0 || p.z > 12) return false; p.hp = Math.max(0, p.hp - damage); p.inv = 1.2; this.shake = .14; this.particles.burst(p.x, p.y, '#ffce92', 9); this.sound('hurt'); return true; }
    finish(won) { if (this.state === 'victory' || this.state === 'gameover') return; this.state = won ? 'victory' : 'gameover'; this.sound(won ? 'win' : 'lose'); }
    get relaxed() { return this.options.difficulty === 'relaxed'; }
  };
  // One bounded accumulator shared by the browser loop and timing tests.
  A.Clock = class {
    constructor() { this.accumulator = 0; }
    advance(seconds, tick) { this.accumulator += A.clamp(seconds, 0, .1); let steps = 0; while (this.accumulator >= A.STEP && steps < 6) { tick(A.STEP); this.accumulator -= A.STEP; steps++; } return steps; }
    reset() { this.accumulator = 0; }
  };
})(globalThis);
