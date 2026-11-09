/* SPDX-License-Identifier: Apache-2.0 */
// Pixel Sleepwalker: an original dream platformer. Stomp nightmare critters,
// head-butt star blocks for crystals, and catch a Storm charm that breaks dream
// bricks and throws bouncing sparks. Reach the Dream Door before the night ends.
(function (A) {
  'use strict';
  const {q, px, clamp, Draw: D, K3: K} = A;
  const L = 2800, GROUND = 303, T = 24; // block size in pixels
  const W = 7, H = 28; // half-width and height of the sleepwalker
  // The three nights hold 18 crystal blocks (7, 6 and 5), so up to three extra lives can be earned.
  const CRYSTAL_LIFE = 6;
  // Each row: [column, row from ground (1 = sits on the ground), kind]. Kinds:
  // b dream brick (breakable with Storm), s star block (crystal), S star block (Storm), w solid pillow.
  const LAYOUTS = [
    [[8, 4, 'b'], [9, 4, 's'], [10, 4, 'b'], [11, 4, 'S'], [12, 4, 'b'], [20, 1, 'w'], [20, 2, 'w'], [31, 4, 's'], [32, 4, 's'], [36, 1, 'w'], [37, 1, 'w'], [37, 2, 'w'],
      [45, 4, 'b'], [46, 4, 'b'], [47, 4, 's'], [48, 4, 'b'], [58, 1, 'w'], [58, 2, 'w'], [58, 3, 'w'], [64, 4, 's'], [65, 4, 'S'], [74, 1, 'w'], [75, 1, 'w'], [75, 2, 'w'], [86, 4, 's'], [87, 4, 'b'], [88, 4, 's'], [98, 1, 'w'], [98, 2, 'w']],
    [[7, 4, 's'], [8, 4, 'S'], [9, 4, 'b'], [18, 1, 'w'], [18, 2, 'w'], [28, 4, 'b'], [29, 4, 's'], [30, 4, 'b'], [31, 4, 's'], [38, 1, 'w'], [38, 2, 'w'], [38, 3, 'w'],
      [42, 4, 's'], [43, 4, 'b'], [58, 1, 'w'], [59, 1, 'w'], [59, 2, 'w'], [64, 4, 'S'], [65, 4, 's'], [78, 1, 'w'], [78, 2, 'w'], [88, 4, 'b'], [89, 4, 's'], [90, 4, 'b'], [100, 1, 'w']],
    [[6, 4, 'b'], [7, 4, 's'], [8, 4, 'S'], [16, 1, 'w'], [16, 2, 'w'], [17, 1, 'w'], [25, 4, 's'], [26, 4, 's'], [35, 1, 'w'], [35, 2, 'w'], [35, 3, 'w'], [39, 4, 'b'], [40, 4, 'S'],
      [41, 4, 'b'], [55, 1, 'w'], [55, 2, 'w'], [60, 4, 's'], [61, 4, 'b'], [62, 4, 's'], [76, 1, 'w'], [77, 1, 'w'], [77, 2, 'w'], [84, 4, 'S'], [97, 1, 'w'], [97, 2, 'w']],
  ];
  // Fairness rule (tested): no floating block within 70 px before a pit, over it or 20 px
  // after it, and no tall wall on a landing, so a full running jump always clears.
  const PITS = [[[600, 660], [1260, 1320], [1980, 2040]], [[540, 610], [1180, 1250], [1700, 1760], [2260, 2320]], [[500, 570], [1120, 1190], [1620, 1690], [2140, 2210], [2520, 2580]]];
  const MOTHS = [[1020, 1650], [800, 1550, 2010], [730, 975, 1455, 1980]];
  A.Sleepwalker = class extends A.Game {
    constructor(mode = 'extended') { super('sleepwalker', 5507, mode); this.lives = 3; this.crystals = 0; this.setup(); }
    setup() {
      const s = this.stage;
      this.p = {x: q(40), y: q(GROUND), vx: 0, vy: 0, face: 1, grounded: true, storm: false, cd: 0};
      Object.assign(this, {camera: 0, sparks: [], foes: [], pops: [], stageTicks: 0, inv: 90, timeLeft: 150 * 60, uid: 0, reached: false});
      this.pits = PITS[s];
      this.blocks = LAYOUTS[s].map(([col, row, kind]) => ({x: col * T, y: GROUND - row * T, kind, used: false}));
      const walkers = [[300, 'ink'], [700, 'ink'], [980, 'ink'], [1400, 'ink'], [1620, 'ink'], [2100, 'ink'], [2400, 'ink']].slice(0, 5 + s);
      for (const [x, kind] of walkers) this.add(kind, x, GROUND);
      // Moth-owls sweep ±50 px around a home clear of every pit's jump and every tall pillow
      // tower (tested), so no jump the level demands passes through a moth's path.
      for (const x of MOTHS[s]) this.add('moth', x, 180);
      this.announce(['NIGHT 1 // PILLOW FIELDS', 'NIGHT 2 // CLOCKWORK ATTIC', 'NIGHT 3 // MOON MIRROR'][s], 140);
    }
    add(kind, x, y) { K.push(this.foes, {kind, x: q(Math.round(x)), y: q(Math.round(y)), home: q(Math.round(x)), vx: -q(1), age: (this.uid * 37) % 120, hp: 1, uid: ++this.uid}, 16); }
    // Solid geometry around a pixel box: blocks (all sides) and ground outside pits.
    solidAt(l, t, r, b) {
      for (const k of this.blocks) if (k.kind !== 'gone' && r > k.x && l < k.x + T && b > k.y && t < k.y + T) return k;
      return null;
    }
    hurtMe() {
      if (this.inv || this.status !== 'playing') return;
      const p = this.p;
      this.emit('hurt');
      if (p.storm) { p.storm = false; this.inv = 90; this.announce('THE STORM FADES', 60); return; }
      this.lives--; this.burst(p.x, p.y - q(14), '#e8b0fc', 18);
      if (this.lives <= 0) { this.finish(false); return; }
      p.x = q(Math.max(40, Math.round(px(this.camera)) + 40)); while (K.overPit(p.x, this.pits)) p.x += q(24);
      p.y = q(GROUND); p.vy = 0; this.inv = 120;
    }
    bump(k) {
      if (k.kind === 's' && !k.used) { k.used = true; this.gainCrystal(k); }
      else if (k.kind === 'S' && !k.used) { k.used = true; K.push(this.pops, {x: q(k.x + 12), y: q(k.y - 12), vy: -q(2), life: 600, kind: 'storm'}, 6); this.emit('pickup'); }
      else if (k.kind === 'b' && this.p.storm) { k.kind = 'gone'; this.score += 50; this.burst(q(k.x + 12), q(k.y + 12), '#b49cff', 10); this.emit('blast'); }
    }
    gainCrystal(k) {
      this.crystals++; this.score += 100; K.push(this.pops, {x: q(k.x + 12), y: q(k.y - 6), vy: -q(3), life: 24, kind: 'crystal'}, 6); this.emit('pickup');
      if (this.crystals % CRYSTAL_LIFE === 0) { this.lives++; this.announce('ONE MORE DREAM // +1 LIFE', 80); }
    }
    tick(input) {
      if (!this.begin()) return;
      this.stageTicks++;
      const p = this.p, s = this.stage;
      if (this.timeLeft && !--this.timeLeft) { this.announce('MORNING CAME', 90); this.inv = 0; p.storm = false; this.hurtMe(); this.timeLeft = 60 * 60; }
      if (this.status !== 'playing') return;
      if (p.cd) p.cd--;
      if (input.x) p.face = input.x;
      // Horizontal move, then resolve against blocks.
      p.vx = input.x * (input.c ? q(5, 2) : q(2));
      p.x = clamp(p.x + p.vx, Math.max(q(10), this.camera + q(8)), q(L - 20));
      let x = px(p.x), y = px(p.y), k = this.solidAt(x - W, y - H, x + W, y);
      if (k) { p.x = q(p.vx > 0 ? k.x - W : k.x + T + W); x = px(p.x); }
      if (input.cPressed && p.grounded) { p.vy = q(-15, 2); p.grounded = false; this.emit('jump'); }
      if (!input.c && p.vy < q(-2)) p.vy = q(-2); // releasing early cuts the jump short
      if (input.aPressed && p.storm && !p.cd && this.sparks.length < 3) { this.sparks.push({x: p.x, y: p.y - q(14), vx: q(p.face * 4), vy: 0, life: 150}); p.cd = 12; this.emit('shot'); }
      p.vy = Math.min(q(8), p.vy + q(3, 10)); p.y += p.vy; y = px(p.y); p.grounded = false;
      k = this.solidAt(x - W, y - H, x + W, y);
      if (k && p.vy > 0) { p.y = q(k.y); p.vy = 0; p.grounded = true; }
      else if (k && p.vy < 0) { p.y = q(k.y + T + H); p.vy = 0; this.bump(k); }
      else if (p.y >= q(GROUND) && !K.overPit(p.x, this.pits)) { p.y = q(GROUND); p.vy = 0; p.grounded = true; }
      if (p.y > q(400)) { this.inv = 0; p.storm = false; this.hurtMe(); }
      if (this.status !== 'playing') return;
      for (const f of this.foes) {
        f.age++;
        if (f.kind === 'ink') {
          f.x += f.vx;
          const ahead = f.x + (f.vx > 0 ? q(10) : -q(10));
          if (K.overPit(ahead, this.pits) || this.solidAt(px(ahead) - 1, px(f.y) - 12, px(ahead) + 1, px(f.y) - 1) || Math.abs(f.x - f.home) > q(140)) f.vx = -f.vx;
        } else f.x = f.home - A.triangle(f.age, 240, q(100)) + q(50), f.y = q(170) + A.triangle(f.age, 90, q(40));
        const fx = px(f.x), fy = px(f.y), top = f.kind === 'ink' ? fy - 16 : fy - 8;
        const ppx = px(p.x), ppy = px(p.y);
        if (Math.abs(ppx - fx) < W + 10 && ppy > top - 2 && ppy - H < (f.kind === 'ink' ? fy : fy + 8)) {
          if (p.vy > 0 && ppy < top + 8) { f.hp = 0; p.vy = q(-5); this.score += 200; this.burst(f.x, f.y - q(8), '#b49cff', 10); this.emit('blast'); }
          else this.hurtMe();
        }
      }
      for (const sp of this.sparks) {
        sp.x += sp.vx; sp.vy += q(3, 10); sp.y += sp.vy; sp.life--;
        if (sp.y >= q(GROUND - 4) && !K.overPit(sp.x, this.pits)) { sp.y = q(GROUND - 4); sp.vy = -q(3); }
        for (const f of this.foes) if (f.hp && A.near(sp, {x: f.x, y: f.y - q(8)}, 14)) { f.hp = 0; sp.life = 0; this.score += 200; this.burst(f.x, f.y - q(8), '#ffd27a', 10); this.emit('blast'); break; }
      }
      K.cull(this.sparks, sp => sp.life > 0 && sp.y < q(380));
      for (const pop of this.pops) {
        pop.life--; pop.y += pop.vy; pop.vy = Math.min(q(2), pop.vy + q(1, 10));
        if (pop.kind === 'storm' && A.near(pop, {x: p.x, y: p.y - q(14)}, 18)) { pop.life = 0; p.storm = true; this.score += 500; this.emit('pickup'); this.announce('STORM CHARM // BREAK BRICKS · Z THROWS SPARKS', 100); }
        if (pop.kind === 'storm' && pop.y > q(GROUND - 8)) { pop.y = q(GROUND - 8); pop.vy = 0; }
      }
      K.cull(this.pops, pop => pop.life > 0);
      K.cull(this.foes, f => f.hp > 0);
      this.camera = clamp(p.x - q(240), this.camera, q(L - 640));
      if (p.x >= q(L - 70)) { this.score += Math.ceil(this.timeLeft / 60) * 10; this.clearStage(); }
    }
    hud() { return {left: 'LIVES ' + this.lives + '   CRYSTALS ' + this.crystals + (this.p.storm ? '   STORM' : ''), right: 'NIGHT ' + (this.stage + 1) + '/3 · ' + Math.ceil(this.timeLeft / 60),
      objective: 'Stomp the nightmares · head-butt star blocks · Storm breaks bricks, Z throws sparks · hold Space to jump higher and run'}; }
    draw(c) {
      const G = A.Gfx, cam = px(this.camera), tick = this.tickCount, s = this.stage, p = this.p;
      const sky = [['#1a1440', '#4a3a8a', '#9a7ac8'], ['#20140c', '#4a2c1c', '#8a5a3a'], ['#06101e', '#16304a', '#5a8ab8']][s];
      G.layer(c, 'dream-sky:' + s, 640, 360, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 300, [[0, sky[0]], [0.6, sky[1]], [1, sky[2]]]); ctx.fillRect(0, 0, 640, 360);
        for (let i = 0; i < 70; i++) { const h = G.hash(i * 13 + s); ctx.fillStyle = G.rgba('#fff6dc', 0.3 + (h % 5) / 8); ctx.fillRect(h % 640, (h >>> 10) % 200, h % 7 ? 1 : 2, h % 7 ? 1 : 2); }
        ctx.fillStyle = G.radial(ctx, 520, 70, 10, 46, [[0, '#fff8e0'], [0.7, G.rgba('#f0e0b0', 0.8)], [1, G.rgba('#f0e0b0', 0)]]); ctx.fillRect(470, 20, 100, 100);
        ctx.fillStyle = sky[0]; ctx.beginPath(); ctx.arc(536, 62, 26, 0, Math.PI * 2); ctx.fill();
      });
      G.layer(c, 'dream-hills:' + s, 1600, 300, ctx => {
        for (let i = 0; i < 18; i++) { const h = G.hash(i * 19 + s), x = i * 96 + h % 40, r = 60 + h % 50;
          ctx.fillStyle = G.shade(sky[1], -0.25); ctx.beginPath(); ctx.ellipse(x, 300, r * 1.4, r, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = G.rgba('#ffffff', 0.08); ctx.beginPath(); ctx.ellipse(x - r * 0.3, 300 - r * 0.6, r * 0.5, r * 0.25, 0, 0, Math.PI * 2); ctx.fill(); }
      }, -Math.round(cam * 0.35), 0);
      G.tile(c, 'dream-ground:' + s, 640, 57, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 57, [[0, G.shade(sky[2], -0.3)], [1, G.shade(sky[0], -0.4)]]); ctx.fillRect(0, 0, 640, 57);
        for (let x = 0; x < 640; x += 16) { ctx.fillStyle = G.rgba('#ffffff', 0.25); ctx.beginPath(); ctx.arc(x + 8, 2, 8, Math.PI, 0); ctx.fill(); }
      }, cam, false, GROUND);
      for (const [l, r] of this.pits) { const x = l - cam; if (x > 660 || x + r - l < -20) continue; D.rect(c, x, GROUND, r - l, 57, G.shade(sky[0], -0.5)); }
      for (const k of this.blocks) { if (k.kind === 'gone') continue; const x = k.x - cam; if (x < -30 || x > 660) continue;
        const key = 'dream-block:' + (k.used ? 'used' : k.kind) + s;
        G.sprite(c, key, T, T, ctx => {
          const fill = k.used ? '#5a5070' : {b: '#9a82d8', s: '#e8c86a', S: '#7ad8ff', w: '#f2ece0'}[k.kind];
          ctx.fillStyle = G.linear(ctx, 0, 0, 0, T, [[0, G.shade(fill, 0.25)], [1, G.shade(fill, -0.3)]]); ctx.fillRect(0, 0, T, T);
          ctx.strokeStyle = G.shade(fill, -0.5); ctx.lineWidth = 2; ctx.strokeRect(1, 1, T - 2, T - 2);
          if (k.kind === 'b' && !k.used) { ctx.fillStyle = G.shade(fill, -0.25); ctx.fillRect(2, 11, T - 4, 2); ctx.fillRect(11, 2, 2, 9); ctx.fillRect(6, 13, 2, 9); ctx.fillRect(17, 13, 2, 9); }
          if ((k.kind === 's' || k.kind === 'S') && !k.used) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 4 : 9; ctx.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r); } ctx.fill(); }
          if (k.kind === 'w') { ctx.fillStyle = 'rgba(160,140,200,0.4)'; ctx.fillRect(4, 4, 6, 6); ctx.fillRect(14, 14, 6, 6); }
        }, x, k.y);
        if ((k.kind === 's' || k.kind === 'S') && !k.used) G.glow(c, x + 12, k.y + 12, 16, k.kind === 'S' ? '#7ad8ff' : '#ffd27a', 0.3 + 0.2 * Math.sin(tick * 0.1));
      }
      const door = L - 60 - cam;
      if (door < 700) { G.glow(c, door, GROUND - 30, 40, '#ffe8a8', 0.5); D.rect(c, door - 16, GROUND - 56, 32, 56, '#3a2a5a'); D.rect(c, door - 12, GROUND - 52, 24, 52, '#ffe8a8');
        D.ellipse(c, door, GROUND - 52, 12, 8, '#ffe8a8'); D.text(c, 'DREAM DOOR', door, GROUND - 64, '#ffe8a8', 9, 'center'); }
      for (const f of this.foes) { const x = px(f.x) - cam, y = px(f.y); if (x < -30 || x > 680) continue;
        if (f.kind === 'ink') { const squish = 1 + 0.1 * Math.sin(tick * 0.3 + f.uid);
          D.ellipse(c, x, y - 8 * squish, 12, 9 * squish, '#1a1028'); D.ellipse(c, x - 4, y - 10, 3, 3, '#ffffff'); D.ellipse(c, x + 4, y - 10, 3, 3, '#ffffff');
          D.rect(c, x - 4, y - 10, 1, 2, '#1a1028'); D.rect(c, x + 4, y - 10, 1, 2, '#1a1028'); }
        else { const flap = tick % 14 < 7 ? -6 : 4; G.glow(c, x, y, 14, '#c8a0ff', 0.3);
          D.ellipse(c, x, y, 8, 7, '#6a5a8a'); D.line(c, x - 4, y, x - 15, y + flap, '#9a8ab8', 4); D.line(c, x + 4, y, x + 15, y + flap, '#9a8ab8', 4);
          D.ellipse(c, x - 3, y - 2, 2.5, 2.5, '#ffd27a'); D.ellipse(c, x + 3, y - 2, 2.5, 2.5, '#ffd27a'); } }
      for (const pop of this.pops) { const x = px(pop.x) - cam, y = px(pop.y);
        if (pop.kind === 'crystal') { G.glow(c, x, y, 10, '#ffd27a', 0.7); D.rect(c, x - 3, y - 5, 6, 10, '#fff1b3'); }
        else { G.glow(c, x, y, 16, '#7ad8ff', 0.7); D.ellipse(c, x, y, 7, 7, '#bdf0ff'); D.line(c, x - 3, y - 4, x + 1, y, '#3a7ab8', 2); D.line(c, x + 1, y, x - 2, y + 4, '#3a7ab8', 2); } }
      if (this.inv % 8 < 5) { // The sleepwalker: striped pajamas, nightcap with a glowing bobble when Storm is up.
        const x = px(p.x) - cam, y = px(p.y), step = p.grounded && p.vx ? Math.floor(tick / 6) % 2 : 0;
        c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(p.face, 1);
        G.shadow(c, 0, 1, 9, 3);
        D.rect(c, -5, -9, 4, 9 - step * 2, '#3a4a8a'); D.rect(c, 1, -9, 4, 9 - (1 - step) * 2, '#3a4a8a');
        D.rect(c, -6, -20, 12, 12, '#8ab8ff'); for (let i = 0; i < 3; i++) D.rect(c, -6, -19 + i * 4, 12, 2, '#5a7ad8');
        D.rect(c, -4, -27, 9, 8, '#f2c8a0'); D.rect(c, 2, -25, 2, 2, '#1a1028');
        D.rect(c, -6, -30, 11, 4, '#e86a8a'); D.rect(c, -9, -33, 6, 4, '#e86a8a');
        const bob = p.storm ? '#7ad8ff' : '#fff6dc'; if (p.storm) G.glow(c, -9, -34, 10, '#7ad8ff', 0.8); D.ellipse(c, -9, -34, 3, 3, bob);
        c.restore(); }
      for (const sp of this.sparks) { const x = px(sp.x) - cam, y = px(sp.y); G.glow(c, x, y, 10, '#7ad8ff', 0.8); D.ellipse(c, x, y, 4, 4, '#e0f8ff'); }
      this.drawEffects(c, cam);
      D.bar(c, 20, 343, 600, px(p.x), L - 70, '#e8b0fc');
    }
  };
  A.register({id: 'sleepwalker', title: 'Pixel Sleepwalker', subtitle: 'Mind the nightmares. Find the door.', genre: 'DREAM PLATFORMER', color: '#e8b0fc', number: '03',
    modes: ['extended'], inspiredBy: 'The Great Giana Sisters',
    controls: ['Move', 'Z · throw spark (Storm)', 'Space · jump · hold to run', '6 crystals · extra life'],
    description: 'Three nights of dreaming. Stomp inkblots and moth-owls, head-butt star blocks and catch the Storm charm before morning comes.'},
  () => new A.Sleepwalker());
})(globalThis.Arcade2);
