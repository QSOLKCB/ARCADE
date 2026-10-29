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
