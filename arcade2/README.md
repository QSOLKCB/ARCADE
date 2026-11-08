# ARCADE 2 — The Second Shift

Ten original single-player cabinets in `arcade2/`, alongside the original nine-game hall.
Open `arcade2/index.html` from an extracted checkout, or visit `arcade2/` beneath the
repository's Pages URL. There is no runtime build, package installation, server,
account, telemetry or external asset request. Sound is optional and starts off.

## The cabinets

| Cabinet | Requested inspiration | Implemented game |
| --- | --- | --- |
| Shadow Circuit | Ninja Gaiden | Three ninja platform stages; sword, shuriken, double jump, sentries, pits and bosses. |
| Floodlight FC | Arcade soccer | Three-a-side football, a controlled outfield player, teammate, CPU opposition and goalkeepers; passing, switching, tackling and turbo. First to five or a 90-second result, with sudden death for ties. |
| Full Court.exe | NBA Jam TE | Two-on-two basketball, passing, steals, charged shot timing, close-range turbo dunks, three-point shots and a three-score fire streak. First to 21 or a 90-second result; a shot in flight finishes after the buzzer. |
| DevOps Kombat | Mortal Kombat | An original SRE versus three production incidents: Cron Reaper, Merge Conflict and Root Cause. Punches, kicks, jumps, guarding, telegraphed retaliation and a metered rollback projectile. |
| Cache Ninja | Shinobi | Three rescue platform stages. Free all three witnesses, defeat the watchdog and reach the exit. Unlimited shuriken and a rechargeable smoke escape. |
| Breach Protocol | Cabal | Three fixed-view compounds, keyboard or pointer aim, destructible cover, telegraphed enemy fire, dodge rolls, finite grenades and heavy-response bosses. |
| Spaced Invaders | Space Invaders | Four finite formations, three craft, eroding bunkers, wandering saucers and limited column pulses. |
| Iron Comet | Metal Slug | Three run-and-gun stages with aimed-up fire, crouching, jumps, grenades, supply crates and tank bosses. |
| Null Vector | R-Type | Three horizontal sectors, charged beams, a front/rear shield pod, bursts, bulkhead gaps and shielded cores. |
| Ember Wing | Salamander | Horizontal / vertical / horizontal sectors, collectible wingmen, bursts, a rechargeable dodge and furnace cores. |

These are compact original reinterpretations of the requested mechanics. They do
not reproduce the commercial games' characters, levels, ROMs, art, soundtracks,
rosters or full feature sets. Historical titles identify inspiration, not
endorsement. Artwork is drawn locally with Canvas; effects are synthesized with
Web Audio. No downloaded art or audio is used.

## Controls

The cabinet always shows its own four control labels and objective.

| Action | Keyboard | Standard gamepad | Touch |
| --- | --- | --- | --- |
| Move / aim | Arrows or WASD | D-pad or left stick | Direction pad |
| Primary | Z or J | A | Z |
| Secondary | X or K | B | X |
| Jump / turbo / special | Space or L | X | SPACE |
| Rollback (Kombat) | C or E | Y | C |
| Pause / resume | P or Escape | Start | Pause button |

- **Full Court.exe:** hold Z, then release while the marker is in the green band.
  Hold Space and release Z near the attacking hoop to dunk. X passes or switches.
- **Floodlight FC:** Z shoots when in possession and tackles otherwise. Up/down
  while shooting selects a goal-mouth target. X passes or switches. Attack right.
- **Null Vector:** tap Z for a shot; hold for at least 25 ticks and release for a
  beam. X moves the pod in front of or behind the ship. Space spends a burst.
- **Ember Wing:** hold Z for fire, X spends a burst and Space dodges when ready.
- **Breach Protocol:** arrows move the reticle; the operator follows its horizontal
  position. Mouse movement also aims and left-click fires. Down ducks behind a
  surviving wall; X rolls, Space throws a grenade. Arrow input takes aim back from
  the pointer. Red ground markers show where the next volley will land.
- **DevOps Kombat:** down guards, Z punches, X kicks and Space jumps. C spends a
  full rollback meter. Three one-round incidents form the ladder; each has a
  60-second clock. A health tie continues until broken. Simultaneous KO is a loss.

**FX full / lite** (masthead) changes presentation only. Full adds glow, trails,
floor reflections and a CRT pass; lite keeps every sprite, hazard, telegraph and
readout. If full effects average more than 7 ms of paint time on a device, the hall
switches to lite for that session and labels the button *FX lite (auto)*.

Keyboard focus loss, hidden tabs and controller disconnect pause play. Resume is
explicit. Inputs and unfinished shot charges are cancelled on transitions. A
controller must return to neutral before it can control a new screen. D-pad/stick
navigate the cabinet list and overlays; A selects, B returns from an overlay.

Each cabinet has a fresh-restart button and a finite win/loss path. Stage-clear
screens require an explicit **Next stage** action. Best scores use the separate
`qsol-arcade2:` storage prefix; blocked or malformed storage never prevents play.
No run state is saved. The original hall's score cartridge remains its own system.

## VANILLAJS v1.2.0

Pinned upstream commit: `c8d6e9972d2214e2f5330f80f7dee49750c2e776`.
The supplied release archive SHA-256 is
`bd62f65f219c412fec7a2a076d8bc749fa0787ac2a29b32269d3d37228185a2d`.

`vendor/vanillajs/PROVENANCE.json` records the archive, exact source revision,
selected modules and SHA-256 of every copied module/licence/notice. Source files
are byte-for-byte copies from the supplied archive, also matched to the release
ref. Both upstream LICENSE and NOTICE are retained. `frame-gate` and `audio2d` were
added in v0.6.0 with `git show` from the same pinned commit (the supplied archive was
not re-read); `PROVENANCE.json` records this per module, and upstream `main`
(`9e643c7`) has no module changes since the pin.

- `integer-math` supplies checked Q16.16 conversion, exact rational multiplication,
  aiming, damping and seeded random state advancement. World coordinates and
  velocities are signed Q16.16 pixels / pixels per tick, with local +Y down.
  Conversion back to floating pixels occurs at drawing boundaries; cosmetic
  drawing, audio, frame timestamps and the sports stamina meter use Numbers.
- `time` supplies a 60 Hz `FixedClock`, six-step catch-up limit and optional
  0.5 ms frame snapping with drift repayment. Hidden/paused time is discarded.
- `frame-gate` (added in v0.6.0) supplies `FrameGate`. The shell presents each
  frame under the complete key `generation|cabinet|tick|stage|status|tier`, so the
  canvas is redrawn once per simulation step or shell change and idle frames are skipped.
- `audio2d` (added in v0.6.0) renders the nine effects in `sound.js` as integer,
  sample-indexed 48 kHz PCM16 scores on four non-overlapping lanes, once each on
  first use. The previous oscillator recipes remain as a fallback.
- `engine.js` is a generated classic-script adapter so `file://` remains usable.
  Only export keywords are removed; each source body is wrapped in its own scope.
  Regenerate with `node scripts/arcade2-engine.cjs`; verify with `--check`.

These games are consumers of selected v1.2.0 modules, not a claim that every
VANILLAJS subsystem is included or that all gameplay is formally verified.
Rendering is independent of simulation and must not mutate game state. Tests
compare seeded replay states within the tested runtime; cross-browser bit-exactness
and device performance are not claimed.

## Graphics (v0.6.0)

`gfx.js` is the presentation layer: parallax cities with neon, haze and rain;
nebula, planet and star parallax with cave terrain and force-field bulkheads;
cached stadium, court, server-room and compound backdrops; shaded, outlined figures
with walk cycles; fighter hulls, drones, tanks, mechs and core bosses; additive
glow for projectiles, beams, tracers and sparks; floor reflections; a low-health
alarm and a CRT pass. All of it is original procedural Canvas art.

Drawing never runs inside the fixed tick and never writes state. The approach
follows four [QSOLKCB/OPT](https://github.com/QSOLKCB/OPT) records:

- **OPT-FAN-001 / OPT-INC-001:** static layers, sprites and glow kernels are painted
  once into offscreen canvases under keys that name every paint input, then reused.
  Even with far richer art, most cabinets now issue fewer canvas calls per frame
  than v0.5.0 (for example Floodlight FC averages 98 calls rather than 755).
- **OPT-CACHE-001:** three pixel-budgeted LRU caches (about 30 MB at most).
- **OPT-APPROX-001:** the FX lite tier and its automatic fallback.
- **OPT-BUDGET-001:** deterministic per-frame draw-call ceilings in the test suite.

## Packaging and offline play

The original Pages workflow stages `arcade2/` with the main hall. The root service
worker precaches both halls under one scope-specific versioned cache. Opening
ARCADE 2 first registers that root worker; installation includes the original hall
as well. File-open play skips service workers entirely. An installed update waits
for the player's **Update ready** action; no worker forcibly replaces an active run.

## Verification

Run the repository checks without installing dependencies:

```sh
node --test tests/*.test.cjs
node scripts/check.cjs
node scripts/arcade2-engine.cjs --check
```

`tests/arcade2-parity.test.cjs` pins SHA-256 hashes of the complete simulation state
for every cabinet (scripted sessions and full campaigns), recorded before the
v0.6.0 graphics work, and replays each with drawing between ticks.
`tests/arcade2-gfx.test.cjs` checks cache-key completeness, reuse, memory and
draw-call budgets in both FX tiers, FrameGate pacing and the audio2d bank.

On real hardware, the owner can dispatch **ARCADE 2 on RTX 5060 Ti** from the Actions
tab (see `docs/ARCADE2_VERIFICATION.md`). It runs only on reviewed `main` on the
owner's self-hosted GPU runner.

`tests/arcade2.test.cjs` covers all ten simulations, seeded replays, pure rendering,
bounded pools, fresh restarts, real goal/shot collisions, stage/exit gates, failure
precedence and mechanic-specific rules. Scenario tests position state near events
to exercise boundary conditions; they are not claims of complete human playthroughs.
`tests/arcade2-playthrough.test.cjs` additionally completes all ten fresh campaigns
using only control packets and normal stage transitions, without changing health,
world state or timers. These state-aware scripted policies are not human playtests.
Input tests use an event-target harness. Offline tests run the worker against a
scope-aware cache mock, including all of the new runtime URLs.

See `../docs/ARCADE2_VERIFICATION.md` for the execution record and browser limits.
