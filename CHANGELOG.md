# Changelog

## Development — QFLOAT-001: The Floating Illusion (unreleased)

- Add an opt-in QFloat author-facing interface that parses decimal strings exactly and quantizes to signed Q16.16 raw integers with explicit truncation toward zero. Arithmetic delegates exclusively to the existing exact integer engine.
- Add a standalone offline 60Hz canvas lab showing float-like decimal display, exact Q16.16 values, raw integers and a deterministic world-state token; no new game, numeric backend or gameplay physics is introduced.
- Reject implicit Float64 coercion from authoritative scalar objects. Add guard/roundtrip and deterministic replay tests; retain every original cabinet and campaign pin.
- Update offline precache revision for the newly introduced lab resources. No third-party dependencies, CDN or paid services.

## Development — ARCADE3-NUMSPEC-PERF-002 (not a production optimization)

- Add a candidate safe-product Float64 path with original exact Q16.16 fallback, independent scalar/BigInt parity tests, and source-bound AB/BA CPU benchmarking of safe, wide and actual campaign arithmetic inputs.
- Re-execute all nine original campaigns in isolated reference/candidate VM contexts; their 29 stages must win and preserve every original SHA-256 pin.
- Preserve raw timing samples and evidence manifest; no change to authoritative runtime, release tags or gameplay.

## Development — ARCADE3-NUMSPEC-001 (experimental, unreleased)

- Add independent signed-int32 BigInt reference for checked Q16.16 multiply-divide, with a guarded Float64 safe-product path and an intentionally failing naive Float64 negative control.
- Implement canonical balanced-ternary addition and multiplication as a separate alternative-radix experiment; exact quotient remains BigInt.
- Implement strict truncated-binary interpolative and delta-varint storage for ordered entity IDs, measured against actual cabinet pool data.
- Replay real seeded ARCADE 3 cabinet inputs through shadow-instrumented original engine and compare exact state hashes with unmodified ARCADE3-FUZZ-001. Gameplay always receives original Q16.16 results.
- Add isolated proof-of-execution CI and SHA-256 source-bound JSON evidence; no production rules, campaign pins or cached browser runtime assets changed.

## Development — ARCADE3-FUZZ-001 verification harness (unreleased)

- Add deterministic valid-input randomized fuzzing for all nine ARCADE 3 cabinets, with a 32-seed × 2,000-tick source-bound CI witness.
- Compare drawn and nondrawn replay hashes; check finite state, pool bounds and terminal-state freeze, with reproducible crash tapes and optional failure shrinking.
- No game mechanics, campaign hash pins or packaged runtime files are changed.

## v0.9.0 — Neon Ronin fighter select

- After each district, Neon Ronin shows a fighter select. You start as KAGE. Defeated
  bosses join your roster: the Lantern Warden after district 1 and the Iron Jackal
  after district 2. In co-op each player picks separately, and a pick stays until
  changed. All four fighters are original.
  - **KAGE**: the original hero with the original numbers.
  - **TSURU**: fastest, with a double jump and twin stars on two lanes; *Gale Dash*
    cuts through a lane of enemies.
  - **LANTERN WARDEN**: heavier, and every star is an ember star; *Lantern Ring*
    burns everything nearby and snuffs enemy stars.
  - **IRON JACKAL**: toughest and hardest-hitting, with the longest reach. A
    shockwave replaces stars, and *Iron Quake* stuns every enemy in view.
- A run that never picks a different fighter replays exactly as before. No
  fighter state exists until the first pick, KAGE uses the original arithmetic,
  and the Neon Ronin pins in `tests/parity.test.cjs` are unchanged.
- `tests/ninja-roster.test.cjs` (18 tests) covers:
  - the default run carrying no fighter state
  - roster unlocks
  - independent co-op picks, and rejection of locked or out-of-turn picks
  - per-fighter speed, double jump, twin and ember stars, and the shockwave
  - every storm art
  - each fighter finishing all three districts at both difficulties, with
    scripted real-damage input
- Cache key `v0.9.0-r1-roster`.

## v0.8.0 — ARCADE 3: The Graveyard Shift

- A third hall at `arcade3/` adds nine original cabinets. Each is built around the
  mechanics of a requested classic; the titles appear in `arcade3/README.md` only
  as inspiration. No names, characters, levels, art, music or code are copied.
  - **Overclock Commando** (run-and-gun)
  - **Tin Lantern** (haunted platformer, committed jumps)
  - **Pixel Sleepwalker** (dream platformer)
  - **Lattice Lancer** (five-rail shooter)
  - **Canal Cutter** (river run with fuel and bridges)
  - **Skyline Overdrive** (into-the-screen jet combat)
  - **Stratos Ward** (colour-weapon vertical shooter)
  - **Hard Court Feud** (two-on-two brawl ball)
  - **Knockout Circuit** (behind-the-boxer boxing)
- ARCADE 3 reuses the ARCADE 2 engine, presentation layer, audio2d bank, input and
  shell. The shell now accepts a per-hall configuration (`Arcade2.HALL`) and
  per-cabinet mode lists, and hides the Mode menu for single-mode cabinets.
  ARCADE 2 behaviour and all of its pins are unchanged.
- `tests/arcade3.test.cjs` (43 tests) covers:
  - for every cabinet: replay determinism, render purity, bounded pools and
    terminal-state freeze
  - control-only completion of all nine campaigns (29 stages), with nine new
    campaign pins
  - that a naive input pattern does not finish the campaigns (Hard Court Feud is
    exempt)
  - draw-call ceilings (full peak 764, lite peak 290)
  - mechanics for every cabinet, including level-fairness checks
- Review fixes (PR #11):
  - **Stratos Ward:** an item dropped outside the playfield's reflect range
    (above y 30 or within 10 px of a wall) could flip direction every tick and
    never come within reach. Items now reflect only when moving out of range, so
    they drift back in. This is an intentional rule change, so Stratos Ward's
    campaign pin was re-recorded; the campaign still wins, in 13,545 ticks.
  - **Knockout Circuit:** a third knockdown landed on the final clock tick now wins
    the bout instead of going to a decision.
  - **Skyline Overdrive:** lock-on now uses the drawn reticle exactly: a target
    locks when its projected position is inside the box. The old world-space box
    disagreed with the drawing at most depths.
  - **Pixel Sleepwalker:** the extra-life reward was set at 100 crystals, but the
    three nights hold only 18. It is now a life every 6 crystals.
  - **Offline:** ARCADE 3 loads its shared ARCADE 2 scripts with a `?v=0.8.0`
    release query, and the service worker precaches those exact URLs. A visitor
    whose browser still runs the v0.7.0 worker therefore fetches current scripts,
    instead of an old shell that would crash on the new cabinets.
    `scripts/check.cjs` enforces the query and the precache entries.
  - **Pixel Sleepwalker:** a sleepwalker already sinking in a pit could step
    sideways back onto the bank. Ground landing now requires crossing the ground
    from above, as `K.land` does. The campaign pin is unchanged.
  - **Hard Court Feud:** a stunned ball carrier, human or AI, can no longer shoot
    or pass until recovered. During the opening and post-basket pauses, the ball
    is now in the inbounder's hands; it used to sit at the corner or at the rim.
  - **Lattice Lancer:** rail spacing now uses the same depth factor as the vertical
    projection, so the painted rails are straight and every drone, block and shot
    sits exactly on its rail. Only cosmetic burst positions moved, which re-pins
    the campaign.
  - **Skyline Overdrive:** the jet was drawn 40 px below the point its collision
    checks used. It now flies 40 units below its aim point, and everything uses
    that one jet position: drawing, flak and airframe collisions, enemy aim,
    missile launch and the cannon muzzle. Cannon rounds climb to cross the
    reticle, so the reticle stays visible above the jet.
  - **Stratos Ward:** an enemy killed by the last bomb pulse no longer moves, fires
    or rams the ship in the same tick.
  - **Overclock Commando / Tin Lantern:** four Commando ledges (67–103 px high)
    and three Lantern ledges (71–81 px) were above the jump's 67 / 69 px rise.
    They are now all reachable, and a test measures the real jump. Snipers,
    chests and crows moved with their ledges.
  - **Overclock Commando:** a runner that falls into a pit can no longer touch you
    on that tick. The turret and gun firing warning was a glow, which the lite FX
    tier does not draw; a muzzle flare now shows in both tiers.
  Skyline, Sleepwalker, Feud, Lancer, Commando and Lantern campaign pins were re-recorded for these rule changes.
  Every fix has a regression test.
- Links to ARCADE 3 from the original hall and ARCADE 2. The service worker cache key
  is now `v0.8.0-r2-arcade3`, and it precaches the 15 ARCADE 3 files and the six versioned shared scripts. The Pages
  workflow publishes `arcade3/`.

## v0.7.0 — ARCADE 2 modes: Legacy, Extended and Remix

- Every ARCADE 2 cabinet now has three rule sets, chosen from a **Mode** menu in the
  playroom and remembered per cabinet. Best scores are kept per mode; Legacy keeps
  the v0.6.0 key, so existing scores carry over. Deep links accept `#id:mode`.
- **Legacy** is v0.6.0 exactly: its 20 simulation pins in
  `tests/arcade2-parity.test.cjs` are unchanged. New rules add no state fields to
  Legacy games and draw no extra randomness.
- **Extended** (the new default) makes play roughly 40–50% longer: platform levels
  3,300 px instead of 2,200 with a second segment, rushers and twin-shot gunners;
  shooter waves of 2,700 ticks with tanks and weavers; bosses that fly a (2,3)
  trefoil-knot path and gain a second phase; a fifth invader orbit with saucer
  salvage; a fourth Kombat incident (Memory Leak) and a 75-second clock; 120-second
  matches to 6 goals / 25 points; larger Breach waves with medkits.
- **Remix** adds one twist per cabinet: Ricochet Blade, Shadow Step, Spread Shot,
  Golden Boot, Downtown, Hotfix, Overwatch, Piercer, Overcharge and Focus
  (bullet time). Each twist has a mechanics test.
- New pins cover complete Extended and Remix campaigns (20 hashes). The playthrough
  policies complete all 30 cabinet/mode campaigns using controls alone.
- Integer trigonometry ported from QSOLKCB/GALAXY's CORDIC (`A.sinCosQ30`, checked
  against GALAXY's reference vectors) drives a 1,024-step Q16.16 table and the
  trefoil paths, after QSOLKCB/GLUBALL's (2,3) knot. Ember Wing's Focus adapts the
  VANILLAJS time-domains contract in integers.
- Art: attack poses for every figure, pit hazard signs, searchlights, a turning
  spiral galaxy behind the shooters, enemy variants, a cracked phase-two boss, Memory
  Leak's drips, a Focus tint and meter, piercing-shot trails and an on-canvas stage
  banner. City layers widen for Extended levels. A 2:3 "boss" cue joins the audio2d
  bank; the nine earlier effects keep their PCM pin.
- Draw-call budgets now cover every mode (full peak 873, lite 297; lite limit raised
  from 300 to 350). The RTX harness adds a Remix paint pass. Cache key
  `v0.7.0-r1-arcade2`.

## v0.6.0 — ARCADE 2 graphics pass (VANILLAJS + OPT)

- Redraw all ten ARCADE 2 cabinets: three-layer parallax cities with neon signs,
  haze, rain and moonlight; nebula/planet/star parallax for the shooters with cave
  terrain and force-field bulkheads; cached stadium, court and arena backgrounds;
  shaded 12 × 14 figures with walk cycles and outlines; a shaded fighter hull,
  drones, tank, mech, core bosses, crates, cages, cover and an exit door; glowing
  projectiles, beams, tracers, muzzle flashes, sword arcs, trails and sparks;
  floor reflections in DevOps Kombat; a low-health alarm and a CRT pass.
- Rendering only: no simulation file's tick, state or rules changed. New
  `tests/arcade2-parity.test.cjs` pins 20 SHA-256 state hashes (10 scripted
  sessions, 10 complete campaigns) recorded **before** this work, and re-runs each
  with drawing between ticks to show rendering cannot alter state.
- Vendor VANILLAJS v1.2.0 `frame-gate` and `audio2d` byte-for-byte from commit
  `c8d6e9972d2214e2f5330f80f7dee49750c2e776` (unchanged on upstream `main`
  `9e643c7`), with SHA-256 provenance. `FrameGate` decides redraws from a complete
  primitive frame key; `audio2d` renders a deterministic PCM16 effects bank
  (`arcade2/sound.js`) with the oscillator recipes kept as a fallback.
- Apply QSOLKCB/OPT records in `arcade2/gfx.js`: OPT-FAN-001/INC-001 (scenery,
  sprites and glow kernels materialised once per complete key), OPT-CACHE-001
  (pixel-budgeted LRU caches), OPT-APPROX-001 (an **FX full / lite** control that
  removes cosmetic glow, trails and CRT only, with an automatic fallback to lite if
  average paint time exceeds 7 ms) and OPT-BUDGET-001 (deterministic per-frame
  draw-call ceilings in `tests/arcade2-gfx.test.cjs`).
- Fix offline deep links: the worker now strips `#fragment` before its URL check,
  so ARCADE 2 (which sets `#cabinets` / `#<cabinet>`) reloads offline. Advance the
  cache key to `v0.6.0-r2-arcade2` and precache `arcade2/gfx.js` and `arcade2/sound.js`.
- Browser evidence for this pass is in `docs/ARCADE2_VERIFICATION.md`.
- Show Breach Protocol cover as rubble only at zero health; positive health now
  has intact, cracked and battered art (review finding on PR #8, with a regression test).
- Add an owner-dispatched hardware check at the maintainer's request:
  `.github/workflows/rtx5060ti-arcade2.yml` runs `scripts/rtx5060ti-arcade2.mjs`
  in headed Chrome on the owner's RTX 5060 Ti runner (reviewed `main`, actor
  `EmergentMonk`, explicit consent; never on push, pull request or schedule). It
  pairs paint cost against the pre-graphics commit, plays every cabinet, measures
  tick rate and presented frames, checks offline reload and seals evidence outside
  the checkout. `tests/rtx-workflow.test.cjs` guards those properties.
- Record the first RTX 5060 Ti results (two passing runs, no findings) and move the
  RTX workflow to Node 24 action releases (checkout v6, upload-artifact v6). This
  removes the Node 20 deprecation warning the v4 commits produced. Round the display
  scale in the hardware summary.

## Unreleased — ARCADE 2 / The Second Shift

- Add a separate `arcade2/` hall with ten original single-player cabinets: Shadow
  Circuit, Floodlight FC, Full Court.exe, DevOps Kombat, Cache Ninja, Breach Protocol,
  Spaced Invaders, Iron Comet, Null Vector and Ember Wing.
- Consume VANILLAJS v1.2.0 `integer-math` and `time` from exact commit
  `c8d6e9972d2214e2f5330f80f7dee49750c2e776`, preserving source bytes, SHA-256
  provenance, Apache-2.0 and upstream notices. Generate a file-open-compatible
  classic-script adapter without adding runtime dependencies.
- Add finite campaigns/matches, CPU opponents, original Canvas art and synthesized
  effects, separate local best scores, keyboard/touch/standard-gamepad controls,
  pause-on-focus-loss and explicit restart/stage transitions.
- Link both halls, expand the existing scope-specific offline cache, and stage the
  new files in the existing Pages workflow. Add PR verification to that workflow.
- Add gameplay, input, deterministic replay, render-purity and packaging checks.
  Existing game rules and replay pins are unchanged. Browser coverage and executed
  evidence are recorded in `docs/ARCADE2_VERIFICATION.md`.
- Keep Floodlight FC shots aimed beyond the opposing scoring plane, including
  possession at either goal-line boundary.
- Use explicit index files in hall navigation so links resolve from extracted
  checkouts as well as nested HTTP hosting.
- Prevent browser defaults on repeated gameplay keys while preserving fresh-press
  requirements after pause or scene transitions.
- Reclaim defeated Breach Protocol enemy slots before spawning the required boss,
  and count only successful reinforcement spawns toward each compound's quota.
- Add ten review regression checks and advance the offline cache revision.


## 0.5.0 — 2026-11-08

Published as GitHub release v0.5.0. It combines Collection 003 (QSOLKCB/ARCADE#4) and the Kestrel Strike graphics pass (QSOLKCB/ARCADE#5), which were developed as 0.4.0 and 0.4.1. GitHub releases v0.4.0 and v0.4.1 had already been published for the 0.3.1 work below, so both parts ship together as 0.5.0.

### Collection 003

Collection 003: a ninth cabinet, the VANILLAJS 2D foundation and a readability pass for every original cabinet. Game rules of the eight existing cabinets are unchanged: all 13 replay pins from 0.3.1 still match.

- **Kestrel Strike (new):** an original vertical-scrolling propeller shooter inspired by 1943 (1987) and Raiden (1990).
  - **Fronts:** four of them (Coral Strait, Amber Dunes, Storm Canopy, Cinder Citadel), each with seeded formations, ground targets, a mid-boss and a phased boss.
  - **Weapons and items:** five firepower levels (homing rockets at the top), screen-clearing bombs, a recharging loop maneuver, courier planes carrying P and B, and medal chains that reset when a medal is missed.
  - **Scoring:** graze points and stage bonuses for bombs left and no-miss runs. Extra planes come at 50,000 and every 120,000 after.
  - **Relaxed mode:** five planes, four bombs and a shield hit per plane.
  - **Movement:** the plane moves through VANILLAJS `motion2d`'s integer shmup profile.
- **VANILLAJS 2D port:** `js/vanilla2d.js`, generated by `scripts/vanilla2d.cjs` from `motion2d`, `range2d`, `audio2d` and `ternary-store2d`, so it still runs from `file://`.
- **audio2d sound bank:** deterministic PCM16 effects for every cabinet: boom, hit, pickup, bank, win, alert, bomb, power, medal, loop, key and order. Oscillator fallbacks remain.
- **range2d prefilter:** `A.near(a, b, r)` replaces `A.dist(a, b) < r` in collision hot loops. It is exactly equivalent (tested against 20,000 random cases and the replay pins).
- **Score cartridge:** back up and restore local best scores as a ternary-store2d grid file. Restore validates strictly and merges by keeping the higher score.
- **Per-cabinet readability:**
  - Iron Meridian route map.
  - Velvet Heist floor plan.
  - Neon Ronin district progress.
  - Neon Air strike cue and speed streaks.
  - Basement Brawl throw prompt and chair pips.
  - Chrono Wing edge radar.
  - Prism Break launch guide and capsule countdown.
  - Void Command terminal tones.

  All of these are drawn purely from existing state.
- **Pins and tests:** 2 new replay pins (Kestrel Strike, Arcade and Relaxed); no existing pin changed. New `tests/kestrel.test.cjs` and `tests/vanilla2d.test.cjs`.

### Kestrel Strike graphics and explosions

Kestrel Strike graphics and explosions. No other cabinet changed: their 13 replay pins still match.

- **Explosions:** every kill now has a layered blast.
  - **Stages:** a white flash with a starburst, then a fireball of overlapping lobes that cools from white through yellow, orange and red to embers, then drifting smoke.
  - **Debris:** spinning wreckage that trails smoke.
  - **Size:** effects scale with the target. Fighters pop. Bombers and mid-bosses chain-explode along their wings with a shockwave ring.
  - **Ground kills:** they leave scorch marks with dying embers, or an oil slick and foam ring at sea, which scroll away with the terrain.
- **Boss finales:** a destroyed boss breaks up over about two seconds of chained explosions, then goes out in a final blast and white flash. Its escorts go down with it. Enemy bullets vanish and the plane cannot be hit during the sequence. The front clears when it ends instead of on the killing shot; this is the only rule change.
- **Sprites:** every aircraft and ground unit is redrawn with shading, a dark edge, panel highlights and spinning propeller discs.
  - **Player's plane:** it banks as it moves and shows engine exhaust flicker and muzzle flashes.
  - **Ground units:** gunboats leave wakes, and tank treads roll.
  - **Damage:** damaged bombers and mid-bosses trail smoke. Bosses break out in fires as they lose health.
- **Weapons fire:** shots are glowing tracers. Rockets trail smoke. Enemy bullets have halos, and the large ones pulse.
- **Items:** medals spin, and power-ups glow.
- **Backgrounds:**
  - **Coral Strait:** swells, sparkles, reefs, and islands with shallows and surf.
  - **Amber Dunes:** shaded dune ridges, rocks, tracks, oases and mesas.
  - **Storm Canopy:** parallax cloud layers and lightning.
  - **Cinder Citadel:** riveted plating, hazard stripes, flowing lava channels and glowing vents.
  - **All ground fronts:** cloud shadows pass over them.
- **Instrument panels:** bevelled.
- **Determinism:** explosions take their shapes from a hash of a counter, never from the game's random number generator. Their pools are bounded: 48 blasts, 64 debris and 24 scorch marks.
- **Pins and tests:** the two Kestrel Strike pins were re-recorded because the snapshot now includes these pools. The simulation fields alone hash identically to the Collection 003 build. Three new Kestrel tests cover the boss sequence, randomness isolation and the bounded pools.

## 0.3.1 — 2026-11-07 (published as GitHub releases v0.4.0 and v0.4.1)

Quality-of-life and performance pass. Game rules, maps and scores are unchanged: every cabinet replays to the same state as v0.3.0.

- **Controller menus:** a standard gamepad now drives the launcher, cabinet menus, pause screen and information panels. D-pad or stick moves between buttons, A selects, left/right changes a setting, B closes a panel or resumes. Buttons held from play are ignored until released.
- **Controller safety:** unplugging a controller pauses the game. A controller that connects, or is held when a menu opens, must return to neutral before it responds; this now covers sticks as well as buttons.
- **Smoother analog movement:** the stick deadzone is rescaled, so movement ramps up from the edge of the deadzone instead of jumping to 20%.
- **Smoother 60 Hz play:** browsers round frame timestamps, which made one 60 Hz frame in three run no simulation step and the next run two. Frames within 0.5 ms of a whole number of steps now count as exactly that many, so every 60 Hz frame advances one step and every 30 Hz frame two.
- **Exact 60 steps per second (release v0.4.1):** the time added or removed by snapping a frame to a whole number of steps is now paid back on a later frame. Before this, a steady 59 Hz display ran every game 1.7% slow and a 61 Hz display 1.7% fast.
- **Less work when nothing moves:** a frame is redrawn only after a simulation step or a change such as a menu action. Paused and menu screens stopped redrawing 60 times a second, and tick-less frames on 120/144 Hz displays reuse the image already on screen.
- **Void Command:** the terminal frame is reused until an order, map selection or campaign choice changes what it shows (0.62 → 0.19 ms per frame in Chromium software rendering, pixel-identical).
- **Exactness checks:** an exact-replay parity test pins the full state of 13 scripted sessions across all eight cabinets, and a recording-canvas test proves that Void Command's cache key covers everything it draws.
- Adapted from [QSOLKCB/VANILLAJS](https://github.com/QSOLKCB/VANILLAJS) (input deadzone and neutral arming, fixed clock) and guided by [QSOLKCB/OPT](https://github.com/QSOLKCB/OPT) (signature-bound reuse, exact-equivalence gates). Both Apache-2.0.

## 0.3.0 — 2026-10-30

Collection 002 expands ARCADE from three cabinets to eight, with original code, art, sound and worlds.

- **Neon Air:** perspective 3D table, moving-mallet puck physics, bank shots, first-to-seven matches and Rookie / Club / Expert opponents with distinct reaction, speed and prediction settings.
- **Basement Brawl:** Pit-Fighter-inspired arena combat; Mara, Bolt and Rook; five bouts; punches, kicks, jumps, guard, combos, chairs, throws and enemy windups/poise.
- **Chrono Wing:** Time Pilot-inspired free flight through five eras with patrol quotas, flagship bosses, courier rescues, evasive rolls, extra lives and a more forgiving Relaxed armour rule.
- **Prism Break:** five original Breakout-inspired boards, armoured bricks, paddle-angle control and wide, slow, multiball and laser capsules.
- **Void Command:** a wholly original 1971-style space strategy campaign with a more advanced ncurses-inspired browser console, tactical/frontier maps, gauges, command history, clickable orders, three seeded missions, damage/repair, docking and an emergency tow.
- Shared launcher, context-specific control legends, native touch dragging for mallets/paddles, optional procedural music, per-AI hockey records, preserved fighter/mission choices on restart and complete offline precaching.
- Expanded rules, controls, provenance, game-frame previews and verification notes. Existing Pages deployment workflow retained.
- Automated command/input replays plus collision, failure/restart, bounded state, audio, input, cache and existing-game regressions. Browser verification limits are recorded in `docs/VERIFICATION.md`.

## 0.2.0 — 2026-10-27

Second pass guided by the maintainer's playtest: rebuild the heist's gameplay and tension, preserve both action games' mechanics.

- Velvet Heist: seven authored screens, lifts, a police-station key, service-floor code, safe and torch, TNT/giant-ghost gate, dark gallery, police reinforcements with advance warnings, limited shots that clear pursuers, helicopter passes and short-turn input buffering. Retains banking, recoverable bags and jail rescues. Deliberately simple C64-style presentation.
- Iron Meridian: layered blast effects, bullet impacts and tracers, shell particles, dash dust, hit flashes, wrecks, subtle environmental motion and an in-game ammunition/grenade display. Combat values and progression unchanged.
- Neon Ronin: directional slash arcs, attack poses, projectile trails, storm lightning, landing dust, defeat fades, lantern light, atmospheric particles, boss health/name display and chain timer. Combat values and progression unchanged.
- Original multi-part music, synthesized percussion and differentiated weapon effects. Separate music/effects levels, saved locally; audio voices stop cleanly on pause and track changes.
- Separate new-edition heist score table, preserving first-edition scores in storage. Updated offline cache, instructions and preservation notes.
- Complete input-driven replays for all three games on both difficulty settings, plus puzzle, pursuit, darkness and audio regression checks.

## 0.1.0 — 2026-10-27

Initial collection: Iron Meridian, Velvet Heist and Neon Ronin, with a shared arcade launcher and original code, maps, pixel artwork and synthesised audio.

- Three-contract mercenary campaign with loadout purchases, multiple weapons, rescue/recovery objectives and extraction.
- Five-area jewel heist with banking, safe codes, haunted mines, stun rounds, smoke and lockup rescues.
- Three-district ninja campaign with twelve encounter blocks, bosses, melee/ranged attacks, jumping and storm specials.
- Local two-player play and revives in the two action games; keyboard, mouse support in Iron Meridian, touch controls and standard controller mappings.
- Arcade/Relaxed modes, local best scores, pause/restart, fullscreen and optional CRT scanlines.
- Standalone file-open distribution and versioned, scope-isolated offline cache for HTTPS hosting.
- Contributor invariants, source/asset provenance, control guide and dependency-free test suite.

