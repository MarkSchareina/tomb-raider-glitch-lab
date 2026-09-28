# NV-003 — Historical experiment record

- **Recorded date:** 2026-09-28
- **Game / application:** TR3R / Nevada Quick Quad Access
- **Goal:** Reproduce the demonstrated six-hop positioning.
- **Outcome:** Positions reproduced; endpoint is not the approved climb start.
- **Current instructions:** [approved Setup](../../../../content/guides/nevada-setup.json)

## Starting conditions and method

Preserved in the original notes below. Exact game build was not recorded.

## Observations and evidence

The original notes retain measurements and local evidence identifiers. Raw logs are held in the separate analysis workspace and are not bundled here. Historical statements about the live session are not current instructions.

## Original chronological notes

# User demonstration: six backward hops from the hollow

Read-only capture completed: 1161 samples, zero resolver errors. The recording
contains position and animation telemetry, not video or physical key states.
No agent movement inputs or game-memory writes were sent during capture.

After preliminary positioning, Lara vaults up the ledge (state 19, animation 50,
ANIM_VAULT2 in the local engine enum) and aligns to yaw -32768 at X46181.
The vault ends at Y-5133/Z54245. This was initially misidentified as sliding.
Six backward movement sequences follow, each beginning with animation 88.
These are backward-hop/backstep animations, not evidence of a Jump-key press.

| Hop | Settled X | Settled Y | Settled Z | Yaw |
|---|---:|---:|---:|---:|
| 1 | 46181 | -4464 | 54559 | -32768 |
| 2 | 46181 | -3789 | 55729 | -32768 |
| 3 | 46181 | -3789 | 56561 | -32768 |
| 4 | 46181 | -3789 | 57393 | -32768 |
| 5 | 46181 | -3789 | 58225 | -32768 |
| 6 | 46181 | -3616 | 59057 | -32768 |

The first two sequences include falling animation 93 and landing animation 82.
The last four each advance exactly 832 units along Z, with constant X and yaw.
The demonstration was subsequently replayed once using keyboard inputs;
all six settled positions and yaws matched exactly.
The final point differs from save 3133 by X0/Y+65/Z+257 and a quarter-turn.
It must not be treated as the same master position or an accepted climb setup.

Evidence:
- `tomb-raider-analysis/temple-mudslide/data/technical/skate-record-1790548479-347506781.csv`
- `tomb-raider-analysis/temple-mudslide/runtime/nevada-user-six-backsteps-2026-09-28.json`

Recording stopped on user request. Input bridge remains paused. To replay the
demonstration without coordinate writes, the starting save at the hollow is
needed; the user has been asked to identify it. Save 3133 is the old master
position and does not restore the recorded hollow start.

## Autonomous replay

Returned toward the ledge using WALK+UP, then used ACTION+UP 100 ms
to vault onto the exact recorded starting XYZ/yaw. An initial longer vault
input overshot; it was corrected using keyboard movement before the test.
From the verified start, six DOWN 100 ms presses, each followed by a 1.5 s
wait after acknowledgement, reproduced all six endpoints exactly.
No Jump key, coordinate writes, or save writes were used.
Evidence: `runtime/nevada-six-backsteps-replay-2026-09-28.json` in the analysis project.
The climb/crouch glitch itself is not yet validated from this endpoint.
