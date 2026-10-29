# Runtime and preservation invariants

1. All code, maps, character designs, graphics and sound patterns in this repository are original contributions. Historical references describe mechanics; they are not asset sources.
2. The browser runtime has no third-party dependencies, CDN resources, analytics, account requirements or fetched game data. External source links are optional navigation only.
3. Classic deferred scripts support file:// as well as static HTTP hosting at a subpath. Service workers are an enhancement only; the downloaded folder is always playable without one.
4. The simulation advances at 60 fixed ticks per second with a bounded catch-up budget. Losing focus or hiding the page pauses active play. Paused/menu time does not advance the simulation.
5. Input is cleared when pausing, resuming, restarting or leaving a game. Pointer cancellation must release touch controls. Starting another game replaces every game-state object.
6. All game states expose a clear objective, useful controls, a victory condition and a retry path. Games do not silently become endless when a level is finished.
7. Maze objectives and transitions must occupy connected walkable cells. Caught players retain banked loot and drop carried loot for recovery. No objective may be permanently lost.
8. The original action campaigns retain usable weapon fallbacks; resource depletion must not strand a run without a recovery or explicit failure outcome. Void Command deliberately permits defeat through exhausted resources or its deadline, with one emergency tow and depot resupply. Co-op has a shared camera and shared outcome.
9. Storage and audio failures never prevent play. Local scores are namespaced, validated and optional. Audio starts only after interaction.
10. Offline cache replacement is atomic at installation and scoped to this arcade's URL. Never delete another application's cache. Do not force a new worker into an ongoing game.
11. Keep frame work bounded: cap particles, projectiles and enemies; remove expired objects; do not accumulate event handlers when restarting.
12. Preserve the existing Apache-2.0 license. Attribute inspirations accurately and make the scope of reinterpretation explicit.

13. New cabinets remain single-player even when two players are selected for the original co-op games. Hockey scores are isolated by AI profile as well as collection difficulty.
14. Void Command advances only on accepted operational commands. Invalid/read-only orders cannot spend resources, elapse campaign time or trigger retaliation. Map clicks alone never commit a command. Its textual world and terminology remain wholly original.
15. Terminal commands, logs, action-game effects and projectile pools remain bounded. Fatal Chrono Wing damage cannot be overwritten by a same-tick flagship transition.
