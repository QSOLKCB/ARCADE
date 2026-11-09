/* SPDX-License-Identifier: Apache-2.0 */
// Overclock Commando: an original run-and-gun. Eight-way aim, prone, spin jumps,
// weapon capsules and one-hit lives through three stages of a data jungle.
(function (A) {
  'use strict';
  const {q, px, clamp, Engine: E, Draw: D, K3: K} = A;
  const L = 2600, GROUND = 303;
  // Hitboxes per foe, centred on the drawn body: [half width, height above feet, depth below feet].
  const BOX = {runner: [12, 32, 4], sniper: [12, 32, 4], turret: [14, 28, 4], gun: [14, 34, 16], core: [30, 52, 4]};
  const WEAPONS = {rifle: {cd: 10, dmg: 12}, rapid: {cd: 5, dmg: 10}, spread: {cd: 14, dmg: 10}, laser: {cd: 22, dmg: 30}};
  A.Commando = class extends A.Game {
    constructor(mode = 'extended') { super('commando', 3301, mode); this.lives = 5; this.setup(); }
    setup() {
      const s = this.stage;
      this.p = {x: q(60), y: q(GROUND), vx: 0, vy: 0, face: 1, grounded: true, prone: false, cd: 0, weapon: 'rifle', ax: 1, ay: 0};
      Object.assign(this, {camera: 0, shots: [], foes: [], pods: [], items: [], stageTicks: 0, inv: 120, bossDead: false, uid: 0});
      // A spin jump covers 86 px; 50-60 px pits leave a 30 px take-off window.
      this.pits = [[700, 760], [1500, 1560], [2050, 2100]];
      // Every ledge sits within a spin jump's 67 px rise (tested), so none is scenery you cannot use.
      this.ledges = [[300, 244, 140], [560, 250, 100], [900, 242, 160], [1200, 246, 120], [1700, 244, 150], [1900, 248, 110]];
      for (const [x, y, kind] of [[480, GROUND, 'turret'], [980, 242, 'sniper'], [1260, 246, 'sniper'], [1350, GROUND, 'turret'], [1780, 244, 'sniper'], [2200, GROUND, 'turret']])
        this.addFoe(kind, x, y, kind === 'turret' ? 40 + s * 10 : 18);
      for (const y of [180, 228, 276]) this.addFoe('gun', L - 150, y, 60 + s * 15);
      this.addFoe('core', L - 95, 236, 260 + s * 70);
      this.announce(['STAGE 1 // ROOT JUNGLE', 'STAGE 2 // COOLANT FALLS', 'STAGE 3 // THE CORE FARM'][s], 140);
    }
    addFoe(kind, x, y, hp) {
      x = Math.round(x); y = Math.round(y);
      K.push(this.foes, {kind, x: q(x), y: q(y), hp, maxHP: hp, cd: 60 + (this.uid * 23) % 70, flash: 0, uid: ++this.uid, vx: 0}, 30);
    }
    die() {
      if (this.inv || this.status !== 'playing') return;
      const p = this.p;
      this.lives--; this.inv = 120; p.weapon = 'rifle'; this.emit('hurt'); this.burst(p.x, p.y - q(16), '#ffd27a', 18);
      if (this.lives <= 0) { this.finish(false); return; }
      if (K.overPit(p.x, this.pits) || p.y > q(GROUND)) {
        const pit = this.pits.find(([l, r]) => p.x > q(l - 40) && p.x < q(r + 40));
        p.x = q(pit ? pit[0] - 40 : 60);
      }
      p.y = q(200); p.vy = 0; p.grounded = false;
    }
    fire() {
      const p = this.p, w = WEAPONS[p.weapon], [vx, vy] = K.aim(p.ax, p.ay, p.face, p.weapon === 'laser' ? 12 : 8);
      const x = p.x + q(p.face * 10), y = p.y - q(p.prone ? 6 : 22);
      const shot = (sx, sy, extra = {}) => K.push(this.shots, {x, y, vx: sx, vy: sy, mine: true, dmg: w.dmg, life: 90, ...extra}, 160);
      if (p.weapon === 'spread') {
        // Five rounds fanned about the aim: base ± k/6 of its perpendicular.
        for (const k of [-2, -1, 0, 1, 2]) shot(vx - E.mulDiv(vy, k, 6), vy + E.mulDiv(vx, k, 6), {kind: 'spread'});
      } else if (p.weapon === 'laser') shot(vx, vy, {kind: 'laser', hits: []});
      else shot(vx, vy, {kind: 'bullet'});
      p.cd = w.cd; this.emit('shot');
    }
    aimAt(f) {
      const dx = this.p.x - f.x, dy = this.p.y - q(18) - (f.y - q(f.kind === 'turret' ? 10 : 20));
      const dist = Math.max(q(1), Math.abs(dx) + Math.abs(dy));
      K.push(this.shots, {x: f.x, y: f.y - q(f.kind === 'turret' ? 10 : 20), vx: E.mulDiv(dx, q(3) + q(this.stage, 2), dist),
        vy: E.mulDiv(dy, q(3) + q(this.stage, 2), dist), mine: false, dmg: 1, life: 180}, 160);
    }
    tick(input) {
      if (!this.begin()) return;
      this.stageTicks++;
      const p = this.p, s = this.stage;
      if (p.cd) p.cd--;
      p.prone = p.grounded && input.y > 0 && !input.x;
      const hold = input.b || p.prone || (p.grounded && input.y < 0 && !input.x);
      if (input.x) p.face = input.x;
      p.ax = input.x || (input.y ? 0 : p.face); p.ay = p.prone ? 0 : input.y > 0 && p.grounded ? 0 : input.y;
      p.vx = hold ? 0 : input.x * q(2);
      if (input.cPressed && p.grounded && !p.prone) { p.vy = q(-13, 2); p.grounded = false; this.emit('jump'); }
      if (input.a && !p.cd) this.fire();
      const oldY = p.y;
      p.x = clamp(p.x + p.vx, Math.max(q(16), this.camera + q(8)), q(L - 180));
      p.vy = Math.min(q(8), p.vy + q(3, 10)); p.y += p.vy;
      p.grounded = K.land(p, oldY, this.ledges, this.pits, L, GROUND);
      if (p.y > q(400)) { this.inv = 0; this.die(); }
      if (this.status !== 'playing') return;
      // Runners pour in from ahead (and now and then from behind) until the boss wall.
      const runners = this.foes.filter(f => f.kind === 'runner').length;
      if (this.stageTicks % Math.max(40, 75 - s * 12) === 0 && runners < 8 && this.camera < q(L - 700)) {
        const behind = this.random(5) === 0, x = this.camera + q(behind ? -20 : 660);
        if (!K.overPit(x, this.pits) && x < q(L - 220)) { this.addFoe('runner', px(x), GROUND, 1); this.foes.at(-1).vx = behind ? q(5, 2) : -q(5, 2) - q(s, 4); }
      }
      if (this.stageTicks % 520 === 200) K.push(this.pods, {x: this.camera + q(660), base: q(110 + this.random(70)), y: q(130), age: 0,
        drop: ['spread', 'laser', 'rapid'][(this.stageTicks / 520 | 0) % 3], uid: ++this.uid}, 4);
      for (const pod of this.pods) { pod.age++; pod.x -= q(2); pod.y = pod.base + A.triangle(pod.age, 120, q(60)) - q(30); }
      K.cull(this.pods, pod => pod.x > this.camera - q(40));
      const gunsAlive = this.foes.some(f => f.kind === 'gun');
      for (const f of this.foes) {
        if (f.flash) f.flash--;
        if (f.kind === 'runner') {
          f.x += f.vx;
          if (K.overPit(f.x, this.pits)) { f.hp = 0; continue; } // a runner that falls is gone, not a hazard
          if (A.near(f, p, 14) && Math.abs(f.y - p.y) < q(28)) this.die();
          continue;
        }
        if (Math.abs(f.x - p.x) > q(440)) continue;
        if (--f.cd <= 0) {
          f.cd = {turret: 95, sniper: 120, gun: 80, core: 999}[f.kind] - s * 10;
          if (f.kind !== 'core') { this.aimAt(f); if (f.kind === 'gun' && s) this.aimAt(f); }
        }
      }
      for (const b of this.shots) {
        b.x += b.vx; b.y += b.vy; b.life--;
        if (!b.mine) {
          const top = p.y - q(p.prone ? 10 : 32);
          if (Math.abs(b.x - p.x) < q(p.prone ? 16 : 8) && b.y > top && b.y < p.y) { b.life = 0; this.die(); }
          continue;
        }
        for (const pod of this.pods) if (A.near(b, pod, 14)) {
          pod.x = -q(999); b.life = 0; K.push(this.items, {x: pod.x0 ?? b.x, y: b.y, vy: 0, kind: pod.drop}, 6); this.score += 200; this.emit('blast');
        }
        if (!b.life) continue;
        for (const f of this.foes) {
          if (f.hp <= 0 || (b.hits && b.hits.includes(f.uid))) continue;
          // Standing shots travel 22 px above the feet, so every foe's box must cover that height.
          const [h, tall, below] = BOX[f.kind];
          if (Math.abs(b.x - f.x) < q(h) && b.y > f.y - q(tall) && b.y < f.y + q(below)) {
            if (f.kind === 'core' && gunsAlive) { b.life = 0; this.burst(b.x, b.y, '#9fb3dc', 2); break; }
            f.hp = Math.max(0, f.hp - b.dmg); f.flash = 6;
            if (b.kind === 'laser') b.hits.push(f.uid); else b.life = 0;
            if (!f.hp) {
              this.score += {runner: 100, sniper: 300, turret: 500, gun: 800, core: 3000}[f.kind];
              this.burst(f.x, f.y - q(16), f.kind === 'core' ? '#ff9a5a' : '#ffd27a', f.kind === 'core' ? 40 : 12); this.emit('blast');
              if (f.kind === 'core') this.bossDead = true;
            }
            break;
          }
        }
      }
      for (const it of this.items) {
        it.vy = Math.min(q(4), it.vy + q(2, 10)); it.y = Math.min(q(GROUND), it.y + it.vy);
        if (A.near(it, p, 20)) { p.weapon = it.kind; it.kind = null; this.emit('pickup'); this.announce('WEAPON // ' + p.weapon.toUpperCase(), 70); }
      }
      K.cull(this.items, it => it.kind && it.x > this.camera - q(40));
      K.cull(this.shots, b => b.life > 0 && Math.abs(b.x - p.x) < q(700) && b.y > q(-30) && b.y < q(380));
      // Placed foes (turrets, snipers, the boss) stay until destroyed; only runners leave by distance.
      K.cull(this.foes, f => f.hp > 0 && (f.kind !== 'runner' || (f.x > this.camera - q(80) && f.x < this.camera + q(900))));
      this.camera = clamp(p.x - q(240), this.camera, q(L - 640));
      if (this.bossDead) { this.score += this.lives * 250; this.clearStage(); }
    }
    hud() { return {left: 'LIVES ' + this.lives + '   ' + this.p.weapon.toUpperCase(), right: 'STAGE ' + (this.stage + 1) + '/3',
      objective: 'Aim eight ways · Z fires · Space spin-jumps · down goes prone · hold X to plant and aim · shoot capsules for weapons'}; }
    draw(c) {
      const G = A.Gfx, cam = px(this.camera), tick = this.tickCount, s = this.stage, p = this.p;
      const tones = [['#04140f', '#0d2a22', '#2b5a3c'], ['#06121c', '#0e2a3c', '#2d5c74'], ['#140a10', '#2a1420', '#5a2c3c']][s];
      G.layer(c, 'commando-sky:' + s, 640, 360, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 300, [[0, tones[0]], [0.7, tones[1]], [1, tones[2]]]); ctx.fillRect(0, 0, 640, 360);
        for (let i = 0; i < 50; i++) { const h = G.hash(i * 17 + s); ctx.fillStyle = G.rgba('#bff6c8', 0.15 + (h % 5) / 20); ctx.fillRect(h % 640, (h >>> 10) % 160, 1, 1); }
      });
      // Server-tree trunks and hanging cables: two parallax layers painted once.
      G.layer(c, 'commando-far:' + s, 1200, 300, ctx => {
        for (let i = 0; i < 26; i++) { const h = G.hash(i * 41 + s), x = i * 48 + h % 20, w = 18 + h % 16;
          ctx.fillStyle = G.shade(tones[1], 0.05); ctx.fillRect(x, 60 + h % 40, w, 300);
          for (let y = 80; y < 300; y += 14) if (G.hash(i * 7 + y) % 4 === 0) { ctx.fillStyle = G.rgba('#7dffb0', 0.5); ctx.fillRect(x + 4, y, 3, 2); } }
      }, -Math.round(cam * 0.25), 0);
      G.layer(c, 'commando-mid:' + s, 1900, 300, ctx => {
        for (let i = 0; i < 30; i++) { const h = G.hash(i * 97 + s * 3), x = i * 64 + h % 30;
          ctx.strokeStyle = G.shade(tones[2], -0.2); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + 30, 80 + h % 60, x + 60, 10); ctx.stroke();
          ctx.fillStyle = G.shade(tones[2], -0.35); ctx.fillRect(x, 150 + h % 60, 26, 300); }
      }, -Math.round(cam * 0.5), 0);
      G.tile(c, 'commando-ground:' + s, 640, 57, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 57, [[0, G.shade(tones[2], -0.1)], [1, '#05080d']]); ctx.fillRect(0, 0, 640, 57);
        ctx.fillStyle = '#7dffb0'; ctx.fillRect(0, 0, 640, 2);
        for (let x = 0; x < 640; x += 9) { ctx.fillStyle = G.shade(tones[2], 0.2); ctx.fillRect(x, 2, 2, 3 + (x * 7) % 5); }
      }, cam, false, GROUND);
      for (const [l, r] of this.pits) { const x = l - cam; if (x > 660 || x + r - l < -20) continue;
        D.rect(c, x, GROUND, r - l, 57, '#020407'); G.glow(c, x + (r - l) / 2, 356, r - l, '#3affc8', 0.2); }
      for (const [x, y, w] of this.ledges) { const lx = x - cam; if (lx > 660 || lx + w < -20) continue;
        D.rect(c, lx, y, w, 9, G.shade(tones[2], 0.1)); D.rect(c, lx, y, w, 2, '#7dffb0'); D.rect(c, lx + 6, y + 9, 3, GROUND - y - 9, G.shade(tones[1], 0.1)); }
      for (const f of this.foes) { const x = px(f.x) - cam, y = px(f.y); if (x < -60 || x > 700) continue;
        if (f.kind === 'runner') D.person(c, x, y, f.flash ? '#fff' : '#ff8a6a', Math.sign(px(f.vx)) || -1, tick, 'trooper', 2);
        else if (f.kind === 'sniper') D.person(c, x, y, f.flash ? '#fff' : '#c9a0ff', x > px(p.x) - cam ? -1 : 1, 0, 'trooper', 2, f.cd < 18);
        else if (f.kind === 'turret' || f.kind === 'gun') {
          const tone = f.flash ? '#ffffff' : f.kind === 'gun' ? '#ff6a6a' : '#9fb3dc';
          if (f.kind === 'turret') { D.rect(c, x - 13, y - 14, 26, 14, '#2a3442'); D.rect(c, x - 13, y - 14, 26, 2, '#5a6878'); }
          D.ellipse(c, x, y - 16, 14, 11, G.shade(tone, -0.3)); D.ellipse(c, x, y - 18, 9, 7, tone);
          const dx = px(p.x) - cam - x, dy = px(p.y) - 18 - (y - 18), d = Math.hypot(dx, dy) || 1;
          D.line(c, x, y - 18, x + dx / d * 16, y - 18 + dy / d * 16, '#e8eef4', 4);
          // Firing warning: a muzzle flare drawn in both FX tiers (the glow is extra, full tier only).
          if (f.cd < 18) { G.glow(c, x, y - 18, 14, '#ff4d4d', 0.8); D.ellipse(c, x + dx / d * 16, y - 18 + dy / d * 16, 5, 5, '#ff4d4d'); D.ellipse(c, x + dx / d * 16, y - 18 + dy / d * 16, 2, 2, '#fff0f0'); }
          if (f.kind === 'turret') D.bar(c, x - 14, y - 34, 28, f.hp, f.maxHP, '#ff7e81');
        } else {
          const open = !this.foes.some(g => g.kind === 'gun');
          D.rect(c, x - 40, 120, 80, GROUND - 120, '#1c2430'); D.rect(c, x - 40, 120, 80, 4, '#ff6a6a');
          G.glow(c, x, y - 25, open ? 50 : 26, open ? '#ff9a5a' : '#5a7ab0', 0.6 + 0.3 * Math.sin(tick * 0.2));
          D.ellipse(c, x, y - 25, 18, 24, f.flash ? '#fff' : open ? '#ffb35c' : '#6f8fb8');
          D.bar(c, x - 40, 108, 80, f.hp, f.maxHP, '#ffa18b'); D.text(c, open ? 'CORE OPEN' : 'SHIELDED', x, 102, open ? '#ffd27a' : '#a0b9c5', 10, 'center');
        }
      }
      for (const pod of this.pods) { const x = px(pod.x) - cam, y = px(pod.y);
        G.glow(c, x, y, 16, '#ffd27a', 0.5); D.ellipse(c, x, y, 12, 7, '#d8dee8'); D.rect(c, x - 18, y - 2, 36, 4, '#8a98a6'); }
      for (const it of this.items) { const x = px(it.x) - cam, y = px(it.y);
        G.glow(c, x, y - 8, 14, '#c2f874', 0.5); D.ellipse(c, x, y - 8, 10, 8, '#c2f874'); D.text(c, it.kind[0].toUpperCase(), x, y - 4, '#14382f', 11, 'center'); }
      if (this.inv % 8 < 5) {
        const x = px(p.x) - cam, y = px(p.y);
        if (p.prone) { c.save(); c.translate(x, y); c.rotate(p.face * Math.PI / 2); D.person(c, 0, 14, '#7fe3e0', p.face, 0, 'trooper', 1.8, true); c.restore(); }
        else if (!p.grounded) { c.save(); c.translate(x, y - 14); c.rotate(tick * 0.5 * p.face); D.ellipse(c, 0, 0, 11, 11, '#7fe3e0'); D.ellipse(c, 0, 0, 6, 6, '#1d2533'); c.restore(); }
        else D.person(c, x, y, '#7fe3e0', p.face, p.vx ? tick : 0, 'trooper', 2, p.cd > WEAPONS[p.weapon].cd - 4);
      }
      for (const b of this.shots) { const x = px(b.x) - cam, y = px(b.y);
        if (!b.mine) { G.glow(c, x, y, 8, '#ff4d6a', 0.6); D.ellipse(c, x, y, 3, 3, '#ffb0b8'); }
        else if (b.kind === 'laser') { G.glow(c, x, y, 12, '#7ff3ff', 0.7); D.line(c, x, y, x - px(b.vx) * 2, y - px(b.vy) * 2, '#c8faff', 3); }
        else { G.glow(c, x, y, 6, b.kind === 'spread' ? '#ff8a5a' : '#ffd27a', 0.5); D.rect(c, x - 2, y - 2, 4, 4, b.kind === 'spread' ? '#ffb38a' : '#fff3c4'); } }
      this.drawEffects(c, cam);
      D.bar(c, 20, 343, 600, px(p.x), L - 180, '#7fe3e0');
    }
  };
  A.register({id: 'commando', title: 'Overclock Commando', subtitle: 'Eight directions. One life at a time.', genre: 'RUN & GUN', color: '#7fe3e0', number: '01',
    modes: ['extended'], inspiredBy: 'Contra',
    controls: ['Move · aim 8 ways · down prone', 'Z · fire', 'X · plant and aim', 'Space · spin jump'],
    description: 'Three stages of data jungle. Shoot capsules for Spread, Laser and Rapid fire, then crack the core behind its three guns.'},
  () => new A.Commando());
})(globalThis.Arcade2);
