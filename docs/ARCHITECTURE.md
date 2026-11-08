# Architecture

The application is a buildless static site. index.html loads classic scripts in dependency order; styles.css handles the launcher, cabinet and responsive controls. Canvas 2D renders the seven action/sport cabinets at 480 × 270. Void Command uses a 960 × 540 terminal canvas with DOM command input and quick-order buttons. Neon Air projects 3D table geometry in software through the same Canvas renderer. This does not require WebGL or a GPU-specific extension.

The Arcade global is the sole shared namespace. core.js provides seeded randomness, geometry, progression helpers and bounded particle/effect pools. Presentation randomness is independent of each game simulation. draw.js contains original pixel characters, scenery and cover compositions. input.js merges keyboard, pointer, touch and standard gamepad input. audio.js synthesizes original sounds and 32-step musical arrangements with Web Audio. Music and effects have separate buses and saved levels, bounded voices and explicit cleanup on pause or track changes. No recorded samples are used.

Each game in js/games owns its state, update, render, HUD and menu transitions. Iron Meridian is a top-down three-contract shooter with a loadout shop. Velvet Heist is a seven-screen arcade adventure with authored escape loops, persistent equipment puzzles, capped police reinforcements and a torch-limited dark gallery. Neon Ronin is a three-stage belt-scrolling action game. They share infrastructure, not simulation objects.

app.js owns one requestAnimationFrame loop, one input manager, one audio engine and one active game. Menus are DOM elements; simulation and world rendering remain independent of the DOM. Fixed-step update methods can run headlessly in the Node test suite.

Local storage holds settings and per-game/per-difficulty best scores only. Runs are deliberately session-only. Exceptions or invalid stored values fall back to defaults.

sw.js precaches the complete runtime at a release-specific, scope-specific cache key. It serves those cached resources offline and keeps an updated worker waiting until a player chooses to reload. File-open play does not register a worker.

Development uses node's built-in test runner and static validation without package installation. Browser QA should check the launcher, all games, pause/restart, co-op controls, small-screen layout, file-open execution and HTTP offline reload when available. Keep test-only state manipulation out of normal UI controls.

## Collection 002

- `hockey.js`: four physics substeps per tick, capped puck/mallet velocity, substepped collision checks, goal-mouth checks, three bounded AI profiles and software perspective projection shared with mouse unprojection.
- `brawl.js`: five bouts, three fighter stat sets, attack windups, guard, jump immunity, combo strikes, chair durability, stagger throws and temporary poise to prevent indefinite stun locks.
- `chrono.js`: player-centred world camera, turn-limited free flight, bounded patrol/projectile pools, couriers, roll cooldowns, five eras and flagship progression. Arcade craft are lost in one unprotected hit; Relaxed craft have an extra armour hit. Defeating a flagship supplies one craft for the next era.
- `breaker.js`: four ball substeps, directional brick/paddle collision response, five original boards, capped multiball and timed power-ups.
- `void.js`: DOM-independent turn-based state machine and bounded command queue. The browser shell submits text on user intent; the fixed-step update consumes it. Read-only/rejected commands do not advance the campaign or trigger enemy fire. Map clicks prepare text without committing it. All simulation coordinates are zero-based internally; player commands and labels are one-based.

The shell configures canvas resolution, solo/co-op routing, per-cabinet control labels, choice menus and terminal focus. Pausing discards queued terminal orders. Restarting preserves the chosen AI/fighter/campaign configuration and resets run state. Pointer control is enabled for direct paddle/mallet touch only; the existing action-game mouse/touch scheme is retained.

The developer-only preview configuration and temporary render scripts are not shipped. Documentation PNGs are renders of game code using an available offline Canvas implementation; that package is not a runtime or test dependency.

## Frame pacing and redraws (v0.3.1)

`A.Clock` runs 60 fixed steps per second with at most six steps per frame. Browser frame timestamps are rounded (often to 0.1 ms), so a frame within 0.5 ms of a whole number of steps counts as exactly that many; otherwise a 60 Hz display alternates zero and two steps. The time added or removed by snapping is carried as drift: frames snap only while the total stays under 0.5 ms, and the next unsnapped frame repays it, so a steady 59, 61, 75 or 144 Hz display still runs exactly 60 steps per second (`tests/games.test.cjs`). A frame is redrawn only when the frame ran a simulation step or the shell marked it dirty: a new or restarted game, a menu render, a pause change or a Void Command map selection. Rendering is a pure function of game state, so a skipped frame would have produced the image already on the canvas.

Void Command keeps one retained 960 × 540 frame. `renderSignature()` serialises every value `draw()` reads. The frame is redrawn when the signature changes and copied otherwise. Contexts that are transformed (screen shake), non-default, or not a plain 960 × 540 canvas are drawn directly. `tests/render-cache.test.cjs` checks over a scripted session that equal signatures produce identical drawing calls, and that changing any single drawn value changes the signature.

`A.PadNav` drives menus from standard controllers with the same neutral-arming rule as gameplay input. The shell disarms it whenever the active menu context changes (launcher, cabinet overlay, information panel), so a button held from play cannot select a menu option.

`tests/parity.test.cjs` pins SHA-256 hashes of the complete state of 15 scripted sessions across all nine cabinets. Performance work must reproduce them exactly; the pins change only with an intentional rule change.

## VANILLAJS 2D and Kestrel Strike (v0.5.0)

`js/vanilla2d.js` publishes four QSOLKCB/VANILLAJS modules on `Arcade.V2D`. `scripts/vanilla2d.cjs` wraps each ES module, unchanged, in its own function scope, so the runtime stays classic-script and file:// compatible; the source commit is recorded in the file.

- `motion2d` drives the Kestrel Strike plane: the body lives in integer subunits (8 per pixel) and moves 16 subunits (2 px) per tick on each axis through the `shmup` profile, clamped to the field bounds. Analog input is quantised to −1/0/1 before stepping.
- `range2d` motivates `A.near(a, b, r)` in core.js, an allocation-free exact prefilter: if either axis gap reaches `r`, `hypot` cannot be below `r`, so the result always equals `A.dist(a, b) < r`. It replaces distance checks in per-tick collision loops only.
- `audio2d` renders the effects bank in audio.js (`SFX2D`). Each effect is an integer score of at most four non-overlapping lanes, rendered once to PCM16, cached, converted to an AudioBuffer and played through the existing bounded voice pool on the effects bus. Without `Arcade.V2D` the oscillator recipes remain.
- `ternary-store2d` backs `js/cartridge.js`: scores are written as a canonical JSON document, exported as a validated trit grid and restored only through `fromSnapshot`. The launcher saves and loads cartridge files only on explicit request.

`kestrel.js` keeps the arcade's conventions: a 60 Hz fixed step, a seeded schedule per front (formations, couriers at fixed times, a mid-boss at the halfway point, the boss when the route ends and the mid-boss has gone), bounded pools (260 enemy bullets, 140 shots, 44 enemies, 24 items) and a renderer that is a pure function of state. The simulation uses field-local coordinates with +Y up, like motion2d. The renderer maps them onto a 240 × 245 playfield between two instrument panels.

Kestrel Strike's explosions (v0.5.0) are bounded presentation pools on the game object: `blasts` (48), `debris` (64) and `scorch` (24). `explode()` derives each blast's shape and its debris from `hash()` of a running counter, never from `this.rand`. The pools advance in `update()`, so a frame is still a pure function of state and a replay reproduces every explosion. A boss kill sets `wreck`, which runs the finale for 2.9 s: chained blasts, a final blast at 2.1 s, then `clearStage()`.

The per-cabinet readability additions in v0.5.0 read existing state only (for example Chrono Wing's radar reads enemy and courier positions, Neon Air's strike cue evaluates the exact strike condition). They add no fields to game objects, which is why the replay pins are unchanged.


## ARCADE 2

`arcade2/` is an independent classic-script consumer with the `Arcade2` namespace.
It does not replace the original `Arcade` shell, generated engine adapter, scores
or game simulations. The hall has its own Canvas renderer and synthesized effects.
Five game-family files provide ten cabinet constructors. Every constructor creates
fresh state. Simulation uses fixed 60 Hz ticks and checked Q16.16 position math;
rendering reads state only. The shared lifecycle caps effects and audio events,
protects terminal outcomes, and keeps explicit stage-clear/retry transitions.

`arcade2/engine.js` is generated by `scripts/arcade2-engine.cjs` from preserved
VANILLAJS v1.2.0 source under `arcade2/vendor/vanillajs`. The generator validates
pinned source hashes before removing export keywords and wrapping the modules.
The browser ships no module loader, third-party runtime or package manager.
Root Pages packaging and the root worker include both halls. See
`arcade2/README.md` for the module contract and coordinate convention.
