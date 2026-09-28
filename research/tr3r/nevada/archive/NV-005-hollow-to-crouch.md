# NV-005 — Historical experiment record

- **Recorded date:** 2026-09-28
- **Game / application:** TR3R / Nevada Quick Quad Access
- **Goal:** Derive and validate positioning, angle and visible crouch sink.
- **Outcome:** Adopted as Setup revision 1. This historical record contains several sequential trials; later confirmations supersede earlier pending statements.
- **Current instructions:** [approved Setup](../../../../content/guides/nevada-setup.json)

## Starting conditions and method

Preserved in the original notes below. Exact game build was not recorded.

## Observations and evidence

The original notes retain measurements and local evidence identifiers. Raw logs are held in the separate analysis workspace and are not bundled here. Historical statements about the live session are not current instructions.

## Original chronological notes

# Nevada setup: development and validation notes

**Final status: user-approved on 2026-09-28.** The current instructions are in
[Setup](../../../../content/guides/nevada-setup.json). Earlier candidate labels, pending-test statements,
and “master” terminology below describe historical stages, not the current
approval status. The user confirmed the manual execution, visible sink,
success, and adoption of this sequence as the Setup.

## Manual confirmation and save 3134

The player subsequently executed the recipe exactly as written and confirmed
this explicitly. A live READ verified X46181/Y-3681/Z58800, yaw 0, state 2,
animation 103, room 116. Thus both an agent trial and a human execution reached
the same exact endpoint. The player identified the new checkpoint as **Save
3134**. The agent did not create or overwrite a save, and has not yet reloaded
3134 to independently verify the saved contents. This is the preferred new
starting checkpoint for deriving a flare-angle sequence from yaw 0.

## Human input recipe

Start at the aligned hollow reference demonstrated by the player: after
vaulting onto the small ledge, Lara stands at X46181/Y-5133/Z54245 facing
yaw -32768. The player must reproduce this initial alignment; being anywhere
in the hollow is not sufficient.

1. Tap Back four separate times, letting each backward hop finish.
2. Roll once (End in the tested bindings). Let the roll finish.
3. Hold Walk (G) + Forward for three walking steps, then release and let Lara stop.
4. Repeat that three-step group twice more, with a full stop between groups.

Mnemonic: **4 back — roll — 3 forward — stop — 3 forward — stop — 3 forward**.
No Jump-key input, inventory buffer, save write, XYZ write, or yaw write is used.
This is the simplest fully tested candidate found in this search, not a proof
of the globally shortest possible input sequence.

## Numerical checkpoints

| Checkpoint | X | Y | Z | Yaw |
|---|---:|---:|---:|---:|
| Hollow reference | 46181 | -5133 | 54245 | -32768 |
| Back hop 1 | 46181 | -4464 | 54559 | -32768 |
| Back hop 2 | 46181 | -3789 | 55729 | -32768 |
| Back hop 3 | 46181 | -3789 | 56561 | -32768 |
| Back hop 4 | 46181 | -3789 | 57393 | -32768 |
| Roll | 46181 | -3789 | 56559 | 0 |
| Walking group 1 | 46181 | -3789 | 57306 | 0 |
| Walking group 2 | 46181 | -3789 | 58053 | 0 |
| Walking group 3 | 46181 | -3681 | 58800 | 0 |

The final XYZ exactly matches save 3133. Final state is 2/animation 103,
room 116. Yaw is deliberately 0 after the player's requested roll: this is
the quarter-turn variant, not the original save's yaw -16384. A subsequent
flare-angle setup must be derived for this new heading. The crouch/drop glitch
has not been validated from this heading.

## Live evidence

First complete trial used DOWN 100 ms four times, END 100 ms once, then
WALK+UP 2000 ms three times, waiting for standing after each group:
`tomb-raider-analysis/temple-mudslide/runtime/nevada-four-hops-roll-walk-1790549243373213700.json`.
Each walking group moved exactly 747 units. The roll displaced Lara by -834 Z;
it cannot be treated as an in-place turn.

Replay script: `tomb-raider-analysis/temple-mudslide/scripts/nevada_hollow_master_walk.py`.
It restores the hollow using keyboard movement, checks the reference, then
tests the same route with 1750/1850/1950 ms walking holds. Its result JSON is
the authority for whether that additional trial completed successfully.

The second trial `nevada-hollow-master-walk-1790549324905189800.json`
restored the exact hollow reference but was rejected on its first DOWN input
with `game not foreground`. The varied walking hold times were therefore
not tested. One full successful route is confirmed; repeatability of the whole
new route remains unverified. Lara was left at the hollow reference, not at
the master endpoint. No attempt was made to bypass the foreground check.

The earlier six-hop route with a short run and backward walking also reached
the exact XYZ, but was more timing-sensitive and was superseded after the
player asked for the roll before fine positioning.

## Ten-buffer yaw candidate from save 3134

From the verified standing endpoint at yaw 0, with inventory open:
**L1, I1, L6, I2** (ten standard 180 ms inventory buffers in total).
Do not insert extra idle buffers between groups: the first idle buffer leaves
the stop transition active, intentionally changing the next turn's phase.

Live verified end: X46181/Y-3681/Z58800, yaw **-3236**, room 116,
state 2/animation 103/frame 1610. Every buffer matched the animation-aware
model; XYZ stayed unchanged. Inventory was left open. This differs from
historical yaw -3250 by 14 angle units (about 0.077 degrees).
This is a verified angle sequence only; the flare ascent, wall distance, and
visible downward crouch cue are not yet tested at this yaw.
Evidence: `runtime/nevada-from3134-yaw10-1790549565386389600.json` in the analysis
project. No save was loaded or written during this angle test; the already
verified live save-3134 endpoint was used.

## Successful flare-crouch test at yaw -3236

The subsequent live input-only trial succeeded:

- Final pickup: X45090/Y-3839/Z60942, yaw -3236, state 67/animation 312/frame 8693.
- 19 upper BUFFERDUCK inputs, all standard delay 180; no parity correction needed.
- End: X45090/Y-3799/Z60942, yaw -3236, state 71/animation 222/frame 6675, room 116.
- Genuine crouch, downward displacement **40**, wall distance **34** from X45056.

Pickup XYZ and crouch XYZ exactly match the historical successful master.
Only yaw differs (-3236 instead of -3250). Inventory remains open at the crouch.
Evidence: `runtime/nevada-input-only-1790549647548340400.json` in the analysis project.
`crouch_success`, `master_sized_drop`, and `complete` are true.
The dynamic visual cue has not been independently reviewed; the evidence here
is measured animation state and displacement, so `visual_cue_verified` remains
false. No slide/load platform landing was tested and no save was written.

## Human-confirmed visible sink

The player manually reproduced the lower ten-buffer sequence; READ confirmed
unchanged master XYZ and yaw -3236. At the manually paused upper pickup,
READ gave X45089/Y-3840/Z60941, state 67/animation 312/frame 8701.
From that later pickup frame, the player executed **15 upper crouch buffers**
and explicitly confirmed visible sinking after exactly 15.
The subsequent READ confirmed X45089/Y-3800/Z60941, yaw -3236,
state 71/animation 222/frame 6675, room 116: genuine crouch, 40 units downward,
33 units wall distance. The visible cue is now user-confirmed for this manual
trial, independently of the earlier automated trial's visual_cue_verified=false.
Evidence: `runtime/nevada-manual-crouch-15-confirmation.json`.

Upper counts depend on the initial pickup frame: 19 from 8693, 15 from 8701.
Do not prescribe 19 universally. The user's earlier standalone message "28"
was ambiguous and is not a verified count of flare pickups.
The subsequent platform landing remains untested in this evidence.
