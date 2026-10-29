# Changelog

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
