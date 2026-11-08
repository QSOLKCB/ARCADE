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
  const axis = v => v > .35 ? 1 : v < -.35 ? -1 : 0;
  const hash = n => { let h = Math.imul(n | 0, 2654435761) >>> 0; h ^= h >>> 15; return Math.imul(h, 2246822519) >>> 0; };

  // ---- Sprites (nose up for the player, nose down for enemies) --------------------------------
  function fighter(c, x, y, body, trim, down, scale = 1, prop = 0) {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, down ? -scale : scale);
    D.rect(c, -2, -11, 5, 22, body); D.rect(c, -12, -2, 25, 5, body); D.rect(c, -6, 8, 13, 3, body);
    D.rect(c, -12, -2, 25, 1, trim); D.rect(c, -1, -6, 3, 5, '#1b2a3a'); D.rect(c, 0, -5, 1, 2, '#bfe3f5');
    D.rect(c, -10, 1, 4, 2, trim); D.rect(c, 7, 1, 4, 2, trim);
    c.globalAlpha *= .55; D.rect(c, -5 + (prop % 3), -13, 11 - (prop % 3) * 2, 2, '#e8eef2'); c.globalAlpha /= .55;
    c.restore();
  }
  function kestrel(c, x, y, t, roll, inv) {
    if (inv > 0 && Math.floor(inv * 14) % 2) return;
    c.save(); c.translate(Math.round(x), Math.round(y));
    if (roll > 0) { const k = Math.cos(roll / .9 * TAU); c.scale(Math.abs(k) * .8 + .2, 1 + (1 - Math.abs(k)) * .25); }
    D.rect(c, -2, -13, 5, 25, '#cfd8d3'); D.rect(c, -14, -3, 29, 6, '#b9c6c0'); D.rect(c, -14, -3, 29, 2, '#f0a24a');
    D.rect(c, -7, 9, 15, 3, '#b9c6c0'); D.rect(c, -1, -7, 3, 6, '#25445c'); D.rect(c, 0, -6, 1, 3, '#a8e6ff');
    D.rect(c, -11, 3, 3, 4, '#5d6d6a'); D.rect(c, 9, 3, 3, 4, '#5d6d6a'); D.rect(c, -2, 11, 5, 3, '#f0a24a');
    const p = Math.floor(t * 40) % 3; c.globalAlpha = .6; D.rect(c, -6 + p, -15, 13 - p * 2, 2, '#f7f3e6'); c.globalAlpha = 1;
    c.restore();
  }
  function bomber(c, x, y, hurt, stage) {
    const body = hurt ? '#fff3d6' : ['#5c6b50', '#7d6a4b', '#506078', '#5d4a52'][stage];
    c.save(); c.translate(Math.round(x), Math.round(y));
    D.rect(c, -4, -22, 9, 42, body); D.rect(c, -30, -6, 61, 9, body); D.rect(c, -12, 15, 25, 5, body);
    for (const ex of [-22, -13, 10, 19]) { D.rect(c, ex, -4, 5, 11, '#2e3632'); D.rect(c, ex - 1, 7, 7, 2, '#c9d2c6'); }
    D.rect(c, -2, -20, 5, 6, '#1d2c37'); D.rect(c, -30, -6, 61, 1, '#d9cfa5'); c.restore();
  }
  function gunboat(c, x, y, aim, hurt) {
    c.save(); c.translate(Math.round(x), Math.round(y));
    c.fillStyle = hurt ? '#fff3d6' : '#59636b'; c.beginPath(); c.moveTo(0, 18); c.lineTo(9, 6); c.lineTo(9, -16); c.lineTo(-9, -16); c.lineTo(-9, 6); c.closePath(); c.fill();
    D.rect(c, -6, -12, 12, 18, '#7c868c'); D.rect(c, -4, -4, 8, 8, '#384047');
    c.save(); c.rotate(-aim - Math.PI / 2); D.rect(c, -1, 0, 3, 12, '#232a30'); c.restore();
    c.globalAlpha = .45; D.rect(c, -10, -22, 3, 6, '#e8f4f7'); D.rect(c, 8, -22, 3, 6, '#e8f4f7'); c.globalAlpha = 1; c.restore();
  }
  function tank(c, x, y, aim, hurt, stage) {
    c.save(); c.translate(Math.round(x), Math.round(y));
    D.rect(c, -10, -9, 4, 18, '#2a2a24'); D.rect(c, 6, -9, 4, 18, '#2a2a24');
    D.rect(c, -7, -8, 14, 16, hurt ? '#fff3d6' : stage === 3 ? '#6e4f4f' : '#8a7a4c');
    D.rect(c, -4, -4, 8, 8, '#4f4a33'); c.save(); c.rotate(-aim - Math.PI / 2); D.rect(c, -1, 0, 3, 13, '#24241e'); c.restore(); c.restore();
  }
  function turret(c, x, y, aim, hurt) {
    c.save(); c.translate(Math.round(x), Math.round(y));
    D.rect(c, -11, -11, 22, 22, '#3b3440'); D.rect(c, -9, -9, 18, 18, hurt ? '#fff3d6' : '#6b5d73');
    c.save(); c.rotate(-aim - Math.PI / 2); D.rect(c, -4, 0, 3, 13, '#201b24'); D.rect(c, 2, 0, 3, 13, '#201b24'); c.restore();
    D.rect(c, -3, -3, 6, 6, '#e07a4a'); c.restore();
  }
  function carrier(c, x, y, hurt, t) {
    fighter(c, x, y, hurt ? '#fff3d6' : '#c84d42', '#f2d36b', true, 1.1, Math.floor(t * 40));
    D.rect(c, x - 4, y - 3, 8, 6, '#f2d36b'); D.text(c, '?', x, y - 3, '#7a2a24', 6, 'center');
  }
  function warden(c, x, y, hurt, stage, t) {
    const body = hurt ? '#fff3d6' : ['#3f6f73', '#8b6a3f', '#4a5f86', '#7a4a4a'][stage];
    c.save(); c.translate(Math.round(x), Math.round(y));
    D.rect(c, -6, -24, 13, 46, body); D.rect(c, -38, -6, 77, 11, body); D.rect(c, -38, -6, 77, 2, '#efe2b8');
    for (const ex of [-30, -18, 14, 26]) D.rect(c, ex, -10, 5, 16, '#2b2f33');
    D.rect(c, -3, 16, 7, 10, '#e9b46a'); D.rect(c, -18, 14, 37, 5, body);
    const glow = .5 + Math.sin(t * 8) * .3; c.globalAlpha = glow; D.rect(c, -3, -2, 7, 7, '#ff9d5a'); c.globalAlpha = 1; c.restore();
  }
  function boss(c, e, stage, t) {
    const x = Math.round(e.x), y = Math.round(e.y), hurt = e.hurt > 0, phase = e.phase || 0;
    c.save(); c.translate(x, y);
    const metal = hurt ? '#fff3d6' : ['#5f6b70', '#9c7a48', '#4d5e82', '#6b3f3f'][stage], dark = '#262a2e', glow = phase > 1 ? '#ff6a4a' : '#ffb35a';
    if (stage === 0) { // Armoured battleship
      c.fillStyle = metal; c.beginPath(); c.moveTo(0, 44); c.lineTo(34, 18); c.lineTo(34, -40); c.lineTo(-34, -40); c.lineTo(-34, 18); c.closePath(); c.fill();
      D.rect(c, -22, -30, 44, 40, '#7d898d'); for (const [tx, ty] of [[-18, -20], [18, -20], [0, 22], [-18, 6], [18, 6]]) { D.rect(c, tx - 6, ty - 6, 12, 12, dark); D.rect(c, tx - 2, ty - 2, 4, 4, glow); }
      D.rect(c, -6, -14, 12, 16, '#bfc8c4');
    } else if (stage === 1) { // Desert crawler
      D.rect(c, -46, -30, 14, 62, '#2c2822'); D.rect(c, 32, -30, 14, 62, '#2c2822');
      for (let i = 0; i < 6; i++) { D.rect(c, -45, -28 + ((i * 11 + Math.floor(t * 30)) % 60), 12, 3, '#5c5240'); D.rect(c, 33, -28 + ((i * 11 + Math.floor(t * 30)) % 60), 12, 3, '#5c5240'); }
      D.rect(c, -32, -26, 64, 54, metal); D.rect(c, -18, -12, 36, 30, '#6d5a3a');
      c.save(); c.rotate(-(e.aim || -Math.PI / 2) - Math.PI / 2); D.rect(c, -4, 0, 8, 34, dark); c.restore(); D.rect(c, -6, -6, 12, 12, glow);
    } else if (stage === 2) { // Flying wing
      c.fillStyle = metal; c.beginPath(); c.moveTo(0, -30); c.lineTo(62, 10); c.lineTo(46, 22); c.lineTo(0, 6); c.lineTo(-46, 22); c.lineTo(-62, 10); c.closePath(); c.fill();
      for (const ex of [-40, -20, 20, 40]) { D.rect(c, ex - 4, 0, 8, 10, dark); D.rect(c, ex - 2, 10, 4, 4, glow); }
      D.rect(c, -8, -16, 16, 12, '#22324a'); D.rect(c, -3, -13, 6, 4, '#9fd3ff');
    } else { // Citadel engine core
      D.rect(c, -50, -34, 100, 64, '#3b3036'); D.rect(c, -42, -26, 84, 48, metal);
      for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * TAU / 4; D.rect(c, Math.cos(a) * 30 - 5, Math.sin(a) * 14 - 5, 10, 10, dark); }
      c.fillStyle = glow; c.beginPath(); c.arc(0, 0, 11 + Math.sin(t * 6) * 2, 0, TAU); c.fill(); D.rect(c, -3, -3, 6, 6, '#fff2c8');
    }
    c.restore();
  }

  A.Kestrel = class extends A.Game {
    constructor(options, sound) {
      super(options, sound); this.id = 'kestrel'; this.options.players = 1; this.stage = 0;
      this.lives = this.relaxed ? 5 : 3; this.bombStock = this.relaxed ? 4 : 3; this.power = 1; this.medal = 100; this.nextLife = 50000;
      this.rand = A.rng(7741); this.bonus = 0; this.setup();
    }
    setup() {
      const st = STAGES[this.stage];
      this.player = { body: A.V2D.createBody2D({ x: 120 * SUB, y: 30 * SUB }), x: 120, y: 30, inv: 2, cd: 0, rocketCD: 0, loop: 0, loopCD: 0, armour: this.relaxed ? 1 : 0, alive: true, respawn: 0 };
      this.bombs = Math.max(this.bombStock, this.relaxed ? 4 : 3); this.bombCD = 0; this.bombFlash = 0;
      this.enemies = []; this.shots = []; this.bullets = []; this.items = []; this.particles.items = []; this.effects.items = [];
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
    damage(e, amount) {
      if (e.hp <= 0 || this.state !== 'playing') return;
      e.hp -= amount; e.hurt = .06;
      if (e.hp > 0) { if (e.kind === 'boss' || e.kind === 'warden' || e.kind === 'bomber') this.sound('hit'); return; }
      const def = KINDS[e.kind], big = e.kind === 'boss' || e.kind === 'warden' || e.kind === 'bomber';
      this.score += def.score + (e.kind === 'boss' ? this.stage * 5000 : 0); this.kills++;
      this.particles.burst(e.x, e.y, def.ground ? '#d9b27a' : '#ffd08a', big ? 40 : 12, big ? 120 : 70);
      this.effects.add('blast', e.x, e.y, '#ffe2a8', big ? 46 : 16, big ? .6 : .35); this.sound('boom'); if (big) this.shake = .25;
      if (e.kind === 'carrier') this.items.push({ x: e.x, y: e.y, kind: e.drop || 'P', vy: -28, t: 0 });
      else if (def.ground || (e.kind === 'bomber' && this.rand() < .5)) this.items.push({ x: e.x, y: e.y, kind: 'M', vy: -SCROLL, t: 0 });
      if (e.kind === 'bomber') this.items.push({ x: e.x + 10, y: e.y, kind: 'P', vy: -28, t: 0 });
      if (e.kind === 'warden') { this.items.push({ x: e.x, y: e.y, kind: 'B', vy: -28, t: 0 }); this.say(STAGES[this.stage].mid + ' DOWN', 2); }
      if (e.kind === 'boss') this.clearStage();
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
      const p = this.player; if (!p.alive || p.inv > 0 || p.loop > 0 || this.state !== 'playing') return;
      if (p.armour > 0) { p.armour--; p.inv = 1.5; this.sound('hurt'); this.say('SHIELD LOST', 1.5); return; }
      this.lives--; this.misses++; p.alive = false; p.respawn = 1.2; this.medal = 100;
      this.power = Math.max(1, this.power - 1); this.bullets = []; this.shake = .3;
      this.particles.burst(p.x, p.y, '#fff0c8', 36, 120); this.effects.add('blast', p.x, p.y, '#ffd59a', 40, .7); this.sound('hurt');
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
      const lanes = [[[-3, 0]], [[-4, 0], [4, 0]], [[-6, 0], [0, 0], [6, 0]], [[-8, -.06], [-3, 0], [3, 0], [8, .06]], [[-9, -.12], [-4, -.04], [0, 0], [4, .04], [9, .12]]][pw - 1];
      for (const [ox, a] of lanes) if (this.shots.length < MAX_SHOTS) this.shots.push({ x: p.x + ox, y: p.y + 12, vx: Math.sin(a) * SHOT_SPEED, vy: Math.cos(a) * SHOT_SPEED, damage: 1 });
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
      if (this.state === 'playing') this.lifeCheck();
    }
    status() {
      const boss = this.enemies.find(e => e.kind === 'boss');
      return STAGES[this.stage].name + ' · Front ' + (this.stage + 1) + '/4 · Planes ' + this.lives + ' · Bombs ' + this.bombs + ' · Power ' + this.power + '/5' + (boss ? ' · Boss ' + Math.ceil(boss.hp / boss.maxHP * 100) + '%' : '') + ' · Score ' + this.score;
    }
    // Launcher artwork: a fixed, seeded scene (does not affect any played run).
    demo() {
      this.clock = 20; this.scroll = 820; this.power = 4;
      this.addEnemy('gunboat', { x: 70, y: 150, vy: -SCROLL }); this.addEnemy('bomber', { x: 160, y: 190, path: 'bomber' });
      for (let i = 0; i < 4; i++) this.addEnemy('gnat', { x: 40 + i * 24, y: 225 - i * 8, path: 'dive', phase: i });
      for (let i = 0; i < 14; i++) this.bullet(160, 190, -Math.PI / 2 + (i - 7) * .09, 90);
      for (const b of this.bullets) { b.x += b.vx * .5; b.y += b.vy * .5; }
      this.items.push({ x: 196, y: 110, kind: 'P', vy: 0, t: 0 });
      for (let i = 0; i < 8; i++) this.shots.push({ x: 116 + (i % 4 - 1.5) * 6, y: 60 + i * 22, vx: 0, vy: SHOT_SPEED, damage: 1 });
      Object.assign(this.player, { x: 120, y: 44, inv: 0 });
    }
    // ---- Rendering: a pure function of the game state ------------------------------------------
    background(c) {
      const st = STAGES[this.stage], s = this.scroll;
      c.save(); c.beginPath(); c.rect(FX, FTOP, FW, FH); c.clip();
      const base = { sea: '#1f5f86', desert: '#c39a62', cloud: '#5b8bc4', citadel: '#2a2230' }[st.kind];
      D.rect(c, FX, FTOP, FW, FH, base);
      for (let k = Math.floor(s / 40) - 1; k < Math.floor((s + 270) / 40) + 1; k++) {
        const h = hash(k + this.stage * 977), wy = k * 40 - s, y = sy(wy);
        if (st.kind === 'sea') { for (let i = 0; i < 4; i++) D.rect(c, sx((h >> (i * 5)) % 220), y - (i * 9), 10 + (h >> (i * 3)) % 14, 1, '#7fb6d1'); }
        else if (st.kind === 'desert') { D.rect(c, FX, y, FW, 2, '#b58b55'); D.rect(c, sx((h % 200)), y - 12, 18, 3, '#a47a48'); if (h % 5 === 0) D.rect(c, sx((h >> 7) % 210), y - 22, 7, 5, '#7c6a4c'); }
        else if (st.kind === 'cloud') { c.globalAlpha = .18; D.rect(c, sx((h % 240) - 20), y, 60 + (h >> 9) % 50, 10, '#e9f1fb'); c.globalAlpha = 1; }
        else { D.rect(c, FX, y, FW, 1, '#3a2f3f'); for (let x = 0; x < FW; x += 40) D.rect(c, sx(x + (k % 2) * 20), y - 20, 1, 20, '#3a2f3f'); if (h % 3 === 0) D.rect(c, sx((h >> 5) % 200), y - 30, 40, 6, '#c2482e'); }
      }
      // Landmarks every 160 px of travel: islands, oases, cloud banks, lava wells.
      for (let k = Math.floor(s / 160) - 1; k < Math.floor((s + 300) / 160) + 1; k++) {
        const h = hash(k * 31 + 7 + this.stage), wy = k * 160 + (h % 60) - s, x = 30 + (h >> 6) % 180, y = sy(wy);
        if (h % 3 === 2) continue;
        if (st.kind === 'sea') { c.fillStyle = '#e6d39a'; c.beginPath(); c.ellipse(sx(x), y, 34, 22, 0, 0, TAU); c.fill(); c.fillStyle = '#5f8f4a'; c.beginPath(); c.ellipse(sx(x), y, 26, 15, 0, 0, TAU); c.fill(); D.palm(c, sx(x) - 6, y + 4, .7); }
        else if (st.kind === 'desert') { c.fillStyle = '#4f86a0'; c.beginPath(); c.ellipse(sx(x), y, 16, 9, 0, 0, TAU); c.fill(); D.palm(c, sx(x) + 12, y + 2, .6); }
        else if (st.kind === 'cloud') { c.globalAlpha = .55; for (let i = 0; i < 5; i++) { c.fillStyle = '#f4f7fb'; c.beginPath(); c.arc(sx(x) + i * 14 - 28, y + (i % 2) * 6, 16, 0, TAU); c.fill(); } c.globalAlpha = 1; }
        else { c.fillStyle = '#ff7a3c'; c.beginPath(); c.arc(sx(x), y, 13, 0, TAU); c.fill(); c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(sx(x), y, 6 + Math.sin(this.time * 4 + k) * 2, 0, TAU); c.fill(); }
      }
      c.restore();
    }
    panels(c) {
      const st = STAGES[this.stage], p = this.player;
      for (const x0 of [0, 360]) { D.rect(c, x0, 25, 120, 245, '#0f1823'); D.rect(c, x0 + (x0 ? 0 : 118), 25, 2, 245, '#3c5468'); for (let y = 34; y < 270; y += 28) { D.rect(c, x0 + 6, y, 2, 2, '#2b3c4c'); D.rect(c, x0 + 112, y, 2, 2, '#2b3c4c'); } }
      D.text(c, 'SCORE', 14, 36, '#8fb2c4', 7); D.text(c, String(this.score).padStart(7, '0'), 14, 46, '#fff0c4', 12);
      D.text(c, 'PLANES', 14, 70, '#8fb2c4', 7); for (let i = 0; i < Math.min(8, this.lives); i++) { const x = 16 + i * 12; D.rect(c, x + 3, 82, 3, 12, '#cfd8d3'); D.rect(c, x, 86, 9, 3, '#f0a24a'); D.rect(c, x + 2, 92, 5, 2, '#b9c6c0'); }
      D.text(c, 'BOMBS', 14, 108, '#8fb2c4', 7); for (let i = 0; i < this.bombs; i++) { D.rect(c, 15 + i * 14, 120, 9, 9, '#e3a65a'); D.rect(c, 17 + i * 14, 122, 5, 5, '#7a4a1e'); }
      D.text(c, 'FIREPOWER', 14, 138, '#8fb2c4', 7); for (let i = 0; i < 5; i++) D.rect(c, 15 + i * 18, 150, 14, 6, i < this.power ? '#ffcf6a' : '#24323f');
      D.text(c, 'MEDAL ' + this.medal, 14, 166, '#c9e7a0', 7); D.text(c, 'GRAZE ' + this.graze, 14, 178, '#a8f0ff', 7);
      D.text(c, p.loopCD <= 0 && p.alive ? 'LOOP READY' : 'LOOP ' + Math.max(0, Math.ceil(p.loopCD)) + 's', 14, 194, p.loopCD <= 0 ? '#baf7ed' : '#5f7f86', 7);
      if (this.relaxed) D.text(c, 'SHIELD ' + (p.armour > 0 ? 'ON' : 'OFF'), 14, 206, '#a6c8ff', 7);
      D.text(c, 'KESTREL', 14, 236, '#3c5468', 12); D.text(c, 'STRIKE', 14, 250, '#f0a24a', 9);
      // Right panel: route to the boss, current front, controls.
      D.text(c, 'FRONT ' + (this.stage + 1) + ' / 4', 374, 36, '#8fb2c4', 7); D.text(c, st.name, 374, 47, '#fff0c4', 8);
      const top = 70, h = 120, prog = A.clamp(this.clock / st.length, 0, 1);
      D.rect(c, 412, top, 4, h, '#24323f'); D.rect(c, 412, top + h * (1 - prog), 4, h * prog, '#f0a24a');
      D.rect(c, 406, top - 6, 16, 6, '#c84d42'); D.text(c, 'BOSS', 426, top - 6, '#e8a29a', 6);
      D.rect(c, 407, top + h * .5 - 1, 14, 2, '#c9e7a0'); D.text(c, 'MID', 426, top + h * .5 - 3, '#c9e7a0', 6);
      kestrel(c, 414, top + h * (1 - prog), this.time, 0, 0);
      const boss = this.enemies.find(e => e.kind === 'boss' || e.kind === 'warden');
      if (boss) { D.text(c, boss.kind === 'boss' ? st.boss : st.mid, 374, 200, '#ffd0a0', 6); D.bar(c, 374, 210, 98, boss.hp, boss.maxHP, '#e8a29a'); }
      D.text(c, 'J FIRE  K BOMB', 374, 232, '#5f7f86', 6); D.text(c, 'SPACE LOOP', 374, 242, '#5f7f86', 6);
    }
    render(c) {
      const st = STAGES[this.stage], p = this.player, ground = st.kind !== 'cloud';
      this.background(c);
      c.save(); c.beginPath(); c.rect(FX, FTOP, FW, FH); c.clip();
      for (const e of this.enemies) if (KINDS[e.kind].ground) {
        const X = sx(e.x), Y = sy(e.y);
        if (e.kind === 'gunboat') gunboat(c, X, Y, e.aim, e.hurt > 0); else if (e.kind === 'tank') tank(c, X, Y, e.aim, e.hurt > 0, this.stage); else turret(c, X, Y, e.aim, e.hurt > 0);
      }
      for (const it of this.items) {
        const X = sx(it.x), Y = sy(it.y), blink = Math.floor(it.t * 6) % 2;
        if (it.kind === 'M') { D.rect(c, X - 4, Y - 5, 8, 10, blink ? '#f6d36a' : '#d9a83a'); D.rect(c, X - 1, Y - 3, 2, 6, '#fff3c2'); }
        else { D.rect(c, X - 7, Y - 7, 14, 14, it.kind === 'P' ? '#c84d42' : '#3c78c8'); D.rect(c, X - 6, Y - 6, 12, 12, blink ? '#fff0c8' : it.kind === 'P' ? '#e8705f' : '#6aa0ef'); D.text(c, it.kind, X, Y - 4, '#1b1f2a', 8, 'center'); }
      }
      // Shadows of aircraft on the ground below.
      if (ground) { c.globalAlpha = .22; for (const e of this.enemies) if (!KINDS[e.kind].ground) { c.fillStyle = '#000'; c.beginPath(); c.ellipse(sx(e.x) + 10, sy(e.y) + 12, e.r * 1.1, e.r * .45, 0, 0, TAU); c.fill(); } if (p.alive) { c.beginPath(); c.ellipse(sx(p.x) + 10, sy(p.y) + 12, 10, 4, 0, 0, TAU); c.fill(); } c.globalAlpha = 1; }
      for (const e of this.enemies) {
        if (KINDS[e.kind].ground) continue; const X = sx(e.x), Y = sy(e.y), hurt = e.hurt > 0, prop = Math.floor(this.time * 40);
        if (e.kind === 'gnat') fighter(c, X, Y, hurt ? '#fff3d6' : ['#6f7d5a', '#8a6f45', '#5d6f93', '#7d5155'][this.stage], '#2f3a2c', true, 1, prop);
        else if (e.kind === 'swallow') fighter(c, X, Y, hurt ? '#fff3d6' : '#9b9488', '#4c4a45', true, .8, prop);
        else if (e.kind === 'carrier') carrier(c, X, Y, hurt, this.time);
        else if (e.kind === 'bomber') bomber(c, X, Y, hurt, this.stage);
        else if (e.kind === 'warden') warden(c, X, Y, hurt, this.stage, this.time);
        else if (e.kind === 'boss') boss(c, { ...e, x: X, y: Y }, this.stage, this.time);
      }
      for (const s of this.shots) { if (s.rocket) { D.rect(c, sx(s.x) - 1, sy(s.y) - 4, 3, 7, '#ffcf6a'); D.rect(c, sx(s.x), sy(s.y) + 3, 1, 3, '#ff8a3c'); } else D.rect(c, sx(s.x) - 1, sy(s.y) - 5, 2, 8, '#fff6c8'); }
      if (p.alive) kestrel(c, sx(p.x), sy(p.y), this.time, p.loop, p.inv);
      for (const b of this.bullets) { const X = sx(b.x), Y = sy(b.y); if (b.big) { D.rect(c, X - 3, Y - 3, 6, 6, '#ff7a5a'); D.rect(c, X - 1, Y - 1, 2, 2, '#fff0d0'); } else { D.rect(c, X - 2, Y - 2, 4, 4, '#ffc06a'); D.rect(c, X - 1, Y - 1, 2, 2, '#fff8e0'); } }
      c.save(); c.translate(FX, 270); c.scale(1, -1); this.particles.draw(c); this.effects.draw(c); c.restore();
      if (this.bombFlash > 0) { c.globalAlpha = this.bombFlash * .55; D.rect(c, FX, FTOP, FW, FH, '#fff3d0'); c.globalAlpha = 1; }
      c.restore();
      this.panels(c);
      D.hud(c, this, 'KESTREL STRIKE / FRONT ' + (this.stage + 1), 'PLANES ' + this.lives + ' / ' + String(this.score).padStart(7, '0'));
    }
  };
  A.Kestrel.STAGES = STAGES; A.Kestrel.KINDS = KINDS; A.Kestrel.SUB = SUB;
})(globalThis.Arcade);
