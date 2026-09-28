# NV-001 — Historical experiment record

- **Recorded date:** 2026-09-27
- **Game / application:** TR3R / Nevada Quick Quad Access
- **Goal:** Reach crouch using keyboard inputs.
- **Outcome:** Crouch measured; rejected as a manual Setup because the visible sink was absent.
- **Current instructions:** [approved Setup](../../../../content/guides/nevada-setup.json)

## Starting conditions and method

Preserved in the original notes below. Exact game build was not recorded.

## Observations and evidence

The original notes retain measurements and local evidence identifiers. Raw logs are held in the separate analysis workspace and are not bundled here. Historical statements about the live session are not current instructions.

## Original chronological notes

# Nevada: first keyboard-only approach and crouch candidate

## Result and scope

One live run reached a genuine crouch 33 units from the wall, using only keyboard
commands from the player's slide-aligned standing position. No jump, position,
angle, animation, inventory-count, or save writes were used during this run.
Bridge telemetry was the primary observation method.

The starting point was **46477/-3641/57555, yaw -16384**, room 116, standing.
The player had just obtained this alignment by sliding. The path from save 3121
to this initial point was not automated or established by this trial.

| Checkpoint | X / Y / Z | Yaw | State / animation / frame |
|---|---|---|---|
| Keyboard-reached lower start | 46181 / -3669 / 58845 | -3336 | 2 / 103 / 1610 |
| Final pickup | 45089 / -3816 / 60902 | -3336 | 67 / 312 / 8693 |
| Crouch after 19 buffers | 45089 / -3820 / 60902 | -3336 | 71 / 222 / 6675 |

All checkpoints are in room 116. This is a new candidate, not master save 3131.
The candidate's slide/load platform landing has **not** been tested. No save was
created or overwritten. The game was left paused in the inventory at the crouch.

**Player feedback: insufficient visual cue.** The player reported that Lara does
not visibly sink at the end. Telemetry agrees: pickup Y-3816 to crouch Y-3820 is
a 4-unit upward movement, not a drop (positive Y points downward). The historical
master changes from -3839 to -3799, a 40-unit downward movement. This candidate
is therefore a technical crouch result, **not an accepted manual setup**. Future
candidates must also provide a player-confirmed visible downward cue. A numeric
drop of at least the master's 40 units is a search criterion, not visual proof.

## Recorded approach

These are measured bridge key-hold durations, **not a repeatability guarantee**.
Let each movement finish and Lara settle before continuing. The bridge adds a
150 ms lead for the Walk modifier. The observed route includes exploratory
corrections; a shorter human recipe still needs to be derived and repeated.

Bindings: Walk G, arrows for movement, crouch Y, Action E, weapons Space,
flare comma, inventory Esc.

| Input | Hold ms | Settled X / Y / Z | Yaw |
|---|---:|---|---:|
| G + Up | 1000 | 46181 / -3789 / 57555 | -16384 |
| G + Right | 1000 | 46181 / -3789 / 57940 | -15474 |
| Left | 100 | 46181 / -3789 / 57940 | -15744 |
| G + Down | 500 | 46430 / -3665 / 57893 | -15744 |
| G + Right | 1800 | 46421 / -3641 / 58477 | -15744 |
| G + Right | 800 | 46412 / -3600 / 58661 | -15744 |
| G + Right | 500 | 46403 / -3558 / 58845 | -15744 |
| G + Up | 1200 | 46181 / -3669 / 58845 | -15744 |

Walking forward reached X46181 in two approaches. Side-stepping directly against
the slope caused a +910 yaw deflection (about 5 degrees). Stepping back first
allowed three side-step trials without yaw drift. This supports positioning
laterally with clearance, then walking into the slope, then setting the angle.

The local classic engine source `tomb3/tomb3/game/lara.cpp`, function
`LaraDeflectEdge`, applies +/-910 on side collisions. This agrees with the live
measurement; it is supporting source evidence, not a claim that the remastered
implementation was inspected directly.

## Counted angle sequence

From the final row above, open the inventory. One buffer means: briefly close
with Esc, release, then re-press Esc together with the direction during closing.
Release both after reopening. An idle buffer uses Esc only.

1. 11 right buffers: yaw -5349.
2. 3 idle buffers: yaw -3471, with the last buffer confirming no further rotation.
3. 1 right buffer and 2 idle buffers: yaw **-3336**, standing.

All buffers used bridge parameter 180 (initial Esc released after 60 ms).
During the 11 right buffers the measured yaws were:
`-15699, -15474, -15069, -14484, -13719, -12774, -11649, -10344, -8859, -7194, -5349`.
The first three idle buffers gave `-3733, -3471, -3471`.
The fine adjustment gave `-3426, -3336, -3336`.

Turning accelerates and continues briefly after the direction is released.
Counting equal angle increments per buffer is therefore incorrect. All angle
measurements preserved XYZ. Timing sensitivity and repeatability remain open.

## Climb test

From 46181/-3669/58845, yaw -3336, inventory open:

- Close inventory, draw a fresh flare, and immediately start the established
  crouch/drop/pickup chain through the input-only `DROPUPPER` command.
- The telemetry contains 29 pickup animation entries (counted by frame wrap),
  ending in the pickup checkpoint above. The bridge opened inventory there.
- Apply 19 crouch buffers. Final state was the genuine crouch listed above,
  and successive reads confirmed that inventory pause held it stable.

The angle differs from historical master -3250 by only 86 units (0.47 degrees).
This live result shows that the exact historical angle is not necessary for
reaching a valid crouch. It does not yet establish a useful tolerance interval
or prove the subsequent platform landing.

## Local evidence and implementation

Analysis-project runtime evidence (kept local):

- `nevada-keyboard-walk-1790543907087370700.json`
- `nevada-keyboard-sidestep-1790543917228870100.json`
- `nevada-keyboard-turn-1790543929468271000.json`
- `nevada-keyboard-back-1790543963417703000.json`
- `nevada-keyboard-free-side-1790543975522486200.json`
- `nevada-keyboard-free-side-1790543987610591000.json`
- `nevada-keyboard-free-side-1790544004342245600.json`
- `nevada-keyboard-wall-1790544015311581300.json`
- `nevada-keyboard-buffer-1790544033169014900.json`
- `nevada-keyboard-buffer-1790544060992710300.json`
- `nevada-keyboard-settle-1790544077880901500.json`
- `nevada-keyboard-fine-1790544098513648700.json`
- `nevada-input-only-1790544141049298900.json`

`automation/nevada/setup.lua` includes guarded `candidate-angle` and
`candidate-crouch` stages matching these measurements. The live trial used the
existing Python client and CE Lua input bridge; the new Lua orchestration module
itself has only been tested offline, not installed into the live CE session.

Next search: adjust the keyboard-reached start or angle to obtain a genuine
crouch with a clear downward cue, then validate slide/load and repeat the
positioning from a reproducible reference. Preserve the historical master.
