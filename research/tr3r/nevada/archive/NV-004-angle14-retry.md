# NV-004 — Historical experiment record

- **Recorded date:** 2026-09-28
- **Game / application:** TR3R / Nevada Quick Quad Access
- **Goal:** Test the climb after fourteen lower buffers.
- **Outcome:** Aborted on focus loss. Neither a geometric failure nor a successful crouch test.
- **Current instructions:** [approved Setup](../../../../content/guides/nevada-setup.json)

## Starting conditions and method

Preserved in the original notes below. Exact game build was not recorded.

## Observations and evidence

The original notes retain measurements and local evidence identifiers. Raw logs are held in the separate analysis workspace and are not bundled here. Historical statements about the live session are not current instructions.

## Original chronological notes

# Nevada: 14 lower buffers, retry from save 3133

The retry is incomplete because the game lost foreground focus during the
pickup chain. This is neither a geometric failure nor a successful crouch test.
Only keyboard inputs and bridge observation were used. No position/yaw writes,
jumps, or save writes were performed.

## Reproduction and measurements

1. Load through F9 (100), Enter (100), then reload the bridge once and create a
   fresh client. The transient `STOPPED|reload` became a new READY session.
2. Confirm X46181/Y-3681/Z58800, yaw -16384, room 116, state 2, animation 103.
3. Open inventory using Esc (100).
4. Execute 12 right buffers and 2 idle buffers, all parameter 180. Every step
   matched the animation-aware model. Final XYZ unchanged, yaw -1816,
   state 2/animation 103/frame 1610.
5. Observe weapons, close inventory, press Flare (100), wait 550 ms after the
   acknowledged command. Weapon trace confirmed gun_type 9 (gun_status 2).
6. Start DROPUPPER (55000). Pickup animation samples confirmed that the chain
   ran, unlike the previous repeated-pistol-draw failure.
7. Bridge paused with `game lost focus`; all held keys were released. Last
   recorded state: X45759/Y-3624/Z59932, yaw -1816, room 116,
   state 67/animation 312/frame 8715. This is an intermediate pickup, not the
   final wall checkpoint. No upper buffers were executed.

The candidate script now records weapon state after ignition and refuses to
start the pickup chain unless gun_type is 9. This verifies flare selection;
it does not by itself prove ignition animation completion or repeatability.

Evidence under `tomb-raider-analysis/temple-mudslide/runtime/`:

- `nevada-verified-turn-plans-1790547476622970300.json`
- `nevada-input-only-1790547514955288300.json`

Bridge session: `1790547463-346490109`, left PAUSED due to lost focus.
Resume requires the user to put the game in foreground, then restart the trial
from save 3133. The real downward crouch cue and final wall distance remain
unmeasured for this angle; visual_cue_verified remains unproven.
