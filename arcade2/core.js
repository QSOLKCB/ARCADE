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
  A.Game = class {
    constructor(id, seed = 731) {
      Object.assign(this, {id, rng: seed >>> 0, tickCount: 0, stage: 0, status: 'playing',
        score: 0, hp: 100, maxHP: 100, message: '', messageTicks: 0, effects: [], events: [], inv: 0});
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
    drawEffects(ctx, offset = 0) {
      for (const e of this.effects) {
        ctx.fillStyle = e.color; const s = e.life > 12 ? 3 : 2;
        ctx.fillRect(Math.round(px(e.x) - offset), Math.round(px(e.y)), s, s);
      }
    }
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
  const ninja = [
    '0001111000', '0011111100', '0012222100', '0011111100', '0001111000',
    '0033333300', '0333433330', '1333433331', '1003433001', '0003333000',
    '0001111000', '0011001100', '0011001100', '0110000110', '0110000110',
  ];
  const trooper = [
    '0001111000', '0011111100', '0012222100', '0012112100', '0001111000',
    '0033333300', '0334443330', '1334443331', '1003333001', '0003333000',
    '0001111000', '0011001100', '0011001100', '0110000110', '0110000110',
  ];
  D.person = (c, x, y, color = '#7fe3e0', face = 1, tick = 0, kind = 'ninja', scale = 2) => {
    const art = kind === 'ninja' ? ninja : trooper;
    const palette = ['transparent', '#141e2b', '#fff5d4', color, '#f8cf72'];
    const stride = Math.floor(tick / 8) % 2;
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(face, 1);
    D.ellipse(c, 0, 1, scale * 6, 3, '#0006');
    for (let row = 0; row < art.length; row++) for (let col = 0; col < art[row].length; col++) {
      const index = Number(art[row][col]); if (!index) continue;
      const shift = row > 10 ? (col < 5 ? stride : -stride) : 0;
      D.rect(c, (col - 5 + shift) * scale, (row - art.length) * scale, scale, scale, palette[index]);
    }
    if (kind === 'ninja') { D.rect(c, -13 * scale / 2, -24 * scale / 2, 8, 3, color); }
    c.restore();
  };
  D.ship = (c, x, y, color, tick, vertical = false, scale = 1) => {
    c.save(); c.translate(Math.round(x), Math.round(y)); if (vertical) c.rotate(-Math.PI / 2); c.scale(scale, scale);
    D.rect(c, -23 - tick % 9, -3, 15 + tick % 9, 6, '#ff9848');
    D.rect(c, -16, -6, 22, 12, '#233248'); D.rect(c, -10, -4, 28, 8, color);
    D.rect(c, -15, -14, 10, 28, color); D.rect(c, -5, -8, 10, 16, '#edf7e7');
    D.rect(c, 4, -3, 9, 6, '#0c1e2c'); D.rect(c, -19, -13, 6, 4, '#657581');
    D.rect(c, -19, 9, 6, 4, '#657581'); c.restore();
  };
  D.drone = (c, x, y, color = '#ff7479', big = false, tick = 0) => {
    const s = big ? 2 : 1;
    D.ellipse(c, x, y, 14 * s, 9 * s, '#202a40');
    D.rect(c, x - 18 * s, y - 3 * s, 36 * s, 6 * s, color);
    D.rect(c, x - 7 * s, y - 9 * s, 14 * s, 18 * s, '#657581');
    D.rect(c, x - 4 * s, y - 4 * s, 8 * s, 8 * s, tick % 60 < 40 ? color : '#fff');
  };
  D.city = (c, camera, theme = 0, tick = 0) => {
    const palettes = [['#0a1024','#182541','#68d8d2'],['#15131e','#30243a','#fd9267'],['#091c25','#123943','#c4ef76']];
    const [sky, building, light] = palettes[theme % palettes.length];
    D.rect(c, 0, 0, 640, 360, sky); D.ellipse(c, 510, 73, 33, 33, '#e9e3ca');
    D.rect(c, 488, 43, 45, 6, sky); D.rect(c, 482, 62, 60, 3, sky);
    for (let i = -1; i < 13; i++) {
      const x = i * 62 - (camera * .2 % 62), h = 65 + ((i + 29) * 73 % 110);
      D.rect(c, x, 281 - h, 48, h, building);
      for (let row = 0; row < h / 12 - 1; row++) for (let col = 0; col < 3; col++) {
        if ((row + col * 3 + i + 30) % 4) D.rect(c, x + 7 + col * 12, 290 - h + row * 12, 5, 3, '#607176');
      }
    }
    D.line(c, 0, 216, 640, 198, light, 1);
    for (let i = 0; i < 5; i++) D.rect(c, (i * 151 - camera * .55 + 5000) % 760 - 60, 240, 35, 55, '#18232c');
    D.rect(c, 0, 303, 640, 57, '#0b121a'); D.line(c, 0, 303, 640, 303, light, 2);
    for (let x = -camera % 40; x < 640; x += 40) D.rect(c, x, 315, 24, 3, '#30404a');
    for (let i = 0; i < 18; i++) { const x = (i * 79 + tick * 2) % 640, y = (i * 47 + tick * 4) % 300; D.line(c, x, y, x - 3, y + 9, '#a8dddf22'); }
  };
  D.space = (c, tick, vertical = false, hot = false) => {
    D.rect(c, 0, 0, 640, 360, hot ? '#1d1229' : '#080e20');
    for (let i = 0; i < 65; i++) {
      const speed = i % 3 + 1;
      const x = vertical ? i * 173 % 640 : (i * 173 - Math.floor(tick * speed / 3) % 640 + 640) % 640;
      const y = vertical ? (i * 97 + Math.floor(tick * speed / 3)) % 360 : i * 97 % 360;
      D.rect(c, x, y, speed === 3 ? 2 : 1, 1, ['#526078','#9da7ba','#dfdfcb'][i % 3]);
    }
    D.ellipse(c, 506, 120, 75, 75, hot ? '#482135' : '#132c45');
    for (let i = 0; i < 5; i++) D.line(c, 451, 83 + i * 14, 557, 92 + i * 14, hot ? '#6a3039' : '#1d3c54', 5);
  };
  A.register = (meta, factory) => A.registry.push(Object.freeze({...meta, create: factory}));
})(globalThis.Arcade2);
