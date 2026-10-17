# Explanation scenes

Open the matching level, then **Scene & annotations → Load scene**. Save scene
stores the current camera and annotations as JSON. Export PNG renders the saved
output dimensions independently of the browser window. It is a geometry render,
not a screenshot of the surrounding controls.

Scene mode supports orbit, pan and zoom. Disabled controls are dimmed; use
**Return to level** to regain free flight and the entire-level view. Textures,
Colored Geometry and Wireframe apply to the active scene and are saved with it.

## Coordinates and measurements

One square is 1024 world units. Local square indices are zero-based X/Z, with the
room ID retained. The optional world overlay labels X/Z at each square's center;
it does not describe a measured Lara position or floor height. Labels follow the
scene in 3D, including squares revealed by moving the camera.

Waypoint inputs use native **world X/Y/Z**, not room-local squares. Add two points,
then **Measure last two** to display their straight 3D distance in squares and
world units. This is not a navigable route length. New user marks are reported
positions; adding a mark does not establish measured gameplay evidence.

## File format

`format: "glitchlab-scene"`, `version: 1`; required fields include `title`,
`level.sha256`, `rooms` and `camera`. Coordinates use native level units (negative
Y is higher). Camera `up` is a direction in that same coordinate convention.

- `displayMode`: `texture`, `color` or `wire`; `roomColors`: room-ID/hex-color map.
- `camera`: `type` (`orthographic`/`perspective`), `position`, `target`, `up`,
  `span` in level units and optional `fov` in degrees.
- `output`: `width`/`height`; `objects`: selected static-placement item IDs.
- `hideCeilings`: cut away downward-facing room faces; the level is not modified.
- `portals`: `walls` or `none`; `portalLabels`: optional boolean.
- `coordinates`: independent `local` and `world` boolean switches.
- `waypoints`: unique `id`, `position`, `label`, `evidence`.
- `lines`: `kind` (`arrow`, `trace`, `measurement`), `points`, `label`, `evidence`.
- `regions`: `kind` (`square`, `circle`), `center`, `radius`, `label`, `evidence`.
  Square radius is its half-width, not its full width.
- `shapes`: arbitrary indexed triangle meshes with `vertices`, `triangles`,
  `color`, `opacity`, `label`, `evidence`. Faces may be omitted to create open
  volumes. Shapes are annotations, not collision geometry.

Annotations accept optional `color` and `labelPosition`. Evidence categories are
`measured`, `model`, `reported`, `static`. They classify source provenance; the
renderer itself does not verify a claim. Scene validation rejects mismatched level
hashes, unknown rooms, invalid cameras and invalid triangle indices.

## Code-driven rendering through an existing static server

Run `python lab/tools/prepare_render_job.py SCENE.json LEVEL.TR2` from the repository
root. This validates the level hash and prepares an ignored copy of that level
and an atomic job file under `local-assets/`. Do not publish that directory.
No server is started or replaced. Open the existing viewer URL with
`?renderJob=local-assets/job.json`; the viewer processes each new job ID once.
Remove the query parameter to stop watching jobs.

The scene panel contains the rendered PNG preview. Its `src` contains the PNG and
its `data-manifest` contains the exact saved scene, level identity and render
statistics. Export PNG also works without the job interface. The public
`window.tenViewer` API exposes `loadPresentation`, `savePresentation`,
`clearPresentation`, `renderImage` and `levelIdentity`. Optional native browser
tools expose inspection, configuration and roundtrip verification. No pointer or
keyboard automation is required.

The separate `*.render.json` files beside CASE-0016 figures record each export.
GPU/browser revisions may change antialiasing; exact pixels are checked within
the current browser session, not promised across different renderers.

Scenes may supply a `legend` string (up to 220 characters) for the PNG footer. Regions accept `stroke: true` for a solid, visible outline and `labelPosition` for a separate native-coordinate caption anchor. Evidence tags remain required even when colors describe visual roles.

Annotation labels support `\n` line breaks, for example `A · Room 48: 6/8\nX/Z (71039 / 51886)`. Local square indices and exact world coordinates remain distinct.

## SVG export

**Export SVG** saves the current scene and camera at the scene output dimensions. It contains vector room/object faces, lines, arrows and editable text labels, without textures, viewer UI or PNG title/footer. Textured scenes use room colors; texture-only object detail is omitted. The scene background is retained. The API is `tenViewer.renderSVG()`; the native page tool is `scene_export_svg`.

Faces and lines are clipped to the camera frustum; backfaces are culled. Filled faces use approximate painter ordering. Intersecting or transparent surfaces may overlap differently from WebGL, so inspect complex scenes before publication. The exporter does not change the active scene.

SVG export retains the camera-facing room surfaces. Surface edges follow their
faces; opaque foreground faces hide only the covered portions of other edges.
This visibility calculation does not remove complete wall planes or create
openings in the level. Transparent guard shapes and annotation overlays do not
erase background edges. Intersecting filled surfaces still use approximate
painter ordering.

Standalone SVGs fit the browser viewport while preserving the scene aspect ratio and background. Portal outlines use thin non-scaling SVG strokes instead of the 3D cylinders used on screen.
