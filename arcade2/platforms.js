/* SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const {q, px, clamp, Draw: D, Engine: E} = A;
  const SPECS = {
    shadow: {title: 'SHADOW CIRCUIT', color: '#8ceee1', attack: 'blade', speed: q(16, 5), boss: 'THE SHOGUN PROCESS'},
    cache: {title: 'CACHE NINJA', color: '#e8b0fc', attack: 'star', speed: q(14, 5), boss: 'THE WATCHDOG'},
    iron: {title: 'IRON COMET', color: '#ffc06a', attack: 'gun', speed: q(14, 5), boss: 'AUDIT TANK'},
  };
  A.Platform = class extends A.Game {
    constructor(id) { super(id, {shadow: 1701, cache: 2903, iron: 4109}[id]); this.spec = SPECS[id]; this.setup(); }
    setup() {
      this.p = {x: q(70), y: q(303), vx: 0, vy: 0, face: 1, grounded: true, jumps: 0, cd: 0, special: 0, swing: 0};
      this.camera = 0; this.shots = []; this.grenades = []; this.bombs = 3; this.rescued = 0; this.bossDead = false;
      this.inv = 90; this.stageTicks = 0;
      this.pits = this.id === 'cache' ? [[720, 786], [1475, 1540]] : [[610, 688], [1430, 1510]];
      this.ledges = [[270, 250, 120], [450, 209, 100], [820, 247, 150], [1050, 211, 140], [1320, 252, 100], [1660, 241, 110]];
      this.hostages = this.id === 'cache' ? [{x: q(330), y: q(250), saved: false}, {x: q(1140), y: q(211), saved: false}, {x: q(1720), y: q(241), saved: false}] : [];
      this.crates = [{x: q(980), y: q(303), taken: false}, {x: q(1790), y: q(303), taken: false}];
      this.enemies = [380, 560, 880, 1160, 1330, 1630, 1830].map((x, i) => ({
        x: q(x), y: q(i === 3 ? 211 : 303), home: q(x), hp: 28 + this.stage * 5,
        maxHP: 28 + this.stage * 5, cd: 45 + i * 17, flash: 0, boss: false, index: i,
      }));
      this.enemies.push({x: q(2050), y: q(303), home: q(2050), hp: 130 + this.stage * 35,
        maxHP: 130 + this.stage * 35, cd: 75, flash: 0, boss: true, index: 9});
      this.announce(['ROOFTOPS // NIGHT SHIFT', 'FOUNDRY // NO OVERTIME', 'CORE // LAST EXIT'][this.stage], 150);
    }
    fire(owner, x, y, vx, vy, damage, type = 'bolt') {
      if (this.shots.length < 96) this.shots.push({owner, x, y, vx, vy, damage, type, life: 150});
    }
    damage(e, amount) {
      if (e.hp <= 0) return;
      e.hp = Math.max(0, e.hp - amount); e.flash = 8;
      if (!e.hp) { this.score += e.boss ? 2000 : 150; this.burst(e.x, e.y - q(20), this.spec.color, e.boss ? 35 : 10); this.emit('blast'); if (e.boss) this.bossDead = true; }
    }
    tick(input) {
      if (!this.begin()) return;
      this.stageTicks++;
      const p = this.p, crouch = input.y > 0 && p.grounded;
      for (const k of ['cd', 'special', 'swing']) if (p[k]) p[k]--;
      p.vx = crouch ? 0 : input.x * this.spec.speed;
      if (input.x) p.face = input.x;
      if (input.cPressed && (p.grounded || (this.id === 'shadow' && p.jumps < 2))) {
        p.vy = q(-32, 5); p.grounded = false; p.jumps++; this.emit('jump');
      }
      if (input.a && !p.cd) {
        p.cd = this.id === 'iron' ? 8 : 19; this.emit('shot');
        if (this.id === 'shadow') {
          p.swing = 11;
          for (const e of this.enemies) if (e.hp > 0 && Math.abs(e.y - p.y) < q(45) && (e.x - p.x) * p.face > q(-12) && (e.x - p.x) * p.face < q(e.boss ? 88 : 64)) this.damage(e, 22);
        } else {
          const up = this.id === 'iron' && input.y < 0;
          this.fire('player', p.x + q(p.face * 15), p.y - q(crouch ? 11 : 22), up ? 0 : q(p.face * 9), up ? q(-9) : 0, this.id === 'iron' ? 12 : 22, this.spec.attack);
        }
      }
      if (input.bPressed && !p.special) {
        if (this.id === 'shadow') {
          this.fire('player', p.x + q(p.face * 14), p.y - q(20), q(p.face * 8), 0, 32, 'star'); p.special = 40; this.emit('shot');
        } else if (this.id === 'cache') {
          p.special = 360; this.inv = Math.max(this.inv, 90); this.burst(p.x, p.y - q(20), '#e8b0fc', 28); this.announce('SMOKE // 1.5 SEC OF COVER', 75); this.emit('dash');
        } else if (this.bombs > 0 && this.grenades.length < 4) {
          this.bombs--; p.special = 30; this.grenades.push({x: p.x, y: p.y - q(20), vx: q(p.face * 4), vy: q(-5), life: 46}); this.emit('shot');
        }
      }
      const oldY = p.y;
      p.x = clamp(E.add(p.x, p.vx), q(18), q(2160));
      p.vy = Math.min(q(9), E.add(p.vy, q(3, 10))); p.y = E.add(p.y, p.vy); p.grounded = false;
      if (p.vy >= 0) {
        const landings = [...this.ledges, [0, 303, 2200]];
        for (const [x, y, w] of landings) {
          if (y === 303 && this.pits.some(([left, right]) => p.x > q(left + 5) && p.x < q(right - 5))) continue;
          if (p.x >= q(x - 7) && p.x <= q(x + w + 7) && oldY <= q(y) && p.y >= q(y)) {
            p.y = q(y); p.vy = 0; p.grounded = true; p.jumps = 0; break;
          }
        }
      }
      if (p.y > q(410)) {
        this.inv = 0; this.hurt(30);
        const gap = this.pits.find(([x, end]) => p.x > q(x - 20) && p.x < q(end + 30));
        p.x = q(gap ? gap[0] - 30 : 70); p.y = q(290); p.vy = 0;
      }
      if (this.status !== 'playing') return;
      for (const h of this.hostages) if (!h.saved && A.near(p, h, 28)) { h.saved = true; this.rescued++; this.score += 500; this.announce('WITNESS FREED // ' + this.rescued + '/3'); this.emit('pickup'); }
      for (const c of this.crates) if (!c.taken && A.near(p, c, 24)) { c.taken = true; this.hp = Math.min(this.maxHP, this.hp + 20); this.bombs = Math.min(5, this.bombs + 2); this.emit('pickup'); }
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (e.flash) e.flash--;
        if (Math.abs(e.x - p.x) > q(570)) continue;
        e.cd--;
        if (!e.boss && e.y === q(303) && Math.abs(e.x - p.x) < q(240)) {
          const target = clamp(p.x, e.home - q(50), e.home + q(50)); e.x = A.approach(e.x, target, q(7, 10));
        }
        if (e.cd <= 0) {
          e.cd = (e.boss ? 63 : 115) - this.stage * 8;
          const dx = p.x - e.x, dy = p.y - q(18) - (e.y - q(e.boss ? 35 : 23));
          const distance = Math.max(q(1), Math.abs(dx) + Math.abs(dy));
          this.fire('enemy', e.x, e.y - q(e.boss ? 35 : 23), E.mulDiv(dx, q(3), distance), E.mulDiv(dy, q(3), distance), e.boss ? 18 : 12);
          if (e.boss) this.fire('enemy', e.x, e.y - q(12), q(-4), 0, 15);
        }
        if (A.near(p, e, e.boss ? 32 : 23)) this.hurt(12);
      }
      for (const g of this.grenades) {
        g.x += g.vx; g.vy += q(1, 4); g.y += g.vy; g.life--;
        if (g.y > q(297)) { g.y = q(297); g.vy = -E.mulDiv(g.vy, 1, 2); g.vx = E.mulDiv(g.vx, 3, 4); }
        if (g.life === 0) {
          this.burst(g.x, g.y, '#ffb14c', 26); this.emit('blast');
          for (const e of this.enemies) if (A.near(e, g, 115)) this.damage(e, 65);
        }
      }
      this.grenades = this.grenades.filter(g => g.life > 0);
      for (const b of this.shots) {
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.owner === 'player') {
          for (const e of this.enemies) if (e.hp > 0 && Math.abs(b.x - e.x) < q(e.boss ? 40 : 18) && b.y > e.y - q(e.boss ? 65 : 34) && b.y < e.y + q(3)) { this.damage(e, b.damage); b.life = 0; break; }
        } else if (Math.abs(b.x - p.x) < q(12) && b.y > p.y - q(crouch ? 17 : 30) && b.y < p.y) { this.hurt(b.damage); b.life = 0; }
      }
      this.shots = this.shots.filter(b => b.life > 0 && b.x > 0 && b.x < q(2220) && b.y > q(-30) && b.y < q(360));
      this.camera = clamp(p.x - q(230), 0, q(1560));
      if (p.x > q(2130) && this.bossDead && this.rescued === this.hostages.length) this.clearStage();
      else if (p.x > q(2110) && this.hostages.some(h => !h.saved)) this.announce('EXIT LOCKED // FREE ALL THREE WITNESSES', 90);
    }
    hud() {
      return {left: 'HEALTH ' + this.hp + (this.id === 'iron' ? '   GRENADES ' + this.bombs : ''),
        right: 'STAGE ' + (this.stage + 1) + '/3', objective: this.id === 'cache' ? 'Free witnesses ' + this.rescued + '/3 · defeat the watchdog · reach EXIT' : 'Cross the district · defeat the boss · reach EXIT'};
    }
    draw(c) {
      const camera = px(this.camera), p = this.p, color = this.spec.color;
      D.city(c, camera, this.stage + (this.id === 'iron' ? 1 : 0), this.tickCount);
      for (const [left, right] of this.pits) {
        D.rect(c, left - camera, 303, right - left, 57, '#030710');
        for (let x = left; x < right; x += 12) { D.rect(c, x - camera, 352, 7, 5, '#ff6b49'); D.rect(c, x - camera + 2, 348, 3, 4, '#ffb157'); }
      }
      for (const [x, y, w] of this.ledges) {
        D.rect(c, x - camera, y, w, 10, '#324653'); D.rect(c, x - camera, y, w, 3, color);
        for (let xx = x; xx < x + w; xx += 22) D.rect(c, xx - camera + 5, y + 5, 10, 2, '#66717b');
        D.line(c, x - camera + 8, y + 10, x - camera + 8, 302, '#263440', 4);
      }
      for (const h of this.hostages) if (!h.saved) {
        D.person(c, px(h.x) - camera, px(h.y), '#f2e08c', 1, 0, 'trooper', 1.6);
        D.text(c, 'FREE ME', px(h.x) - camera, px(h.y) - 36, '#f2e08c', 10, 'center');
      }
      for (const box of this.crates) if (!box.taken) {
        const x = px(box.x) - camera;
        D.rect(c, x - 10, 282, 20, 20, '#435e51'); D.rect(c, x - 6, 289, 12, 5, '#b6f78a'); D.rect(c, x - 2, 285, 4, 13, '#b6f78a');
      }
      D.rect(c, 2135 - camera, 233, 35, 70, this.bossDead ? '#234a39' : '#482e38');
      D.text(c, 'EXIT', 2152 - camera, 225, this.bossDead ? '#bdf56b' : '#fa7f80', 12, 'center');
      for (const e of this.enemies) if (e.hp > 0 && Math.abs(px(e.x) - camera - 320) < 380) {
        const x = px(e.x) - camera, y = px(e.y);
        if (e.boss && this.id === 'iron') {
          D.rect(c, x - 47, y - 22, 94, 22, '#383e43'); D.rect(c, x - 39, y - 48, 80, 28, e.flash ? '#fff' : '#847967');
          D.rect(c, x - 18, y - 64, 42, 20, '#5c6b65'); D.rect(c, x - 69, y - 46, 55, 7, '#b8c2b2');
          for (let i = 0; i < 6; i++) D.ellipse(c, x - 36 + i * 14, y - 9, 7, 7, '#1b2430');
        } else D.person(c, x, y, e.flash ? '#fff' : e.boss ? '#ed6786' : '#c88b74', -1, this.tickCount, this.id === 'iron' ? 'trooper' : 'ninja', e.boss ? 3.8 : 2);
        D.bar(c, x - (e.boss ? 45 : 16), y - (e.boss ? 73 : 42), e.boss ? 90 : 32, e.hp, e.maxHP, '#ff7e81');
        if (e.boss) D.text(c, this.spec.boss, x, y - 82, '#ffb4c5', 10, 'center');
        if (e.cd < 18) D.text(c, '!', x, y - 46, '#fff', 17, 'center');
      }
      if (this.inv % 8 < 5) {
        c.save(); if (p.grounded && p.vx === 0 && p.y === q(303)) c.translate(0, 0);
        D.person(c, px(p.x) - camera, px(p.y), color, p.face, p.vx ? this.tickCount : 0, this.id === 'iron' ? 'trooper' : 'ninja', 2);
        if (this.id === 'iron') D.rect(c, px(p.x) - camera + (p.face > 0 ? 4 : -24), px(p.y) - 23, 20, 5, '#e6dbc2');
        if (p.swing) { D.line(c, px(p.x) - camera + p.face * 10, px(p.y) - 25, px(p.x) - camera + p.face * 58, px(p.y) - 15, '#e7fff0', 5); }
        c.restore();
      }
      for (const b of this.shots) {
        const x = px(b.x) - camera, y = px(b.y);
        D.rect(c, x - 4, y - 2, b.owner === 'player' ? 10 : 6, 4, b.owner === 'player' ? color : '#ff6f75');
        if (b.type === 'star') { D.rect(c, x - 1, y - 5, 3, 10, '#efffd9'); }
      }
      for (const g of this.grenades) D.ellipse(c, px(g.x) - camera, px(g.y), 5, 5, '#bafc75');
      this.drawEffects(c, camera);
      D.bar(c, 20, 340, 600, px(p.x), 2160, color);
    }
  };
  A.register({id:'shadow', title:'Shadow Circuit', subtitle:'A blade against the machine.', genre:'NINJA ACTION', color:'#8ceee1', number:'01', controls:['Move / crouch','Z · blade','X · shuriken','Space · double jump'], description:'Three neon districts. Chain aerial jumps, cut through sentries and defeat the shogun process.'}, () => new A.Platform('shadow'));
  A.register({id:'cache', title:'Cache Ninja', subtitle:'Leave no witness behind.', genre:'RESCUE PLATFORMER', color:'#e8b0fc', number:'05', controls:['Move / crouch','Z · shuriken','X · smoke','Space · jump'], description:'Free three witnesses per district. Use smoke to cross firing lines, then take down the watchdog.'}, () => new A.Platform('cache'));
  A.register({id:'iron', title:'Iron Comet', subtitle:'Heavy metal. Light paperwork.', genre:'RUN & GUN', color:'#ffc06a', number:'08', controls:['Move / crouch / aim up','Z · fire','X · grenade','Space · jump'], description:'Storm three industrial districts. Grab med crates, lob grenades and bring down the audit tanks.'}, () => new A.Platform('iron'));
})(globalThis.Arcade2);
