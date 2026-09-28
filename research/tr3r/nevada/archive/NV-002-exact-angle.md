# NV-002 — Historical experiment record

- **Recorded date:** 2026-09-27
- **Game / application:** TR3R / Nevada Quick Quad Access
- **Goal:** Reach the historical exact yaw using counted buffers.
- **Outcome:** Angle achieved; superseded by the shorter approved Setup. Includes an invalid earlier model and a longer historical sequence.
- **Current instructions:** [approved Setup](../../../../content/guides/nevada-setup.json)

## Starting conditions and method

Preserved in the original notes below. Exact game build was not recorded.

## Observations and evidence

The original notes retain measurements and local evidence identifiers. Raw logs are held in the separate analysis workspace and are not bundled here. Historical statements about the live session are not current instructions.

## Original chronological notes

# Exact master angle using keyboard buffers

## Preferred shorter sequence: 29 buffers

Live verified on 2026-09-27, from the same master XYZ and yaw -16384:

**Right x7, idle x2, Right x1, Left x5, Right x11, Left x1, idle x2.**

Execute these groups continuously: **do not add settling buffers between groups**.
Every buffer uses the existing parameter 180. The reversal timing intentionally
uses the turn and stop transition animations. After buffer 28 yaw is exactly
-3250; buffer 29 finishes the transition to standing animation 103. Repeated
READ confirmed yaw -3250 at unchanged XYZ46181/-3681/58800, room116, with the
inventory open. Every buffer's yaw, animation and applicable frame matched the
animation-aware model. This is the shortest sequence found and live checked so
far, not a proof of global optimality across all possible input techniques.

Evidence: `runtime/nevada-verified-turn-plans-1790545829827475500.json`.
Runner: `nevada_verify_turn_plans.py`; model/search: `nevada_turn_model.py`.
The model was first checked against 95 recorded buffers. Its animation ranges
come from the original level data; agreement with the live remaster was checked
at each step rather than assumed. An earlier simplified 28-buffer prediction
failed at buffer 11 and is **not a valid recipe**.

## Historical longer sequence: superseded

Live verified once on 2026-09-27. Start: X46181/Y-3681/Z58800, room 116,
standing, yaw -16384. The position was restored externally at the user's request
before this experiment. The entire subsequent angle adjustment used keyboard
inputs only; XYZ did not change.

Open inventory. Execute these groups, with **three idle inventory buffers after
every group** to let the turn settle. All buffers used parameter 180 in the
existing CE bridge (60 ms initial Esc release). Right/left buffers re-press the
direction together with Esc during inventory closing; idle buffers re-press Esc
alone. Release keys between buffers.

| Group | Direction buffers | Settled yaw |
|---|---|---:|
| 1 | Right x1 | -16249 |
| 2 | Left x6 | -19935 |
| 3 | Left x6 | -23621 |
| 4 | Left x9 | -31844 |
| 5 | Left x9 | 25469 |
| 6 | Left x9 | 17246 |
| 7 | Left x9 | 9023 |
| 8 | Left x11 | **-3250** |

Total: 60 direction buffers + 24 idle buffers = **84 buffers**. This long
sequence was chosen to reach the exact integer yaw, including acceleration and
deceleration. It is not claimed to be the simplest human setup or the globally
shortest sequence. Every measured group matched its predicted displacement.

Final: **46181/-3681/58800, yaw -3250, state 2, animation 103, frame 1612**.
Repeated READ confirmed the final paused state. No flare was drawn and no
movement, jumping, saving, loading, absolute TURN, or memory writes occurred in
the angle sequence. The inventory remains open.

Implementation: local analysis script `nevada_exact_keyboard_angle.py`, using
the existing CE Lua bridge. It replans from measured settled yaw if timing
deviates, validates unchanged XYZ after each buffer, and bounds inputs to 250
buffers. This live run required no replanning for deviations. The fixed recipe
above still needs independent repetition before being called repeatable.

Local evidence: `runtime/nevada-exact-keyboard-angle-1790545078554870700.json`
in the analysis project's `temple-mudslide` directory.
