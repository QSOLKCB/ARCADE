/* Original procedural pixel art. SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  const D = A.Draw = {};
  D.rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); };
  D.text = (c, text, x, y, color = '#f7efdb', size = 8, align = 'left') => { c.fillStyle = color; c.font = 'bold ' + size + 'px monospace'; c.textAlign = align; c.textBaseline = 'top'; c.fillText(text, Math.round(x), Math.round(y)); };
  D.shadow = (c, x, y, w = 10) => { c.fillStyle = '#050b1490'; c.beginPath(); c.ellipse(x, y + 3, w, 3, 0, 0, Math.PI * 2); c.fill(); };
  D.bar = (c, x, y, w, value, max, color) => { D.rect(c, x, y, w, 4, '#09121c'); D.rect(c, x, y, Math.max(0, w * value / max), 4, color); };
  D.gem = (c, x, y, color = '#6df3e1', scale = 1) => { c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale); c.fillStyle = color; c.beginPath(); c.moveTo(0, -6); c.lineTo(5, -2); c.lineTo(0, 6); c.lineTo(-5, -2); c.closePath(); c.fill(); D.rect(c, -1, -4, 2, 5, '#fff6d8'); c.restore(); };
  D.star = (c, x, y, t, color = '#a4f7ec') => { c.save(); c.translate(x, y); c.rotate(t); D.rect(c, -6, -1, 12, 2, color); D.rect(c, -1, -6, 2, 12, color); D.rect(c, -2, -2, 4, 4, '#fff5d6'); c.restore(); };
  D.person = function (c, p, kind = 'soldier', color = '#b6cf73', scale = 1) {
    if (p.hp === 0) return;
    if (p.inv > 0 && Math.floor(p.inv * 14) % 2) c.globalAlpha = .45;
    D.shadow(c, p.x, p.y, 8 * scale);
    c.save(); c.translate(Math.round(p.x), Math.round(p.y - (p.z || 0))); c.scale(scale * (p.face === -1 ? -1 : 1), scale);
    const step = p.walk ? Math.sin(p.walk * 13) * 2 : 0;
    D.rect(c, -5, -6, 4, 7 + step, '#223041'); D.rect(c, 2, -6, 4, 7 - step, '#223041');
    D.rect(c, -6, -1 + step, 5, 3, '#0c151e'); D.rect(c, 2, -1 - step, 6, 3, '#0c151e');
    D.rect(c, -6, -17, 12, 12, color); D.rect(c, -6, -8, 12, 2, '#171e2a');
    D.rect(c, -4, -24, 9, 8, '#f0b68f');
    if (kind === 'ninja') { D.rect(c, -5, -25, 10, 4, color); D.rect(c, -5, -19, 10, 4, color); D.rect(c, 1, -21, 4, 1, '#172435'); D.rect(c, -11, -23, 6, 2, '#ed8c64'); }
    else if (kind === 'thief') { D.rect(c, -5, -25, 11, 4, '#243047'); D.rect(c, -7, -22, 15, 2, '#243047'); D.rect(c, -5, -19, 10, 3, '#142337'); D.rect(c, -6, -14, 12, 2, '#e6decc'); D.rect(c, -6, -10, 12, 2, '#e6decc'); }
    else { D.rect(c, -5, -25, 11, 5, color); D.rect(c, -6, -21, 13, 2, '#213338'); D.rect(c, -4, -14, 3, 6, '#51604d'); }
    D.rect(c, -9, -16, 4, 8, color); D.rect(c, 6, -16, 4, 8, color);
    if (kind !== 'thief') { D.rect(c, 4, -12, p.attack > 0 ? 15 : 10, 3, kind === 'ninja' ? '#d8e2d5' : '#101d28'); D.rect(c, 7, -11, 3, 4, '#e4b18d'); }
    c.restore(); c.globalAlpha = 1;
  };
  D.topSoldier = function (c, p, color = '#a9c875') {
    if (p.hp === 0) return;
    c.save(); c.translate(Math.round(p.x), Math.round(p.y));
    if (p.inv > 0 && Math.floor(p.inv * 14) % 2) c.globalAlpha = .4;
    c.rotate((p.angle || 0) + Math.PI / 2);
    const walk = Math.sin((p.walk || 0) * 14) * 2;
    D.rect(c, -5, 4, 4, 5 + walk, '#1a2827'); D.rect(c, 2, 4, 4, 5 - walk, '#1a2827');
    D.rect(c, -7, -4, 14, 10, color); D.rect(c, -4, -6, 8, 9, '#e4bb8c'); D.rect(c, -5, -8, 10, 7, color);
    D.rect(c, 6, -12, 3, 14, '#13242b'); D.rect(c, 5, -1, 5, 3, '#e4bb8c');
    if (p.attack > 0) { D.rect(c, 5, -17, 5, 5, '#fff0a6'); D.rect(c, 7, -21, 2, 7, '#f8b84c'); }
    c.restore();
  };
  D.palm = function (c, x, y, scale = 1) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    D.rect(c, -2, -25, 5, 28, '#7f7754'); D.rect(c, 2, -21, 2, 20, '#4e5841');
    for (const [dx, dy, w] of [[-22,-26,20],[-16,-33,15],[3,-33,16],[4,-24,24],[-8,-37,13],[-18,-19,13]]) { D.rect(c, dx, dy, w, 5, '#344f42'); D.rect(c, dx, dy, w - 3, 2, '#618069'); }
    c.restore();
  };
  D.city = function (c, camera, palette, seed = 0) {
    D.rect(c, 0, 0, 480, 270, palette[0]);
    D.rect(c, 0, 75, 480, 90, palette[1]);
    c.fillStyle = palette[3]; c.beginPath(); c.arc(370 - camera * .03, 65, 31, 0, Math.PI * 2); c.fill();
    for (let layer = 0; layer < 2; layer++) for (let i = -1; i < 13; i++) {
      const x = i * 53 - (camera * (.09 + layer * .11)) % 53, h = 40 + ((i + seed + 20) * 37 % 63), y = 164 - h;
      D.rect(c, x, y, 39 + i % 3 * 4, h, layer ? '#202b47' : '#303951');
      D.rect(c, x + 5, y - 7, 12, 7, '#26314a');
      if (layer) for (let wx = 5; wx < 34; wx += 10) for (let wy = 8; wy < h - 8; wy += 13) if ((wx + wy + i) % 3) D.rect(c, x + wx, y + wy, 3, 5, '#dda978');
    }
  };
  D.hud = function (c, game, label, right) {
    D.rect(c, 0, 0, 480, 24, '#0b141ef2'); D.rect(c, 0, 24, 480, 1, '#ffffff25');
    D.text(c, label, 10, 8, '#f1dfb6', 8); D.text(c, right, 470, 8, '#a4c6c0', 8, 'right');
    if (game.messageTime > 0) { const w = Math.min(462, game.message.length * 5.3 + 20); D.rect(c, (480 - w) / 2, 242, w, 20, '#101925ec'); D.text(c, game.message, 240, 248, '#fff0bb', 8, 'center'); }
  };
  D.cover = function (canvas, id) {
    const c = canvas.getContext('2d'); canvas.width = 480; canvas.height = 270; c.imageSmoothingEnabled = false;
    if (id === 'iron') {
      D.rect(c, 0, 0, 480, 270, '#253e3c'); D.rect(c, 0, 88, 480, 182, '#77846a');
      for (let i = 0; i < 60; i++) D.rect(c, i * 41 % 480, 88 + i * 37 % 182, 19, 3, '#62705b');
      D.rect(c, 175, 82, 160, 188, '#9b9c7c'); D.rect(c, 182, 82, 4, 188, '#b4b18c');
      for (let i = 0; i < 7; i++) D.rect(c, 245, 95 + i * 29, 5, 15, '#ddd09a');
      for (const [x,y,s] of [[60,150,2],[420,198,2],[110,270,2.5],[365,100,1.5],[34,70,1.5]]) D.palm(c,x,y,s);
      D.rect(c, 284, 120, 48, 49, '#304c47'); D.rect(c, 292, 126, 32, 36, '#5a7060'); D.rect(c, 307, 103, 7, 40, '#253e3b');
      D.topSoldier(c,{x:239,y:221,angle:-1.57,attack:.1},'#e2c179'); D.topSoldier(c,{x:189,y:183,angle:-.9},'#8dc4b0');
      for (let i = 0; i < 5; i++) D.topSoldier(c,{x:190+i*22,y:98+(i%2)*20,angle:1.57},'#945a4d');
      D.rect(c, 241, 153, 2, 12, '#fff3b0'); D.rect(c, 260, 177, 2, 8, '#fff3b0');
      D.text(c, 'OPERATION / BREAKWATER', 18, 18, '#d2d6b4', 8);
    } else if (id === 'heist') {
      D.city(c,0,['#222742','#4c4866','#e7b287','#d5b08f']);
      D.rect(c,0,170,480,100,'#33364c'); D.rect(c,0,228,480,42,'#222a3c');
      for(let i=0;i<8;i++){ D.rect(c,i*64,165,59,63,'#596379'); D.rect(c,i*64+6,172,47,46,'#28354f'); D.rect(c,i*64+9,177,40,6,'#d6b17b'); }
      D.rect(c,162,102,171,125,'#9d8d94'); D.rect(c,170,109,154,116,'#4c4b68'); D.rect(c,181,148,131,70,'#202d47');
      D.rect(c,179,120,135,20,'#e0ba7b'); D.text(c,'DIAMOND EXCHANGE',246,126,'#34384b',10,'center');
      D.rect(c,193,155,47,56,'#426e7d'); D.rect(c,251,155,47,56,'#426e7d'); D.gem(c,216,180,'#7ff3d7',2); D.gem(c,275,180,'#c4b7ed',2);
      D.rect(c,58,221,65,21,'#d9b976'); D.rect(c,68,209,40,13,'#b09d72'); D.rect(c,73,211,27,9,'#35576a'); D.rect(c,66,238,12,8,'#101d2d'); D.rect(c,105,238,12,8,'#101d2d');
      D.person(c,{x:343,y:243,face:-1,walk:.3},'thief','#cdd1c7',1.5); D.person(c,{x:400,y:227,face:-1},'soldier','#718bc9',1.3);
      D.text(c, 'ONE LAST JOB. THEN WE RETIRE.', 18, 18, '#d6c6e1', 8);
    } else {
      D.city(c,0,['#33283f','#9a665d','#9a665d','#efbe81']); D.rect(c,0,182,480,88,'#4c4660');
      for(let x=0;x<480;x+=44){ D.rect(c,x,194,40,4,'#b57e79'); D.rect(c,x,238,40,3,'#6b5871'); }
      for(let x=35;x<480;x+=170){ D.rect(c,x,82,8,115,'#53374c'); D.rect(c,x-20,90,115,9,'#412d45'); D.rect(c,x-13,82,103,8,'#d7a682'); D.rect(c,x+67,87,7,109,'#53374c'); D.rect(c,x+14,106,27,20,'#e6ac7d'); D.rect(c,x+25,100,5,6,'#613a49'); }
      D.person(c,{x:178,y:235,face:1,attack:1},'ninja','#76c3bf',2.2); D.person(c,{x:327,y:218,face:-1},'ninja','#d6949a',1.8); D.star(c,252,190,.5,'#fff1ce');
      D.rect(c,0,262,480,8,'#22283e'); D.text(c,'THE CITY BELONGS TO THE NIGHT.',18,18,'#ecd2bd',8);
    }
    D.rect(c,0,0,480,1,'#ffffff20');
  };
})(globalThis.Arcade);
