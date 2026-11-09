/* SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const {q, px, clamp, Engine: E, Draw: D} = A;
  A.Sport = class extends A.Game {
    constructor(id) {
      super(id, id === 'soccer' ? 1103 : 2111); this.hoops = id === 'hoops';
      this.goals = [0, 0]; this.streak = [0, 0]; this.timeLeft = 90 * 60;
      this.controlled = 0; this.stamina = 100; this.charge = 0; this.serve = 50; this.tackle = 0;
      this.setup();
    }
    setup() {
      this.players = [{x:q(240),y:q(180),team:0}, {x:q(170),y:q(255),team:0},
        {x:q(410),y:q(180),team:1}, {x:q(480),y:q(110),team:1}];
      if (!this.hoops) this.players.push({x:q(53),y:q(180),team:0,keeper:true}, {x:q(587),y:q(180),team:1,keeper:true});
      this.ball = {x:q(250),y:q(180),vx:0,vy:0,owner:0,lock:0,flight:null};
      this.controlled = 0; this.charge = 0;
    }
    pass(index) {
      const b = this.ball, p = this.players[index];
      const mate = index < 2 ? (index === 0 ? 1 : 0) : (index === 2 ? 3 : 2);
      const target = this.players[mate], dx = target.x - b.x, dy = target.y - b.y;
      const dist = Math.max(q(1), Math.abs(dx) + Math.abs(dy));
      b.owner = -1; b.vx = E.mulDiv(dx, q(7), dist); b.vy = E.mulDiv(dy, q(7), dist); b.lock = 12;
      if (!p.team) this.controlled = mate;
      this.emit('shot');
    }
    shoot(index, power = 22, sprint = false, aimY = 0) {
      const b = this.ball, p = this.players[index];
      if (b.owner !== index) return;
      b.owner = -1; this.charge = 0; this.emit('shot');
      if (!this.hoops) {
        // Aim beyond the scoring planes (26 / 614), even at the possession limits.
        const goalX = p.team ? q(10) : q(630);
        const goalY = q(188 + aimY * 28), dx = goalX - b.x, dy = goalY - b.y;
        const dist = Math.max(q(1), Math.abs(dx) + Math.abs(dy));
        b.vx = E.mulDiv(dx, q(10), dist); b.vy = E.mulDiv(dy, q(10), dist); b.lock = 14;
      } else {
        const hx = p.team ? q(64) : q(576), hy = q(174), dist = Math.abs(hx - p.x) + Math.abs(hy - p.y);
        const dunk = sprint && dist < q(94);
        const contested = this.players.some(other => other.team !== p.team && A.near(p, other, 35));
        const green = power >= 15 && power <= 30;
        const chance = dunk ? 100 : clamp(42 + (green ? 36 : 0) + (this.streak[p.team] >= 3 ? 16 : 0) - (contested ? 22 : 0) - (dist > q(310) ? 23 : 0), 10, 96);
        b.flight = {fromX:b.x,fromY:b.y,toX:hx,toY:hy,t:0,duration:dunk?20:42,
          good:this.random(100)<chance,points:dist>q(255)?3:2,team:p.team,dunk};
        b.vx = b.vy = 0;
        if (dunk) this.announce('SLAM DEPLOY!', 65);
      }
    }
    point(team, points) {
      this.goals[team] += points; this.streak[team]++; this.streak[1-team] = 0;
      if (!team) this.score += points * 500;
      this.announce(this.hoops ? (points === 3 ? 'THREE FROM DOWNTOWN!' : 'BUCKET!') : 'GOOOOAL!', 110);
      this.emit('win');
      if (this.goals[team] >= (this.hoops ? 21 : 5)) { this.finish(team === 0); return; }
      this.setup(); this.ball.owner = team ? 0 : 2; this.serve = 70;
    }
    tick(input) {
      if (!this.begin()) return;
      if (this.serve) { this.serve--; return; }
      if (this.timeLeft > 0) this.timeLeft--;
      if (this.tackle) this.tackle--;
      const b = this.ball, p = this.players[this.controlled];
      const sprint = input.c && this.stamina > 0;
      this.stamina = clamp(this.stamina + (sprint && (input.x || input.y) ? -1 : .5), 0, 100);
      let speed = sprint ? q(18,5) : q(12,5);
      if (input.x && input.y) speed = E.mulDiv(speed, 181, 256);
      p.x = clamp(p.x + input.x * speed, q(46), q(594)); p.y = clamp(p.y + input.y * speed, q(69), q(302));
      p.moving = !!(input.x || input.y);
      if (input.bPressed && !b.flight) {
        if (b.owner === this.controlled) this.pass(this.controlled);
        else this.controlled = this.controlled === 0 ? 1 : 0;
        this.charge = 0;
      }
      if (!b.flight && input.aPressed && b.owner !== this.controlled && !this.tackle) {
        this.tackle = 35;
        if (b.owner >= 0 && this.players[b.owner].team === 1 && A.near(this.players[this.controlled], this.players[b.owner], 32)) {
          b.owner = this.controlled; b.lock = 30; this.emit('pickup'); this.score += 25;
        }
      }
      if (b.owner === this.controlled && !b.flight) {
        if (this.hoops) {
          if (input.a) this.charge++;
          if ((input.aReleased && this.charge > 0) || this.charge >= 60) this.shoot(this.controlled, this.charge, sprint);
        } else if (input.aPressed) this.shoot(this.controlled, 0, sprint, input.y);
      } else this.charge = 0;
      for (let i = 0; i < this.players.length; i++) {
        if (i === this.controlled) continue;
        const other = this.players[i], attack = b.owner >= 0 && this.players[b.owner].team === other.team;
        let tx, ty;
        if (other.keeper) {
          tx = q(other.team ? 587 : 53); ty = clamp(b.y, q(155), q(222));
        } else if (b.owner === i) {
          tx = q(other.team ? 130 : 510); ty = q(184);
          if (!this.hoops && Math.abs(other.x - tx) < q(120) && this.tickCount % 55 === 0) this.shoot(i, 22, false, (this.tickCount % 3) - 1);
          if (this.hoops && Math.abs(other.x - tx) < q(65) && this.tickCount % 75 === 0) this.shoot(i, 22, true);
        } else if (!attack || b.owner === -1) {
          tx = b.x; ty = b.y;
          // The second defender covers the passing lane rather than stacking.
          if (other.team && i === 3 && b.owner >= 0) { tx += q(45); ty += q(40); }
        } else {
          tx = clamp(b.x + q(other.team ? -95 : 95), q(110), q(530)); ty = q(i % 2 ? 268 : 104);
        }
        const pace = other.keeper ? q(7,5) : q(other.team ? 17 : 19, 10);
        other.x = A.approach(other.x, clamp(tx, q(46), q(594)), pace);
        other.y = A.approach(other.y, clamp(ty, q(69), q(302)), pace);
        other.moving = true;
        if (b.owner >= 0 && !b.flight && b.lock === 0 && this.players[b.owner].team !== other.team && A.near(other, this.players[b.owner], 18) && this.tickCount % 35 === 0) {
          b.owner = i; b.lock = 35; if (!other.team && !other.keeper) this.controlled = i;
        }
      }
      if (b.flight) {
        const f = b.flight; f.t++;
        b.x = f.fromX + E.mulDiv(f.toX - f.fromX, f.t, f.duration);
        b.y = f.fromY + E.mulDiv(f.toY - f.fromY, f.t, f.duration);
        if (f.t >= f.duration) {
          b.flight = null;
          if (f.good) this.point(f.team, f.dunk ? 2 : f.points);
          else { b.vx = q(f.team ? 3 : -3); b.vy = q(2); b.lock = 15; this.streak[f.team] = 0; this.announce('OFF THE RIM // REBOUND', 65); }
        }
      } else if (b.owner >= 0) {
        const owner = this.players[b.owner]; b.x = owner.x + q(owner.team ? -10 : 10); b.y = owner.y;
        if (owner.keeper && this.tickCount % 40 === 0) this.pass(owner.team ? 2 : 0);
      } else {
        b.x += b.vx; b.y += b.vy;
        b.vx = E.mulDiv(b.vx, 995, 1000); b.vy = E.mulDiv(b.vy, 995, 1000);
        if (!this.hoops && b.y > q(151) && b.y < q(226) && (b.x < q(26) || b.x > q(614))) {
          this.point(b.x > q(614) ? 0 : 1, 1);
        } else {
          const goalMouth = !this.hoops && b.y > q(151) && b.y < q(226);
          if (!goalMouth && (b.x < q(36) || b.x > q(604))) { b.x = clamp(b.x, q(36), q(604)); b.vx = -b.vx; }
          if (b.y < q(62) || b.y > q(312)) { b.y = clamp(b.y, q(62), q(312)); b.vy = -b.vy; }
          if (!b.lock) for (let i = 0; i < this.players.length; i++) if (A.near(this.players[i], b, this.players[i].keeper ? 17 : 13)) {
            b.owner = i; b.lock = 25; if (!this.players[i].team && !this.players[i].keeper) this.controlled = i;
            break;
          }
        }
      }
      if (this.ball.lock > 0) this.ball.lock--;
      if (this.timeLeft === 0 && !this.ball.flight && this.goals[0] !== this.goals[1]) this.finish(this.goals[0] > this.goals[1]);
    }
    hud() { return {left:'YOU ' + this.goals[0] + ' : ' + this.goals[1] + ' CPU', right:this.timeLeft ? Math.ceil(this.timeLeft/60) + ' SEC' : 'SUDDEN DEATH', objective:this.hoops ? 'First to 21 · hold Z into the green, release to shoot · turbo near hoop to dunk' : 'First to 5 · shoot into the right goal · X passes or switches teammate'}; }
    // Presentation only: reads state, never writes it (see tests/arcade2-parity.test.cjs).
    draw(c) {
      const G = A.Gfx, hoops = this.hoops, tick = this.tickCount;
      G.layer(c, 'arena:' + (hoops ? 'hoops' : 'soccer'), 640, 360, ctx => this.paintArena(ctx));
      // Crowd: two cached poses, swapped on the beat, plus camera flashes.
      G.layer(c, 'crowd:' + hoops + ':' + (Math.floor(tick / 18) % 2), 640, 48, ctx => {
        for (let row = 0; row < 3; row++) for (let i = 0; i < 72; i++) {
          const h = G.hash(i * 31 + row * 977 + (hoops ? 7 : 0)), x = i * 9 + (row % 2) * 4, bob = (h + Math.floor(tick / 18)) % 2 ? 1 : 0;
          const y = 8 + row * 12 - bob * ((h >>> 5) % 3 === 0 ? 2 : 0);
          ctx.fillStyle = ['#c6708a', '#7cc7d8', '#e8d07a', '#a0d88c', '#d8a07a', '#9a8ad8'][h % 6]; ctx.fillRect(x, y + 4, 7, 6);
          ctx.fillStyle = ['#f0c8a0', '#b88660', '#7a5440', '#e8b48b'][(h >>> 8) % 4]; ctx.fillRect(x + 1, y, 5, 5);
        }
      }, 0, 4);
      if (G.high()) for (let i = 0; i < 3; i++) {
        const h = G.hash(Math.floor(tick / 7) * 13 + i);
        if (h % 5 === 0) G.glow(c, h % 640, 8 + (h >>> 9) % 36, 9, '#ffffff', 0.9);
      }
      for (const x of [70, 570]) G.glow(c, x, 4, 90, '#fff6d0', 0.12);
      for (const p of [...this.players].sort((a, b) => a.y - b.y)) {
        const i = this.players.indexOf(p), color = p.keeper ? '#e7bd55' : p.team ? '#f47686' : '#80ede2';
        const x = px(p.x), y = px(p.y);
        if (i === this.controlled) {
          G.glow(c, x, y, 22, '#bdf56b', 0.45);
          c.save(); c.strokeStyle = '#bdf56b'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y + 3, 16, 6, 0, 0, Math.PI * 2); c.stroke(); c.restore();
          D.text(c, '1P', x, y - 38, '#d7ff97', 10, 'center'); D.rect(c, x - 3, y - 35, 6, 3, '#d7ff97');
        }
        if (hoops && this.streak[p.team] >= 3) {
          for (let f = 0; f < 3; f++) G.glow(c, x + Math.sin(tick * 0.3 + f * 2) * 6, y - 18 - f * 8, 14 - f * 3, f ? '#ffb148' : '#ff5a2a', 0.6);
          D.text(c, 'ON FIRE', x, y - 49, '#ffb148', 9, 'center');
        }
        D.person(c, x, y, color, p.team ? -1 : 1, p.moving ? tick : 0, 'trooper', 1.6);
      }
      const b = this.ball, f = b.flight, z = f ? Math.sin(f.t / f.duration * Math.PI) * (f.dunk ? 38 : 90) : 0;
      const bx = px(b.x), by = px(b.y), ballColor = hoops ? '#ffa54f' : '#f6efda';
      G.shadow(c, bx, by + 3, 7 - z / 30, 3 - z / 60, 0.45 - z / 300);
      if (G.high()) {
        const tx = f ? px(f.toX - f.fromX) / f.duration : px(b.vx), ty = f ? px(f.toY - f.fromY) / f.duration : px(b.vy);
        for (let k = 1; k <= 3; k++) { c.save(); c.globalAlpha = 0.18 / k; D.ellipse(c, bx - tx * k * 2, by - 6 - z - ty * k * 2, 6, 6, ballColor); c.restore(); }
      }
      G.sprite(c, 'ball:' + hoops, 14, 14, ctx => {
        ctx.fillStyle = G.radial(ctx, 5, 5, 1, 8, [[0, '#ffffff'], [0.4, ballColor], [1, G.shade(ballColor, -0.45)]]);
        ctx.beginPath(); ctx.arc(7, 7, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1; ctx.stroke();
        if (hoops) { ctx.strokeStyle = '#5a2f1d'; ctx.beginPath(); ctx.moveTo(1, 7); ctx.lineTo(13, 7); ctx.moveTo(7, 1); ctx.lineTo(7, 13); ctx.stroke(); }
        else { ctx.fillStyle = '#283240'; ctx.fillRect(5, 5, 4, 4); ctx.fillRect(2, 9, 2, 2); ctx.fillRect(10, 3, 2, 2); }
      }, bx - 7, by - 13 - z);
      if (hoops && this.streak[0] >= 3) G.glow(c, 576, 174, 26, '#ff7a2a', 0.5 + 0.3 * Math.sin(tick * 0.2));
      if (hoops && this.streak[1] >= 3) G.glow(c, 64, 174, 26, '#ff7a2a', 0.5 + 0.3 * Math.sin(tick * 0.2));
      D.bar(c, 230, 329, 180, this.stamina, 100, '#bdf56b'); D.text(c, 'TURBO', 214, 335, '#e5e8c9', 9, 'right');
      if (this.charge) {
        D.rect(c, 229, 41, 182, 9, '#05080d'); D.rect(c, 230, 42, 180, 7, '#3b2331'); D.rect(c, 275, 42, 45, 7, '#bdf56b');
        G.glow(c, 297, 45, 20, '#bdf56b', 0.4);
        D.rect(c, 230 + Math.min(60, this.charge) * 3, 39, 3, 13, '#ffffff');
      }
      if (this.serve) { G.glow(c, 320, 186, 120, '#fff6da', 0.18); D.text(c, 'TIP-OFF / KICK-OFF', 320, 192, '#fff6da', 19, 'center'); }
    }
    // The static arena is painted once into a cached layer.
    paintArena(c) {
      const G = A.Gfx, hoops = this.hoops;
      c.fillStyle = G.linear(c, 0, 0, 0, 360, hoops ? [[0, '#120d1e'], [1, '#241838']] : [[0, '#06110f'], [1, '#0d2420']]); c.fillRect(0, 0, 640, 360);
      c.fillStyle = '#1b2230'; c.fillRect(0, 0, 640, 54);
      for (let i = 0; i < 4; i++) { c.fillStyle = G.shade('#1b2230', i % 2 ? 0.05 : -0.1); c.fillRect(0, 4 + i * 12, 640, 12); }
      const boards = ['QSOL', 'VANILLAJS', 'FREE PLAY', 'ARCADE 2', 'NO QUARTERS'];
      for (let i = 0; i < 5; i++) {
        const x = 8 + i * 127; c.fillStyle = '#0b1018'; c.fillRect(x, 50, 120, 9);
        c.fillStyle = ['#c2f874', '#7fe3e0', '#ffad72', '#f1a0ba', '#e8d07a'][i]; c.font = 'bold 7px monospace'; c.textAlign = 'center'; c.fillText(boards[i], x + 60, 57);
      }
      c.textAlign = 'left';
      if (hoops) {
        c.fillStyle = G.linear(c, 0, 60, 0, 315, [[0, '#c4824e'], [1, '#9c6236']]); c.fillRect(35, 60, 570, 255);
        for (let i = 0; i < 40; i++) { c.fillStyle = i % 2 ? '#b77642' : '#c88a52'; c.fillRect(36 + i * 14.2, 61, 14, 253); c.fillStyle = 'rgba(80,40,20,0.25)'; c.fillRect(36 + i * 14.2, 61 + (G.hash(i) % 200), 14, 1); }
        c.fillStyle = 'rgba(255,240,210,0.08)'; c.beginPath(); c.ellipse(320, 140, 260, 50, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#393a5f'; c.fillRect(36, 120, 98, 130); c.fillRect(506, 120, 98, 130);
        c.strokeStyle = '#e7dfb3'; c.lineWidth = 2;
        for (const [hx, dir] of [[64, 1], [576, -1]]) { c.beginPath(); c.arc(hx, 188, 132, dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI * 1.5); c.stroke(); }
        c.fillStyle = 'rgba(255,173,114,0.25)'; c.beginPath(); c.arc(320, 188, 45, 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = '#285f4c'; c.fillRect(35, 60, 570, 255);
        for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#2a6550' : '#317357'; c.fillRect(36 + i * 71, 61, 71, 253); }
        for (let i = 0; i < 600; i++) { const h = G.hash(i * 17); c.fillStyle = h % 2 ? 'rgba(20,60,40,0.35)' : 'rgba(120,200,140,0.12)'; c.fillRect(36 + h % 568, 61 + (h >>> 10) % 253, 2, 1); }
        c.strokeStyle = '#e7dfb3'; c.lineWidth = 2; for (const [x, y] of [[36, 61], [604, 61], [36, 314], [604, 314]]) { c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.stroke(); }
      }
      c.fillStyle = G.radial(c, 320, 188, 120, 360, [[0, 'rgba(255,250,220,0.08)'], [1, 'rgba(0,0,0,0.35)']]); c.fillRect(35, 60, 570, 255);
      c.strokeStyle = '#e7dfb3'; c.lineWidth = 2; c.strokeRect(36, 61, 568, 253);
      c.beginPath(); c.moveTo(320, 62); c.lineTo(320, 314); c.stroke();
      c.beginPath(); c.arc(320, 188, 45, 0, Math.PI * 2); c.stroke();
      for (const x of [36, 506]) c.strokeRect(x, 120, 98, 130);
      c.fillStyle = '#05080dcc'; c.font = 'bold 13px monospace'; c.textAlign = 'center'; c.fillText(hoops ? 'FULL COURT.EXE' : 'FLOODLIGHT FC', 321, 352);
      c.fillStyle = '#aac6aa'; c.fillText(hoops ? 'FULL COURT.EXE' : 'FLOODLIGHT FC', 320, 351); c.textAlign = 'left';
      for (const side of [0, 1]) {
        const x = side ? 603 : 14;
        if (!hoops) {
          c.fillStyle = 'rgba(216,237,221,0.12)'; c.fillRect(x, 151, 23, 75);
          c.strokeStyle = '#a5c0a7'; c.lineWidth = 1;
          for (let yy = 152; yy < 225; yy += 6) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 23, yy); c.stroke(); }
          for (let xx = x; xx < x + 24; xx += 5) { c.beginPath(); c.moveTo(xx, 151); c.lineTo(xx, 226); c.stroke(); }
          c.fillStyle = '#fff8d4'; c.fillRect(side ? 602 : 34, 149, 4, 79);
        } else {
          const hx = side ? 576 : 64;
          c.fillStyle = '#0b1018'; c.fillRect(hx + (side ? 14 : -18), 120, 4, 70);
          c.fillStyle = G.linear(c, 0, 133, 0, 182, [[0, '#f4fbff'], [1, '#aebfc8']]); c.fillRect(hx + (side ? 12 : -15), 133, 3, 49);
          c.strokeStyle = '#fa8c44'; c.lineWidth = 3; c.beginPath(); c.moveTo(hx + (side ? 12 : -12), 174); c.lineTo(hx, 174); c.stroke();
          c.fillStyle = '#f29356'; c.beginPath(); c.ellipse(hx, 174, 10, 4, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#7a3c1c'; c.beginPath(); c.ellipse(hx, 174, 7, 2, 0, 0, Math.PI * 2); c.fill();
          c.strokeStyle = '#f4efdd'; c.lineWidth = 1;
          for (let k = -7; k <= 7; k += 3.5) { c.beginPath(); c.moveTo(hx + k, 176); c.lineTo(hx + k * 0.55, 188); c.stroke(); }
          c.beginPath(); c.moveTo(hx - 6, 181); c.lineTo(hx + 6, 181); c.moveTo(hx - 4, 186); c.lineTo(hx + 4, 186); c.stroke();
        }
      }
      for (const x of [70, 570]) {
        c.fillStyle = '#2a3340'; c.fillRect(x - 2, 0, 4, 10); c.fillStyle = '#fff6d0'; c.fillRect(x - 12, 0, 24, 5);
        c.fillStyle = G.linear(c, 0, 0, 0, 315, [[0, 'rgba(255,246,208,0.16)'], [1, 'rgba(255,246,208,0)']]);
        c.beginPath(); c.moveTo(x - 10, 5); c.lineTo(x + 10, 5); c.lineTo(x + (x < 320 ? 190 : 30), 315); c.lineTo(x - (x < 320 ? 30 : 190), 315); c.closePath(); c.fill();
      }
    }
  };
  A.register({id:'soccer',title:'Floodlight FC',subtitle:'Small pitch. Big attitude.',genre:'ARCADE FOOTBALL',color:'#b4f383',number:'02',controls:['Move','Z · shoot / tackle','X · pass / switch','Space · turbo'],description:'Three-a-side football under the floodlights. Pass around the defence, pick a corner and race to five.'},()=>new A.Sport('soccer'));
  A.register({id:'hoops',title:'Full Court.exe',subtitle:'Boom. Shaka. Deploy.',genre:'2-ON-2 BASKETBALL',color:'#ffad72',number:'03',controls:['Move','Hold / release Z · shoot','X · pass / switch','Space · turbo / dunk'],description:'Two-on-two streetball. Time your shot, slam from close range and sink three in a row to catch fire.'},()=>new A.Sport('hoops'));
})(globalThis.Arcade2);
