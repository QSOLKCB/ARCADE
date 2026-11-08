# ARCADE 2 verification record

Implementation base: QSOLKCB/ARCADE
`2296034a04c5417c4a8f6057c2dd73b06adccb8e` (main).
Engine source: QSOLKCB/VANILLAJS v1.2.0
`c8d6e9972d2214e2f5330f80f7dee49750c2e776`.
The release ref was read from GitHub and matches the supplied ZIP's commit comment.

## Executed

| Check | Observed result |
| --- | --- |
| `npm test` (Node v24.22.1, built-in test runner) | **197 passed, 0 failed, 0 skipped**: 143 existing checks and 54 new checks. No packages installed. |
| `npm run check` | Passed JavaScript syntax, local assets, classic scripts, relative URLs, cache coverage and no external runtime-request checks. |
| `node scripts/arcade2-engine.cjs --check` | Generated adapter matches the preserved v1.2.0 module bytes and pinned SHA-256 values. |
| `git diff --check` | Passed. |
| Existing replay pins | All 15 original game/difficulty replay pins pass unchanged. |
| New seeded simulations | Two identical scripted input streams produce equal full game states for each cabinet; drawing does not mutate those states. Effects, events and projectile pools stay bounded. |
| New complete campaigns | All ten fresh cabinets reach victory using state-aware control packets and normal stage transitions only. No health grants, timer edits, teleportation or target deletion. |
| Failure and mechanic scenarios | Goal-mouth crossing; basketball rebounds, dunks and buzzer flight; block/rollback/KO precedence; pits, ledge reachability and rescue gates; cover damage; pod/charge/burst behavior; changing scroll axes; shields, invasion landing and limited craft. |
| Input event harness | Keyboard aliases, quick taps, auto-repeat after clearing, touch cancellation/lost capture, controller neutral arming, disconnect pause, menu edges and pointer/keyboard ownership pass. This is a mock event environment. |
| Service-worker harness | All **34** precached URLs resolve without network in the cache mock, including nested `arcade2/` navigation. Scope isolation, failed installation and explicit update activation pass. |
| Native Canvas rendering | All ten game renderers executed through the preinstalled `@napi-rs/canvas`; the contact sheet below was visually inspected. This package is not added to the repository or runtime. |

The control-only completion policies live in `tests/arcade2-playthrough.test.cjs`.
They can inspect exact state when choosing actions and are not evidence of human
skill requirements, controller usability or difficulty balance. Boundary scenario
tests deliberately arrange state near an event; these are separately identified in
the test names and do not underpin the control-only completion claim.

Longer completion probes exposed a soccer boundary that bounced shots before the
goal line and an overly wide high-platform gap. Both were fixed and now have
specific regression checks. The checked arithmetic also caught a fractional
half-width passed as an integer; it now uses `fromRatio(numerator, 2)`.

## Browser and device coverage

A local Playwright/Chromium launch was attempted. Chromium aborted before loading
the game with `socket() failed: Operation not permitted` in its process-singleton
setup. The shared browser could not reach the local preview server and subsequent
observation was rejected by its URL policy. No browser access restrictions were
changed or bypassed.

Consequently, this execution does **not** establish browser DOM/CSS rendering,
actual file-open execution, real service-worker offline reload, audible output,
physical touch/controller behavior, mobile layout or device performance. The
implementation includes these paths; their browser/device coverage remains open.
The PR is left as a draft for review and browser playtesting. No release or merge
is performed by this implementation task.

## Cabinet renders

These are native Canvas renders of the game code after roughly 150 simulation
ticks, composed into a contact sheet. They are not browser screenshots. No
commercial game imagery is used.

![Ten original ARCADE 2 cabinet renders](arcade2-cabinets.png)
