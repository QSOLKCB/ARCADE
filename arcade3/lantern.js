/* SPDX-License-Identifier: Apache-2.0 */
// Tin Lantern: an original gothic-mechanical platformer. A clockwork knight whose
// brass plating breaks off on the first hit, committed jump arcs, thrown tools
// (only a few on screen at once), scrap risers and a Foundry Warden in each stage.
(function (A) {
  'use strict';
  const {q, px, clamp, Engine: E, Draw: D, K3: K} = A;
  const L = 2400, GROUND = 303;
  const TOOLS = {spanner: {cd: 16, max: 2, dmg: 14}, flare: {cd: 24, max: 2, dmg: 10}, lance: {cd: 20, max: 1, dmg: 22}};
  const CYCLE = ['flare', 'lance', 'spanner'];
  A.Lantern = class extends A.Game {
    constructor(mode = 'extended') { super('lantern', 4409, mode); this.lives = 4; this.setup(); }
    setup() {
      const s = this.stage;
      this.p = {x: q(50), y: q(GROUND), vy: 0, jumpVX: 0, face: 1, grounded: true, cd: 0, armor: true, tool: this.p ? this.p.tool : 'spanner'};
      Object.assign(this, {camera: 0, shots: [], foes: [], slag: [], drops: [], stageTicks: 0, inv: 90, bossDead: false, kills: 0, checkpoint: 50, uid: 0});
      this.pits = [[640, 700], [1180, 1240], [1720, 1780]];
      this.ledges = [[380, 238, 120], [820, 226, 140], [1350, 232, 130], [1880, 222, 120]];
      this.chests = [{x: q(900), y: q(226), open: false}, {x: q(1420), y: q(232), open: false}];
      for (const [x, y] of [[430, 238], [880, 226], [1400, 232], [1930, 222]]) this.add('crow', x, y - 6, 1);
      this.add('warden', L - 200, GROUND, 40 + s * 15);
      this.announce(['STAGE 1 // THE SCRAPYARD', 'STAGE 2 // RUST MARSH', 'STAGE 3 // FURNACE KEEP'][s], 140);
    }
    add(kind, x, y, hp) {
      x = Math.round(x); y = Math.round(y); // spawn points can derive from fractional positions
      K.push(this.foes, {kind, x: q(x), y: q(y), hp, maxHP: hp, home: q(x), age: 0, vx: 0, cd: 80 + (this.uid * 29) % 60, rise: kind === 'riser' ? 30 : 0, flash: 0, uid: ++this.uid}, 24);
    }
    hurt() {
      if (this.inv || this.status !== 'playing') return;
      const p = this.p;
      this.emit('hurt');
      if (p.armor) { p.armor = false; this.inv = 90; this.burst(p.x, p.y - q(16), '#d8c27a', 14); this.announce('PLATING LOST', 60); return; }
      this.lives--; this.burst(p.x, p.y - q(16), '#ffd27a', 20);
      if (this.lives <= 0) { this.finish(false); return; }
      p.x = q(this.checkpoint); p.y = q(GROUND); p.vy = 0; p.jumpVX = 0; p.grounded = true; p.armor = true; this.inv = 120;
      this.camera = clamp(p.x - q(240), 0, q(L - 640)); this.foes = this.foes.filter(f => f.kind !== 'riser' && f.kind !== 'wraith'); this.slag = [];
    }
    throwTool() {
      const p = this.p, t = TOOLS[p.tool];
      if (this.shots.length >= t.max) return;
      const x = p.x + q(p.face * 10), y = p.y - q(18);
      if (p.tool === 'flare') this.shots.push({x, y, vx: q(p.face * 3), vy: q(-3), kind: 'flare', dmg: t.dmg, life: 120, burn: 0});
      else this.shots.push({x, y, vx: q(p.face * (p.tool === 'lance' ? 8 : 6)), vy: 0, kind: p.tool, dmg: t.dmg, life: 80, hits: []});
      p.cd = t.cd; this.emit('shot');
    }
    tick(input) {
      if (!this.begin()) return;
      this.stageTicks++;
      const p = this.p, s = this.stage;
      if (p.cd) p.cd--;
      if (p.grounded) {
        if (input.x) p.face = input.x;
        p.x = clamp(p.x + input.x * q(3, 2), Math.max(q(12), this.camera + q(8)), q(L - 150));
        // A committed jump: its horizontal speed is fixed at take-off, as in the genre.
        if (input.cPressed) { p.vy = q(-6); p.jumpVX = input.x * q(2); p.grounded = false; this.emit('jump'); }
      } else p.x = clamp(p.x + p.jumpVX, Math.max(q(12), this.camera + q(8)), q(L - 150));
      if (input.a && !p.cd) this.throwTool();
      const oldY = p.y;
      p.vy = Math.min(q(8), p.vy + q(1, 4)); p.y += p.vy;
      if (K.land(p, oldY, this.ledges, this.pits, L, GROUND)) { p.grounded = true; p.jumpVX = 0; } else p.grounded = false;
      if (p.y > q(400)) { this.inv = 0; p.armor = false; this.hurt(); }
      if (this.status !== 'playing') return;
      if (p.x > q(1300)) this.checkpoint = 1300;
      // Scrap risers claw out of the ground around the knight.
      const risers = this.foes.filter(f => f.kind === 'riser').length;
      // At most four risers at once: the knight can only have one or two tools in flight.
      if (this.stageTicks % Math.max(45, 90 - s * 15) === 0 && risers < 4 && p.x < q(L - 360)) {
        const side = this.random(2) ? 1 : -1, x = clamp(p.x + side * q(120 + this.random(140)), q(30), q(L - 300));
        if (!K.overPit(x, this.pits)) this.add('riser', px(x), GROUND, 1 + (s === 2 ? 1 : 0));
      }
      if (s >= 1 && this.stageTicks % 300 === 150 && this.foes.filter(f => f.kind === 'wraith').length < 2)
        this.add('wraith', px(this.camera) + 680, 250, 2);
      for (const f of this.foes) {
        f.age++; if (f.flash) f.flash--;
        if (f.kind === 'riser') {
          if (f.rise) { f.rise--; continue; }
          f.x += p.x > f.x ? q(3, 4) : -q(3, 4);
          if (A.near(f, p, 14) && Math.abs(f.y - p.y) < q(26)) this.hurt();
        } else if (f.kind === 'crow') {
          if (!f.vx && Math.abs(f.x - p.x) < q(200)) f.vx = p.x < f.x ? -q(2) : q(2);
          if (f.vx) { f.x += f.vx; f.y = f.home ? Math.min(q(GROUND - 20), f.y + q(1, 2)) : f.y; }
          if (A.near(f, {x: p.x, y: p.y - q(16)}, 14)) this.hurt();
        } else if (f.kind === 'wraith') {
          // Wraiths sweep between 250 and 290 px, dipping into the knight's throwing line.
          f.x -= q(1); f.y = f.home ? q(250) + A.triangle(f.age, 160, q(40)) : f.y;
          if (--f.cd <= 0) { f.cd = 120; const dx = p.x - f.x, dy = p.y - q(16) - f.y, d = Math.max(q(1), Math.abs(dx) + Math.abs(dy));
            K.push(this.slag, {x: f.x, y: f.y, vx: E.mulDiv(dx, q(2), d), vy: E.mulDiv(dy, q(2), d), g: 0, life: 200}, 24); }
          if (A.near(f, {x: p.x, y: p.y - q(16)}, 16)) this.hurt();
        } else if (f.kind === 'warden') {
          if (Math.abs(f.x - p.x) > q(420)) continue;
          f.x = f.home - A.triangle(f.age, 240, q(120));
          if (--f.cd <= 0) {
            f.cd = 90 - s * 15;
            for (const k of [1, 2, 3]) K.push(this.slag, {x: f.x, y: f.y - q(60), vx: -q(k), vy: -q(7, 2), g: 1, life: 200}, 24);
          }
          if (Math.abs(f.x - p.x) < q(34) && p.y > f.y - q(80)) this.hurt();
        }
      }
      for (const m of this.slag) {
        m.x += m.vx; m.y += m.vy; if (m.g) m.vy += q(1, 8); m.life--;
        if (m.y > q(GROUND)) m.life = 0;
        if (A.near(m, {x: p.x, y: p.y - q(14)}, 12)) { m.life = 0; this.hurt(); }
      }
      K.cull(this.slag, m => m.life > 0);
      for (const b of this.shots) {
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.kind === 'flare') {
          if (b.burn) b.burn--; else { b.vy += q(1, 4); if (b.y >= q(GROUND - 4) && !K.overPit(b.x, this.pits)) { b.y = q(GROUND - 4); b.vx = 0; b.vy = 0; b.burn = 40; b.life = 40; } }
        }
        for (const f of this.foes) {
          if (f.hp <= 0 || f.rise || (b.hits && b.hits.includes(f.uid))) continue;
          const tall = f.kind === 'warden' ? 90 : f.kind === 'riser' || f.kind === 'wraith' ? 30 : 16, half = f.kind === 'warden' ? 34 : 14;
          const cy = f.kind === 'riser' || f.kind === 'warden' ? f.y - q(tall / 2) : f.y;
          if (Math.abs(b.x - f.x) < q(half) && Math.abs(b.y - cy) < q(tall / 2 + 4)) {
            f.hp = Math.max(0, f.hp - b.dmg); f.flash = 6;
            if (b.kind === 'lance') b.hits.push(f.uid); else if (!b.burn) b.life = 0;
            if (!f.hp) this.defeat(f);
            if (!b.burn) break;
          }
        }
      }
      K.cull(this.shots, b => b.life > 0 && Math.abs(b.x - p.x) < q(520));
      K.cull(this.foes, f => f.hp > 0 && (f.kind !== 'wraith' || f.x > this.camera - q(60)));
      for (const c of this.chests) if (!c.open && A.near(c, p, 24)) { c.open = true; p.armor = true; this.score += 300; this.emit('pickup'); this.announce('PLATING RESTORED', 70); }
      for (const d of this.drops) if (d.tool && A.near(d, p, 22)) { p.tool = d.tool; d.tool = null; this.emit('pickup'); this.announce('TOOL // ' + p.tool.toUpperCase(), 70); }
      K.cull(this.drops, d => d.tool);
      this.camera = clamp(p.x - q(240), this.camera, q(L - 640));
      if (this.bossDead) { this.score += 2500 + (p.armor ? 1000 : 0); this.clearStage(); }
    }
    defeat(f) {
      this.kills++; this.score += {riser: 100, crow: 150, wraith: 250, warden: 0}[f.kind];
      this.burst(f.x, f.y - q(f.kind === 'warden' ? 40 : 12), f.kind === 'warden' ? '#ff9a5a' : '#d8c27a', f.kind === 'warden' ? 40 : 10); this.emit('blast');
      if (f.kind === 'warden') this.bossDead = true;
      else if (this.kills % 7 === 0) K.push(this.drops, {x: f.x, y: q(GROUND), tool: CYCLE[(this.kills / 7 - 1) % 3]}, 4);
    }
    hud() { return {left: 'LIVES ' + this.lives + '   ' + (this.p.armor ? 'PLATED' : 'EXPOSED') + '   ' + this.p.tool.toUpperCase(), right: 'STAGE ' + (this.stage + 1) + '/3',
      objective: 'Jumps are committed · Z throws your tool · chests restore plating · defeat the Foundry Warden'}; }
    draw(c) {
      const G = A.Gfx, cam = px(this.camera), tick = this.tickCount, s = this.stage, p = this.p;
      const sky = [['#120a1c', '#2a1830', '#4a2a3c'], ['#081418', '#13303a', '#2c4a44'], ['#1c0806', '#3a120c', '#6a2a14']][s];
      G.layer(c, 'lantern-sky:' + s, 640, 360, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 300, [[0, sky[0]], [0.7, sky[1]], [1, sky[2]]]); ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = G.radial(ctx, 140, 80, 4, 40, [[0, '#fff2d0'], [0.6, G.rgba('#e8c08a', 0.6)], [1, G.rgba('#e8c08a', 0)]]); ctx.fillRect(90, 30, 100, 100);
      });
      G.layer(c, 'lantern-far:' + s, 1100, 300, ctx => {
        for (let i = 0; i < 24; i++) { const h = G.hash(i * 31 + s), x = i * 48 + h % 24, top = 140 + h % 70;
          ctx.fillStyle = G.shade(sky[1], -0.25); ctx.fillRect(x, top, 30, 300 - top);
          if (h % 3 === 0) { ctx.beginPath(); ctx.moveTo(x - 4, top); ctx.lineTo(x + 15, top - 30); ctx.lineTo(x + 34, top); ctx.fill(); }
          if (h % 4 === 0) { ctx.fillStyle = G.rgba('#ffcf7a', 0.6); ctx.fillRect(x + 12, top + 20, 5, 7); } }
      }, -Math.round(cam * 0.3), 0);
      G.tile(c, 'lantern-ground:' + s, 640, 57, ctx => {
        ctx.fillStyle = G.linear(ctx, 0, 0, 0, 57, [[0, G.shade(sky[2], -0.2)], [1, '#06040a']]); ctx.fillRect(0, 0, 640, 57);
        ctx.fillStyle = G.shade(sky[2], 0.2); ctx.fillRect(0, 0, 640, 2);
        for (let x = 0; x < 640; x += 46) { ctx.fillStyle = '#2a2430'; ctx.fillRect(x + 10, -18, 14, 18); ctx.fillRect(x + 14, -24, 6, 6); }
      }, cam, false, GROUND);
      for (const [l, r] of this.pits) { const x = l - cam; if (x > 660 || x + r - l < -20) continue;
        D.rect(c, x, GROUND, r - l, 57, s === 2 ? '#3a0c04' : '#03050a'); if (s === 2) G.glow(c, x + (r - l) / 2, 350, r - l, '#ff5a2a', 0.5); }
      for (const [x, y, w] of this.ledges) { const lx = x - cam; if (lx > 660 || lx + w < -20) continue;
        D.rect(c, lx, y, w, 10, '#3a3040'); D.rect(c, lx, y, w, 2, '#a89070'); D.rect(c, lx + 10, y + 10, 4, GROUND - y - 10, '#2a2430'); }
      for (const ch of this.chests) { const x = px(ch.x) - cam, y = px(ch.y);
        D.rect(c, x - 11, y - 14, 22, 14, ch.open ? '#3a2c20' : '#8a5a2a'); D.rect(c, x - 11, y - 14, 22, 3, '#d8c27a'); if (!ch.open) G.glow(c, x, y - 8, 16, '#ffd27a', 0.35); }
      for (const d of this.drops) { const x = px(d.x) - cam; G.glow(c, x, GROUND - 10, 14, '#c2f874', 0.5); D.text(c, d.tool[0].toUpperCase(), x, GROUND - 6, '#c2f874', 12, 'center'); }
      for (const f of this.foes) { const x = px(f.x) - cam, y = px(f.y); if (x < -80 || x > 720) continue;
        if (f.kind === 'riser') { const up = 1 - f.rise / 30;
          c.save(); c.beginPath(); c.rect(x - 20, 0, 40, GROUND); c.clip();
          D.person(c, x, y + 28 * (1 - up), f.flash ? '#fff' : '#8a9a6a', p.x < f.x ? -1 : 1, f.rise ? 0 : tick, 'trooper', 2); c.restore();
          if (f.rise) for (let k = 0; k < 3; k++) D.rect(c, x - 10 + k * 8, GROUND - 2, 4, 2, '#5a4a3a'); }
        else if (f.kind === 'crow') { const flap = tick % 12 < 6 ? -4 : 3;
          D.ellipse(c, x, y, 8, 5, f.flash ? '#fff' : '#1a1420'); D.line(c, x - 2, y, x - 12, y + flap, '#2a2030', 3); D.line(c, x + 2, y, x + 12, y + flap, '#2a2030', 3); D.rect(c, x + (f.vx > 0 ? 6 : -9), y - 2, 3, 2, '#ffcf3a'); }
        else if (f.kind === 'wraith') { G.glow(c, x, y, 22, '#9fd0ff', 0.4); D.ellipse(c, x, y, 10, 13, f.flash ? '#fff' : G.rgba('#cfe8ff', 0.7)); D.rect(c, x - 4, y - 3, 2, 3, '#0a0f17'); D.rect(c, x + 2, y - 3, 2, 3, '#0a0f17'); }
        else { // Foundry Warden: a furnace-bellied hulk.
          G.glow(c, x, y - 40, 60, '#ff7a2a', 0.3);
          D.rect(c, x - 30, y - 80, 60, 80, f.flash ? '#fff' : '#4a3a34'); D.rect(c, x - 30, y - 80, 60, 4, '#a89070');
          D.rect(c, x - 16, y - 50, 32, 22, '#ff9a3a'); G.glow(c, x, y - 40, 22, '#ffcf6a', 0.6 + 0.3 * Math.sin(tick * 0.3));
          D.rect(c, x - 12, y - 96, 24, 18, '#3a2c28'); D.rect(c, x - 8, y - 90, 4, 4, '#ff5a2a'); D.rect(c, x + 4, y - 90, 4, 4, '#ff5a2a');
          D.rect(c, x - 44, y - 70, 14, 40, '#3a2c28'); D.rect(c, x + 30, y - 70, 14, 40, '#3a2c28');
          D.bar(c, x - 40, y - 108, 80, f.hp, f.maxHP, '#ffa18b'); D.text(c, 'FOUNDRY WARDEN', x, y - 114, '#ffb4a0', 10, 'center'); }
      }
      for (const m of this.slag) { const x = px(m.x) - cam, y = px(m.y); G.glow(c, x, y, 10, '#ff7a2a', 0.7); D.ellipse(c, x, y, 4, 4, '#ffcf6a'); }
      if (this.inv % 8 < 5) {
        const x = px(p.x) - cam, y = px(p.y), plate = p.armor ? '#c8ccd4' : '#b87a3a';
        D.person(c, x, y, plate, p.face, p.grounded ? tick : 0, 'trooper', 2, p.cd > TOOLS[p.tool].cd - 5);
        // Lantern plume and glowing chest window: the knight's own signature.
        D.rect(c, x - 2, y - 33, 4, 6, p.armor ? '#ff6a4a' : '#5a4a3a'); G.glow(c, x, y - 16, 10, '#ffcf6a', 0.6); D.rect(c, x - 2, y - 18, 4, 4, '#ffe8a8');
        if (!p.armor) for (let k = 0; k < 3; k++) D.ellipse(c, x - 4 + k * 4, y - 10, 2, 2, '#d8a050');
      }
      for (const b of this.shots) { const x = px(b.x) - cam, y = px(b.y);
        if (b.kind === 'flare') { G.glow(c, x, y, b.burn ? 18 : 10, '#ff8a3a', 0.8); D.ellipse(c, x, y, 4, b.burn ? 6 : 4, '#ffd27a'); }
        else if (b.kind === 'lance') { G.glow(c, x, y, 10, '#cfe8ff', 0.5); D.rect(c, x - 12, y - 1, 24, 3, '#e8eef4'); D.rect(c, x + (b.vx > 0 ? 8 : -12), y - 3, 4, 7, '#ffffff'); }
        else { c.save(); c.translate(x, y); c.rotate(tick * 0.6); D.rect(c, -6, -2, 12, 4, '#b8c2cc'); D.rect(c, -6, -4, 3, 8, '#b8c2cc'); c.restore(); } }
      this.drawEffects(c, cam);
      D.bar(c, 20, 343, 600, px(p.x), L - 150, '#d8c27a');
    }
  };
  A.register({id: 'lantern', title: 'Tin Lantern', subtitle: 'Lose the plating. Keep the flame.', genre: 'GOTHIC PLATFORMER', color: '#d8c27a', number: '02',
    modes: ['extended'], inspiredBy: "Ghosts 'n Goblins",
    controls: ['Move', 'Z · throw tool', 'Space · committed jump', 'Chests restore plating'],
    description: 'A clockwork knight crosses three haunted foundries. One hit strips the plating, the next costs a life. Jumps cannot be steered.'},
  () => new A.Lantern());
})(globalThis.Arcade2);
