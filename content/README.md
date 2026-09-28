# Content, evidence and approval

## Responsibilities

- `research/<game>/<application>/README.md`: evidence register, decisions and gaps.
- `research/<game>/<application>/experiments/`: one bounded trial per record, using
  the [experiment template](../research/EXPERIMENT_TEMPLATE.md).
- `research/<game>/<application>/archive/`: preserved historical source records.
- `content/guides/`: maintained approved English guide revisions and their approval metadata.
- `docs/`: generated public HTML; never edit a generated page to change a recipe.
- `automation/`: executable tools, with their own implementation and validation status.

## From experiment to guide

1. Record the starting conditions, actual inputs, observations, outcome and evidence.
   Add the experiment to the application register, including failed and aborted trials.
2. Assess the evidence. Distinguish measured state, visible player confirmation and
   independent repetition; do not treat an abort as a gameplay failure.
3. Prepare proposed instruction changes alongside the experiment. Keep the current
   approved source unchanged until the revised input sequence has been approved.
4. On approval, update the guide source with the exact approved instructions, revision,
   date, approver, scope and evidence reference. Preserve previous revision contents
   in version control; retain experiment records and the approval decision.
5. Build with `python tools/build_site.py`, then run `python tools/check_links.py` and
   `python tools/check_content.py`. Review the generated guide before publishing.

Building is an explicit local command, not an automatic approval or publication.
The builder requires approved English source and a resolvable evidence reference;
these checks do not substitute for a human approval decision. An approval applies
only to its named revision and scope. Later experiments do not change it automatically.
Publishing to GitHub Pages remains a separate action.

## Current migration scope

Nevada uses `guides/nevada-setup.json` as its one maintained instruction source.
The catalogue refers to it with `guide_source`, so homepage cards, game cards and
the application page share its status and summary. The generator renders its
steps, details and measurements. Existing unrelated page bodies remain in the
site generator; migrate them when their own structured guide is introduced.
An English translation of the historical Setup is archived as approval provenance.

## Step images

Each Nevada step has a matching `step_images` entry, in the same order. Replace
its `src` with a path relative to `docs/` and its `alt` with a concise English
description when the screenshot is available. The generator renders a small
preview and a same-page modal viewer. Until then, each step uses the explicit
screenshot placeholder; it is not gameplay evidence.

## Discovery pages

The homepage searches the full catalogue and displays gallery cards. Game pages
filter the same catalogue to that game's applications; glitch pages explain the
shared technique and link to its applications. Cards use an optional catalogue
`thumbnail` (relative to `docs/`) or the guide's first introduction image. Without
an image, they show a labelled text preview. Guide videos appear above images
and reproduction steps.
