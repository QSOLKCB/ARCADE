# ARCADE 3 — The Graveyard Shift

Nine original single-player cabinets in `arcade3/`, alongside the original hall and
ARCADE 2. Open `arcade3/index.html` from an extracted checkout, or visit `arcade3/`
beneath the repository's Pages URL. There is no runtime build, package installation,
server, account, telemetry or external asset request. Sound is optional and starts off.

## The cabinets

Each cabinet is an original game built around the mechanics of a requested classic.
The titles in the middle column identify that inspiration only; none of their
names, characters, levels, maps, art, music, sound or code is used, and no
endorsement is implied.

| No. | Cabinet | Requested inspiration | Implemented game |
| --- | --- | --- | --- |
| 01 | Overclock Commando | Contra | Three run-and-gun stages through a data jungle. Eight-way aim, prone, spin jumps, a plant-and-aim stance, and one-hit lives. Shoot flying capsules for Spread, Laser and Rapid fire. Each stage ends at a wall of three guns that shield a core. |
| 02 | Tin Lantern | Ghosts 'n Goblins | A clockwork knight crosses three haunted stages. Brass plating breaks off on the first hit and chests restore it. Jumps commit to their arc. Throw spanners, flares or a lance. Risers, crows and orb-spitting wraiths, then the Foundry Warden. |
| 03 | Pixel Sleepwalker | The Great Giana Sisters | Three dream nights against a 150-second clock. Stomp inkblots, head-butt star blocks for crystals (every 6 crystals give a life), and catch the Storm charm to break dream bricks and throw sparks. Moth-owls patrol overhead. Reach the Dream Door. |
| 04 | Lattice Lancer | Beamrider | Five light rails run to the horizon. Lance a quota of drones per sector, dodge the indestructible cargo blocks and the sparks, then use your three torpedoes on the warden crossing the sky. Four sectors. |
| 05 | Canal Cutter | River Raid | A night canal that narrows and forks. Throttle up and down, keep your cell charged by skimming CHG buoys (or shoot them for points), shoot barges, hover-drones and interceptors, and burn down each firewall bridge. The last bridge you burned is your restart point. |
| 06 | Skyline Overdrive | After Burner | Into-the-screen jet combat over a banking horizon. The cannon fires straight ahead; missiles ripple into up to two targets locked inside the reticle. Jink away from incoming flak. Each of the three sorties ends with a gunship. |
| 07 | Stratos Ward | Raiden II | A vertical shooter. Crystals change colour as they drift: red spreads, blue punches through, violet curves into targets. Each crystal levels the weapon up. Ward bombs clear the sky, and medals grow in value. Each of three stages ends with a dreadnought. |
| 08 | Hard Court Feud | Arch Rivals | Two-on-two street basketball where an elbow knocks the ball loose. Shoot, pass, turbo and dunk. Beat three rival crews; losing a game costs a credit and you replay it. |
| 09 | Knockout Circuit | Super Punch-Out!! | Boxing seen from behind your fighter. Read each rival's tell, slip or duck the punch, and counter into the opening. Pick body or head shots around the guard, and spend a full power meter on a haymaker. Four rivals; three knockdowns win a bout. |

All artwork is drawn locally with Canvas, and sound uses the ARCADE 2 audio2d bank.
No downloaded art or audio is used.

## Controls

| Action | Keyboard | Standard gamepad | Touch |
| --- | --- | --- | --- |
| Move / aim | Arrows or WASD | D-pad or left stick | Direction pad |
| Primary (Z) | Z or J | A | Z |
| Secondary (X) | X or K | B | X |
| Jump / turbo / special (Space) | Space or L | X | SPACE |
| Pause / resume | P or Escape | Start | Pause button |

Each cabinet shows its own four control labels and objective in the playroom.

- **Overclock Commando:** hold X to plant your feet and aim without moving. Down
  goes prone.
- **Tin Lantern:** jumps cannot be steered once you leave the ground.
- **Pixel Sleepwalker:** hold Space to run and jump higher; let go early for a short
  hop. Z throws Storm sparks while you have the charm.
- **Canal Cutter:** up throttles and down eases off. Skim a buoy slowly to recharge
  more.
- **Skyline Overdrive:** a red box marks each locked target. X fires at them.
- **Hard Court Feud:** X passes when you have the ball, calls for the ball when your
  teammate has it, and throws an elbow on defence. Hold Space to turbo, and shoot
  from close range with turbo to dunk.
- **Knockout Circuit:** left/right slip, down ducks and up guards. A guard stops
  jabs only. Z is a body shot, X a head shot, and Space a haymaker at full power.
  Taking a hit empties the power meter.

## Engine

ARCADE 3 adds no engine of its own. It loads the ARCADE 2 runtime from `../arcade2/`:
the generated VANILLAJS v1.2.0 adapter (fixed 60 Hz clock, checked Q16.16 math,
FrameGate, audio2d), the presentation layer, input and the hall shell. `hall.js`
sets `Arcade2.HALL`, which gives the shell this hall's title, storage prefix
(`qsol-arcade3:`), featured cabinet and filters. `kit.js` holds small helpers that
the platformers share: eight-way aim, landing on ledges and over pits, and bounded
pools.

Every cabinet has a single rule set, so the Mode menu is hidden. Rendering is a pure
function of game state, and simulation randomness comes only from each game's seeded
generator.

## Testing

`tests/arcade3.test.cjs` covers the following for every cabinet:

- seeded replay determinism
- render purity
- bounded pools
- terminal-state freeze
- a complete campaign driven only by controls (`tests/arcade3-policy.cjs`), pinned
  by state hash and replayed with drawing between ticks
- that a naive input pattern does not finish the campaign (Hard Court Feud is
  exempt, because your AI teammate can carry a game)
- draw-call ceilings in both FX tiers

It also has a mechanics test for each cabinet. Those tests include level-fairness
checks: no Sleepwalker block sits over a pit's jump arc, no moth-owl patrols above a
pit or a tall pillow tower, and every Canal Cutter channel is at least 60 px wide.
