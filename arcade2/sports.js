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
      const b = this.ball, p = this.players[index], goalX = p.team ? q(38) : q(602);
      if (b.owner !== index) return;
      b.owner = -1; this.charge = 0; this.emit('shot');
      if (!this.hoops) {
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
    draw(c) {
      D.rect(c, 0, 0, 640, 360, this.hoops ? '#1d1529' : '#0b201f');
      // Grandstand lights and spectators are deterministic scenery.
      for (let i = 0; i < 80; i++) D.rect(c, i*9%640, 14+(i%3)*9, 4, 4, ['#788080','#c58d70','#5c8798'][i%3]);
      if (this.hoops) {
        D.rect(c, 35, 60, 570, 255, '#b47646');
        for (let i = 0; i < 20; i++) D.rect(c, 36+i*29, 61, 1, 253, '#d99b5a');
        for (let i = 0; i < 4; i++) D.line(c, 36, 100+i*55, 604, 100+i*55, '#9d6237');
        D.rect(c, 36, 120, 98, 130, '#393a5f'); D.rect(c, 506, 120, 98, 130, '#393a5f');
      } else {
        D.rect(c, 35, 60, 570, 255, '#285f4c');
        for (let i = 0; i < 8; i++) if (i%2===0) D.rect(c, 36+i*71, 61, 71, 253, '#306c53');
      }
      c.strokeStyle='#e7dfb3'; c.lineWidth=2; c.strokeRect(36,61,568,253); D.line(c,320,62,320,314,'#e7dfb3',2);
      c.beginPath(); c.arc(320,188,45,0,Math.PI*2); c.stroke();
      for (const x of [36,506]) { c.strokeRect(x,120,98,130); }
      D.text(c, this.hoops ? 'FULL COURT.EXE' : 'FLOODLIGHT FC', 320, 351, '#aac6aa', 13, 'center');
      for (const side of [0,1]) {
        const x = side ? 603 : 14;
        if (!this.hoops) {
          D.rect(c, x, 151, 23, 75, '#d8eddd22');
          for (let yy=152; yy<225; yy+=8) D.line(c,x,yy,x+23,yy,'#a5c0a7');
          for (let xx=x; xx<x+24; xx+=6) D.line(c,xx,151,xx,226,'#a5c0a7');
          D.line(c, side?604:36,151,side?604:36,226,'#fff8d4',3);
        } else {
          const hx=side?576:64;
          D.rect(c, hx+(side?12:-15), 133, 3, 49, '#dae5e2'); D.line(c,hx+(side?12:-12),174,hx,174,'#fa8c44',3);
          D.ellipse(c,hx,174,10,4,'#f29356'); D.line(c,hx-7,176,hx-4,187,'#f4efdd'); D.line(c,hx+7,176,hx+4,187,'#f4efdd');
        }
      }
      for (const p of [...this.players].sort((a,b)=>a.y-b.y)) {
        const i=this.players.indexOf(p), color=p.keeper?'#e7bd55':p.team?'#f47686':'#80ede2';
        const x=px(p.x),y=px(p.y);
        if (i===this.controlled) { D.ellipse(c,x,y+3,16,6,'#bdf56b'); D.text(c,'1P',x,y-38,'#d7ff97',10,'center'); }
        D.person(c,x,y,color,p.team?-1:1,p.moving?this.tickCount:0,'trooper',1.6);
        if (this.hoops && this.streak[p.team]>=3) { D.text(c,'ON FIRE',x,y-49,'#ffb148',9,'center'); }
      }
      const b=this.ball, f=b.flight, z=f?Math.sin(f.t/f.duration*Math.PI)*(f.dunk?38:90):0;
      const bx=px(b.x),by=px(b.y);
      D.ellipse(c,bx,by+3,7,3,'#0005'); D.ellipse(c,bx,by-6-z,6,6,this.hoops?'#ffa54f':'#f6efda');
      if (!this.hoops) D.rect(c,bx-2,by-8-z,4,4,'#283240'); else D.line(c,bx-5,by-6-z,bx+5,by-6-z,'#683f2d');
      D.bar(c,230,329,180,this.stamina,100,'#bdf56b'); D.text(c,'TURBO',214,335,'#e5e8c9',9,'right');
      if (this.charge) {
        D.rect(c,230,42,180,7,'#3b2331'); D.rect(c,275,42,45,7,'#bdf56b');
        D.rect(c,230+Math.min(60,this.charge)*3,39,3,13,'#fff');
      }
      if (this.serve) D.text(c,'TIP-OFF / KICK-OFF',320,192,'#fff6da',19,'center');
    }
  };
  A.register({id:'soccer',title:'Floodlight FC',subtitle:'Small pitch. Big attitude.',genre:'ARCADE FOOTBALL',color:'#b4f383',number:'02',controls:['Move','Z · shoot / tackle','X · pass / switch','Space · turbo'],description:'Three-a-side football under the floodlights. Pass around the defence, pick a corner and race to five.'},()=>new A.Sport('soccer'));
  A.register({id:'hoops',title:'Full Court.exe',subtitle:'Boom. Shaka. Deploy.',genre:'2-ON-2 BASKETBALL',color:'#ffad72',number:'03',controls:['Move','Hold / release Z · shoot','X · pass / switch','Space · turbo / dunk'],description:'Two-on-two streetball. Time your shot, slam from close range and sink three in a row to catch fire.'},()=>new A.Sport('hoops'));
})(globalThis.Arcade2);
