# Verification

## Second pass — v0.2.0

`npm test` passes **54 tests**; `npm run check` and `git diff --check` pass. Six normal-input replays complete all three games on both Arcade and Relaxed, with real damage and resource limits. The heist replay collects equipment, uses lifts, opens the safe and giant-ghost gate, enters the dark gallery, recovers any lost gems, frees captured lives and banks all 22 gems. It never grants lives, moves actors directly, removes enemies or forces progression.

New regression coverage checks the seven authored maps and all fixtures, permanent key/code requirements, interrupted safe cracking, non-wasteable TNT, torch expiry/recharging and an unlocked return route, shooting police and small ghosts, bounded/announced reinforcements, helicopter warning time, recoverable bags and captured lives. Audio checks cover optional context creation, finite musical notes, voice cleanup/limits, saved-level validation and independent music/effects muting.

A separate before/after comparison ran the existing combat input replays against the first-release commit `5ba9d07747f9b11a4553f2f46d489fccfe5a1953` and the second-pass files. Iron Meridian and Neon Ronin matched tick for tick on both difficulties for player positions, health, ammunition/energy, enemy positions/health, projectile counts, scores and progression. The presentation pass therefore preserved those recorded gameplay outcomes exactly.

Chromium preview checks exercised all three cabinets, the updated heist briefing and shooting, action-game attacks, grenades, two-player ninja controls, jump/storm, pause, and the Audio panel. Music/effects values were changed, survived reload, and displayed correctly in a 390-pixel iframe. The heist touch controls show TNT and Enter/bank and hide the unused jump button. The narrow page and audio panel had 390-pixel content/scroll widths, with no horizontal overflow. Page-specific console inspection found no application errors. These are UI/rendering observations, not a claim of physical-controller or hardware-audio verification.

## First release — v0.1.0

## Automated checks

Run `npm test` and `npm run check` with Node.js 20 or later. No dependency installation is needed.

The initial suite passes **44 tests**. The suite covers:

- Fixed-step timing, bounded catch-up, repeatable random sequences, particle limits and unavailable/corrupt storage.
- Affordable team loadouts, ammunition fallback, walls stopping actors and projectiles, objective/extraction requirements, revives, all three contract transitions, and fresh-run state.
- Connected heist fixtures and loot, wall-safe police routes, bidirectional room transitions, safe-code requirements, banking all 22 gems, recoverable dropped loot, jail lives and failure/reset.
- Ninja melee versus ranged attacks, jump invulnerability/landing, special energy cost, wave gates, twelve blocks, three boss transitions, co-op revives and final outcomes.
- Defeat taking precedence over completion when the last player takes fatal damage in the same tick as extraction or boss clearance.
- Very short keyboard taps, separate repeated presses, cleared input, modal Escape handling, gamepad Start polling while paused, player-key separation and pointer cancellation.
- Complete offline cache coverage with a mocked unavailable network, exact-scope cache cleanup, explicit update activation and failed-install handling.
- Four complete input-driven combat replays: Iron Meridian and Neon Ronin, each on Arcade and Relaxed. These use normal damage, normal resource limits and ordinary game inputs; they do not remove enemies, grant invulnerability or force transitions.
- Finite drawing coordinates across all stages and rooms; syntax, local dependency paths, cache coverage and absence of remote game-data calls.

## Browser observations

Chromium cloud preview was used to inspect the launcher, artwork, game briefings, weapon purchases, all three rendered games, keyboard actions, health/resource/score displays, help, pause and restart controls. A 390-pixel iframe was used for narrow-layout and touch-control inspection. The action games expose separate player-two controls and HUDs. Page-specific console checks found no application errors during these checks.

The development preview is plain HTTP on a non-localhost hostname, so it correctly offers a download instead of claiming an offline cache. The published HTTPS launcher at https://qsolkcb.github.io/ARCADE/ loaded successfully, reported “Offline ready · all 3 games”, and launched Neon Ronin without application console errors. The initial publishing run passed all 44 tests and deployment: https://github.com/QSOLKCB/ARCADE/actions/runs/40486083566.

## Limits

This is a first playable release, not a certified compatibility matrix or a claim of exact equivalence to the historical games. The scripted campaign replays establish that the combat campaigns are completable; human difficulty tuning and extended playtesting remain useful.

The cloud browser disallows file:// navigation, so direct file-open execution could not be browser-tested here. Static checks confirm classic scripts, local asset paths, no fetched game data and a service-worker-independent runtime. Real gamepad hardware, real touchscreen devices, Firefox and Safari were not available for this pass; input mappings and cancellation were tested with controlled inputs. The offline network-failure tests run against the service-worker logic, rather than disconnecting a physical device.

The Pages publishing workflow runs the same checks before staging the static runtime, with official actions pinned to verified commit SHAs and an Ubuntu 24.04 runner.

Final runtime publication also passed: https://github.com/QSOLKCB/ARCADE/actions/runs/40486526192. The live update prompt was exercised: selecting Reload activated the new cache, refreshed the launcher, removed the update prompt and retained the offline-ready status.
