/* Kestrel Strike: an original vertical-scrolling propeller shoot-'em-up. SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const D = A.Draw, TAU = Math.PI * 2;
  // The playfield is a vertical (TATE) strip between two instrument panels. Simulation coordinates
  // are field-local pixels with +Y up (0 = bottom of the field), matching VANILLAJS motion2d.
  const FX = 120, FW = 240, FTOP = 25, FH = 245;
  const sx = x => FX + x, sy = y => 270 - y;
  // The player's plane moves through QSOLKCB/VANILLAJS motion2d's integer 'shmup' profile:
  // 256 subunits per game unit and one game unit = 32 px, so 8 subunits per pixel.
  const SUB = 8, BOUNDS = { minX: 10 * SUB, maxX: 230 * SUB, minY: 12 * SUB, maxY: 215 * SUB };
  const STAGES = [
    { name: 'CORAL STRAIT', kind: 'sea', boss: 'THE IRON TORTOISE', length: 78, pool: ['gnat', 'swallow', 'gunboat', 'gnat', 'gunboat', 'swallow'], mid: 'THE REEF WARDEN' },
    { name: 'AMBER DUNES', kind: 'desert', boss: 'THE SAND LEVIATHAN', length: 84, pool: ['gnat', 'tank', 'swallow', 'tank', 'bomber', 'gnat'], mid: 'THE DUST HAWK' },
    { name: 'STORM CANOPY', kind: 'cloud', boss: 'THE THUNDERHEAD', length: 88, pool: ['swallow', 'bomber', 'gnat', 'bomber', 'swallow', 'gnat'], mid: 'THE GALE TWINS' },
    { name: 'CINDER CITADEL', kind: 'citadel', boss: 'THE CINDER ENGINE', length: 92, pool: ['gnat', 'turret', 'bomber', 'swallow', 'turret', 'tank'], mid: 'THE ASH SENTRY' }
  ];
  const KINDS = {
    gnat: { hp: 3, score: 100, r: 7 }, swallow: { hp: 1, score: 80, r: 6 }, carrier: { hp: 6, score: 500, r: 9 },
    bomber: { hp: 34, score: 1500, r: 17 }, gunboat: { hp: 10, score: 300, r: 11, ground: true },
    tank: { hp: 8, score: 250, r: 9, ground: true }, turret: { hp: 12, score: 350, r: 9, ground: true },
    warden: { hp: 120, score: 5000, r: 22 }, boss: { hp: 300, score: 20000, r: 32 }
  };
  const SCROLL = 34, SHOT_SPEED = 360, MAX_ENEMY_BULLETS = 260, MAX_SHOTS = 140;
  // Presentation pools (explosions, flying wreckage, scorch marks) are bounded like the particles.
  const MAX_BLASTS = 48, MAX_DEBRIS = 64, MAX_SCORCH = 24, WRECK_TIME = 2.1, WRECK_END = 2.9;
  // Gun lanes per firepower level: [x offset, angle].
  const LANES = [[[-3, 0]], [[-4, 0], [4, 0]], [[-6, 0], [0, 0], [6, 0]], [[-8, -.06], [-3, 0], [3, 0], [8, .06]], [[-9, -.12], [-4, -.04], [0, 0], [4, .04], [9, .12]]];
  const axis = v => v > .35 ? 1 : v < -.35 ? -1 : 0;
  const hash = n => { let h = Math.imul(n | 0, 2654435761) >>> 0; h ^= h >>> 15; return Math.imul(h, 2246822519) >>> 0; };

  // ---- Drawing helpers ----------------------------------------------------------------------
  // Shaded pixel sprites: every solid is drawn twice, a dark edge offset one pixel down-right on
  // screen and the face on top, so silhouettes read against busy terrain at 480x270.
  const tones = new Map();
  function tone(hex, f) { // f > 0 mixes toward white, f < 0 toward black
    const key = hex + f; let v = tones.get(key); if (v) return v;
    const n = parseInt(hex.slice(1), 16), m = f > 0 ? 255 : 0, k = Math.abs(f);
    const ch = s => Math.round(((n >> s) & 255) + (m - ((n >> s) & 255)) * k);
    v = '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); tones.set(key, v); return v;
  }
  function poly(c, color, p) { c.fillStyle = color; c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); c.fill(); }
  function disc(c, x, y, r, color) { if (r <= 0) return; c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function oval(c, x, y, rx, ry, color) { if (rx <= 0 || ry <= 0) return; c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  let edgeY = 1; // +1 when local +Y points down the screen, -1 for sprites drawn flipped (nose down)
  function solid(c, p, face, edge) { c.save(); c.translate(1, edgeY); poly(c, edge || tone(face, -.62), p); c.restore(); poly(c, face, p); }
  function alpha(c, a, fn) { const old = c.globalAlpha; c.globalAlpha = old * a; fn(); c.globalAlpha = old; }
  function propDisc(c, x, y, rx, spin, color = '#e8eef2') {
    alpha(c, .26, () => oval(c, x, y, rx, 1.6, color));
    const a = spin * .9, w = Math.abs(Math.cos(a)) * rx; alpha(c, .55, () => D.rect(c, x - w, y - .5, w * 2, 1, '#2a2f33'));
    D.rect(c, x - 1, y - 1, 2, 2, '#d8d2c0');
  }
  // A trail of drifting smoke puffs from a burning wreck or damaged hull (pure in t).
  function smoke(c, X, Y, t, amount, dir = -1, fire = true) {
    for (let i = 0; i < 6; i++) {
      const age = (t * 1.7 + i / 6) % 1, r = 1.5 + age * 5;
      alpha(c, (1 - age) * .5 * amount, () => { disc(c, X + Math.sin(i * 2.1 + t * 2.6) * 3 * age, Y + dir * (3 + age * 26), r, '#3a3431'); disc(c, X - 1 + Math.sin(i * 2.1 + t * 2.6) * 3 * age, Y + dir * (2 + age * 26), r * .5, '#6d625a'); });
    }
    if (fire && amount > .45) { const f = Math.floor(t * 18 + X) % 3; disc(c, X, Y, 2.4 + f * .6, '#f2672e'); disc(c, X, Y, 1.2 + f * .3, '#ffe28a'); }
  }

  // ---- Sprites (nose up for the player, nose down for enemies) --------------------------------
  function fighter(c, x, y, body, trim, down, scale = 1, prop = 0) {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, down ? -scale : scale); edgeY = down ? -1 : 1;
    const lit = tone(body, .38), shade = tone(body, -.28);
    solid(c, [-13, -1, -3, -4, 3, -4, 13, -1, 13, 2, 3, 3, -3, 3, -13, 2], body);
    poly(c, shade, [-13, 1, -3, 2, 3, 2, 13, 1, 13, 2, 3, 3, -3, 3, -13, 2]); poly(c, lit, [-13, -1, -3, -4, 3, -4, 3, -3, -3, -3, -13, 0]);
    D.rect(c, -13, -1, 2, 3, trim); D.rect(c, 11, -1, 2, 3, trim);
    disc(c, -8, 0, 1.6, trim); disc(c, 8, 0, 1.6, trim);
    solid(c, [-6, 8, -2, 7, 2, 7, 6, 8, 6, 10, -6, 10], body); D.rect(c, -6, 8, 12, 1, lit);
    solid(c, [0, -12, 3, -9, 3, 4, 2, 12, -2, 12, -3, 4, -3, -9], body);
    poly(c, shade, [0, -12, 3, -9, 3, 4, 2, 12, 0, 12]); D.rect(c, -2, -8, 1, 13, lit);
    D.rect(c, -3, -11, 6, 2, tone(body, -.45));
    poly(c, '#1b2a3a', [-2, -6, 2, -6, 2, -1, -2, -1]); D.rect(c, -1, -5, 1, 2, '#bfe3f5');
    propDisc(c, 0, -13, 6, prop);
    c.restore(); edgeY = 1;
  }
  function kestrel(c, x, y, t, roll, inv, bank = 0) {
    if (inv > 0 && Math.floor(inv * 14) % 2) return;
    c.save(); c.translate(Math.round(x), Math.round(y)); edgeY = 1;
    if (roll > 0) { const k = Math.cos(roll / .9 * TAU); c.scale(Math.abs(k) * .8 + .2, 1 + (1 - Math.abs(k)) * .25); }
    else if (bank) c.scale(1 - Math.abs(bank) * .14, 1);
    const body = '#cfd8d3', wing = '#bac7c1', lit = '#f4f8f4', shade = '#8b9a95', trim = '#f0a24a';
    solid(c, [-15, -2, -4, -5, 4, -5, 15, -2, 15, 2, 4, 4, -4, 4, -15, 2], wing, '#3d4a48');
    poly(c, shade, [-15, 1, -4, 3, 4, 3, 15, 1, 15, 2, 4, 4, -4, 4, -15, 2]); poly(c, lit, [-15, -2, -4, -5, 4, -5, 4, -4, -4, -4, -15, -1]);
    D.rect(c, -15, -2, 3, 4, trim); D.rect(c, 12, -2, 3, 4, trim);
    for (const wx of [-9, 9]) { disc(c, wx, 0, 2.2, trim); disc(c, wx, 0, 1, '#fff2d6'); }
    if (bank) alpha(c, .28, () => poly(c, '#16201f', bank > 0 ? [4, -5, 15, -2, 15, 2, 4, 4] : [-4, -5, -15, -2, -15, 2, -4, 4]));
    D.rect(c, -11, 3, 3, 4, '#5d6d6a'); D.rect(c, 9, 3, 3, 4, '#5d6d6a');
    solid(c, [-7, 9, -2, 8, 2, 8, 7, 9, 7, 12, -7, 12], wing, '#3d4a48'); D.rect(c, -7, 9, 14, 1, lit); D.rect(c, -7, 11, 2, 1, trim); D.rect(c, 5, 11, 2, 1, trim);
    solid(c, [0, -14, 3, -11, 3, 5, 2, 13, -2, 13, -3, 5, -3, -11], body, '#3d4a48');
    poly(c, shade, [0, -14, 3, -11, 3, 5, 2, 13, 0, 13]); D.rect(c, -2, -10, 1, 15, lit);
    D.rect(c, -1, 1, 2, 10, trim); D.rect(c, -3, -13, 6, 2, '#5d6d6a');
    poly(c, '#25445c', [-2, -8, 2, -8, 2, -1, -2, -1]); D.rect(c, -1, -7, 1, 3, '#a8e6ff'); D.rect(c, -2, -4, 4, 1, '#6f8a96');
    const f = Math.floor(t * 30) % 3; alpha(c, .8, () => { D.rect(c, -4, -10 + f, 1, 2, '#ffb35a'); D.rect(c, 3, -10 + ((f + 1) % 3), 1, 2, '#ffb35a'); });
    propDisc(c, 0, -15, 7, Math.floor(t * 40), '#f7f3e6');
    c.restore();
  }
  function bomber(c, x, y, hurt, stage, t = 0) {
    const body = hurt ? '#fff3d6' : ['#5c6b50', '#7d6a4b', '#506078', '#5d4a52'][stage], lit = tone(body, .32), shade = tone(body, -.3);
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(1, -1); edgeY = -1;
    solid(c, [-31, -4, -6, -8, 6, -8, 31, -4, 31, 2, 6, 4, -6, 4, -31, 2], body);
    poly(c, shade, [-31, 0, -6, 2, 6, 2, 31, 0, 31, 2, 6, 4, -6, 4, -31, 2]); poly(c, lit, [-31, -4, -6, -8, 6, -8, 6, -7, -6, -7, -31, -3]);
    for (const ex of [-21, -12, 12, 21]) { solid(c, [ex - 3, -10, ex + 3, -10, ex + 3, 4, ex - 3, 4], tone(body, -.2)); D.rect(c, ex - 2, -10, 1, 13, lit); D.rect(c, ex - 3, -11, 6, 2, '#2e3632'); propDisc(c, ex, -12, 5.5, Math.floor(t * 40) + ex); }
    for (const wx of [-26, 26]) disc(c, wx, -1, 2, '#c84d42');
    solid(c, [-13, 15, -3, 14, 3, 14, 13, 15, 13, 19, -13, 19], body); D.rect(c, -14, 13, 3, 8, shade); D.rect(c, 11, 13, 3, 8, shade);
    solid(c, [0, -24, 4, -20, 5, 10, 3, 20, -3, 20, -5, 10, -4, -20], body);
    poly(c, shade, [0, -24, 4, -20, 5, 10, 3, 20, 0, 20]); D.rect(c, -3, -18, 1, 30, lit);
    disc(c, 0, -20, 3, '#26404e'); D.rect(c, -1, -22, 1, 2, '#bfe3f5'); D.rect(c, -2, -12, 4, 4, '#1d2c37'); D.rect(c, -1, 5, 2, 2, '#1d2c37');
    c.restore(); edgeY = 1;
  }
  function gunboat(c, x, y, aim, hurt, t = 0) {
    c.save(); c.translate(Math.round(x), Math.round(y));
    for (let i = 0; i < 4; i++) { const age = (t * 1.2 + i / 4) % 1; alpha(c, (1 - age) * .55, () => { D.rect(c, -9 - age * 9, -18 - age * 18, 3, 2, '#e8f4f7'); D.rect(c, 7 + age * 9, -18 - age * 18, 3, 2, '#e8f4f7'); }); }
    alpha(c, .6, () => { D.rect(c, -8, 12, 2, 3, '#e8f4f7'); D.rect(c, 7, 12, 2, 3, '#e8f4f7'); });
    const hull = hurt ? '#fff3d6' : '#59636b';
    solid(c, [0, 19, 9, 7, 9, -15, 7, -17, -7, -17, -9, -15, -9, 7], hull, '#1d2429');
    poly(c, '#7c868c', [0, 15, 7, 6, 7, -14, -7, -14, -7, 6]); D.rect(c, -7, -14, 1, 20, '#9aa4a8');
    solid(c, [-5, -12, 5, -12, 5, -3, -5, -3], '#959ea3'); D.rect(c, -4, -10, 8, 1, '#2a3238'); D.rect(c, -3, -7, 6, 1, '#2a3238');
    disc(c, 0, 4, 4.5, '#2a3238'); disc(c, 0, 4, 3.5, '#4a545b'); D.rect(c, -1, 2, 1, 2, '#7c868c');
    c.save(); c.translate(0, 4); c.rotate(-aim - Math.PI / 2); D.rect(c, -2, 2, 2, 10, '#1b2126'); D.rect(c, 1, 2, 2, 10, '#1b2126'); c.restore();
    c.restore();
  }
  function tank(c, x, y, aim, hurt, stage, t = 0) {
    c.save(); c.translate(Math.round(x), Math.round(y));
    const hull = hurt ? '#fff3d6' : stage === 3 ? '#6e4f4f' : '#8a7a4c';
    for (const tx of [-10, 6]) { D.rect(c, tx + 1, -8, 4, 18, '#141410'); D.rect(c, tx, -9, 4, 18, '#2a2a24'); for (let i = 0; i < 5; i++) D.rect(c, tx, -9 + ((i * 4 + Math.floor(t * 24)) % 18), 4, 1, '#4a4a3e'); }
    solid(c, [-7, -8, 7, -8, 7, 8, -7, 8], hull); D.rect(c, -7, -8, 14, 1, tone(hull, .3)); D.rect(c, -7, -8, 1, 16, tone(hull, .2)); D.rect(c, -7, 6, 14, 2, tone(hull, -.25));
    D.rect(c, -5, 5, 3, 2, '#2a2a24'); D.rect(c, 2, 5, 3, 2, '#2a2a24');
    c.save(); c.rotate(-aim - Math.PI / 2); D.rect(c, -1, 3, 3, 12, '#24241e'); D.rect(c, -2, 13, 5, 2, '#24241e'); c.restore();
    disc(c, 1, 1, 5, '#262619'); disc(c, 0, 0, 5, tone(hull, -.3)); disc(c, -1, -1, 2.5, tone(hull, -.1)); D.rect(c, -2, -2, 2, 1, tone(hull, .25));
    c.restore();
  }
  function turret(c, x, y, aim, hurt, t = 0) {
    c.save(); c.translate(Math.round(x), Math.round(y));
    solid(c, [-8, -12, 8, -12, 12, -8, 12, 8, 8, 12, -8, 12, -12, 8, -12, -8], '#3b3440', '#17131a');
    const plate = hurt ? '#fff3d6' : '#6b5d73';
    poly(c, plate, [-6, -9, 6, -9, 9, -6, 9, 6, 6, 9, -6, 9, -9, 6, -9, -6]); poly(c, tone(plate, .25), [-6, -9, 6, -9, 9, -6, -9, -6]); poly(c, tone(plate, -.25), [-9, 6, 9, 6, 6, 9, -6, 9]);
    c.save(); c.rotate(-aim - Math.PI / 2); D.rect(c, -4, 0, 3, 13, '#201b24'); D.rect(c, 2, 0, 3, 13, '#201b24'); D.rect(c, -4, 12, 3, 2, '#4a4252'); D.rect(c, 2, 12, 3, 2, '#4a4252'); c.restore();
    const g = .6 + Math.sin(t * 5) * .3; disc(c, 0, 0, 4, '#2a2230'); alpha(c, g, () => disc(c, 0, 0, 3, '#ff8a4a')); D.rect(c, -1, -1, 2, 2, '#ffe0b0');
    c.restore();
  }
  function carrier(c, x, y, hurt, t) {
    const pulse = .5 + Math.sin(t * 7) * .5;
    alpha(c, .18 + pulse * .2, () => disc(c, Math.round(x), Math.round(y), 15 + pulse * 2, '#f2d36b'));
    fighter(c, x, y, hurt ? '#fff3d6' : '#c84d42', '#f2d36b', true, 1.1, Math.floor(t * 40));
    D.rect(c, x - 4, y - 3, 8, 7, '#7a2a24'); D.rect(c, x - 3, y - 2, 6, 5, '#f2d36b'); D.text(c, '?', x, y - 2, '#7a2a24', 6, 'center');
  }
  function warden(c, x, y, hurt, stage, t) {
    const body = hurt ? '#fff3d6' : ['#3f6f73', '#8b6a3f', '#4a5f86', '#7a4a4a'][stage], lit = tone(body, .32), shade = tone(body, -.3);
    c.save(); c.translate(Math.round(x), Math.round(y)); edgeY = 1;
    solid(c, [-39, -6, -8, -10, 8, -10, 39, -6, 39, 5, 8, 7, -8, 7, -39, 5], body);
    poly(c, lit, [-39, -6, -8, -10, 8, -10, 39, -6, 39, -4, 8, -8, -8, -8, -39, -4]); poly(c, shade, [-39, 3, -8, 5, 8, 5, 39, 3, 39, 5, 8, 7, -8, 7, -39, 5]);
    D.rect(c, -39, -5, 77, 1, '#efe2b8');
    for (const ex of [-30, -18, 14, 26]) { solid(c, [ex - 3, -11, ex + 4, -11, ex + 4, 7, ex - 3, 7], '#2b2f33'); D.rect(c, ex - 2, -11, 1, 17, '#4a5258'); propDisc(c, ex + .5, 9, 5.5, Math.floor(t * 40) + ex); }
    solid(c, [-18, -22, 19, -22, 19, -17, -18, -17], body); D.rect(c, -18, -22, 37, 1, lit);
    solid(c, [0, 27, 6, 20, 7, -18, 3, -25, -3, -25, -7, -18, -6, 20], body);
    poly(c, shade, [0, 27, 6, 20, 7, -18, 3, -25, 0, -25]); D.rect(c, -5, -18, 1, 36, lit);
    D.rect(c, -3, 16, 7, 9, '#e9b46a'); disc(c, 0, 21, 2.5, '#26404e'); D.rect(c, -1, 19, 1, 2, '#bfe3f5');
    const glow = .5 + Math.sin(t * 8) * .3; alpha(c, glow * .5, () => disc(c, 0, 1, 7, '#ff9d5a')); alpha(c, glow, () => disc(c, 0, 1, 3.5, '#ffd27a'));
    c.restore();
  }
  // Fires that break out across a boss hull as it loses health (boss-local offsets per stage).
  const BOSS_FIRES = [[[-20, -24], [18, 8], [-14, 14], [24, -30]], [[-22, -14], [20, 10], [-8, 20], [26, -18]], [[-40, 8], [36, 12], [-18, 2], [18, -6]], [[-30, -16], [32, 14], [-20, 16], [28, -20]]];
  function boss(c, e, stage, t, sink = 0) {
    const x = Math.round(e.x), y = Math.round(e.y), hurt = e.hurt > 0, phase = e.phase || 0;
    c.save(); c.translate(x, y); edgeY = 1; if (sink) c.scale(1 - sink * .14, 1 - sink * .14);
    const metal = hurt ? '#fff3d6' : ['#5f6b70', '#9c7a48', '#4d5e82', '#6b3f3f'][stage], lit = tone(metal, .3), shade = tone(metal, -.3), dark = '#262a2e', glow = phase > 1 ? '#ff6a4a' : '#ffb35a';
    const gun = (gx, gy, r) => { disc(c, gx + 1, gy + 1, r + 1, '#14171a'); disc(c, gx, gy, r + 1, dark); disc(c, gx, gy, r, '#4d575c'); c.save(); c.translate(gx, gy); c.rotate(-(e.aim || -Math.PI / 2) - Math.PI / 2); D.rect(c, -2, 2, 2, r + 7, '#15181b'); D.rect(c, 1, 2, 2, r + 7, '#15181b'); c.restore(); alpha(c, .8, () => disc(c, gx, gy, 1.5, glow)); };
    if (stage === 0) { // Armoured battleship
      for (let i = 0; i < 5; i++) { const age = (t * 1.1 + i / 5) % 1; alpha(c, (1 - age) * .5, () => { D.rect(c, -36 - age * 14, -44 - age * 22, 4, 2, '#e8f4f7'); D.rect(c, 33 + age * 14, -44 - age * 22, 4, 2, '#e8f4f7'); }); }
      solid(c, [0, 46, 34, 18, 34, -40, 28, -46, -28, -46, -34, -40, -34, 18], metal, '#1a1f22');
      poly(c, lit, [0, 46, -34, 18, -34, -40, -31, -40, -31, 17, 0, 42]); poly(c, shade, [0, 46, 34, 18, 34, -40, 31, -40, 31, 17, 0, 42]);
      solid(c, [-22, -32, 22, -32, 22, 12, -22, 12], '#7d898d'); for (let i = 0; i < 5; i++) D.rect(c, -20, -28 + i * 8, 40, 1, '#6b777b');
      solid(c, [-7, -16, 7, -16, 7, 2, -7, 2], '#bfc8c4'); D.rect(c, -5, -13, 10, 2, '#26404e'); D.rect(c, -2, -24, 4, 8, '#3a4246');
      for (const [tx, ty] of [[-18, -22], [18, -22], [0, 24], [-18, 4], [18, 4]]) gun(tx, ty, 4);
    } else if (stage === 1) { // Desert crawler
      for (const tx of [-46, 32]) { D.rect(c, tx + 1, -29, 14, 62, '#14120e'); D.rect(c, tx, -30, 14, 62, '#2c2822'); for (let i = 0; i < 6; i++) D.rect(c, tx + 1, -28 + ((i * 11 + Math.floor(t * 30)) % 60), 12, 3, '#5c5240'); }
      solid(c, [-32, -26, 32, -26, 32, 28, -32, 28], metal); D.rect(c, -32, -26, 64, 2, lit); D.rect(c, -32, -26, 2, 54, lit); D.rect(c, -32, 25, 64, 3, shade);
      for (const vx of [-26, 20]) for (let i = 0; i < 3; i++) D.rect(c, vx, -20 + i * 5, 6, 2, '#3e3424');
      solid(c, [-18, -12, 18, -12, 18, 18, -18, 18], '#6d5a3a'); D.rect(c, -18, -12, 36, 1, '#8a7450');
      c.save(); c.rotate(-(e.aim || -Math.PI / 2) - Math.PI / 2); D.rect(c, -5, 0, 10, 36, '#14120e'); D.rect(c, -4, 0, 8, 34, dark); D.rect(c, -6, 32, 12, 4, '#3a352c'); c.restore();
      disc(c, 0, 0, 9, '#3a352c'); disc(c, 0, 0, 7, '#5a4c34'); alpha(c, .7 + Math.sin(t * 6) * .3, () => disc(c, 0, 0, 4, glow)); D.rect(c, -1, -1, 2, 2, '#fff2c8');
    } else if (stage === 2) { // Flying wing
      solid(c, [0, -30, 62, 10, 46, 22, 0, 6, -46, 22, -62, 10], metal, '#151c2a');
      poly(c, lit, [0, -30, -62, 10, -56, 12, 0, -24]); poly(c, lit, [0, -30, 62, 10, 56, 12, 0, -24]); poly(c, shade, [0, 6, -46, 22, -46, 18, 0, 2]); poly(c, shade, [0, 6, 46, 22, 46, 18, 0, 2]);
      for (const ex of [-40, -20, 20, 40]) { solid(c, [ex - 4, -2, ex + 4, -2, ex + 4, 10, ex - 4, 10], dark); const f = .6 + Math.sin(t * 14 + ex) * .4; alpha(c, f, () => { disc(c, ex, 13, 3.5, glow); disc(c, ex, 13, 1.6, '#fff2c8'); }); }
      solid(c, [-8, -16, 8, -16, 8, -4, -8, -4], '#22324a'); D.rect(c, -3, -13, 6, 4, '#9fd3ff'); D.rect(c, -2, -13, 2, 2, '#e6f6ff');
      for (const gx of [-28, 28]) gun(gx, 2, 3);
    } else { // Citadel engine core
      solid(c, [-50, -34, 50, -34, 50, 30, -50, 30], '#3b3036', '#140f12'); D.rect(c, -50, -34, 100, 2, '#56474e');
      solid(c, [-42, -26, 42, -26, 42, 22, -42, 22], metal); D.rect(c, -42, -26, 84, 2, lit); D.rect(c, -42, 19, 84, 3, shade);
      for (const [vx, vy] of [[-46, -30], [44, -30], [-46, 26], [44, 26]]) D.rect(c, vx, vy, 3, 3, '#7a6a70');
      for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * TAU / 4, px = Math.cos(a) * 30, py = Math.sin(a) * 14; disc(c, px + 1, py + 1, 6, '#140f12'); disc(c, px, py, 6, dark); disc(c, px, py, 3, '#5a4c54'); alpha(c, .8, () => D.rect(c, px - 1, py - 1, 2, 2, glow)); }
      const pulse = Math.sin(t * 6) * 2; alpha(c, .35, () => disc(c, 0, 0, 17 + pulse, glow)); disc(c, 0, 0, 11 + pulse, glow); disc(c, 0, 0, 6 + pulse * .5, '#ffd27a'); D.rect(c, -3, -3, 6, 6, '#fff2c8');
    }
    const fires = phase === 0 ? 0 : phase === 1 ? 2 : 4;
    for (let i = 0; i < fires; i++) { const [fx, fy] = BOSS_FIRES[stage][i]; D.rect(c, fx - 3, fy - 1, 7, 2, '#1a1414'); D.rect(c, fx - 1, fy - 3, 2, 6, '#1a1414'); }
    c.restore();
    for (let i = 0; i < fires; i++) { const [fx, fy] = BOSS_FIRES[stage][i]; smoke(c, x + fx * (1 - sink * .14), y + fy * (1 - sink * .14), t + i * .37, .9); }
  }

  // ---- Explosions ----------------------------------------------------------------------------
  // A blast is a white flash, then a fireball of overlapping lobes whose rings cool from the core
  // outward (white, yellow, orange, red, ember), then drifting smoke. Its shape comes from a hash
  // of its seed, so it is drawn purely from state and never touches gameplay randomness.
  const FIRE = ['#fffbe8', '#ffe28a', '#ffae45', '#f2672e', '#b8381f', '#5a2a22'];
  function blast(c, b) {
    if (b.t < 0) return;
    const k = b.t / b.life, X = sx(b.x), Y = sy(b.y), R = b.r, s = b.seed;
    const grow = Math.min(1, k / .2), fade = k > .72 ? 1 - (k - .72) / .28 : 1;
    if (b.ring) alpha(c, (1 - k) * .85, () => { c.strokeStyle = '#fff0c8'; c.lineWidth = Math.max(1, 3.5 * (1 - k)); c.beginPath(); c.arc(X, Y, R * (.6 + 2.8 * k), 0, TAU); c.stroke(); });
    const base = c.globalAlpha;
    if (k > .16) {
      const sa = Math.min(1, (k - .16) * 3.5) * (1 - k) * .8;
      for (let i = 0; i < 6; i++) {
        const h = hash(s + i * 13), a = (h % 628) / 100, d = R * (.25 + .8 * Math.sqrt(k)) * (.6 + ((h >> 10) % 40) / 100);
        const px = X + Math.cos(a) * d, py = Y + Math.sin(a) * d - k * R * .6, pr = R * (.3 + .45 * k) * (.7 + ((h >> 16) % 30) / 100);
        c.globalAlpha = base * sa; disc(c, px, py, pr, '#3d3531');
        if (R >= 14) { c.globalAlpha = base * sa * .55; disc(c, px - pr * .3, py - pr * .3, pr * .55, '#6e6259'); }
      }
    }
    // Rings that have cooled past the last ember colour are skipped, so late frames draw less.
    const lobes = R < 12 ? 4 : R < 18 ? 5 : 7, shift = Math.floor(k * 4.4);
    c.globalAlpha = base * fade;
    for (let i = 0; i < lobes; i++) {
      const h = hash(s + i * 7 + 1), a = (h % 628) / 100, d = i ? R * .45 * grow * (.5 + ((h >> 9) % 50) / 100) : 0;
      const lx = X + Math.cos(a) * d, ly = Y + Math.sin(a) * d - k * R * .25, lr = R * (i ? .44 : .62) * (.75 + ((h >> 17) % 25) / 100) * (.35 + .65 * grow) * (1 - k * .3);
      for (let j = Math.max(0, shift - 1); j < 5; j++) disc(c, lx, ly, lr * (1 - j * .18), FIRE[4 - j + shift]);
    }
    c.globalAlpha = base;
    if (k < .13) {
      const f = 1 - k / .13;
      alpha(c, f, () => { disc(c, X, Y, R * (.45 + k * 3.5), '#ffffff'); c.save(); c.translate(X, Y); c.rotate((s % 100) / 100 * TAU); for (let i = 0; i < 6; i++) { c.rotate(TAU / 6); D.rect(c, 0, -.5, R * 1.7 * f, 1, '#fff6d0'); } c.restore(); });
    }
  }
  function debris(c, d) {
    const k = d.t / d.life, X = sx(d.x), Y = sy(d.y), sc = d.ground ? 1 : 1 - k * .55;
    for (let i = 1; i <= 3; i++) alpha(c, (1 - k) * .4 / i, () => disc(c, X - d.vx * .03 * i, Y + d.vy * .03 * i, 1 + i * .8, '#4a423d'));
    c.save(); c.translate(X, Y); c.rotate(d.a); c.scale(sc, sc);
    D.rect(c, -d.size / 2, -1, d.size, 2, d.color); D.rect(c, -d.size / 2, -1, d.size, 1, tone(d.color, .3));
    if (k < .6 && Math.floor(d.t * 20 + d.size) % 2) D.rect(c, d.size / 2 - 1, -1, 2, 2, '#ffb35a');
    c.restore();
  }
  function scorch(c, m, t) {
    const X = sx(m.x), Y = sy(m.y);
    if (m.sea) {
      alpha(c, .4, () => oval(c, X, Y, m.r * 1.3, m.r * .85, '#123a52'));
      if (m.t < 1.8) alpha(c, (1 - m.t / 1.8) * .7, () => { c.strokeStyle = '#e8f6f6'; c.lineWidth = 1; c.beginPath(); c.ellipse(X, Y, m.r * (.6 + m.t * 1.1), m.r * (.4 + m.t * .7), 0, 0, TAU); c.stroke(); });
      for (let i = 0; i < 4; i++) { const h = hash(m.seed + i); D.rect(c, X + (h % 17) - 8 + Math.sin(t + i) , Y + ((h >> 8) % 11) - 5, 2 + (h >> 16) % 3, 1, '#3b332c'); }
      return;
    }
    alpha(c, .5, () => { for (let i = 0; i < 5; i++) { const h = hash(m.seed + i * 3), a = (h % 628) / 100; disc(c, X + Math.cos(a) * m.r * .45, Y + Math.sin(a) * m.r * .3, m.r * (.45 + ((h >> 12) % 30) / 100), '#2a2018'); } disc(c, X, Y, m.r * .5, '#120d0a'); });
    if (m.t < 5) for (let i = 0; i < 4; i++) { const h = hash(m.seed + i * 11); if ((Math.floor(t * 7) + i) % 3) alpha(c, 1 - m.t / 5, () => D.rect(c, X + (h % 13) - 6, Y + ((h >> 8) % 9) - 4, 1, 1, i % 2 ? '#ff8a3c' : '#ffd27a')); }
    if (m.t < 3) smoke(c, X, Y, t + m.seed % 7, (1 - m.t / 3) * .8, -1, false);
  }

  A.Kestrel = class extends A.Game {
    constructor(options, sound) {
      super(options, sound); this.id = 'kestrel'; this.options.players = 1; this.stage = 0;
      this.lives = this.relaxed ? 5 : 3; this.bombStock = this.relaxed ? 4 : 3; this.power = 1; this.medal = 100; this.nextLife = 50000;
      this.rand = A.rng(7741); this.bonus = 0; this.fxSeq = 0; this.setup();
    }
    setup() {
      const st = STAGES[this.stage];
      this.player = { body: A.V2D.createBody2D({ x: 120 * SUB, y: 30 * SUB }), x: 120, y: 30, inv: 2, cd: 0, rocketCD: 0, loop: 0, loopCD: 0, armour: this.relaxed ? 1 : 0, alive: true, respawn: 0 };
      this.bombs = Math.max(this.bombStock, this.relaxed ? 4 : 3); this.bombCD = 0; this.bombFlash = 0;
      this.enemies = []; this.shots = []; this.bullets = []; this.items = []; this.particles.items = []; this.effects.items = [];
      this.blasts = []; this.debris = []; this.scorch = []; this.wreck = null;
      this.pending = []; this.clock = 0; this.scroll = 0; this.misses = 0; this.bossSpawned = false; this.midSpawned = false; this.kills = 0; this.graze = 0;
      // Deterministic schedule: formations from the front's pool, carriers with power-ups, a mid-boss, the boss.
      const plan = [], rand = A.rng(4400 + this.stage * 97);
      for (let t = 2; t < st.length - 3; t += 2.1 + rand() * 1.4) plan.push({ t, wave: st.pool[Math.floor(rand() * st.pool.length)], seed: Math.floor(rand() * 1e6) });
      for (const [t, drop] of [[11, 'P'], [27, 'B'], [43, 'P'], [60, 'P'], [72, 'B']]) plan.push({ t, wave: 'carrier', drop, seed: t });
      plan.push({ t: Math.round(st.length * .5), wave: 'warden' });
      this.plan = plan.sort((a, b) => a.t - b.t); this.planIndex = 0;
    }
    menu() {
      const st = STAGES[this.stage], clear = this.state === 'stageclear';
      return { eyebrow: 'KESTREL STRIKE · FRONT ' + (this.stage + 1) + ' / 4 · ' + st.name,
        title: clear ? 'Front secured. +' + this.bonus + ' bonus.' : this.stage === 0 ? 'One propeller. Four fronts. No retreat.' : 'The next front is waiting.',
        description: 'Fly the Kestrel up four hostile fronts. Shoot down formations, sink gunboats and tanks, catch the red courier planes for power-ups and bombs, and bring down ' + st.boss + ' at the end of the front.',
        details: 'WASD / arrows fly · hold J / A to fire · K / B bomb (clears bullets) · Space / X loop (brief invulnerability, recharges) · P raises firepower, B adds a bomb, medals grow in value until one is missed. Bullets that skim past you score graze points. Extra plane at 50,000 and every 120,000.' + (this.relaxed ? ' Relaxed: five planes, four bombs and one shield hit per plane.' : ''),
        button: clear ? 'Fly to ' + STAGES[this.stage + 1].name : 'Take off', action: 'start' };
    }
    action(id) {
      if (id !== 'start') return;
      if (this.state === 'stageclear') { this.stage++; this.setup(); this.state = 'playing'; this.say(STAGES[this.stage].name + ' · FRONT ' + (this.stage + 1), 2.5); }
      else if (this.state === 'briefing') { this.state = 'playing'; this.say('CORAL STRAIT · HOLD J TO FIRE', 2.5); }
    }
    addEnemy(kind, o = {}) {
      if (this.enemies.length >= 44) return null;
      const def = KINDS[kind], stageHP = kind === 'boss' ? def.hp + this.stage * 140 : kind === 'warden' ? def.hp + this.stage * 40 : def.hp + Math.floor(this.stage * def.hp * .2);
      const e = { kind, x: 120, y: 260, vx: 0, vy: -60, hp: stageHP, maxHP: stageHP, r: def.r, cd: .8 + this.rand() * 1.2, t: 0, hurt: 0, aim: -Math.PI / 2, ...o };
      this.enemies.push(e); return e;
    }
    spawnWave(w) {
      const r = A.rng(w.seed || 1), st = this.stage;
      if (w.wave === 'gnat') {
        const swoop = r() < .5, side = r() < .5 ? -1 : 1, x0 = 40 + r() * 160;
        for (let i = 0; i < 5; i++) this.pending.push({ at: this.clock + i * .28, kind: 'gnat', o: { x: A.clamp(x0 + (swoop ? 0 : (i - 2) * 22), 14, 226), y: 258, vy: -(78 + st * 8), path: swoop ? 'swoop' : 'dive', side, phase: i } });
      } else if (w.wave === 'swallow') {
        const left = r() < .5;
        for (let i = 0; i < 6; i++) this.pending.push({ at: this.clock + (i % 3) * .18, kind: 'swallow', o: { x: left ? -10 - (i % 3) * 14 : 250 + (i % 3) * 14, y: 236 - Math.floor(i / 3) * 18 + (i % 3) * 6, vx: left ? 120 + st * 10 : -(120 + st * 10), vy: -10, path: 'cross' } });
      } else if (w.wave === 'gunboat' || w.wave === 'tank' || w.wave === 'turret') {
        const n = w.wave === 'turret' ? 2 : 1 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) this.addEnemy(w.wave, { x: 30 + r() * 180, y: 262 + i * 30, vx: w.wave === 'tank' ? (r() - .5) * 18 : 0, vy: -SCROLL, cd: 1 + r() });
      } else if (w.wave === 'bomber') this.addEnemy('bomber', { x: 50 + r() * 140, y: 290, vy: -22, path: 'bomber', cd: 1.4 });
      else if (w.wave === 'carrier') { const left = (w.seed % 2) === 0; this.addEnemy('carrier', { x: left ? -12 : 252, y: 200, vx: left ? 70 : -70, vy: -6, drop: w.drop, path: 'cross' }); }
      else if (w.wave === 'warden') { this.addEnemy('warden', { x: 120, y: 300, vy: -40, path: 'warden', cd: 2 }); this.midSpawned = true; this.say(STAGES[st].mid + ' INBOUND', 2.5); this.sound('alert'); }
    }
    spawnBoss() {
      this.bossSpawned = true; this.addEnemy('boss', { x: 120, y: 330, vy: -30, path: 'boss', cd: 2, phase: 0, spin: 0 });
      this.say(STAGES[this.stage].boss + ' APPROACHES', 3); this.sound('alert');
    }
    fireAt(e, speed, spread = [0], extra = {}) {
      const p = this.player, aim = Math.atan2(p.y - e.y, p.x - e.x);
      for (const off of spread) this.bullet(e.x, e.y - 4, aim + off, speed, extra);
    }
    bullet(x, y, angle, speed, extra = {}) { if (this.bullets.length < MAX_ENEMY_BULLETS) this.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 2.5, grazed: false, ...extra }); }
    ring(e, n, speed, offset = 0) { for (let i = 0; i < n; i++) this.bullet(e.x, e.y, offset + i * TAU / n, speed, { big: true }); }
    enemyFire(e, dt) {
      const p = this.player, slow = this.relaxed ? 1.5 : 1, base = 76 + this.stage * 11;
      if (!p.alive || e.y > 250 || e.y < 18 || e.x < -5 || e.x > 245) return;
      e.cd -= dt; if (e.cd > 0) return;
      const frac = e.hp / e.maxHP;
      switch (e.kind) {
        case 'gnat': if (e.y > p.y + 30) this.fireAt(e, base + 14); e.cd = (2.2 - this.stage * .2 + this.rand()) * slow; break;
        case 'gunboat': case 'tank': this.fireAt(e, base, e.kind === 'gunboat' ? [-.12, .12] : [0]); e.cd = (1.7 - this.stage * .15) * slow; break;
        case 'turret': this.fireAt(e, base + 6, [-.25, 0, .25]); e.cd = 1.5 * slow; break;
        case 'bomber': this.fireAt(e, base - 6, [-.36, -.18, 0, .18, .36]); e.cd = 1.5 * slow; break;
        case 'carrier': case 'swallow': e.cd = 99; break;
        case 'warden': e.volley = (e.volley || 0) + 1; if (e.volley % 2) this.fireAt(e, base + 10, [-.42, -.28, -.14, 0, .14, .28, .42]); else this.ring(e, 12 + this.stage * 2, base - 10, e.t); e.cd = 1.25 * slow; break;
        case 'boss':
          e.phase = frac > .66 ? 0 : frac > .33 ? 1 : 2; e.volley = (e.volley || 0) + 1;
          if (e.phase === 0) { this.fireAt(e, base + 18, [-.3, -.15, 0, .15, .3]); if (e.volley % 3 === 0) this.ring(e, 14 + this.stage * 2, base - 14, e.t * .7); e.cd = .95 * slow; }
          else if (e.phase === 1) { this.ring(e, 18 + this.stage * 2, base - 6, e.t); this.fireAt(e, base + 24, [-.12, 0, .12]); e.cd = 1.2 * slow; }
          else { for (let arm = 0; arm < 3; arm++) this.bullet(e.x, e.y, e.t * 2.4 + arm * TAU / 3, base, { big: true }); if (e.volley % 6 === 0) this.fireAt(e, base + 30, [-.2, 0, .2]); e.cd = .14 * slow; }
          break;
      }
    }
    moveEnemy(e, dt) {
      e.t += dt; e.hurt = Math.max(0, e.hurt - dt);
      switch (e.path) {
        case 'dive': e.x += Math.sin(e.t * 2.4 + e.phase) * 26 * dt + (e.vx || 0) * dt; e.y += e.vy * dt; if (e.y < 125 && !e.peel) { e.peel = true; e.vx = e.x < this.player.x ? -95 : 95; e.vy = -28; } break;
        case 'swoop': e.y += e.vy * dt; if (e.t > .9) { e.vx = A.clamp((e.vx || 0) + e.side * 150 * dt, -120, 120); e.vy = Math.min(-20, e.vy + 40 * dt); } e.x += (e.vx || 0) * dt; break;
        case 'bomber': e.y += e.vy * dt; if (e.y < 175 && e.t < 13) e.vy = -6; else if (e.t >= 13) e.vy = -40; e.x += Math.sin(e.t * .7) * 10 * dt; break;
        case 'warden': if (e.y > 185) e.y += e.vy * dt; else { e.x = 120 + Math.sin(e.t * .8) * 70; if (e.t > 32) e.y += 30 * dt; } break;
        case 'boss': if (e.y > 190) e.y += e.vy * dt; else e.x = 120 + Math.sin(e.t * (.5 + e.phase * .15)) * (50 + e.phase * 8); break;
        default: e.x += (e.vx || 0) * dt; e.y += e.vy * dt;
      }
      if (KINDS[e.kind].ground || e.kind === 'boss') e.aim = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    }
    // Presentation only: hashes a running counter for shape and debris, never this.rand.
    explode(x, y, r, o = {}) {
      const seed = hash(++this.fxSeq * 977 + this.stage * 131), ground = !!o.ground;
      if (this.blasts.length >= MAX_BLASTS) this.blasts.shift();
      this.blasts.push({ x, y, vx: o.vx || 0, vy: ground ? -SCROLL : o.vy || 0, r, t: -(o.delay || 0), life: o.life || .42 + r * .014, seed, ground, ring: !!o.ring });
      for (let i = 0; i < (o.debris || 0); i++) {
        const h = hash(seed + i * 101), a = (h % 628) / 100, v = 40 + (h >> 10) % 90;
        if (this.debris.length >= MAX_DEBRIS) this.debris.shift();
        this.debris.push({ x, y, vx: Math.cos(a) * v + (o.vx || 0), vy: Math.sin(a) * v + (ground ? 0 : o.vy || 0), t: 0, life: .5 + ((h >> 18) % 50) / 100, a, spin: (h >> 4) % 21 - 10, size: 2 + (h >> 22) % 4, color: o.metal || '#3b3430', ground });
      }
      if (o.sparks) this.particles.burst(x, y, o.spark || '#ffe9b0', o.sparks, 80 + r * 3, { size: 1, life: .28 });
    }
    // Kill effects sized to the target: small fighters pop, bombers and the mid-boss chain-explode.
    killEffects(e) {
      const def = KINDS[e.kind], kind = STAGES[this.stage].kind, metal = e.kind === 'bomber' ? ['#5c6b50', '#7d6a4b', '#506078', '#5d4a52'][this.stage] : '#3b3430';
      const o = def.ground ? { ground: true } : { vx: (e.vx || 0) * .35, vy: (e.vy || 0) * .35 };
      if (def.ground) {
        this.explode(e.x, e.y, 16, { ...o, debris: 6, sparks: 12, spark: '#ffd27a' }); this.explode(e.x + 5, e.y - 4, 10, { ...o, delay: .1 });
        if (kind !== 'cloud') { this.scorch.push({ x: e.x, y: e.y, r: e.r * 1.3, seed: hash(this.fxSeq + 5), t: 0, sea: kind === 'sea' }); if (this.scorch.length > MAX_SCORCH) this.scorch.shift(); }
      } else if (e.kind === 'bomber' || e.kind === 'warden') {
        const w = e.kind === 'warden', span = w ? 32 : 22;
        this.explode(e.x, e.y, w ? 28 : 22, { ...o, ring: true, debris: w ? 14 : 10, sparks: 24, metal, life: .9 });
        for (let i = 0; i < (w ? 6 : 4); i++) this.explode(e.x + (i % 2 ? span : -span) * (1 - i * .12), e.y + (i % 3 - 1) * 8, w ? 13 : 11, { ...o, delay: .08 + i * .09 });
        this.shake = .25;
      } else {
        this.explode(e.x, e.y, e.kind === 'carrier' ? 16 : 13, { ...o, debris: 4, sparks: 10 }); this.explode(e.x + 4, e.y + 3, 9, { ...o, delay: .07 });
        if (e.kind === 'carrier') this.particles.burst(e.x, e.y, '#f2d36b', 10, 70, { size: 1, life: .4 });
      }
    }
    damage(e, amount) {
      if (e.hp <= 0 || this.state !== 'playing') return;
      e.hp -= amount; e.hurt = .06;
      if (e.hp > 0) { if (e.kind === 'boss' || e.kind === 'warden' || e.kind === 'bomber') this.sound('hit'); return; }
      const def = KINDS[e.kind];
      this.score += def.score + (e.kind === 'boss' ? this.stage * 5000 : 0); this.kills++;
      this.sound('boom');
      if (e.kind === 'boss') this.startWreck(e); else this.killEffects(e);
      if (e.kind === 'carrier') this.items.push({ x: e.x, y: e.y, kind: e.drop || 'P', vy: -28, t: 0 });
      else if (def.ground || (e.kind === 'bomber' && this.rand() < .5)) this.items.push({ x: e.x, y: e.y, kind: 'M', vy: -SCROLL, t: 0 });
      if (e.kind === 'bomber') this.items.push({ x: e.x + 10, y: e.y, kind: 'P', vy: -28, t: 0 });
      if (e.kind === 'warden') { this.items.push({ x: e.x, y: e.y, kind: 'B', vy: -28, t: 0 }); this.say(STAGES[this.stage].mid + ' DOWN', 2); }
    }
    // The boss breaks up over WRECK_TIME seconds of chained explosions, then a final blast clears the
    // front. Bullets vanish, the plane is untouchable and remaining escorts go down with it.
    startWreck(e) {
      this.wreck = { x: e.x, y: e.y, aim: e.aim, t: 0, pops: 0, final: false, seed: hash(this.stage * 7919 + 13) };
      this.bullets = []; this.shake = .35; this.player.inv = Math.max(this.player.inv, 1);
      this.say(STAGES[this.stage].boss + ' IS GOING DOWN', 2.5);
      for (const o of this.enemies) if (o !== e && o.hp > 0) this.damage(o, 1e6);
    }
    updateWreck(dt) {
      const w = this.wreck, p = this.player; w.t += dt; w.y -= 8 * dt; p.inv = Math.max(p.inv, .5); this.bullets = [];
      while (!w.final && w.pops < Math.floor(w.t / .08)) {
        const h = hash(w.seed + ++w.pops);
        this.explode(w.x + (h % 81 - 40) * .9, w.y + ((h >> 8) % 61 - 30) * .8, 11 + (h >> 16) % 13, { debris: w.pops % 3 ? 0 : 3, sparks: 6, ring: w.pops % 6 === 0 });
        if (w.pops % 4 === 0) { this.shake = Math.max(this.shake, .12); this.sound('boom'); }
      }
      if (!w.final && w.t >= WRECK_TIME) {
        w.final = true; this.bombFlash = 1; this.shake = .5; this.sound('bomb');
        this.explode(w.x, w.y, 48, { ring: true, debris: 18, sparks: 40, life: 1.2 });
        for (let i = 0; i < 6; i++) this.explode(w.x + Math.cos(i * 1.05) * 30, w.y + Math.sin(i * 1.05) * 22, 16, { delay: .1 + i * .06, life: .8 });
      }
      if (w.t >= WRECK_END) { this.wreck = null; this.clearStage(); }
    }
    clearStage() {
      if (this.state !== 'playing') return;
      this.bonus = this.bombs * 1000 + (this.misses === 0 ? 10000 : 0) + this.graze * 10;
      this.score += this.bonus; this.bullets = []; this.bombStock = this.bombs;
      this.lifeCheck();
      if (this.stage === STAGES.length - 1) this.finish(true); else { this.state = 'stageclear'; this.sound('win'); }
    }
    lifeCheck() { while (this.score >= this.nextLife) { this.lives = Math.min(9, this.lives + 1); this.nextLife += 120000; this.say('EXTRA PLANE', 2); this.sound('bank'); } }
    hitPlayer() {
      const p = this.player; if (!p.alive || p.inv > 0 || p.loop > 0 || this.wreck || this.state !== 'playing') return;
      if (p.armour > 0) { p.armour--; p.inv = 1.5; this.sound('hurt'); this.say('SHIELD LOST', 1.5); return; }
      this.lives--; this.misses++; p.alive = false; p.respawn = 1.2; this.medal = 100;
      this.power = Math.max(1, this.power - 1); this.bullets = []; this.shake = .3;
      this.explode(p.x, p.y, 22, { ring: true, debris: 10, sparks: 30, metal: '#bac7c1', life: .8 }); for (let i = 0; i < 3; i++) this.explode(p.x + (i - 1) * 9, p.y + (i % 2) * 6, 9, { delay: .1 + i * .08 }); this.sound('hurt');
      if (this.lives <= 0) this.finish(false); else this.say('PLANE DOWN · ' + this.lives + ' LEFT', 2);
    }
    bomb() {
      const p = this.player; if (this.bombs <= 0 || this.bombCD > 0 || !p.alive) return;
      this.bombs--; this.bombCD = .8; this.bombFlash = 1; p.inv = Math.max(p.inv, 1.6);
      this.score += this.bullets.length * 10; for (const b of this.bullets) this.particles.burst(b.x, b.y, '#fff3c2', 1, 30, { life: .3 });
      this.bullets = []; this.effects.add('blast', p.x, p.y, '#fff1c0', 150, .7); this.shake = .3; this.sound('bomb');
      for (const e of [...this.enemies]) if (e.y < 250 && e.y > 0) this.damage(e, e.kind === 'boss' ? 40 : e.kind === 'warden' ? 30 : 24);
    }
    fire() {
      const p = this.player, pw = this.power; p.cd = .085;
      for (const [ox, a] of LANES[pw - 1]) if (this.shots.length < MAX_SHOTS) this.shots.push({ x: p.x + ox, y: p.y + 12, vx: Math.sin(a) * SHOT_SPEED, vy: Math.cos(a) * SHOT_SPEED, damage: 1 });
      if (pw >= 5 && p.rocketCD <= 0) { p.rocketCD = .36; for (const side of [-1, 1]) if (this.shots.length < MAX_SHOTS) this.shots.push({ x: p.x + side * 12, y: p.y, vx: side * 40, vy: 160, damage: 2, rocket: true }); }
      if (Math.floor(this.clock / .085) % 2 === 0) this.sound('fire');
    }
    collect(it) {
      if (it.kind === 'P') { if (this.power < 5) { this.power++; this.say('FIREPOWER ' + this.power + ' / 5', 1.2); } else this.score += 2000; this.sound('power'); }
      else if (it.kind === 'B') { this.bombs = Math.min(6, this.bombs + 1); this.say('BOMB +1', 1.2); this.sound('power'); }
      else { this.score += this.medal; this.say('MEDAL +' + this.medal, .8); this.medal = Math.min(1000, this.medal + 100); this.sound('medal'); }
    }
    update(dt, inputs) {
      if (this.state !== 'playing') return; this.common(dt);
      const p = this.player, a = inputs[0] || A.emptyInput(), st = STAGES[this.stage];
      this.clock += dt; this.scroll += SCROLL * dt; this.bombCD -= dt; this.bombFlash = Math.max(0, this.bombFlash - dt * 1.6);
      // Player: integer motion2d shmup profile (2 px per tick), field bounds enforced in subunits.
      if (p.alive) {
        p.body = A.V2D.stepBody2D(p.body, { x: axis(a.x), y: -axis(a.y) }, { profile: 'shmup', bounds: BOUNDS });
        p.x = p.body.x / SUB; p.y = p.body.y / SUB;
        p.inv = Math.max(0, p.inv - dt); p.cd -= dt; p.rocketCD -= dt; p.loop = Math.max(0, p.loop - dt); p.loopCD -= dt;
        if (a.jumpPressed && p.loopCD <= 0) { p.loop = .9; p.loopCD = this.relaxed ? 3.5 : 5; this.sound('loop'); }
        if (a.specialPressed) this.bomb();
        if (a.fire && p.cd <= 0) this.fire();
      } else if ((p.respawn -= dt) <= 0) {
        p.alive = true; p.inv = 2.5; p.armour = this.relaxed ? 1 : 0; p.body = A.V2D.createBody2D({ x: 120 * SUB, y: 30 * SUB }); p.x = 120; p.y = 30;
        this.bombs = Math.max(this.bombs, 2);
      }
      // Schedule.
      while (this.planIndex < this.plan.length && this.plan[this.planIndex].t <= this.clock) this.spawnWave(this.plan[this.planIndex++]);
      for (const s of this.pending) if (s.at <= this.clock) { this.addEnemy(s.kind, s.o); s.done = true; }
      this.pending = this.pending.filter(s => !s.done);
      if (!this.bossSpawned && this.clock >= st.length && !this.enemies.some(e => e.kind === 'warden')) this.spawnBoss();
      // Enemies.
      for (const e of this.enemies) {
        if (e.hp <= 0) continue; this.moveEnemy(e, dt); this.enemyFire(e, dt);
        if (!KINDS[e.kind].ground && p.alive && A.near(e, p, e.r * .7 + 3)) { this.hitPlayer(); this.damage(e, 4); }
      }
      // Player shots.
      for (const s of this.shots) {
        if (s.rocket) { let target = null, best = 1e9; for (const e of this.enemies) if (e.hp > 0 && e.y > s.y && e.y < 250) { const d = Math.abs(e.x - s.x) + (e.y - s.y) * .3; if (d < best) { best = d; target = e; } } if (target) s.vx += A.clamp(target.x - s.x, -1, 1) * 600 * dt; s.vx = A.clamp(s.vx, -120, 120); s.vy = Math.min(300, s.vy + 300 * dt); }
        s.x += s.vx * dt; s.y += s.vy * dt;
        for (const e of this.enemies) if (e.hp > 0 && A.near(s, e, e.r + 3)) { this.damage(e, s.damage); s.dead = true; this.particles.burst(s.x, s.y, '#fff6d0', 2, 40, { life: .15, size: 1 }); break; }
      }
      this.shots = this.shots.filter(s => !s.dead && s.y < 250 && s.x > -10 && s.x < 250);
      // Enemy bullets: hit, graze, expire.
      for (const b of this.bullets) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (!p.alive) continue;
        if (A.near(b, p, 1.5 + b.r * .6)) { this.hitPlayer(); b.dead = true; } // small core hitbox (genre standard)
        else if (!b.grazed && p.inv <= 0 && A.near(b, p, 14)) { b.grazed = true; this.graze++; this.score += 20; this.particles.burst(p.x, p.y, '#a8f0ff', 2, 30, { life: .18, size: 1 }); }
      }
      this.bullets = this.bullets.filter(b => !b.dead && b.x > -8 && b.x < 248 && b.y > -8 && b.y < 255);
      // Items drift down; medals missed off the bottom reset the medal chain.
      for (const it of this.items) {
        it.t += dt; it.y += it.vy * dt; it.x += Math.sin(it.t * 2) * 12 * dt;
        if (p.alive && A.near(it, p, 13)) { it.dead = true; this.collect(it); }
        else if (it.y < -8) { it.dead = true; if (it.kind === 'M' && this.medal > 100) { this.medal = 100; this.say('MEDAL MISSED · CHAIN RESET', 1.2); } }
      }
      this.items = this.items.filter(it => !it.dead).slice(-24);
      this.enemies = this.enemies.filter(e => e.hp > 0 && e.y > -40 && e.y < 360 && e.x > -60 && e.x < 300);
      // Presentation: blasts drift with what exploded (ground blasts scroll with the terrain).
      for (const b of this.blasts) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; if (!b.ground) { b.vx *= .94; b.vy *= .94; } }
      this.blasts = this.blasts.filter(b => b.t < b.life);
      for (const d of this.debris) { d.t += dt; d.x += d.vx * dt; d.y += (d.vy - (d.ground ? SCROLL : 0)) * dt; d.vx *= .95; d.vy *= .95; d.a += d.spin * dt; }
      this.debris = this.debris.filter(d => d.t < d.life);
      for (const m of this.scorch) { m.t += dt; m.y -= SCROLL * dt; }
      this.scorch = this.scorch.filter(m => m.y > -30);
      if (this.wreck) this.updateWreck(dt);
      if (this.state === 'playing') this.lifeCheck();
    }
    status() {
      const boss = this.enemies.find(e => e.kind === 'boss');
      return STAGES[this.stage].name + ' · Front ' + (this.stage + 1) + '/4 · Planes ' + this.lives + ' · Bombs ' + this.bombs + ' · Power ' + this.power + '/5' + (boss ? ' · Boss ' + Math.ceil(boss.hp / boss.maxHP * 100) + '%' : '') + ' · Score ' + this.score;
    }
    // Launcher artwork: a fixed, seeded scene (does not affect any played run).
    demo() {
      this.clock = 20; this.scroll = 820; this.power = 4; this.time = 3.2;
      this.addEnemy('gunboat', { x: 70, y: 150, vy: -SCROLL }); this.addEnemy('bomber', { x: 160, y: 190, path: 'bomber' });
      for (let i = 0; i < 4; i++) this.addEnemy('gnat', { x: 40 + i * 24, y: 225 - i * 8, path: 'dive', phase: i });
      for (let i = 0; i < 14; i++) this.bullet(160, 190, -Math.PI / 2 + (i - 7) * .09, 90);
      for (const b of this.bullets) { b.x += b.vx * .5; b.y += b.vy * .5; }
      this.items.push({ x: 196, y: 110, kind: 'P', vy: 0, t: 0 });
      for (let i = 0; i < 8; i++) this.shots.push({ x: 116 + (i % 4 - 1.5) * 6, y: 60 + i * 22, vx: 0, vy: SHOT_SPEED, damage: 1 });
      this.explode(196, 196, 13, { debris: 5 }); this.explode(30, 104, 14, { ground: true, debris: 4 });
      this.scorch.push({ x: 30, y: 104, r: 12, seed: 77, t: .6, sea: true });
      for (const b of this.blasts) b.t = .16; for (const d of this.debris) { d.t = .12; d.x += d.vx * .12; d.y += d.vy * .12; }
      Object.assign(this.player, { x: 120, y: 44, inv: 0, cd: .08 });
    }
    // ---- Rendering: a pure function of the game state ------------------------------------------
    background(c) {
      const st = STAGES[this.stage], s = this.scroll, t = this.time, z = this.stage * 977;
      c.save(); c.beginPath(); c.rect(FX, FTOP, FW, FH); c.clip();
      const rows = (step, rate, fn) => { const o = s * rate; for (let k = Math.floor(o / step) - 1; k < Math.floor((o + 270) / step) + 2; k++) fn(k, sy(k * step - o), hash(k * 131 + z + step)); };
      if (st.kind === 'sea') {
        D.rect(c, FX, FTOP, FW, FH, '#1d5c84');
        rows(24, 1, (k, y, h) => {
          D.rect(c, FX, y - 6, FW, 6, h & 1 ? '#1a557b' : '#21648d');
          for (let i = 0; i < 3; i++) { const x = (h >> (i * 6)) % 230, w = 8 + (h >> (i * 4 + 2)) % 12, bob = Math.round(Math.sin(t * 1.6 + i + k) * 2); D.rect(c, sx(x + bob), y - 9 - i * 5, w, 1, '#5fa4c6'); D.rect(c, sx(x + bob + 1), y - 8 - i * 5, w - 2, 1, '#174d70'); }
          if ((h >> 20) % 3 === 0 && Math.sin(t * 5 + k * 1.7) > .5) D.rect(c, sx((h >> 11) % 236), y - 14, 2, 1, '#e6f6ff');
          if ((h >> 24) % 7 === 0) { const rx = sx(20 + (h >> 3) % 200); alpha(c, .55, () => { for (let i = 0; i < 4; i++) oval(c, rx + i * 6 - 9, y - 4 + (i % 2) * 4, 5, 3, '#2f8a8a'); }); D.rect(c, rx - 4, y - 5, 3, 1, '#5cc0b0'); D.rect(c, rx + 6, y - 2, 2, 1, '#5cc0b0'); }
        });
      } else if (st.kind === 'desert') {
        D.rect(c, FX, FTOP, FW, FH, '#c49b63');
        rows(36, 1, (k, y, h) => {
          const a = (h % 7), b = (h >> 4) % 5, crest = x => y - 18 + Math.sin(x * .045 + a) * 5 + Math.sin(x * .11 + b) * 2, pts = [];
          for (let x = 0; x <= FW; x += 12) pts.push(sx(x), crest(x));
          const band = (dy0, dy1, color) => { const p = []; for (let i = 0; i < pts.length; i += 2) p.push(pts[i], pts[i + 1] + dy0); for (let i = pts.length - 2; i >= 0; i -= 2) p.push(pts[i], pts[i + 1] + dy1); poly(c, color, p); };
          band(-4, 0, '#dcb67e'); band(0, 8, '#a8804e'); band(8, 11, '#b58d58');
          for (let i = 0; i < 2; i++) { const rx = sx((h >> (8 + i * 7)) % 228), ry = y - 4 - i * 9; D.rect(c, rx + 1, ry + 1, 5, 3, '#7a5f3e'); D.rect(c, rx, ry, 5, 3, '#9a7a50'); D.rect(c, rx, ry, 3, 1, '#c4a06c'); }
          if ((h >> 22) % 5 === 0) { const tx = 40 + (h >> 13) % 160; alpha(c, .35, () => { D.rect(c, sx(tx), y - 36, 1, 36, '#8a6a42'); D.rect(c, sx(tx + 7), y - 36, 1, 36, '#8a6a42'); }); }
        });
      } else if (st.kind === 'cloud') {
        D.rect(c, FX, FTOP, FW, FH, '#5a8ac3');
        rows(30, .35, (k, y, h) => { if (h & 1) D.rect(c, FX, y - 10, FW, 10, '#6293c9'); });
        rows(70, .5, (k, y, h) => { alpha(c, .3, () => { for (let i = 0; i < 4; i++) oval(c, sx(h % 220) + i * 10 - 15, y + (i % 2) * 3, 12, 5, '#c9daf0'); }); });
        const bolt = hash(Math.floor(t * 4) + z) % 37 === 0;
        if (bolt) { const bx = sx(30 + hash(Math.floor(t * 4)) % 180); alpha(c, .25, () => D.rect(c, FX, FTOP, FW, FH, '#e6f0ff')); c.strokeStyle = '#f4f8ff'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx, FTOP); for (let i = 1; i < 6; i++) c.lineTo(bx + (hash(i + Math.floor(t * 4)) % 21 - 10), FTOP + i * 30); c.stroke(); }
        rows(64, 1, (k, y, h) => {
          if (h % 3 === 0) return; const x = sx(h % 220), n = 3 + (h >> 5) % 3;
          alpha(c, .9, () => {
            for (let i = 0; i < n; i++) disc(c, x + i * 13 - n * 6, y + 4 + (i % 2) * 4, 13 + (i % 2) * 3, '#9fb6d6');
            for (let i = 0; i < n; i++) disc(c, x + i * 13 - n * 6, y + (i % 2) * 4, 13 + (i % 2) * 3, '#eef3fa');
            for (let i = 0; i < n; i++) disc(c, x + i * 13 - n * 6 - 4, y - 4 + (i % 2) * 4, 5, '#ffffff');
          });
        });
        rows(140, 1.6, (k, y, h) => { alpha(c, .2, () => oval(c, sx(h % 240), y, 50 + (h >> 7) % 40, 9, '#ffffff')); });
      } else {
        D.rect(c, FX, FTOP, FW, FH, '#2a2230');
        rows(40, 1, (k, y, h) => {
          for (let x = (k & 1) * 20 - 20; x < FW; x += 40) { D.rect(c, sx(x + 1), y - 39, 38, 38, '#30273a'); D.rect(c, sx(x + 1), y - 39, 38, 1, '#45394f'); D.rect(c, sx(x + 1), y - 39, 1, 38, '#3c3146'); D.rect(c, sx(x + 1), y - 2, 38, 1, '#1b151f'); for (const [rx, ry] of [[3, -36], [35, -36], [3, -5], [35, -5]]) D.rect(c, sx(x + rx), y + ry, 1, 1, '#5a4c64'); }
          if (h % 5 === 0) for (let x = 0; x < FW; x += 12) { D.rect(c, sx(x), y - 26, 6, 4, '#c9a43a'); D.rect(c, sx(x + 6), y - 26, 6, 4, '#2a2230'); }
          if (h % 3 === 0) {
            const ly = y - 32; D.rect(c, FX, ly - 1, FW, 8, '#1a1216'); D.rect(c, FX, ly, FW, 6, '#8a2a1e'); D.rect(c, FX, ly + 1, FW, 3, '#c2482e');
            for (let i = 0; i < 7; i++) D.rect(c, sx((i * 37 + t * 22 + (h % 50)) % 250 - 6), ly + 2, 8, 1, '#ffb35a');
            alpha(c, .25 + Math.sin(t * 3 + k) * .1, () => D.rect(c, FX, ly - 4, FW, 14, '#ff6a3c'));
          }
          if (h % 4 === 1) { const vx = sx(20 + (h >> 6) % 190); D.rect(c, vx, y - 18, 22, 10, '#16111a'); for (let i = 0; i < 5; i++) D.rect(c, vx + 2 + i * 4, y - 17, 2, 8, '#3a3044'); alpha(c, .3 + Math.sin(t * 9 + k) * .2, () => D.rect(c, vx + 1, y - 17, 20, 8, '#ff7a3c')); }
        });
      }
      // Landmarks every 160 px of travel: islands, oases and mesas, cloud banks, lava wells.
      for (let k = Math.floor(s / 160) - 1; k < Math.floor((s + 300) / 160) + 1; k++) {
        const h = hash(k * 31 + 7 + this.stage), wy = k * 160 + (h % 60) - s, x = sx(30 + (h >> 6) % 180), y = sy(wy);
        if (h % 3 === 2) continue;
        if (st.kind === 'sea') {
          alpha(c, .5, () => oval(c, x, y, 48, 33, '#3a9fb4'));
          const surf = Math.sin(t * 2 + k) * 1.5; oval(c, x, y, 38 + surf, 26 + surf, '#d9f0f0');
          oval(c, x + 2, y + 2, 34, 22, '#c9b47a'); oval(c, x, y, 33, 21, '#e6d39a');
          oval(c, x + 2, y + 2, 26, 15, '#4a7a3a'); oval(c, x, y, 25, 14, '#5f8f4a'); oval(c, x - 6, y - 4, 12, 6, '#7aaa5c');
          D.rect(c, x + 12, y + 8, 5, 3, '#7c7468'); D.rect(c, x + 12, y + 8, 3, 1, '#a49c8e');
          D.palm(c, x - 6, y + 4, .7); D.palm(c, x + 8, y - 2, .55);
        } else if (st.kind === 'desert') {
          if (h % 3 === 0) { oval(c, x, y, 23, 14, '#8a9a5a'); oval(c, x, y, 18, 10, '#7fb3c2'); oval(c, x, y + 1, 15, 8, '#4f86a0'); D.rect(c, x - 8, y - 3, 6, 1, '#cfe8f0'); D.palm(c, x + 12, y + 2, .6); D.palm(c, x - 14, y + 6, .5); }
          else { solid(c, [x - 22, y + 8, x - 16, y - 10, x + 14, y - 12, x + 24, y + 6, x + 8, y + 14], '#9a7448', '#5e4428'); poly(c, '#c79c64', [x - 16, y - 10, x + 14, y - 12, x + 10, y - 4, x - 12, y - 2]); D.rect(c, x - 10, y + 2, 14, 1, '#7c5a36'); }
        } else if (st.kind === 'cloud') {
          for (let i = 0; i < 5; i++) disc(c, x + i * 14 - 28, y + 5 + (i % 2) * 6, 16, '#a8bedb');
          for (let i = 0; i < 5; i++) disc(c, x + i * 14 - 28, y + (i % 2) * 6, 16, '#f4f7fb');
          for (let i = 0; i < 5; i++) disc(c, x + i * 14 - 32, y - 5 + (i % 2) * 6, 6, '#ffffff');
        } else {
          alpha(c, .3 + Math.sin(t * 2 + k) * .08, () => disc(c, x, y, 24, '#ff6a3c'));
          disc(c, x + 1, y + 2, 17, '#120d10'); disc(c, x, y, 16, '#3a2a2c'); disc(c, x, y, 13, '#c2482e'); disc(c, x, y, 11, '#ff7a3c');
          disc(c, x, y, 6 + Math.sin(t * 4 + k) * 2, '#ffd27a');
          for (let i = 0; i < 2; i++) { const a = t * (1.3 + i) + k; disc(c, x + Math.cos(a) * 6, y + Math.sin(a * 1.4) * 4, 1.5 + ((t * 3 + i) % 1), '#fff2c8'); }
        }
      }
      // Cloud shadows slide over the ground fronts slightly faster than the terrain.
      if (st.kind !== 'cloud') rows(200, 1.35, (k, y, h) => { if (h & 1) alpha(c, .12, () => { const x = sx(h % 240); for (let i = 0; i < 3; i++) oval(c, x + i * 22 - 22, y + (i % 2) * 8, 26, 16, '#000000'); }); });
      c.restore();
    }
    panels(c) {
      const st = STAGES[this.stage], p = this.player;
      const box = (x, y, w, h) => { D.rect(c, x, y, w, h, '#132131'); D.rect(c, x, y, w, 1, '#2f475c'); D.rect(c, x, y, 1, h, '#2f475c'); D.rect(c, x, y + h - 1, w, 1, '#060b11'); D.rect(c, x + w - 1, y, 1, h, '#060b11'); };
      for (const x0 of [0, 360]) {
        D.rect(c, x0, 25, 120, 245, '#0f1823'); for (let y = 25; y < 270; y += 4) D.rect(c, x0, y, 120, 1, '#0d1520');
        D.rect(c, x0 + (x0 ? 0 : 117), 25, 3, 245, '#3c5468'); D.rect(c, x0 + (x0 ? 1 : 118), 25, 1, 245, '#5d7a90');
        for (let y = 34; y < 270; y += 28) { D.rect(c, x0 + 3, y, 2, 2, '#2b3c4c'); D.rect(c, x0 + 113, y, 2, 2, '#2b3c4c'); }
      }
      box(8, 30, 104, 32); box(8, 65, 104, 34); box(8, 103, 104, 30); box(8, 136, 104, 26); box(8, 165, 104, 48);
      D.text(c, 'SCORE', 14, 34, '#8fb2c4', 7); D.text(c, String(this.score).padStart(7, '0'), 14, 45, '#fff0c4', 12);
      D.text(c, 'PLANES', 14, 69, '#8fb2c4', 7); for (let i = 0; i < Math.min(8, this.lives); i++) { const x = 16 + i * 12; D.rect(c, x + 3, 82, 3, 12, '#cfd8d3'); D.rect(c, x, 86, 9, 3, '#bac7c1'); D.rect(c, x, 86, 2, 3, '#f0a24a'); D.rect(c, x + 7, 86, 2, 3, '#f0a24a'); D.rect(c, x + 2, 92, 5, 2, '#b9c6c0'); D.rect(c, x + 4, 84, 1, 2, '#25445c'); }
      D.text(c, 'BOMBS', 14, 107, '#8fb2c4', 7); for (let i = 0; i < this.bombs; i++) { const bx = 19 + i * 14; disc(c, bx + 1, 125, 4.5, '#3a2410'); disc(c, bx, 124, 4.5, '#e3a65a'); D.rect(c, bx - 2, 122, 2, 2, '#fff0c4'); D.rect(c, bx - 1, 117, 3, 3, '#7a4a1e'); }
      D.text(c, 'FIREPOWER', 14, 140, '#8fb2c4', 7); for (let i = 0; i < 5; i++) { D.rect(c, 15 + i * 18, 151, 14, 6, i < this.power ? '#ffcf6a' : '#24323f'); if (i < this.power) D.rect(c, 15 + i * 18, 151, 14, 1, '#fff2c0'); }
      D.text(c, 'MEDAL ' + this.medal, 14, 169, '#c9e7a0', 7); D.text(c, 'GRAZE ' + this.graze, 14, 181, '#a8f0ff', 7);
      D.text(c, p.loopCD <= 0 && p.alive ? 'LOOP READY' : 'LOOP ' + Math.max(0, Math.ceil(p.loopCD)) + 's', 14, 193, p.loopCD <= 0 ? '#baf7ed' : '#5f7f86', 7);
      if (this.relaxed) D.text(c, 'SHIELD ' + (p.armour > 0 ? 'ON' : 'OFF'), 14, 203, '#a6c8ff', 7);
      D.text(c, 'KESTREL', 14, 228, '#3c5468', 12); D.text(c, 'STRIKE', 14, 242, '#f0a24a', 9); D.rect(c, 14, 254, 92, 1, '#24323f');
      // Right panel: route to the boss, current front, controls.
      box(368, 30, 104, 30); box(368, 63, 104, 132); box(368, 198, 104, 26); box(368, 228, 104, 26);
      D.text(c, 'FRONT ' + (this.stage + 1) + ' / 4', 374, 34, '#8fb2c4', 7); D.text(c, st.name, 374, 45, '#fff0c4', 8);
      const top = 76, h = 108, prog = A.clamp(this.clock / st.length, 0, 1);
      D.rect(c, 412, top, 4, h, '#24323f'); D.rect(c, 412, top + h * (1 - prog), 4, h * prog, '#f0a24a'); for (let i = 1; i < 6; i++) D.rect(c, 409, top + h * i / 6, 2, 1, '#3c5468');
      D.rect(c, 406, top - 6, 16, 6, '#c84d42'); D.text(c, 'BOSS', 426, top - 6, '#e8a29a', 6);
      D.rect(c, 407, top + h * .5 - 1, 14, 2, '#c9e7a0'); D.text(c, 'MID', 426, top + h * .5 - 3, '#c9e7a0', 6);
      kestrel(c, 414, top + h * (1 - prog), this.time, 0, 0);
      const boss = this.enemies.find(e => e.kind === 'boss' || e.kind === 'warden');
      if (boss) { D.text(c, boss.kind === 'boss' ? st.boss : st.mid, 374, 203, '#ffd0a0', 6); D.bar(c, 374, 213, 92, boss.hp, boss.maxHP, '#e8a29a'); }
      else if (this.wreck) D.text(c, 'TARGET DESTROYED', 374, 207, '#ffd0a0', 6);
      D.text(c, 'J FIRE  K BOMB', 374, 233, '#5f7f86', 6); D.text(c, 'SPACE LOOP', 374, 243, '#5f7f86', 6);
    }
    render(c) {
      const st = STAGES[this.stage], p = this.player, ground = st.kind !== 'cloud', t = this.time;
      this.background(c);
      c.save(); c.beginPath(); c.rect(FX, FTOP, FW, FH); c.clip();
      for (const m of this.scorch) scorch(c, m, t);
      for (const e of this.enemies) if (KINDS[e.kind].ground) {
        const X = sx(e.x), Y = sy(e.y);
        if (e.kind === 'gunboat') gunboat(c, X, Y, e.aim, e.hurt > 0, e.t); else if (e.kind === 'tank') tank(c, X, Y, e.aim, e.hurt > 0, this.stage, e.t); else turret(c, X, Y, e.aim, e.hurt > 0, t);
        if (e.hp < e.maxHP * .5) smoke(c, X, Y - 2, t + e.x * .1, .6, -1, false);
      }
      for (const b of this.blasts) if (b.ground) blast(c, b);
      for (const it of this.items) {
        const X = Math.round(sx(it.x)), Y = Math.round(sy(it.y)), blink = Math.floor(it.t * 6) % 2;
        if (it.kind === 'M') { const w = 1 + Math.abs(Math.cos(it.t * 5)) * 4; oval(c, X + 1, Y + 1, w, 5, '#6a4a12'); oval(c, X, Y, w, 5, blink ? '#f6d36a' : '#e0b040'); if (w > 2.5) D.rect(c, X - 1, Y - 3, 1, 5, '#fff3c2'); }
        else {
          const col = it.kind === 'P' ? '#c84d42' : '#3c78c8', pulse = .5 + Math.sin(it.t * 8) * .5;
          alpha(c, .25 + pulse * .2, () => disc(c, X, Y, 10 + pulse * 2, it.kind === 'P' ? '#ffb07a' : '#9cc6ff'));
          D.rect(c, X - 6, Y - 6, 14, 14, '#10141c'); D.rect(c, X - 7, Y - 7, 14, 14, col); D.rect(c, X - 6, Y - 6, 12, 12, blink ? '#fff0c8' : tone(col, .25)); D.rect(c, X - 6, Y - 6, 12, 2, '#ffffff');
          D.text(c, it.kind, X, Y - 4, '#1b1f2a', 8, 'center');
        }
      }
      // Shadows of aircraft on the ground below.
      if (ground) { c.globalAlpha = .22; for (const e of this.enemies) if (!KINDS[e.kind].ground) { c.fillStyle = '#000'; c.beginPath(); c.ellipse(sx(e.x) + 10, sy(e.y) + 12, e.r * 1.1, e.r * .45, 0, 0, TAU); c.fill(); } if (p.alive) { c.beginPath(); c.ellipse(sx(p.x) + 10, sy(p.y) + 12, 10, 4, 0, 0, TAU); c.fill(); } c.globalAlpha = 1; }
      for (const e of this.enemies) {
        if (KINDS[e.kind].ground) continue; const X = sx(e.x), Y = sy(e.y), hurt = e.hurt > 0, prop = Math.floor(t * 40);
        if (e.kind === 'gnat') fighter(c, X, Y, hurt ? '#fff3d6' : ['#6f7d5a', '#8a6f45', '#5d6f93', '#7d5155'][this.stage], '#c8b46a', true, 1, prop);
        else if (e.kind === 'swallow') fighter(c, X, Y, hurt ? '#fff3d6' : '#9b9488', '#c84d42', true, .8, prop);
        else if (e.kind === 'carrier') carrier(c, X, Y, hurt, t);
        else if (e.kind === 'bomber') bomber(c, X, Y, hurt, this.stage, t);
        else if (e.kind === 'warden') warden(c, X, Y, hurt, this.stage, t);
        else if (e.kind === 'boss') boss(c, { ...e, x: X, y: Y }, this.stage, t);
        if ((e.kind === 'bomber' || e.kind === 'warden') && e.hp < e.maxHP * .5) { smoke(c, X - e.r * .6, Y - 2, t + e.x * .07, e.hp < e.maxHP * .25 ? 1 : .6); if (e.hp < e.maxHP * .25) smoke(c, X + e.r * .7, Y - 1, t + 3.1, .8); }
      }
      if (this.wreck && !this.wreck.final) {
        const w = this.wreck, k = w.t / WRECK_TIME, jx = Math.round(Math.sin(w.t * 53) * 3 * k), jy = Math.round(Math.cos(w.t * 47) * 2 * k);
        alpha(c, 1 - k * .2, () => boss(c, { x: sx(w.x) + jx, y: sy(w.y) + jy, aim: w.aim, phase: 2, hurt: Math.floor(w.t * 14) % 3 === 0 ? 1 : 0 }, this.stage, t, k));
      }
      for (const b of this.blasts) if (!b.ground) blast(c, b);
      for (const d of this.debris) debris(c, d);
      for (const s of this.shots) {
        const X = Math.round(sx(s.x)), Y = Math.round(sy(s.y));
        if (s.rocket) { for (let i = 1; i <= 4; i++) alpha(c, .35 / i, () => disc(c, X - s.vx * .012 * i, Y + 3 + i * 4, 1.5 + i * .7, '#cfc8bf')); D.rect(c, X - 1, Y - 4, 3, 7, '#d9dde0'); D.rect(c, X - 1, Y - 5, 3, 2, '#c84d42'); D.rect(c, X, Y + 3, 1, 2 + Math.floor(t * 30) % 2 * 2, '#ffb35a'); }
        else { alpha(c, .35, () => D.rect(c, X - 2, Y - 6, 4, 11, '#ffd27a')); D.rect(c, X - 1, Y - 5, 2, 8, '#fff6c8'); D.rect(c, X - 1, Y - 5, 2, 2, '#ffffff'); }
      }
      if (p.alive) {
        const bank = A.clamp((p.body.vx || 0) / 16, -1, 1);
        kestrel(c, sx(p.x), sy(p.y), t, p.loop, p.inv, bank);
        if (p.cd > .05 && !(p.inv > 0 && Math.floor(p.inv * 14) % 2)) for (const [ox] of LANES[this.power - 1]) { const X = Math.round(sx(p.x + ox)), Y = Math.round(sy(p.y + 15)), f = Math.floor(t * 30) % 2; alpha(c, .5, () => disc(c, X, Y, 3 + f, '#ffd27a')); D.rect(c, X - 1, Y - 3 - f, 2, 4 + f, '#fff6c8'); }
      }
      c.save(); c.translate(FX, 270); c.scale(1, -1); this.particles.draw(c); this.effects.draw(c); c.restore();
      for (const b of this.bullets) {
        const X = sx(b.x), Y = sy(b.y);
        if (b.big) { const pulse = Math.sin(t * 12 + b.x * .3) * .8; alpha(c, .3, () => disc(c, X, Y, 6 + pulse, '#ff4a6a')); disc(c, X, Y, 3.6, '#ff7a5a'); disc(c, X - .5, Y - .5, 1.7, '#fff0d0'); }
        else { alpha(c, .32, () => disc(c, X, Y, 4.2, '#ff8a4a')); disc(c, X, Y, 2.5, '#ffc06a'); D.rect(c, X - 1, Y - 1, 2, 2, '#fff8e0'); }
      }
      if (this.bombFlash > 0) { c.globalAlpha = this.bombFlash * .55; D.rect(c, FX, FTOP, FW, FH, '#fff3d0'); c.globalAlpha = 1; }
      c.restore();
      this.panels(c);
      D.hud(c, this, 'KESTREL STRIKE / FRONT ' + (this.stage + 1), 'PLANES ' + this.lives + ' / ' + String(this.score).padStart(7, '0'));
    }
  };
  A.Kestrel.STAGES = STAGES; A.Kestrel.KINDS = KINDS; A.Kestrel.SUB = SUB;
})(globalThis.Arcade);
