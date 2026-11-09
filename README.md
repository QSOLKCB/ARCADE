# ARCADE

**Keep the feeling alive.** Nine original retro browser games for the preservation of game experiences, from QSOL–IMC.

[**Play the arcade**](https://qsolkcb.github.io/ARCADE/) · [**Download for offline play**](https://github.com/QSOLKCB/ARCADE/archive/refs/heads/main.zip) · [Controls](docs/CONTROLS.md) · [Preservation notes](docs/PRESERVATION.md)

## ARCADE 2 — The Second Shift

A second hall adds **ten original single-player cabinets** at [`arcade2/`](arcade2/),
using pinned VANILLAJS **v1.2.0** arithmetic and timing modules. Ninja action,
football, 2-on-2 basketball, **DevOps Kombat**, a cover shooter, Spaced Invaders,
run-and-gun action and two scrolling shooters bring the repository to 19 games.
v0.6.0 redraws every ARCADE 2 cabinet — parallax scenery, shaded sprites, additive
lighting and a CRT pass — with VANILLAJS `FrameGate` redraws and `audio2d` sound,
while the 60 Hz simulation is pinned bit-for-bit to its previous state hashes.
v0.7.0 gives every cabinet three modes: **Legacy** (v0.6.0 exactly), **Extended**
(longer levels, new enemies, trefoil-knot bosses) and **Remix** (one twist each).

[**Enter ARCADE 2**](https://qsolkcb.github.io/ARCADE/arcade2/) ·
[Cabinets, controls and engine provenance](arcade2/README.md) ·
[Verification record](docs/ARCADE2_VERIFICATION.md)

## ARCADE 3 — The Graveyard Shift

A third hall at [`arcade3/`](arcade3/) adds **nine original cabinets** on the shared
ARCADE 2 engine, bringing the repository to 28 games:

- a run-and-gun
- a haunted platformer with committed jumps
- a dream platformer
- a five-rail shooter
- a river run with fuel and bridges
- an into-the-screen jet shooter
- a colour-weapon vertical shooter
- two-on-two brawl ball
- behind-the-boxer boxing

Each is an original game built around the mechanics of a classic. No names,
characters, levels, art or music are copied. Every campaign is proven finishable
with controls alone and pinned by state hash.

[**Enter ARCADE 3**](https://qsolkcb.github.io/ARCADE/arcade3/) ·
[Cabinets, inspirations and controls](arcade3/README.md) ·
[Verification record](docs/ARCADE3_VERIFICATION.md) ·
[ARCADE3-FUZZ-001 valid-control fuzz protocol](docs/ARCADE3_FUZZ_001.md)

## The original hall

| Cabinet | Historical inspiration | This implementation |
| --- | --- | --- |
| **Iron Meridian** | *Dogs of War* (1989, Amiga / Atari ST) | Three mercenary contracts, team loadout shop, four weapons, limited ammunition with unlimited sidearm fallback, grenades, rescue/recovery objectives, armoured roadblocks and extraction. 1–2 players. |
| **Velvet Heist** | *Cops 'n' Robbers* (1985, Commodore 64) | Seven authored screens, pursuing police and reinforcements, limited shots, lifts, a key/code/safe puzzle, TNT, a torch-lit gallery, helicopter warnings, 22 gems, banking and jail rescues. 1 player. |
| **Neon Ronin** | *Ninja Combat* (1990, arcade / Neo Geo) | Three city districts, twelve encounter blocks, three bosses, throwing stars, close-range attacks, jumps, rechargeable storm attacks, weapon/health pickups and local co-op revives. A fighter select after each district: four fighters with their own skills, and each defeated boss joins the roster. 1–2 players. |
| **Neon Air** | Air hockey | Perspective 3D table, velocity-based mallet strikes, bank shots, first-to-seven matches and Rookie / Club / Expert AI. 1 player. |
| **Basement Brawl** | *Pit-Fighter* (1990) | Three fighters, five arena bouts, depth movement, punches, kicks, jump attacks, guard, combos, chairs and stagger throws. 1 player. |
| **Chrono Wing** | *Time Pilot* (1982) | Free flight through five eras, patrol quotas, flagship bosses, courier rescues, evasive rolls and replacement craft. 1 player. |
| **Prism Break** | *Breakout* (1976) | Five brick boards, paddle-angle control, armoured bricks, multiball, wide paddle, slow ball and laser capsules. 1 player. |
| **Void Command** | *Star Trek* (1971), gameplay only | An original terminal command deck: 8 × 8 frontier and tactical grids, three seeded campaigns, scanning, navigation, combat, shield transfers, damage/repair, docking and deadlines. 1 player. |
| **Kestrel Strike** | *1943* (1987) and *Raiden* (1990) | A vertical-scrolling propeller shooter on a TATE-style playfield: four fronts (sea, desert, storm clouds, volcanic citadel), formations and ground targets, red courier planes carrying firepower and bombs, growing medal chains, graze scoring, a loop maneuver, mid-bosses and a fortress boss on every front. 1 player. |

These are new interpretations of the play experiences, **not exact ports or emulations**. Code, maps, characters, pixel art, sound effects and musical sequences are original to this project. No ROMs, original game assets or recorded soundtrack samples are required or included.

## Collection 003 — v0.5.0

**Kestrel Strike** joins as the ninth cabinet. It is a vertical-scrolling propeller shoot-'em-up in the spirit of 1943 and Raiden, with original aircraft, fronts, bosses and music. Its plane flies through the integer `shmup` movement profile of [QSOLKCB/VANILLAJS](https://github.com/QSOLKCB/VANILLAJS) `motion2d`: exactly 2 px per tick, so every replay is exact.

The VANILLAJS 2D foundation now runs inside the arcade. `js/vanilla2d.js` is generated from the VANILLAJS modules by `scripts/vanilla2d.cjs`, so it still opens from disk with classic scripts:

- **audio2d:** a deterministic, sample-indexed PCM16 sound bank (explosions, hits, pickups, banks, alerts, bombs, power-ups, medals, the loop and terminal keys) shared by every cabinet.
- **range2d:** an exact collision prefilter (`A.near`) in the hot loops of Iron Meridian, Velvet Heist, Neon Ronin, Basement Brawl and Chrono Wing. All 13 replay pins from 0.3.1 still match, so no rule changed.
- **ternary-store2d:** the new **Score cartridge** button packs your local best scores into a ternary grid file you can download, and restores them with strict validation. A restore only ever raises a score.

![Kestrel Strike — browser screenshot, Coral Strait](docs/kestrel-strike-v041.png)

Every original cabinet also gets a readability improvement drawn purely from its existing state:

| Cabinet | New in v0.5.0 |
| --- | --- |
| Iron Meridian | Route map: the squad, objectives, roadblock, extraction and camera window on one strip |
| Velvet Heist | Floor plan of all seven screens with the loose gems left in each |
| Neon Ronin | District progress: four blocks, the last holding the boss |
| Neon Air | Strike cue that lights exactly when J will connect, plus speed streaks on a fast puck |
| Basement Brawl | "THROW · E" on a staggered opponent and durability pips on chairs |
| Chrono Wing | Edge radar for off-screen patrols, the flagship and couriers |
| Prism Break | Launch-path guide while serving, and a capsule countdown |
| Void Command | Key and order tones from the audio2d bank |

## Collection 002 — v0.3.0

Five new cabinets expand the collection to eight. **Void Command** uses a browser-native, ncurses-inspired command deck with bordered panels, tactical and frontier maps, resource gauges, a command log, clickable orders and command history. Its ship, factions, terminology, setting and art are original.

**Neon Air** uses a software-projected 3D table and shaded geometry, rendered through Canvas 2D. Rookie, Club and Expert opponents have distinct reaction delays, movement limits, aiming error and prediction; choose one on its cabinet card. This AI setting controls the hockey challenge independently of the collection's Arcade/Relaxed setting.

![Collection 002 — frames rendered from the game code](docs/collection-002-v030.png)

These are game-code renders for documentation, not browser screenshots. See [verification](docs/VERIFICATION.md) for browser coverage and its limits.

### Original collection

![The live ARCADE launcher](docs/arcade-preview-20261027.jpg)

## Second pass — v0.2.0

Velvet Heist now concentrates on the C64 adventure loop: spend ammunition to escape a pursuit, gather tools, open the safe, brave the dark mine and decide when to bank your bag. Its graphics stay deliberately simple. Iron Meridian and Neon Ronin retain their combat rules, with animated hits, richer particles, projectile trails, environmental detail and distinct original music.

![Velvet Heist — second-pass gameplay](docs/heist-v020-1793098132395.jpg)

## Play offline

1. Download the repository ZIP and extract it.
2. Open `index.html` in a modern browser. Keep `js/`, `assets/` and the other runtime files beside it.
3. Pick a cabinet and play. No installation, package manager, server or network connection is required.

The hosted HTTPS version also caches all nine games. Wait for **Offline ready · all 9 games** before disconnecting, then revisit the same address. Browser data clearing removes this cache. A new cached release waits for you to select **Update ready · Reload** from the launcher.

Scores and settings are local to the browser/device; current runs are not saved. If storage is blocked, the games still run. Sound starts disabled and can be enabled in the header. Each cabinet has an **Audio** panel with separate music and effects levels; set music to zero for effects only. There are no accounts, trackers, ads or external runtime dependencies.

## Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | WASD; arrows also work in solo mode | Arrow keys |
| Attack | J / Z | U / Numpad 1 |
| Grenade, TNT or storm | K / X | I / Numpad 2 |
| Dash / jump | Space / C | O / Numpad 0 |
| Use, switch weapon or hold to revive | E | H / Numpad 3 |
| Pause | Escape / P | Escape / P |

Iron Meridian also supports mouse aim, left-button fire and right-button grenades. Standard gamepads: left stick/D-pad, A attack, B special, X jump/dash, Y use, Start pause. Controllers also drive the launcher and menus (D-pad/stick moves, A selects, B goes back), and unplugging one pauses the game. Touch controls are available through the **Touch** button. Local co-op uses a shared screen; Velvet Heist and the five new cabinets are single-player. Select **Relaxed** for more forgiving health, lives and enemy behaviour. High scores are separated by difficulty; Neon Air also separates Rookie, Club and Expert scores. The rebuilt Velvet Heist uses a new score table; first-edition scores remain stored without being mixed into the new rules.

### New cabinet controls

| Cabinet | Controls |
| --- | --- |
| Neon Air | Mouse / touch drag or WASD / arrows moves the mallet; J / controller A strikes. |
| Basement Brawl | Move, J punch, K kick, Space jump, E pick up / throw; hold E to guard. |
| Chrono Wing | WASD / arrows steer; hold J to fire; K for a rechargeable evasive roll. |
| Prism Break | Mouse / touch drag or left/right moves; J / Space launches; J fires active lasers. |
| Void Command | Type `HELP`; enter commands or click quick orders. Click maps to prepare `MOVE`, `LANCE` or `JUMP`, then Execute. ↑ / ↓ command history. |
| Kestrel Strike | WASD / arrows fly; hold J to fire; K drops a bomb that clears enemy bullets; Space loops for brief invulnerability. |

Void Command uses the keyboard or touch console rather than the action-game controller buttons. Coordinates are column then row, from 1 to 8. Commands are queued into the fixed-step loop; time advances only for accepted operational orders. `HELP`, `MAP`, `STATUS` and invalid orders are free. The terminal canvas scrolls horizontally on narrow screens to preserve legible text.

## Hosting and development

Serve the repository root with any static host. The included **Publish arcade** workflow verifies the games and deploys only their runtime files to the already-enabled GitHub Pages site on pushes to `main`. It uses pinned official GitHub actions and requires no package installation or application build. A branch-based host can also serve `main` at `/ (root)`.

The runtime uses HTML, CSS, classic JavaScript, Canvas 2D and Web Audio. It intentionally does not require WebGL, a game engine, a CDN or npm dependencies. All paths are relative so the same files work under `/ARCADE/`, another subdirectory, or directly from disk.

Optional local HTTP preview:

```sh
python3 -m http.server 8080
```

Development checks use Node.js 20 or later, with no dependency installation:

```sh
npm test
npm run check
```

See [verification](docs/VERIFICATION.md), [architecture](docs/ARCHITECTURE.md), [invariants](docs/INVARIANTS.md), [asset provenance](docs/ASSETS_AND_RIGHTS.md) and [contributor rules](AGENTS.md). When changing a runtime file, update the cache revision in `sw.js`.

## Licence

The original project contributions use the repository's [Apache License 2.0](LICENSE). Historical game names identify inspirations and remain associated with their respective creators and rights holders. ARCADE is an independent project, without affiliation or endorsement.

