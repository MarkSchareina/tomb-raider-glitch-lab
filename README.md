# Tomb Raider Glitch Lab

Glitch guides, research notes and interactive level inspection for Tomb Raider.
The initial focus is Tomb Raider I–III Remastered, with separate research cases
for the original games, community engines and custom levels.

**[Explore the Glitch Lab](https://markschareina.github.io/tomb-raider-glitch-lab/)**

## Explore

| Section | What you will find |
| --- | --- |
| [Research catalogue](https://markschareina.github.io/tomb-raider-glitch-lab/research/) | Cases identified by ID and name, including unfinished investigations, evidence gaps and next steps. |
| [Glitch guides](https://markschareina.github.io/tomb-raider-glitch-lab/glitches/flare-climb-slide-load/) | Technique explanations and level-specific applications, including Temple Mudslide and Nevada Quick Quad Access. |
| [Technical reference](https://markschareina.github.io/tomb-raider-glitch-lab/technical/) | Game-specific technical documentation and analysis. |
| [Mechanism reconstructions](https://markschareina.github.io/tomb-raider-glitch-lab/technical/reconstructions/) | Illustrated explanations, including Sophia knockback, with scoped evidence and limitations. |
| [Level Inspector](https://markschareina.github.io/tomb-raider-glitch-lab/tools/level-inspector/) | Explore local level geometry, textures, rooms, sectors, portals and triggers in your browser. |

## Reading the evidence

The catalogue includes **unverified**, **partial** and **reproduced** cases as
well as any fully **verified** results. A listed case is not automatically a
working recipe. A historical reproduction may still lack a qualified proof
video or exact build information; each case states its remaining limitations.

Results are scoped to the game, executable build, level revision and controls.
Tank and Modern Controls are assessed separately. Diagnostic position or state
writes are distinguished from input-only gameplay. Findings from an original
game or community engine do not establish the same behavior in Remastered.

## Level Inspector

Open the [browser viewer](https://markschareina.github.io/tomb-raider-glitch-lab/tools/level-inspector/)
and choose or drop a supported level file. Files are processed locally and are
not uploaded. The viewer supports **TombEngine 1.10.1.0** and **TR3 PC level
data**, including classic `.TR2` levels shipped with Remastered. A `.TR2` suffix
alone does not imply support for the TR2 game format.

For offline use, download [standalone.html](https://markschareina.github.io/tomb-raider-glitch-lab/tools/level-inspector/standalone.html)
and open the saved file in your browser. No installation or local server is
needed. The inspector displays level data; it does not simulate gameplay or
dynamic collision. See the [viewer documentation](docs/tools/level-inspector/README.md)
for format support and limitations. Game assets are not included.

## Preview this repository

This is the **publication repository**. The prepared website is in `docs/` and
can be served directly from a checkout:

```sh
python -m http.server 8080 --directory docs
```

Open [localhost:8080](http://localhost:8080/). No site build is required to preview
the published files.

## Maintenance and publication

The maintained research catalogue and site generator live in a separate research
workspace. Its canonical case records generate the research pages; curated
guides retain their own approval scope. Reviewed, committed site files are
exported into this repository's `docs/` directory.

[PUBLICATION.json](PUBLICATION.json) records source commits and exported file
hashes. Older `content/`, `research/`, `automation/` and `tools/` files remain as
publication history; they are not a complete current research workspace or a
supported way to rebuild the current site.

The publication handoff prepares a local commit on `main`. The operator reviews
and pushes it; local commits do not deploy the website. The documented GitHub
Pages publication source is `main:/docs`.

Only reviewed publication assets belong here. Raw recordings, saves, live
sessions and game installations remain outside the publication export. Files
outside `docs/` are also publicly visible when committed to this repository.
