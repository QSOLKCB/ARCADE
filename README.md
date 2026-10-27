# ARCADE

**Keep the feeling alive.** Three original retro browser games for the preservation of game experiences, from QSOL–IMC.

[**Play the arcade**](https://qsolkcb.github.io/ARCADE/) · [**Download for offline play**](https://github.com/QSOLKCB/ARCADE/archive/refs/heads/main.zip) · [Controls](docs/CONTROLS.md) · [Preservation notes](docs/PRESERVATION.md)

| Cabinet | Historical inspiration | This implementation |
| --- | --- | --- |
| **Iron Meridian** | *Dogs of War* (1989, Amiga / Atari ST) | Three mercenary contracts, team loadout shop, four weapons, limited ammunition with unlimited sidearm fallback, grenades, rescue/recovery objectives, armoured roadblocks and extraction. 1–2 players. |
| **Velvet Heist** | *Cops 'n' Robbers* (1985, Commodore 64) | Five connected maze areas, 18 loose diamonds, three safe-code scraps, four safe gems, police pursuit, haunted mine, smoke, limited stun rounds, loot banking, recoverable dropped loot and lockup rescues. 1 player. |
| **Neon Ronin** | *Ninja Combat* (1990, arcade / Neo Geo) | Three city districts, twelve encounter blocks, three bosses, throwing stars, close-range attacks, jumps, rechargeable storm attacks, weapon/health pickups and local co-op revives. 1–2 players. |

These are new interpretations of the play experiences, **not exact ports or emulations**. Code, maps, characters, pixel art, sound effects and musical sequences are original to this project. No ROMs, original game assets or recorded soundtrack samples are required or included.

## Play offline

1. Download the repository ZIP and extract it.
2. Open `index.html` in a modern browser. Keep `js/`, `assets/` and the other runtime files beside it.
3. Pick a cabinet and play. No installation, package manager, server or network connection is required.

The hosted HTTPS version also caches all three games. Wait for **Offline ready · all 3 games** before disconnecting, then revisit the same address. Browser data clearing removes this cache. A new cached release waits for you to select **Update ready · Reload** from the launcher.

Scores and settings are local to the browser/device; current runs are not saved. If storage is blocked, the games still run. Sound starts disabled and can be enabled in the header. There are no accounts, trackers, ads or external runtime dependencies.

## Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | WASD; arrows also work in solo mode | Arrow keys |
| Attack | J / Z | U / Numpad 1 |
| Grenade, smoke or storm | K / X | I / Numpad 2 |
| Dash / jump | Space / C | O / Numpad 0 |
| Use, switch weapon or hold to revive | E | H / Numpad 3 |
| Pause | Escape / P | Escape / P |

Iron Meridian also supports mouse aim, left-button fire and right-button grenades. Standard gamepads: left stick/D-pad, A attack, B special, X jump/dash, Y use, Start pause. Touch controls are available through the **Touch** button. Local co-op uses a shared screen; Velvet Heist always starts with one player. Select **Relaxed** for more forgiving health, lives and enemy behaviour. High scores are separated by difficulty.

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
