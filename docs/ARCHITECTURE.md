# Architecture

The application is a buildless static site. index.html loads classic scripts in dependency order; styles.css handles the launcher, cabinet and responsive controls. Canvas 2D renders original pixel graphics at 480 × 270. This does not require WebGL or a GPU-specific extension.

The Arcade global is the sole shared namespace. core.js provides seeded randomness, geometry, progression helpers and a bounded particle pool. draw.js contains original pixel characters, scenery and cover compositions. input.js merges keyboard, pointer, touch and standard gamepad input. audio.js synthesizes original sounds and musical patterns with Web Audio. No recorded samples are used.

Each game in js/games owns its state, update, render, HUD and menu transitions. Iron Meridian is a top-down three-contract shooter with a loadout shop. Velvet Heist is a connected five-area maze heist. Neon Ronin is a three-stage belt-scrolling action game. They share infrastructure, not simulation objects.

app.js owns one requestAnimationFrame loop, one input manager, one audio engine and one active game. Menus are DOM elements; simulation and world rendering remain independent of the DOM. Fixed-step update methods can run headlessly in the Node test suite.

Local storage holds settings and per-game/per-difficulty best scores only. Runs are deliberately session-only. Exceptions or invalid stored values fall back to defaults.

sw.js precaches the complete runtime at a release-specific, scope-specific cache key. It serves those cached resources offline and keeps an updated worker waiting until a player chooses to reload. File-open play does not register a worker.

Development uses node's built-in test runner and static validation without package installation. Browser QA should check the launcher, all games, pause/restart, co-op controls, small-screen layout, file-open execution and HTTP offline reload when available. Keep test-only state manipulation out of normal UI controls.
