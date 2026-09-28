# Nevada: historical Lua calibration runner

The current manual [Setup](../../docs/glitches/flare-climb-slide-load/tr3r/nevada-quick-quad-access/index.html) was approved on 2026-09-28. This runner has not been updated or live-validated against that revision. All experiments and remaining-work statements below describe the older implementation, not the current manual Setup. See the [research register](../../research/tr3r/nevada/README.md) for current evidence.

## Historical implementation notes

Status: **offline implementation; live calibration pending**. This does not yet
provide a verified keyboard route from save 3121 to the master start.

The **master angle now has a live-verified 29-buffer keyboard recipe**:
[exact master angle](../../research/tr3r/nevada/archive/NV-002-exact-angle.md).
The module's `master-angle` mode reproduces that command sequence from
46181/-3681/58800, yaw -16384, already paused in inventory. The live verification
used the Python client and existing CE bridge; this Lua orchestration wrapper
itself remains offline-tested. Reaching that XYZ from save 3121 remains open.

Live research update: [keyboard-only candidate](../../research/tr3r/nevada/archive/NV-001-keyboard-candidate.md)
reached a genuine crouch, but the player rejected its unclear visual cue: Lara
does not sink visibly. It is not yet an accepted manual setup. The Lua module's
`candidate-angle` and `candidate-crouch` modes preserve that measured experiment;
they start in an already open inventory at their exact respective checkpoints.

The same counted inventory buffers are intended for manual play and Lua replay.
The Lua module sends input commands through the existing local CE bridge. It does
not set coordinates, angles, animations, inventory, or save files. Loading the
module alone starts nothing. Use only one bridge client at a time.

## Preserved reference

| Stage | X / Y / Z | Yaw | State / animation / frame |
|---|---|---|---|
| Save 3121 | 46180 / -3790 / 58052 | -16979 | 2 / 103 / idle frame varies |
| Master lower start | 46181 / -3681 / 58800 | -3250 | standing |
| Pickup checkpoint | 45090 / -3839 / 60942 | -3250 | 67 / 312 / 8693 |
| Save 3131 crouch | 45090 / -3799 / 60942 | -3250 | 71 / 222 / 6675 |

All these checkpoints are in internal room 116. Preserve saves 3121, 3124, 3130
and 3131. The user confirmed a central platform landing using 3124, an actual
slope slide, then 3131. The onward quad route is still unverified.

The master ascent recorded 28 pickup entries and 19 crouch buffers, but its
initial position and angle were externally set. These counts alone are not a
complete input-only setup. Do not label the route verified until the positioning,
ascent and slide/load have all been repeated using inputs alone.

## First experiment: counted turning

1. Load 3121 and close the inventory; Lara must be standing at the initial checkpoint.
2. Open the inventory.
3. Close it with a short Esc tap, release, then press Right + Esc during closing
   until the inventory reopens. Release both. Repeat the chosen number of times.
4. Do two equivalent buffers with Esc only, allowing turning to settle.
5. Record the resulting yaw and confirm no positional drift. Repeat from 3121.

The default candidate to investigate is 15 right buffers; **this is not a
verified angle recipe**. The Lua trial takes an explicit count from 1 to 20.
Its buffer parameter is 180 ms, using the existing bridge's 60 ms initial Esc
phase. This is timer-based automation, not guaranteed frame stepping.

## Run locally in Cheat Engine

Prerequisites: game access available, CE attached to the intended game, the
existing `ce_live_persistent.lua` bridge running with a validated Lara address,
and no other bridge clients. This module does not install or replace the bridge.
Replace both paths below with the local checkout paths. Start with the game
running at save 3121, inventory closed; bring the game to the foreground before
the input phase. The bridge rejects input if game focus is absent.

```lua
local setup = dofile('C:/path/to/tomb-raider-glitch-lab/automation/nevada/setup.lua')
nevadaSetup = setup.startCE('C:/path/to/tomb-raider-analysis/temple-mudslide', 'turn', 15)
```

For the separate crouch regression trial, first reach the exact master pickup
checkpoint and visually confirm the inventory is fully open:

```lua
nevadaSetup = setup.startCE('C:/path/to/tomb-raider-analysis/temple-mudslide', 'crouch')
```

The latter performs exactly 19 buffers, checks the intermediate states, and
requires the exact final crouch checkpoint. It does not perform the ascent.
Both trials leave the inventory open on success. Inspect `nevadaSetup.phase`
and `nevadaSetup.error`. To abort: `nevadaSetup:cancel('User stop')`.
On failure the runner requests a session-tagged bridge stop; it does not assume
that the game has been paused. Reinitialize the bridge before another trial.

Logs are local `runtime/nevada-setup-*.log` files in the analysis project.
Every command and acknowledged READ is recorded. A timeout, rejection, changed
session, unexpected state, or drift stops the trial. The code does not auto-load
saves or retry failed inputs.

## Remaining work

- Measure and repeat the counted angle; derive a movement route to the lower start.
- Test whether a reachable nearby angle/position reproduces the climb if the exact
  historical master cannot be reached with simple counted inputs.
- Add the verified movement and ascent recipe to the runner, then repeat the full
  input-only route before documenting it as Quick Reproduce.
- Validate the slide/load endpoint and record the two demonstrations.

Offline controller checks: `python automation/nevada/test_setup.py` (8 passing
tests using the local CE Lua DLL). These do not establish gameplay success.

On 2026-09-27 the initial computer-use attempt was rejected with
`Computer Use was not approved to use tomb123`. The user subsequently enabled
bridge access and requested coordinate-first work, starting with the exact master
angle. After loading 3121 and reinitializing the bridge for its changed pointer,
an angle-only `SET|,,,-3250` was acknowledged and read back at
46180/-3790/58052, yaw -3250, room 116, standing. XYZ remained unchanged.
This is an externally aligned reference, not an input-only calibration result;
the counted-turn trial has not yet been run. The lower master position is still
1 X unit and 748 Z units away from this reference position.
