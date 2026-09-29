# Tomb Raider Glitch Lab

English guides, research and reproduction tools for Tomb Raider Remastered.

Repository: https://github.com/MarkSchareina/tomb-raider-glitch-lab

Website: https://MarkSchareina.github.io/tomb-raider-glitch-lab/

## Structure

```text
docs/                                      GitHub Pages web root
  index.html                               Collection homepage
  assets/site.css                          Shared design
  glitches/flare-climb-slide-load/
    index.html                             Complete technique and compatibility
    media/tr3r/                            Game-labelled technique demonstrations
    tr3r/
      temple-mudslide/index.html            Existing publication entry
      nevada-quick-quad-access/index.html   Quick Reproduce, then detailed evidence
        media/                             Application-specific videos
  tr1r/, tr2r/, tr3r/                       Game indexes linking to canonical guides
  technical/
    index.html                             Technical reference index
    tr1r/, tr2r/, tr3r/                     Separate game-specific offsets
    lua-automation/index.html              Existing protocol and future live workflow
content/guides/                            Approved English guide sources and approval metadata
research/                                  Structured evidence registers and experiment records
  tr3r/nevada/README.md                     Current approval scope and evidence register
  tr3r/nevada/archive/                      Preserved historical trials
automation/                                Future portable replay tools
tools/build_site.py                        Static page generator
tools/check_links.py                       Local HTML link validation
```

Each application has one canonical page under its complete glitch technique.
Game indexes provide a second navigation path without duplicating content.
Older draft paths contain links to the canonical pages.

## Page design

1. Introduction and application video when available.
2. Overview images, status and prerequisites.
3. Quick Reproduce: inputs and expected outcome.
4. Detailed explanation, measurements and limitations below.

Memory offsets and the Lua bridge belong in the separate technical section.
Game adapters must be independently validated. Live automation is planned;
the static website itself does not control Cheat Engine or the game.

## Build and check

```sh
python tools/build_site.py
python tools/check_links.py
python tools/check_content.py
python -m http.server 8080 --directory docs
```

Open http://localhost:8080/. No third-party build dependencies, remote fonts or trackers.
Edit the approved Nevada guide in `content/guides/nevada-setup.json`; its HTML and
catalogue status are generated from that one source. Other existing page bodies
remain in `tools/build_site.py`. Edit styling in `docs/assets/site.css`.
See [the content workflow](content/README.md) before changing an approved recipe.

## Publish with GitHub Pages

After committing and pushing the reviewed content, in Settings > Pages select
Deploy from a branch, branch `main`, folder `/docs`.

Documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

Guide URL pattern:
`https://MarkSchareina.github.io/tomb-raider-glitch-lab/glitches/flare-climb-slide-load/tr3r/nevada-quick-quad-access/`

All internal links are relative, so repository-prefixed project URLs work.
The existing Temple Mudslide publication is unchanged and linked externally.
The compressed Nevada video is included. Its uncompressed original is kept locally and excluded from Git.

## Nevada status

Title: TR3R Nevada – Quick Quad Access Flare Climb.
The current English [Setup](docs/glitches/flare-climb-slide-load/tr3r/nevada-quick-quad-access/index.html)
is generated from [revision 1](content/guides/nevada-setup.json), approved 2026-09-28.
Use the name **Setup**. Positioning, ten lower angle buffers and visible sinking
into crouch were manually confirmed. Upper buffer count depends on pickup timing:
15 from frame 8701 in the manual trial; 19 from frame 8693 in the automated trial.
See the [evidence register](research/tr3r/nevada/README.md) for approval scope,
historical results and open questions. The older Lua runner remains historical
and is not live-validated against this revision.

Do not publish local saves, raw logs or machine-specific paths without review.
Files outside `docs` are not served by Pages but are still visible in a public repository.

## Catalogue and consistent metadata

Edit `content/catalog.json` for titles, game, level, technique, status, search tags and summaries. The same records supply homepage cards and application-page metadata. For entries with `guide_source`, status and summary come from that approved guide source; do not duplicate them in the catalogue. Rebuild with `python tools/build_site.py`. New guide bodies still need a page definition.

The homepage supports text search plus game/type filters without a backend. The complete catalogue remains readable without JavaScript. Level names: Temple Ruins and Nevada Desert (TR3R).


## Glitch Lab · Level Inspector

[Open the viewer](docs/tools/ten-viewer/index.html) on the site, or download
[the standalone HTML](docs/tools/ten-viewer/standalone.html) for offline use.
Choose or drag a TEN 1.10.1.0 or TR3 PC (.TR2) level into it. The file stays on the user's device.

The single maintained source is `docs/tools/ten-viewer/`. The normal site build
also generates the offline HTML from those same modules. See the
[viewer documentation](docs/tools/ten-viewer/README.md) for format support,
limitations, verification and same-origin iframe integration.
