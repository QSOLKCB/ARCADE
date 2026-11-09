/* SPDX-License-Identifier: Apache-2.0 */
// ARCADE 2 presentation layer (v0.6.0). Everything here reads game state and
// writes pixels only: no function in this file stores anything on a game object,
// consumes gameplay randomness or runs inside the 60 Hz fixed tick.
//
// Performance model, adapted from the QSOLKCB/OPT catalogue:
// - OPT-FAN-001 / OPT-INC-001: static scenery, sprites and glow kernels are
//   materialised once into offscreen layers under a key that names every input
//   to the paint function, then reused with one drawImage per frame.
// - OPT-CACHE-001: each layer cache is a bounded LRU with hit/miss/eviction stats.
// - OPT-APPROX-001: the 'lite' tier removes cosmetic glow, trails and the CRT
//   pass only. Sprites, telegraphs, hazards and HUD are identical in both tiers.
// Without a canvas factory (Node tests, very old browsers) every layer is painted
// directly into the target context, which produces the same image more slowly.
(function (A) {
  'use strict';
  const G = A.Gfx = {};
  const D = A.Draw;
  let quality = 'high';
  G.setQuality = value => { quality = value === 'lite' ? 'lite' : 'high'; return quality; };
  G.quality = () => quality;
  G.high = () => quality === 'high';

  G.factory = (w, h) => {
    try {
      if (typeof document !== 'undefined' && document.createElement) {
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; return canvas;
      }
      if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
    } catch (_) {}
    return null;
  };

  // Bounded LRU keyed by complete paint signatures, budgeted in pixels (4 bytes each).
  class LayerCache {
    constructor(name, budget) { Object.assign(this, {name, budget, pixels: 0, map: new Map(), hits: 0, misses: 0, evictions: 0, unavailable: false}); }
    get(key, w, h, paint) {
      const found = this.map.get(key);
      if (found) { this.map.delete(key); this.map.set(key, found); this.hits++; return found; }
      if (this.unavailable) return null;
      const width = Math.max(1, Math.ceil(w)), height = Math.max(1, Math.ceil(h));
      if (width * height > this.budget) return null;
      const canvas = G.factory(width, height);
      const ctx = canvas && canvas.getContext && canvas.getContext('2d');
      if (!ctx) { this.unavailable = true; return null; }
      ctx.imageSmoothingEnabled = false;
      paint(ctx); // A paint that throws is never published (fail closed).
      if (G.onPaint) G.onPaint(this.name, key, canvas);
      this.misses++; this.map.set(key, canvas); this.pixels += width * height;
      while (this.pixels > this.budget) {
        const [oldest, layer] = this.map.entries().next().value;
        this.map.delete(oldest); this.pixels -= layer.width * layer.height; this.evictions++;
      }
      return canvas;
    }
    clear() { this.map.clear(); this.unavailable = false; this.pixels = this.hits = this.misses = this.evictions = 0; }
    stats() { return {size: this.map.size, pixels: this.pixels, budget: this.budget, hits: this.hits, misses: this.misses, evictions: this.evictions}; }
  }
  // About 24 MB of scenery, 6 MB of sprites and 1 MB of glow kernels at most.
  const scenery = new LayerCache('scenery', 6000000), sprites = new LayerCache('sprites', 1500000), kernels = new LayerCache('kernels', 250000);
  G.caches = {scenery, sprites, kernels};
  G.onPaint = null; // Test hook: observe each materialised layer.
  G.reset = () => { for (const cache of Object.values(G.caches)) cache.clear(); colors.clear(); };
  G.stats = () => Object.fromEntries(Object.entries(G.caches).map(([k, v]) => [k, v.stats()]));

  // Draw a cached layer at (x, y). Fallback paints directly with the same origin.
  function blit(cache, c, key, w, h, paint, x, y, flip = false) {
    const layer = cache.get(key, w, h, paint);
    if (!flip) {
      if (layer) { c.drawImage(layer, Math.round(x), Math.round(y)); return; }
      c.save(); c.translate(Math.round(x), Math.round(y)); paint(c); c.restore(); return;
    }
    c.save(); c.translate(Math.round(x) + Math.ceil(w), Math.round(y)); c.scale(-1, 1);
    if (layer) c.drawImage(layer, 0, 0); else paint(c);
    c.restore();
  }
  G.layer = (c, key, w, h, paint, x = 0, y = 0) => blit(scenery, c, key, w, h, paint, x, y);
  G.sprite = (c, key, w, h, paint, x, y, flip = false) => blit(sprites, c, key, w, h, paint, x, y, flip);
  // A repeating tile, drawn as many times as needed to cover the 640 x 360 view.
  G.tile = (c, key, w, h, paint, offset, vertical = false, origin = 0) => {
    const size = vertical ? h : w, span = vertical ? 360 : 640, o = ((Math.round(offset) % size) + size) % size;
    for (let at = -o; at < span; at += size) G.layer(c, key, w, h, paint, vertical ? origin : at, vertical ? at : origin);
  };
  // Symmetric triangle wave for slow, seam-free cosmetic drift.
  G.drift = (tick, period, range) => { const p = ((tick % period) + period) % period; return (p < period / 2 ? p : period - p) * 2 * range / period; };
  // Cosmetic integer hash. Presentation variation never touches gameplay RNG.
  G.hash = n => {
    let x = (n | 0) ^ 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  };
  const colors = new Map();
  const memo = (key, make) => {
    let value = colors.get(key);
    if (value === undefined) { if (colors.size > 1024) colors.clear(); value = make(); colors.set(key, value); }
    return value;
  };
  const parse = hex => {
    let h = String(hex).replace('#', '');
    if (h.length === 3 || h.length === 4) h = [...h].map(ch => ch + ch).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0);
  };
  const hex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  G.mix = (a, b, t) => memo('m' + a + b + t, () => { const x = parse(a), y = parse(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); });
  G.shade = (color, t) => t < 0 ? G.mix(color, '#000000', -t) : G.mix(color, '#ffffff', t);
  G.rgba = (color, alpha) => memo('r' + color + alpha, () => { const [r, g, b] = parse(color); return `rgba(${r},${g},${b},${alpha})`; });

  // Gradient helpers fall back to a flat colour in contexts without gradients.
  G.linear = (c, x0, y0, x1, y1, stops) => {
    const g = c.createLinearGradient ? c.createLinearGradient(x0, y0, x1, y1) : null;
    if (!g || typeof g.addColorStop !== 'function') return stops[0][1];
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
  };
  G.radial = (c, x, y, r0, r1, stops) => {
    const g = c.createRadialGradient ? c.createRadialGradient(x, y, r0, x, y, r1) : null;
    if (!g || typeof g.addColorStop !== 'function') return stops[stops.length - 1][1];
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
  };
  const kernel = (color, r) => {
    const size = r * 2 + 2;
    return [size, ctx => {
      ctx.fillStyle = G.radial(ctx, r + 1, r + 1, 0, r, [[0, G.rgba(color, 0.95)], [0.25, G.rgba(color, 0.5)], [1, G.rgba(color, 0)]]);
      ctx.fillRect(0, 0, size, size);
    }];
  };
  // Additive soft light. High tier only: purely cosmetic.
  G.glow = (c, x, y, r, color, alpha = 1) => {
    if (quality !== 'high' || !(r > 0)) return;
    const radius = Math.min(96, Math.max(2, Math.round(r))), [size, paint] = kernel(color, radius);
    const layer = kernels.get('g' + color + radius, size, size, paint);
    if (!layer) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.drawImage(layer, Math.round(x - radius - 1), Math.round(y - radius - 1)); c.restore();
  };
  // A soft dark ellipse used for contact shadows.
  G.shadow = (c, x, y, rx, ry, alpha = 0.45) => {
    c.save(); c.globalAlpha = alpha; D.ellipse(c, x, y, rx, ry, '#000000'); c.restore();
  };

  // ---------------------------------------------------------------- sprites
  // Original 12 x 14 figures, facing right. Legend: k outline, p/d/h body,
  // s/S skin, a accent, w white, m/n metal, b boots/belt.
  const UPPER = {
    ninja: [
      '....kkkk....', '...kdpphk...', '.aakaaaaak..', 'a.kdwkkwhk..', '..kdpppphk..',
      '...kddpk....', '..kdpppphk..', '.kdpdpphhpk.', '.kpkdpphkpk.', '.kskaaaaksk.', '..kdppphhk..',
    ],
    trooper: [
      '...kkkkkk...', '..knmmmmhk..', '..knmmmmmhk.', '..kaaaaaawk.', '..kSssssssk.',
      '...kSssk....', '..kdpppphk..', '.kdpdpphhpk.', '.kpkdpmhkpk.', '.kskbbbbksk.', '..kdppphhk..',
    ],
  };
  const LEGS = [
    ['..kdpkkphk..', '..kdpk.kphk.', '..kbbk.kbbk.'],
    ['..kdpkkphk..', '.kdpk..kphk.', '.kbbk...kbbk'],
    ['...kdpphk...', '...kdpphk...', '...kbbbbk...'],
  ];
  // Ninja headband tails flutter on a separate phase from the stride.
  const TAILS = [['.aakaaaaak..', 'a.kdwkkwhk..'], ['aaakaaaaak..', '..kdwkkwhk..']];
  G.personArt = (kind, frame, flutter) => {
    const upper = UPPER[kind === 'ninja' ? 'ninja' : 'trooper'].slice();
    if (kind === 'ninja') [upper[2], upper[3]] = TAILS[flutter % 2];
    return upper.concat(LEGS[frame % 3]);
  };
  const palette = (kind, color) => memo('p' + kind + color, () => ({
    k: '#0a0f17', p: color, d: G.shade(color, -0.42), h: G.shade(color, 0.38),
    s: '#e8b48b', S: '#b77c5c', w: '#fff6dc', m: '#a9b6bf', n: '#56636f', b: '#1c2431',
    a: kind === 'ninja' ? '#ff5b6e' : '#8ff1ff',
  }));
  const paintArt = (art, colorsFor, scale) => ctx => {
    for (let row = 0; row < art.length; row++) {
      const y0 = Math.round(row * scale), y1 = Math.round((row + 1) * scale);
      for (let col = 0; col < art[row].length; col++) {
        const ch = art[row][col]; if (ch === '.' || ch === ' ') continue;
        const x0 = Math.round(col * scale), x1 = Math.round((col + 1) * scale);
        ctx.fillStyle = colorsFor[ch]; ctx.fillRect(x0 + 1, y0 + 1, x1 - x0, y1 - y0);
      }
    }
  };
  D.person = (c, x, y, color = '#7fe3e0', face = 1, tick = 0, kind = 'ninja', scale = 2) => {
    const frame = tick ? 1 + Math.floor(tick / 8) % 2 : 0, flutter = Math.floor(tick / 6) % 2;
    const art = G.personArt(kind, frame, flutter), w = 12 * scale + 2, h = 14 * scale + 2;
    G.shadow(c, x, y + 1, scale * 6, 3);
    G.sprite(c, 'person:' + kind + color + scale + ':' + frame + flutter, w, h, paintArt(art, palette(kind, color), scale),
      x - 6 * scale - 1, y - 14 * scale - 1, face < 0);
  };

  // Fighter craft: a cached hull plus live engine flame and glow.
  const hull = (color, s) => ctx => {
    ctx.translate(26 * s, 17 * s); ctx.scale(s, s);
    const dark = G.shade(color, -0.45), light = G.shade(color, 0.4);
    const poly = (points, fill) => { ctx.beginPath(); ctx.moveTo(points[0], points[1]); for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); };
    ctx.strokeStyle = '#0a0f17'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
    poly([-15, -16, 3, -5, 3, 5, -15, 16, -21, 16, -12, 4, -12, -4, -21, -16], G.linear(ctx, 0, -16, 0, 16, [[0, light], [0.5, dark], [1, light]]));
    poly([-20, -5, 6, -7, 23, -1.5, 23, 1.5, 6, 7, -20, 5], G.linear(ctx, 0, -7, 0, 7, [[0, light], [0.45, color], [1, dark]]));
    ctx.fillStyle = '#4b5866'; ctx.fillRect(-24, -4, 5, 8); ctx.strokeRect(-24, -4, 5, 8);
    ctx.fillStyle = '#eaf6ea'; ctx.fillRect(-11, -1, 15, 2);
    ctx.fillStyle = G.linear(ctx, 0, -4, 0, 3, [[0, '#e6feff'], [1, '#22506a']]);
    ctx.beginPath(); ctx.ellipse(6, -1, 7, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6a5a'; ctx.fillRect(-18, -15, 3, 2); ctx.fillStyle = '#7dff9b'; ctx.fillRect(-18, 13, 3, 2);
  };
  D.ship = (c, x, y, color, tick, vertical = false, scale = 1) => {
    c.save(); c.translate(Math.round(x), Math.round(y)); if (vertical) c.rotate(-Math.PI / 2);
    const flicker = tick % 9, flame = 10 + flicker;
    G.glow(c, -26 * scale, 0, 13 * scale, '#ff8a3a', 0.8);
    c.fillStyle = G.high() ? G.linear(c, -24 * scale - flame * scale, 0, -22 * scale, 0, [[0, 'rgba(255,90,40,0)'], [0.6, '#ff9848'], [1, '#fff3c4']]) : '#ff9848';
    c.fillRect(-23 * scale - flame * scale, -3 * scale, flame * scale, 6 * scale);
    c.fillStyle = '#fff5cf'; c.fillRect(-25 * scale, -1.5 * scale, 3 * scale, 3 * scale);
    G.sprite(c, 'ship:' + color + scale, 52 * scale, 34 * scale, hull(color, scale), -26 * scale, -17 * scale);
    c.restore();
  };

  // Hostile drone: cached chassis, live sensor eye.
  const chassis = (color, s) => ctx => {
    ctx.translate(20 * s, 12 * s); ctx.scale(s, s);
    ctx.strokeStyle = '#0a0f17'; ctx.lineWidth = 1.3;
    ctx.fillStyle = G.linear(ctx, 0, -4, 0, 4, [[0, G.shade(color, 0.35)], [1, G.shade(color, -0.4)]]);
    ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(-9, -4); ctx.lineTo(9, -4); ctx.lineTo(19, 0); ctx.lineTo(9, 4); ctx.lineTo(-9, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = G.radial(ctx, -3, -4, 1, 15, [[0, '#4d5d78'], [1, '#141b2b']]);
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b7b88'; ctx.fillRect(-6, -10, 12, 3); ctx.fillRect(-6, 7, 12, 3);
    ctx.fillStyle = '#0a0f17'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
  };
  D.drone = (c, x, y, color = '#ff7479', big = false, tick = 0) => {
    const s = big ? 2 : 1, on = tick % 60 < 40, eye = on ? color : '#fff6e8';
    G.sprite(c, 'drone:' + color + s, 40 * s, 24 * s, chassis(color, s), x - 20 * s, y - 12 * s);
    G.glow(c, x, y, 10 * s, eye, on ? 0.55 : 0.9);
    D.ellipse(c, x, y, 3.5 * s, 3.5 * s, eye); D.rect(c, x - 1 * s, y - 2 * s, 1.5 * s, 1.5 * s, '#ffffff');
  };

  // ---------------------------------------------------------------- scenery
  const CITY = [
    {sky: ['#060a1c', '#16234a', '#3d3a6b'], far: '#141d38', mid: '#1b2846', near: '#0d1424', light: '#68d8d2', window: '#ffd98a', neon: ['#68d8d2', '#ff7aa8', '#ffd16a']},
    {sky: ['#0d0812', '#311a33', '#7a3b3c'], far: '#26172a', mid: '#341f35', near: '#170e19', light: '#fd9267', window: '#ffc073', neon: ['#fd9267', '#ffd56a', '#9fe7ff']},
    {sky: ['#03111a', '#0d3038', '#25584c'], far: '#0d2329', mid: '#123139', near: '#081419', light: '#c4ef76', window: '#c8ffb0', neon: ['#c4ef76', '#7ef5ff', '#ff8bb0']},
  ];
  const SIGNS = ['QSOL', 'RAMEN', '24/7', 'DEPLOY', 'NO OT', 'CACHE', 'NOODLE', 'ARCADE'];
  G.cityTheme = theme => CITY[((theme % CITY.length) + CITY.length) % CITY.length];
  const sky = t => ctx => {
    ctx.fillStyle = G.linear(ctx, 0, 0, 0, 300, [[0, t.sky[0]], [0.62, t.sky[1]], [1, t.sky[2]]]); ctx.fillRect(0, 0, 640, 360);
    for (let i = 0; i < 90; i++) {
      const h = G.hash(i * 31 + 7), x = h % 640, y = (h >>> 10) % 190, b = (h >>> 20) % 3;
      ctx.fillStyle = ['#56607e', '#9aa6c2', '#f4f1dc'][b]; ctx.fillRect(x, y, b === 2 ? 2 : 1, b === 2 ? 2 : 1);
    }
    ctx.fillStyle = G.radial(ctx, 510, 73, 20, 90, [[0, G.rgba('#f2ecd2', 0.35)], [1, G.rgba('#f2ecd2', 0)]]); ctx.fillRect(400, 0, 240, 180);
    ctx.fillStyle = G.radial(ctx, 500, 64, 4, 34, [[0, '#fbf7e6'], [0.8, '#e5dcbc'], [1, '#c9bf9d']]);
    ctx.beginPath(); ctx.arc(510, 73, 33, 0, Math.PI * 2); ctx.fill();
    for (const [cx, cy, r] of [[498, 62, 6], [522, 86, 4], [516, 58, 3], [494, 88, 5]]) {
      ctx.fillStyle = G.rgba('#9f9578', 0.45); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = G.linear(ctx, 0, 170, 0, 290, [[0, G.rgba(t.sky[2], 0)], [1, G.rgba(t.light, 0.18)]]); ctx.fillRect(0, 170, 640, 120);
  };
  const skyline = (t, width, seed, base, tall, color, windows) => ctx => {
    for (let x = -10, i = 0; x < width; i++) {
      const h = G.hash(seed + i * 97), w = 34 + h % 46, top = base - (tall[0] + (h >>> 8) % tall[1]);
      ctx.fillStyle = G.linear(ctx, 0, top, 0, base + 60, [[0, G.shade(color, 0.12)], [1, G.shade(color, -0.3)]]);
      ctx.fillRect(x, top, w, 400 - top);
      ctx.fillStyle = G.shade(color, 0.22); ctx.fillRect(x, top, w, 2);
      if ((h >>> 3) % 3 === 0) { ctx.fillStyle = G.shade(color, -0.2); ctx.fillRect(x + w / 2 - 1, top - 16, 2, 16); ctx.fillStyle = '#ff5b5b'; ctx.fillRect(x + w / 2 - 2, top - 18, 4, 3); }
      if ((h >>> 5) % 4 === 0) { ctx.fillStyle = G.shade(color, -0.15); ctx.fillRect(x + 6, top - 12, 14, 12); ctx.fillRect(x + 8, top - 3, 2, 3); }
      if (windows) for (let wy = top + 8; wy < 300; wy += 11) for (let wx = x + 5; wx < x + w - 6; wx += 9) {
        const lit = G.hash(wx * 13 + wy * 7 + seed) % 11;
        if (lit > 2) continue;
        ctx.fillStyle = lit === 0 ? G.shade(t.window, -0.2) : lit === 1 ? G.shade(t.window, -0.55) : G.shade(color, 0.1);
        ctx.fillRect(wx, wy, 4, 5);
      }
      x += w + 4 + (h >>> 16) % 14;
    }
  };
  const signs = (t, width, seed) => {
    const list = [];
    for (let i = 0; i < width / 420; i++) {
      const h = G.hash(seed + i * 131);
      list.push({x: 90 + i * 420 + h % 160, y: 120 + (h >>> 9) % 40, text: SIGNS[(h >>> 4) % SIGNS.length], color: t.neon[(h >>> 12) % t.neon.length]});
    }
    return list;
  };
  const signLayer = (t, width, seed) => ctx => {
    for (const s of signs(t, width, seed)) {
      const w = s.text.length * 9 + 10;
      ctx.fillStyle = '#0a0f17'; ctx.fillRect(s.x - 2, s.y - 2, w + 4, 20);
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.strokeRect(s.x, s.y, w, 16);
      ctx.fillStyle = s.color; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.fillText(s.text, s.x + 5, s.y + 12);
    }
  };
  // Atmospheric depth: darkens the mid skyline so gameplay reads in front of it.
  const haze = t => ctx => {
    ctx.fillStyle = G.linear(ctx, 0, 90, 0, 300, [[0, G.rgba(t.sky[0], 0.15)], [0.6, G.rgba(t.sky[1], 0.42)], [1, G.rgba(t.light, 0.16)]]);
    ctx.fillRect(0, 0, 640, 300);
  };
  const street = t => ctx => {
    ctx.fillStyle = G.linear(ctx, 0, 303, 0, 360, [[0, '#121b26'], [1, '#05080d']]); ctx.fillRect(0, 0, 640, 57);
    ctx.fillStyle = t.light; ctx.fillRect(0, 0, 640, 2);
    ctx.fillStyle = G.rgba(t.light, 0.25); ctx.fillRect(0, 2, 640, 3);
    for (let x = 0; x < 640; x += 40) { ctx.fillStyle = '#2e3d48'; ctx.fillRect(x, 12, 24, 3); }
    for (let x = 0; x < 640; x += 16) { ctx.fillStyle = (x / 16) % 2 ? '#0e151d' : '#111a23'; ctx.fillRect(x, 22, 16, 35); }
  };
  D.city = (c, camera, theme = 0, tick = 0) => {
    const t = G.cityTheme(theme), id = (theme % CITY.length + CITY.length) % CITY.length;
    G.layer(c, 'city-sky:' + id, 640, 360, sky(t));
    G.layer(c, 'city-far:' + id, 960, 300, skyline(t, 960, 11 + id, 262, [70, 90], t.far, false), -Math.round(camera * 0.2), 0);
    const mid = skyline(t, 1560, 503 + id, 285, [55, 120], t.mid, true), lights = signLayer(t, 1560, 77 + id);
    G.layer(c, 'city-mid:' + id, 1360, 300, ctx => { mid(ctx); lights(ctx); }, -Math.round(camera * 0.45), 0);
    G.layer(c, 'city-haze:' + id, 640, 300, haze(t));
    if (G.high()) for (const s of signs(t, 1560, 77 + id)) {
      const sx = s.x - camera * 0.45, on = G.hash(s.x + Math.floor(tick / 5)) % 23 !== 0;
      if (sx > -80 && sx < 700 && on) G.glow(c, sx + s.text.length * 4.5 + 5, s.y + 8, 30, s.color, 0.32);
    }
    G.tile(c, 'city-street:' + id, 640, 57, street(t), camera, false, 303);
    // Rain is presentation-only and derived from the frame tick.
    const drops = G.high() ? 46 : 18;
    c.strokeStyle = G.rgba('#a8dddf', G.high() ? 0.22 : 0.14); c.lineWidth = 1; c.beginPath();
    for (let i = 0; i < drops; i++) { const x = (i * 79 + tick * 2) % 640, y = (i * 47 + tick * 5) % 300; c.moveTo(x, y); c.lineTo(x - 3, y + 10); }
    c.stroke();
  };

  const nebula = (hot, vertical) => ctx => {
    ctx.fillStyle = G.linear(ctx, 0, 0, vertical ? 0 : 640, vertical ? 360 : 0, hot ? [[0, '#1d0f24'], [0.5, '#2a1022'], [1, '#1a0d20']] : [[0, '#060b1d'], [0.5, '#0a1430'], [1, '#070c20']]);
    ctx.fillRect(0, 0, 640, 360);
    const tones = hot ? ['#ff6b4a', '#c33a72', '#ffb35c', '#7a2a6e'] : ['#2f6fb0', '#6a3fb3', '#1fa3a0', '#33508f'];
    for (let i = 0; i < 9; i++) {
      const h = G.hash(i * 211 + (hot ? 5 : 9)), x = h % 640, y = (h >>> 10) % 360, r = 60 + (h >>> 20) % 110;
      const grad = G.radial(ctx, 0, 0, 0, r, [[0, G.rgba(tones[i % 4], 0.22)], [0.6, G.rgba(tones[i % 4], 0.07)], [1, G.rgba(tones[i % 4], 0)]]);
      // Draw each blob at its wrapped copies so the tile repeats seamlessly.
      for (const dx of [-640, 0, 640]) for (const dy of [-360, 0, 360]) {
        ctx.save(); ctx.translate(x + dx, y + dy); ctx.fillStyle = grad; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
      }
    }
  };
  const stars = (layer, hot, vertical) => ctx => {
    const count = [36, 20, 8][layer], tones = hot ? ['#7e5a6e', '#d8a7a0', '#fff1d6'] : ['#4a5875', '#9da7ba', '#eef3ff'];
    for (let i = 0; i < count; i++) {
      const h = G.hash(i * 7919 + layer * 104729), x = h % (vertical ? 640 : 320), y = (h >>> 11) % (vertical ? 180 : 360);
      ctx.fillStyle = tones[layer]; ctx.fillRect(x, y, layer === 2 ? 2 : 1, layer === 2 ? 2 : 1);
      if (layer === 2) { ctx.fillStyle = G.rgba(tones[2], 0.35); ctx.fillRect(x - 1, y, 4, 2); ctx.fillRect(x, y - 1, 2, 4); }
    }
  };
  const planet = hot => ctx => {
    const base = hot ? '#7a2e45' : '#1f4e78', rim = hot ? '#ff9b6a' : '#7fd2ff';
    ctx.fillStyle = G.radial(ctx, 110, 110, 70, 108, [[0, G.rgba(rim, 0.3)], [1, G.rgba(rim, 0)]]); ctx.fillRect(0, 0, 220, 220);
    ctx.save(); ctx.beginPath(); ctx.arc(110, 110, 75, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = G.radial(ctx, 80, 80, 8, 110, [[0, G.shade(base, 0.35)], [0.55, base], [1, G.shade(base, -0.7)]]); ctx.fillRect(0, 0, 220, 220);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = G.rgba(hot ? '#ffb37a' : '#9be2ff', 0.08 + (i % 2) * 0.05); ctx.fillRect(20, 52 + i * 21, 200, 8 + (i % 3) * 3); }
    ctx.restore();
    ctx.strokeStyle = G.rgba(rim, 0.55); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(110, 116, 104, 18, -0.25, 0.1, Math.PI - 0.1); ctx.stroke();
  };
  D.space = (c, tick, vertical = false, hot = false) => {
    const k = (hot ? 'h' : 'c') + (vertical ? 'v' : 'x');
    G.tile(c, 'space-nebula:' + k, 640, 360, nebula(hot, vertical), Math.floor(tick / 6), vertical);
    G.layer(c, 'space-planet:' + hot, 220, 220, planet(hot), 396 - (vertical ? 0 : G.drift(tick, 7200, 60)), 10 + (vertical ? G.drift(tick, 7200, 40) : 0));
    for (let layer = 0; layer < 3; layer++) {
      const offset = Math.floor(tick * (layer + 1) / 3);
      G.tile(c, 'space-stars:' + hot + vertical + layer, vertical ? 640 : 320, vertical ? 180 : 360, stars(layer, hot, vertical), vertical ? -offset : offset, vertical);
    }
  };

  // ---------------------------------------------------------------- effects
  // Particles drawn as hot sparks: additive halo, streak and bright core.
  G.sparks = (c, effects, offset = 0) => {
    const high = G.high();
    for (const e of effects) {
      const x = A.px(e.x) - offset, y = A.px(e.y), s = e.life > 24 ? 3 : e.life > 12 ? 2 : 1;
      if (high) {
        G.glow(c, x, y, 4 + s * 2, e.color, Math.min(1, e.life / 30));
        D.line(c, x, y, x - A.px(e.vx) * 3, y - A.px(e.vy) * 3, G.rgba(e.color, 0.5), s);
      }
      D.rect(c, x - s / 2, y - s / 2, s, s, e.life > 20 ? '#fff6dc' : e.color);
    }
  };
  // Post pass shared by every cabinet: low-health alarm and CRT scanlines.
  const crt = ctx => {
    ctx.fillStyle = G.radial(ctx, 320, 180, 150, 420, [[0, 'rgba(0,0,0,0)'], [0.75, 'rgba(0,0,0,0.18)'], [1, 'rgba(0,0,0,0.55)']]);
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = 0; y < 360; y += 3) ctx.fillRect(0, y, 640, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.025)'; for (let y = 1; y < 360; y += 3) ctx.fillRect(0, y, 640, 1);
  };
  const alarm = ctx => {
    ctx.fillStyle = G.radial(ctx, 320, 180, 170, 400, [[0, 'rgba(255,40,60,0)'], [1, 'rgba(255,40,60,0.55)']]);
    ctx.fillRect(0, 0, 640, 360);
  };
  G.post = (c, game) => {
    const danger = game && game.status === 'playing' && (game.id === 'invaders' ? game.lives === 1 : game.hp > 0 && game.hp <= 30);
    if (danger) {
      c.save(); c.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(game.tickCount * 0.09));
      G.layer(c, 'post-alarm', 640, 360, alarm); c.restore();
    }
    if (G.high()) G.layer(c, 'post-crt', 640, 360, crt);
  };
  // Text with a 1 px drop shadow for legibility over busy scenery.
  const plainText = D.text;
  D.text = (c, text, x, y, color = '#f1f6ee', size = 12, align = 'left') => {
    plainText(c, text, x + 1, y + 1, '#05080dcc', size, align); plainText(c, text, x, y, color, size, align);
  };
  D.plainText = plainText;
  // Bevelled meter: dark track, gradient fill and highlight.
  D.bar = (c, x, y, w, value, max, color = '#bbf765') => {
    const f = A.clamp(value / max, 0, 1);
    D.rect(c, x - 1, y - 1, w + 2, 7, '#05080d'); D.rect(c, x, y, w, 5, '#24323a');
    if (f > 0) { D.rect(c, x, y, w * f, 5, color); D.rect(c, x, y, w * f, 2, G.shade(color, 0.4)); D.rect(c, x, y + 4, w * f, 1, G.shade(color, -0.35)); }
  };
})(globalThis.Arcade2);
