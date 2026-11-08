/* Score cartridge: back up and restore local best scores. SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  // Scores are packed into a QSOLKCB/VANILLAJS ternary-store2d grid (six trits per UTF-8 byte) and
  // saved only when the player asks. Restoring validates the whole snapshot strictly and merges by
  // keeping the higher score for each table, so a cartridge can never lower a record.
  const FORMAT = 'qsol-arcade-score-cartridge', DOC = 'arcade/scores.json', KEY = /^best\.[a-z0-9]+(?:\.[a-z0-9]+)*$/;
  A.Cartridge = {
    FORMAT,
    pack(scores) {
      const clean = {};
      for (const [key, value] of Object.entries(scores || {})) if (KEY.test(key) && A.safeScore(value) > 0) clean[key] = A.safeScore(value);
      const store = new A.V2D.TernaryGridStore2D({ columns: 27 });
      store.put(DOC, { version: 1, scores: clean });
      return { format: FORMAT, version: 1, cartridge: store.snapshot() };
    },
    unpack(text) {
      if (typeof text !== 'string' || text.length > 4_000_000) throw new TypeError('not a score cartridge');
      const data = JSON.parse(text);
      if (!data || data.format !== FORMAT || data.version !== 1) throw new TypeError('not a score cartridge');
      const doc = A.V2D.TernaryGridStore2D.fromSnapshot(data.cartridge).get(DOC);
      if (!doc || doc.version !== 1 || !doc.scores || typeof doc.scores !== 'object') throw new TypeError('empty score cartridge');
      const scores = {};
      for (const [key, value] of Object.entries(doc.scores)) if (KEY.test(key) && A.safeScore(value) > 0) scores[key] = A.safeScore(value);
      return scores;
    },
    // Merge into storage keeping the better score; returns how many tables improved.
    merge(storage, scores) {
      let improved = 0;
      for (const [key, value] of Object.entries(scores)) { const old = A.safeScore(storage.read(key, 0)); if (value > old) { storage.write(key, value); improved++; } }
      return improved;
    }
  };
})(globalThis.Arcade);
