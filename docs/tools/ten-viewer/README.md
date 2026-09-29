# Glitch Lab · Level Inspector

This directory is the **only maintained viewer source**. It replaces the viewer
previously developed inside the Only Up export project. No game assets are shipped.

## Use

- On the Glitch Lab website: open `tools/ten-viewer/`, then **Open level…**, or
  drag one `.ten` or TR3 `.tr2` file onto the page.
- Offline: download `standalone.html`, optionally rename it to `Glitch-Lab-Level-Inspector.html`,
  and double-click it. No server, installation, Python or internet is required.
- The readable `index.html` uses ES modules and is served over HTTP(S). For
  `file://`, use the generated `standalone.html` instead.

The level stays on the user's device. The parser runs in a dedicated worker and
never executes embedded Lua or any game code. A new import replaces the current
scene; rejected files leave the current scene available. Use **Cancel import**
to stop an import.

Reloading the same browser tab restores the last successfully opened level and
its camera, room/sector selection, display settings and room search. The file is
cached locally in IndexedDB; a sessionStorage key associates it with this tab.
No file is uploaded. New independent tabs start empty. Browser session recovery
may also recover this state. Abandoned binary cache entries expire after seven
days and are removed on a subsequent viewer visit. If browser storage is blocked
or full, manual import still works and the viewer reports that reload recovery
is unavailable. This also applies to the offline viewer where supported by the
browser's local-file storage policy.

Supported: **TEN 1.10.1.0**, embedded PNG atlases, and **TR3 PC** classic data,
including the `.TR2` levels shipped with Tomb Raider I–III Remastered. These use
their classic embedded textures, not the separate Remastered HD assets. Detection
uses binary signatures, not extensions: a TR2-game file is still rejected even
though it has the same suffix. TR1 and console layouts are not supported yet.
Import limits: 512 MiB input, 384 MiB per
decompressed block, 768 MiB total decompressed data. Larger levels also need
sufficient browser memory and GPU resources. Tested on desktop Edge/Chromium.

The viewer shows static room geometry, textures, object reference poses,
reference/static bounds, raw trigger sectors, portals, event volumes and a
selectable minimap. It does not simulate gameplay, Lua, animation, dynamic
collision, special Lara skinning or engine lighting. TEN trigger action lists are
not decoded. TR3 adds decoded floor-data functions, trigger types/actions, slope
values and ceiling portals to sector inspection. Trigger geometry is a static
floor-plane visualization, not a simulation of runtime collision. Animated
textures and sprites use their reference frame. Event volumes do not exist in
TR3; that control is disabled. The level file is enough; external scripts and
game installation are not needed.

## Format architecture

`LevelParser` defines `matches(bytes)` and `parse(buffer, source, progress)`.
`TENParser` in `ten-parser.js` owns TEN compression, records and sector-plane
interpretation. `TR3Parser` in `tr3-parser.js` owns TR3 records, A1R5G5B5 textures,
UVs, palette faces, packed frame rotations, sprites and floor-data interpretation.
Neither parser imports Three.js or uses the DOM.

Both adapters normalize their data for `SceneBuilder` (`scene-builder.js`):
native X/Y/Z positions with 1024 units per sector, rooms and polygon buckets,
object hierarchies/reference frames, bounds, portals, explicit trigger triangles
and normalized `mapSectors`. Format-specific inspector details are supplied as
plain `inspection` strings. The builder returns one scene contract: `nodes`,
typed geometry `meshes`, `materials`, `images` and `meta`. Images are encoded PNG
bytes or `{data, width, height}` RGBA pixels. Geometry uses X/−Y/−Z world coordinates.
Metadata includes a format label and capability flags; the UI never decodes a
binary record or switches on a game version.

`level-formats.js` registers parser classes and detects the signature.
`level-worker.js` runs that registry; `level-import.js` constructs Three.js objects
from its result. `app.js`, the minimap and sector inspector are shared. The old
`ten-import.js`/`ten-worker.js` names are compatibility entry points only.
The offline builder bundles the same worker dependency graph. To add TR1 later,
implement a new adapter and register its class; do not fork the renderer.

Layout/behavior references used for TR3: the local tomb3 source's
`specific/file.cpp`, `game/control.cpp`, and trview's
`trlevel/Level_tr3_pc.ixx`, `trlevel/trtypes.ixx` and `trlevel/Level.cpp`.

## One source, two outputs

Edit the JS/CSS/HTML here. Do **not** edit `standalone.html` by hand.

```sh
python tools/build_ten_viewer.py
# Or build the complete site, including the offline viewer:
python tools/build_site.py
python tools/check_links.py
python tools/check_content.py
```

The standalone builder embeds the same modules, CSS and worker in one HTML file;
it uses only the Python standard library at build time. The generated file is
checked in so the website's offline download works directly on GitHub Pages.
All website resources use relative URLs, including under repository subpaths.

## Embed in a lab page

Use an iframe pointing to the canonical viewer. Adjust the relative path for
the containing page. The normal Open/drop controls work within the frame.

```html
<iframe id="levelViewer" src="../../tools/ten-viewer/"
        title="TEN level inspector" allow="fullscreen"
        style="width:100%;height:800px;border:0"></iframe>
```

For a shared file picker in a **same-origin** parent page, wait for
`ten-viewer:ready`, then send a browser `File` object:

```js
const frame = document.getElementById('levelViewer');
window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
  if (event.data.type === 'ten-viewer:ready') {
    // Enable your own picker; pass its selected File in your change handler.
  }
  if (event.data.type === 'ten-viewer:loaded') {
    console.log(event.data.name, event.data.rooms, event.data.objects);
  }
});
function openLevel(file) {
  frame.contentWindow.postMessage({type:'ten-viewer:open', file}, location.origin);
}
function showSector(room, x, z) {
  frame.contentWindow.postMessage({type:'ten-viewer:select', room, sector:[x,z]}, location.origin);
}
```

The frame validates parent identity and origin. Cross-origin commands and
`file://` message integration are disabled. Offline Open/drop still work.
For direct same-page integration, `window.tenViewer` exposes `openFile(file)`,
`selectRoom(id)` and `selectSector(x,z)` after initialization.

## Verification

```sh
node tests/check-ten-parser.mjs
node tests/check-tr3-parser.mjs
```

For the full browser regression suite, install Playwright in your development
environment, have Edge installed, and set `TEN_LEVEL` to the local Only Up TEN
1.10.1.0 test fixture. Alternatively, `PLAYWRIGHT_PATH` can point to an existing
Playwright package. Run `node tests/check-ten-viewer.cjs`.

Set `TR3_LEVEL` to the local `3/DATA/JUNGLE.TR2` fixture, then run
`node tests/check-tr3-parser.mjs` and `node tests/check-tr3-viewer.cjs`.
The latter checks file/drop import, all three display modes, floor-data inspection,
format capabilities, tab reload, invalid/cancelled imports and offline operation.
Set `TEN_LEVEL` as well to cover TEN→TR3 switching in the same renderer.
JUNGLE has 165 rooms, 142 items and 11 texture pages. All 22 `.TR2` files from the
local Remastered TR3 DATA directory also passed parser smoke checks; this is not
a claim of visual or runtime equivalence for every level. No game assets are
included in the repository.

The test serves a nested Pages-like path and tests the actual `file://` offline
HTML with HTTP requests blocked. It covers file selection, drag/drop, repeated
imports, invalid/truncated files, cancellation and the existing viewer controls.
Outputs go to ignored `qa/`. No TEN fixture is committed.

Set `TEN_BASELINE` to the old Python export directory when running the parser
test to compare room metadata and every geometry/UV buffer against that export.

Three.js is vendored under its MIT license in `vendor/THREE-LICENSE.txt`; the
license is also embedded in the generated standalone HTML.

## Credits and license notices

The **About & licenses** button names this tool **Glitch Lab · Level Inspector**.
`viewer-info.js` holds the display name, attribution, upstream links and complete
local license snapshots (reviewed 2026-09-29). The same module is embedded in the
offline HTML, so reading notices never requires a network connection.

- Bundled: Three.js r180 and its OrbitControls, MIT (2010–2025 three.js authors).
- Technical/visual reference: trview, MIT (2018 trview team).
- TEN format reference: TombEngine, modified MIT for non-commercial use only
  (2025 Tomb Engine Team), not standard MIT.
- TR3 layout/behavior reference: tomb3, GNU GPL v3.

The native engines and the dependencies inside their repositories are not shipped
with this viewer. Python (build) and Playwright (QA) are development tools, not
bundled browser components. Browser APIs and the viewer's LZ4 block decoder do not
introduce an external JavaScript runtime package. Game assets are user-supplied.

No project-wide license for the viewer-specific code is selected by these notices.
Attribution alone does not establish permission to relicense any adapted code;
source provenance and applicable terms must inform that separate choice. The name
is an independent project name, not an assertion of endorsement by the referenced
projects. The existing `tools/ten-viewer/` URL and integration API remain stable.
