# Verification — initial collection

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

The development preview is plain HTTP on a non-localhost hostname, so it correctly offers a download instead of claiming an offline cache. The final GitHub Pages HTTPS address is checked separately during publication.

## Limits

This is a first playable release, not a certified compatibility matrix or a claim of exact equivalence to the historical games. The scripted campaign replays establish that the combat campaigns are completable; human difficulty tuning and extended playtesting remain useful.

The cloud browser disallows file:// navigation, so direct file-open execution could not be browser-tested here. Static checks confirm classic scripts, local asset paths, no fetched game data and a service-worker-independent runtime. Real gamepad hardware, real touchscreen devices, Firefox and Safari were not available for this pass; input mappings and cancellation were tested with controlled inputs. The offline network-failure tests run against the service-worker logic, rather than disconnecting a physical device.

The Pages publishing workflow runs the same checks before staging the static runtime, with official actions pinned to verified commit SHAs and an Ubuntu 24.04 runner.
