# Historical approval record — English translation

Translated from the original German record for publication. This preserves the
historical measurements and approval scope; it is not the current walkthrough.
Use the maintained [Setup source](../../../../content/guides/nevada-setup.json).

## Nevada — Quick Quad Access: Setup

**Confirmed and approved by the user on 28 September 2026.**
This sequence superseded earlier alignment variants. Its name is simply **Setup**.

## Positioning from the hollow

Start at the aligned position confirmed in the recording, after pulling up onto
the small ledge, with Lara facing the hollow.

1. Perform 4 backward hops, letting each finish. Do not press Jump.
2. Perform 1 roll and let it finish.
3. Walk forward 3 steps, release and stop completely.
4. Walk forward 3 steps, release and stop completely.
5. Walk forward 3 steps and stop completely.

Sequence: **4 back → roll → 3 forward / stop / 3 forward / stop / 3 forward.**

Historical test bindings: Walk = G, movement = arrow keys, roll = End.
Hold G + Forward for each walking group and release between groups.
Do not walk all 9 steps continuously.

The user saved a positioning checkpoint before adjusting the lower angle.

## Lower angle adjustment

Open the inventory, then perform:

**1 Left buffer → 1 idle buffer → 6 Left buffers → 2 idle buffers.**

There are 10 buffers in total. Do not add idle buffers between groups.
A Left buffer combines Left with Esc when reopening the inventory; an idle
buffer uses Esc without a direction. Each buffer starts and ends in inventory.
The tested bridge setting was 180 ms, observed as 2 game frames per buffer.

## Flare chain and upper crouch buffers

Perform the confirmed flare drop/pickup chain and pause the upper pickup in the
inventory. Apply crouch buffers until Lara visibly sinks into a true crouch.

The successful manual run needed exactly 15 crouch buffers from pickup frame
8701. The automated run needed 19 from frame 8693. The count depends on when
the pickup is paused; 15 is not universal. The stopping cue is the visible sink.

## Confirmation

- Automated positioning and the user's manual reproduction reached the same position.
- The 10 lower buffers were confirmed automatically and manually.
- The automated flare chain reached true crouch with a 40-unit sink and 34 units of wall clearance.
- The user confirmed visible sinking after exactly 15 upper buffers. Measurements confirmed true crouch, a 40-unit sink and 33 units of wall clearance.
- The user then reported success and explicitly approved the sequence as the new Setup. The continuation after crouch was not separately measured in this record.

## Historical measurements

| Checkpoint | X / Y / Z | Yaw | State / animation |
|---|---|---:|---|
| Aligned hollow start | 46181 / -5133 / 54245 | -32768 | 2 / 103 |
| Lower positioning checkpoint | 46181 / -3681 / 58800 | 0 | 2 / 103 |
| After 10 lower buffers | 46181 / -3681 / 58800 | -3236 | 2 / 103 |
| Upper pickup, manual | 45089 / -3840 / 60941 | -3236 | 67 / 312, frame 8701 |
| Confirmed crouch, manual | 45089 / -3800 / 60941 | -3236 | 71 / 222, frame 6675 |

Gameplay used keyboard inputs only. The agent did not overwrite saves or write
position or yaw to memory. Approval covers this input sequence and does not
establish complete live validation of the older Lua automation.

The [experiment notes](NV-005-hollow-to-crouch.md) contain measurements and
historical intermediate states. Save slot identifiers from the original record
are omitted here because they are not reproduction requirements.
