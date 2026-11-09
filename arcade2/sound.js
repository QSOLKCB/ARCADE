/* SPDX-License-Identifier: Apache-2.0 */
// ARCADE 2 effects bank rendered with VANILLAJS audio2d (arcade2/engine.js):
// integer, sample-indexed 48 kHz PCM16 scores on four non-overlapping lanes.
// Each effect is rendered once on first use and cached (OPT-FAN-001). This file
// owns no AudioContext; the shell converts PCM to an AudioBuffer after the
// player's first interaction. Original sound design, no recorded samples.
(function (A) {
  'use strict';
  const E = A.Engine, RATE = E.AUDIO2D_RATE, samples = ms => Math.round(ms * RATE / 1000);
  // Builds a score whose lanes cannot overlap: runs advance in whole samples.
  function score(build) {
    const events = []; let id = 1;
    const at = (channel, startMs, lengthMs, frequency, wave, gain, seed = 0) => {
      events.push({id: id++, sample: samples(startMs), duration: samples(lengthMs), channel, frequency, wave, gain, seed});
    };
    const run = (channel, startMs, frequencies, stepMs, wave, gain) => {
      const start = samples(startMs), step = samples(stepMs);
      frequencies.forEach((frequency, i) => events.push({id: id++, sample: start + i * step, duration: step, channel, frequency, wave, gain, seed: 0}));
    };
    build(at, run);
    const frames = Math.max(...events.map(e => e.sample + e.duration)) + samples(4);
    return Object.freeze({frames, events: Object.freeze(events.map(Object.freeze))});
  }
  const BANK = Object.freeze({
    shot: score((at, run) => { run(0, 0, [880, 700, 560, 440], 12, 'square', 3200); at(3, 0, 22, 900, 'noise', 1600, 11); }),
    hurt: score((at, run) => { run(0, 0, [210, 160, 125, 95], 30, 'square', 4600); at(3, 0, 90, 300, 'noise', 3800, 5); }),
    blast: score((at, run) => { at(3, 0, 300, 400, 'noise', 8200, 7); run(0, 0, [160, 122, 94, 74, 58, 46, 38], 34, 'square', 4200); at(1, 0, 220, 55, 'triangle', 7000); }),
    jump: score((at, run) => { run(0, 0, [300, 380, 470, 560, 650], 18, 'square', 3000); run(1, 0, [600, 760, 940], 30, 'triangle', 2600); }),
    pickup: score((at, run) => { run(0, 0, [660, 880, 1320], 50, 'triangle', 6500); at(1, 100, 90, 1320, 'square', 1700); }),
    win: score((at, run) => { run(0, 0, [523, 659, 784, 1047], 90, 'triangle', 6400); run(1, 0, [262, 330, 392, 523], 90, 'square', 1900); at(2, 360, 240, 1047, 'triangle', 4200); }),
    lose: score((at, run) => { run(0, 0, [392, 330, 262, 196, 147], 110, 'square', 3600); run(1, 0, [196, 165, 131, 98, 73], 110, 'triangle', 6000); at(3, 500, 160, 200, 'noise', 2600, 3); }),
    dash: score((at, run) => { at(3, 0, 120, 600, 'noise', 4200, 9); run(0, 0, [1200, 920, 700, 520, 340], 22, 'triangle', 3400); }),
    block: score((at, run) => { run(0, 0, [240, 190], 30, 'square', 3800); at(2, 0, 26, 1600, 'triangle', 2400); }),
  });
  const pcm = new Map();
  A.Sound = {
    RATE, BANK, names: Object.keys(BANK),
    // Deterministic PCM16 for a bank entry; unknown names fall back to 'shot'.
    pcm(name) {
      const key = Object.hasOwn(BANK, name) ? name : 'shot';
      if (!pcm.has(key)) pcm.set(key, E.createSound2D(BANK[key]).renderAll());
      return pcm.get(key);
    },
  };
})(globalThis.Arcade2);
