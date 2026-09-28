# Nevada research index

Current guide: [English Setup webpage](../../../docs/glitches/flare-climb-slide-load/tr3r/nevada-quick-quad-access/index.html).
Maintained source: [Setup revision 1](../../../content/guides/nevada-setup.json).

## Approval

Revision 1 was approved by the user on 2026-09-28. It covers keyboard-only
positioning, ten lower angle buffers and the flare climb with visible sinking
into crouch. The user reported success. The subsequent slide/load was not
separately measured for this revision; the onward quad route is unverified.
The approval metadata and scope are stored with the guide source.

## Evidence register

| ID | Date | Question | Outcome | Role in current Setup |
|---|---|---|---|---|
| [NV-001](archive/NV-001-keyboard-candidate.md) | 2026-09-27 | Reach crouch using keyboard inputs. | Crouch measured; rejected as a manual Setup because the visible sink was absent. | Historical comparison only |
| [NV-002](archive/NV-002-exact-angle.md) | 2026-09-27 | Reach the historical exact yaw using counted buffers. | Angle achieved; superseded by the shorter approved Setup. Includes an invalid earlier model and a longer historical sequence. | Historical comparison only |
| [NV-003](archive/NV-003-six-backsteps.md) | 2026-09-28 | Reproduce the demonstrated six-hop positioning. | Positions reproduced; endpoint is not the approved climb start. | Historical comparison only |
| [NV-004](archive/NV-004-angle14-retry.md) | 2026-09-28 | Test the climb after fourteen lower buffers. | Aborted on focus loss. Neither a geometric failure nor a successful crouch test. | Historical comparison only |
| [NV-005](archive/NV-005-hollow-to-crouch.md) | 2026-09-28 | Derive and validate positioning, angle and visible crouch sink. | Adopted as Setup revision 1. This historical record contains several sequential trials; later confirmations supersede earlier pending statements. | Supports revision 1 |

The [English translation of the approval record](archive/setup-v1-approval-en.md) is retained
for provenance only. The five older documents are archived as source records;
they have not been rewritten to pretend they followed the new template or
represented only one trial each. Their original chronological notes are preserved.

## Remaining evidence gaps

- Exact game build.
- A continuous video demonstration.
- Telemetry of the slide/load continuation and verification of the onward quad route.
- Integration and live validation of this revision in the Lua runner.

New work uses one [experiment record](../../EXPERIMENT_TEMPLATE.md) per bounded
trial, with the next NV identifier, in `experiments/`. Add it to this register.
Keep outcome (success / failed / aborted / inconclusive) separate from adoption
(candidate / adopted / superseded). A focus-loss abort is not a gameplay failure.

## Pickup count verification (2026-09-28)

Recounting `nevada-input-only-1790549647548340400.json` confirms **28 pickup
animation entries** in the successful input-only ascent from the revision-1
lower checkpoint (yaw -3236). Count an entry when animation 312 starts or its
frame counter wraps backwards. The first entry is at tick 348679343; the 28th
is at tick 348715343. The final pickup was paused at frame 8693 before the
19 upper crouch buffers. Thus 28 applies to this measured current Setup, not
only to the historical angle. The player should pause during pickup 28, not
complete it and then open the inventory. This recount does not add a new live trial.

## Completed screenshot walkthrough (2026-09-28)

The player supplied English replacements for the upper pickup and crouch, both
load-menu captures and a final image on the upper platform. Every guide step
now has an image. The final result is visually documented; these still images
are not continuous video or telemetry of the load transition. The screenshot
session restored the lower position using the bridge before replaying the
ascent; it is illustration work, not a new end-to-end input-only trial.
