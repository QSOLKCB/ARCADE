/* SPDX-License-Identifier: Apache-2.0 */
// ARCADE 3 shared helpers. ARCADE 3 reuses the ARCADE 2 engine (fixed 60 Hz clock,
// checked Q16.16 positions, presentation layer and audio2d bank) from ../arcade2/.
(function (A) {
  'use strict';
  const {q, clamp, Engine: E} = A;
  const K = A.K3 = {};
  // Eight-way aim: unit-ish Q16 direction scaled to `speed` px/tick (diagonals ×181/256).
  K.aim = (x, y, face, speed) => {
    if (!x && !y) x = face;
    const s = x && y ? E.mulDiv(q(speed), 181, 256) : q(speed);
    return [x * s, y * s];
  };
  // Land a falling body on ground (with pits) or one-way ledges. Returns true if grounded.
  K.land = (body, oldY, ledges, pits, length, ground = 303) => {
    if (body.vy < 0) return false;
    for (const [x, y, w] of [...ledges, [0, ground, length]]) {
      if (y === ground && pits.some(([l, r]) => body.x > q(l + 4) && body.x < q(r - 4))) continue;
      if (body.x >= q(x - 6) && body.x <= q(x + w + 6) && oldY <= q(y) && body.y >= q(y)) {
        body.y = q(y); body.vy = 0; return true;
      }
    }
    return false;
  };
  K.overPit = (x, pits) => pits.some(([l, r]) => x > q(l + 4) && x < q(r - 4));
  // Bounded push into a pool.
  K.push = (pool, item, cap) => { if (pool.length < cap) pool.push(item); };
  K.cull = (pool, keep) => { for (let i = pool.length - 1; i >= 0; i--) if (!keep(pool[i])) pool.splice(i, 1); };
  K.clamp = clamp;
})(globalThis.Arcade2);
