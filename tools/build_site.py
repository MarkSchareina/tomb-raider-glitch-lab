"""Build the English static guide draft. Python standard library only."""
from pathlib import Path
import html
import os
import json

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
CHAIN = 'glitches/flare-climb-slide-load'
NEVADA = CHAIN + '/tr3r/nevada-quick-quad-access'
MUD = CHAIN + '/tr3r/temple-mudslide'
CATALOG = json.loads((ROOT / 'content/catalog.json').read_text(encoding='utf-8'))
GUIDES = {}
for entry in CATALOG:
    if 'guide_source' not in entry:
        continue
    guide = json.loads((ROOT / 'content' / entry['guide_source']).read_text(encoding='utf-8'))
    approval = guide['approval']
    if approval['status'] != 'approved' or guide['language'] != 'en':
        raise ValueError('Only approved English guide revisions may be built: ' + guide['id'])
    if not approval['date'] or not approval['scope'] or not (ROOT / approval['evidence']).is_file():
        raise ValueError('Missing approval scope, date or evidence: ' + guide['id'])
    GUIDES[entry['path']] = guide
    entry.update(status=guide['status'], summary=guide['summary'])
BY_PATH = {entry['path']: entry for entry in CATALOG}

def url(source, target):
    return os.path.relpath(DOCS / target, DOCS / source).replace('\\', '/')

def link(source, target, text):
    return f'<a href="{url(source, target)}/index.html">{text}</a>'

def page(path, title, intro, body):
    entry = BY_PATH.get(path)
    if entry and entry['type'] == 'Application':
        title = f"{entry['game']} · {entry['level']} — {entry['title']}"
    metadata = ''
    if entry:
        metadata = '<dl class="guide-meta">' + ''.join('<div><dt>'+html.escape(label)+'</dt><dd>'+html.escape(entry[key])+'</dd></div>' for label,key in [('Type','type'),('Game','game'),('Level','level'),('Technique','technique'),('Status','status')]) + '</dl>'
    video_markup = ''
    video = GUIDES.get(path, {}).get('video')
    if video:
        video_src = html.escape(url(path, video['src']), quote=True)
        poster = html.escape(url(path, video['poster']), quote=True)
        video_markup = '<section id="video" class="guide-video"><h2>Watch the route</h2><video controls playsinline preload="metadata" poster="' + poster + '" aria-label="' + html.escape(video['title'], quote=True) + '"><source src="' + video_src + '" type="video/mp4"><a href="' + video_src + '">Open the video</a></video></section>'
    intro_image = ''
    pictures = GUIDES.get(path, {}).get('intro_images', [])
    if pictures:
        intro_image = '<div class="intro-gallery">'
        for picture in pictures:
            caption = html.escape(picture['caption'], quote=True)
            intro_image += '<button type="button" class="step-image intro-image" data-step-image data-caption="' + caption + '" aria-label="' + html.escape('Enlarge image: ' + picture['caption'], quote=True) + '" aria-haspopup="dialog" aria-controls="step-image-dialog">'
            intro_image += '<img src="' + html.escape(url(path, picture['src']), quote=True) + '" alt="' + html.escape(picture['alt'], quote=True) + '" width="1590" height="945"><span>' + caption + ' · View image ↗</span></button>'
        intro_image += '</div>'
    dest = DOCS / path / 'index.html'
    dest.parent.mkdir(parents=True, exist_ok=True)
    nav = ' · '.join([link(path, '', 'Home'), link(path, 'glitches', 'Glitches'), link(path, 'games', 'Games'), link(path, 'technical', 'Technical')])
    dest.write_text(f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="{html.escape(intro, quote=True)}"><title>{html.escape(title)} · Tomb Raider Glitch Lab</title><link rel="stylesheet" href="{url(path, 'assets/site.css')}"></head>
<body><a class="skip" href="#content">Skip to content</a><header class="wrap"><a class="brand" href="{url(path, '')}/index.html">TOMB RAIDER <span>GLITCH LAB</span></a><nav aria-label="Main navigation">{nav}</nav></header>
<main id="content" class="wrap"><section class="compact-hero"><p class="eyebrow">Remastered · Reproduce & understand</p><h1>{title}</h1><p class="lead">{intro}</p>{video_markup}{intro_image}{metadata}</section>{body}</main>
<footer class="wrap"><span>Tomb Raider Glitch Lab · 2026</span><span>Each guide distinguishes verified results from pending work.</span></footer></body></html>''', encoding='utf-8')

def steps(items):
    return '<ol class="steps">' + ''.join(f'<li><div><h3>{a}</h3><p>{b}</p></div></li>' for a,b in items) + '</ol>'

def card(source, target, title, text):
    entry = BY_PATH.get(target)
    if entry:
        title = entry['title']
        text = entry['summary']
        label = html.escape(entry['level'])
        game_badge = '<span class="game-badge" data-game="' + html.escape(entry['game'], quote=True) + '">' + html.escape(entry['game']) + '</span>'
        pictures = GUIDES.get(target, {}).get('intro_images', [])
        thumbnail = entry.get('thumbnail') or (pictures[0]['src'] if pictures else None)
        if thumbnail:
            visual = '<img src="'+html.escape(url(source, thumbnail), quote=True)+'" alt="" loading="lazy" width="640" height="360">'
        else:
            visual = '<span class="tile-placeholder" aria-hidden="true"><span>'+html.escape(entry['level'] if entry['type'] == 'Application' else 'Flare / Slide / Load')+'</span><small>'+('Preview coming soon' if entry['type'] == 'Application' else 'Technique explained')+'</small></span>'
        return '<article class="gallery-card"><div class="tile-visual">'+visual+game_badge+'<span class="tile-badge">'+html.escape(entry['type'])+'</span></div><div class="tile-copy"><p class="eyebrow">'+label+'</p><h3>'+link(source,target,html.escape(title))+'</h3><p>'+html.escape(text)+'</p><p class="note">'+html.escape(entry['status'])+'</p><span class="tile-action" aria-hidden="true">'+('Explore technique' if entry['type'] == 'Glitch' else 'View walkthrough')+' ↗</span></div></article>'
    return '<article><h3>'+link(source,target,title)+'</h3><p>'+text+'</p></article>'

def catalogue(source, entries, interactive=False):
    result = ''
    if interactive:
        result += '<form data-catalog-controls class="catalog-controls" role="search"><label>Search guides<input name="query" type="search" placeholder="Try Temple Ruins, flare or quad"></label><label>Game<select name="game"><option value="">All games</option><option>TR1R</option><option>TR2R</option><option>TR3R</option></select></label><label>Type<select name="type"><option value="">All types</option><option>Glitch</option><option>Application</option></select></label><button type="reset">Clear filters</button></form><p data-result-count role="status" aria-live="polite">'+str(len(entries))+' results</p>'
    result += '<div class="ingredients catalog-grid">'
    for e in entries:
        search = ' '.join([e[k] for k in ('title','game','level','technique','status','summary')]+e['tags'])
        content = card(source,e['path'],e['title'],e['summary'])
        attrs = ' data-catalog-entry data-game="'+html.escape(e['game'],quote=True)+'" data-type="'+html.escape(e['type'],quote=True)+'" data-search="'+html.escape(search,quote=True)+'"'
        result += content.replace('<article ', '<article'+attrs+' ', 1)
    result += '</div>'
    if interactive:
        result += '<p data-no-results hidden>No matching guides. Try a different term or clear the filters.</p><script defer src="'+url(source,'assets/catalog.js')+'"></script>'
    return result

page('', 'Find your next route.', 'Search Tomb Raider glitches and discover where to use them.',
    '<section class="discovery"><h2 class="sr-only">Search the collection</h2>'+catalogue('',CATALOG,True)+'</section><section class="browse-links"><h2>Explore by game</h2><p>'+link('','tr1r','Tomb Raider I')+' · '+link('','tr2r','Tomb Raider II')+' · '+link('','tr3r','Tomb Raider III')+'</p><p class="note">Glitches explain the technique. Applications show the exact route in a specific level.</p></section><section><h2>Level inspection</h2><p>'+link('','tools/ten-viewer','Open Glitch Lab · Level Inspector')+'</p><p>Inspect a local TombEngine 1.10.1 level with textures, geometry, bounds, triggers and a minimap. Drop a TEN file into the viewer; it stays on your device.</p></section><section><h2>Technical reference</h2><p>'+link('','technical','Game-specific offsets, Cheat Engine and live Lua automation →')+'</p></section>')
page('glitches','Glitch catalogue','Complete techniques, their requirements and confirmed game compatibility.', '<section>'+catalogue('glitches',[e for e in CATALOG if e['type']=='Glitch'])+'</section>')
page('games','Browse by game','Find applications by their Remastered game and level.', '<section><div class="ingredients">'+''.join(card('games',f'tr{i}r',f'TR{i}R', 'Browse documented applications.' if i==3 else 'No verified applications documented yet.') for i in (1,2,3))+'</div></section>')

page(CHAIN,'Flare Climb + Slide-Load','One complete technique: prepare a crouched state, slide, then load.',
    '<p class="status"><strong>Confirmed:</strong> TR3R in the applications below. <strong>Untested:</strong> TR1R and TR2R.</p><section><h2>Quick Reproduce</h2>'+steps([
        ('Prepare the crouched state','At a suitable slope, repeatedly drop and pick up a flare while crouching. Buffer the final pickup through the inventory until Lara visibly drops into the crouch animation. Save that state.'),
        ('Establish the slide','Load a prepared starting save at the appropriate opposing slope and actually start sliding.'),
        ('Load the crouch save','While sliding, load the prepared crouch save. In the tested routes, this allows Lara to reach the upper surface.')])+
    '<p class="note">This is the shared sequence, not a universal input recipe. Exact positions, angles, counts and sliding directions belong to each application.</p></section><section><h2>Applications</h2><div class="ingredients">'+card(CHAIN,MUD,'Temple Mudslide','Preparation and reproduction in the temple.')+card(CHAIN,NEVADA,'Nevada – Quick Quad Access Flare Climb','A confirmed central landing on the platform.')+'</div></section><section><h2>How it works</h2><details open><summary>Why this is one guide</summary><p>The flare cycle produces the required elevated crouched state. The subsequent slide/load transition completes the route. Slide-load is documented here as a phase of the technique rather than as an independently useful glitch.</p></details><details><summary>Evidence and scope</summary><p>Successful endpoints have been observed in TR3R. Read-only telemetry confirmed the crouch state and animation. The result depends on the saved state and the surrounding geometry; a high-looking pose alone is insufficient.</p><p>The tested installation uses tank controls on Windows. Its exact game build and compatibility with other platforms are not documented yet.</p></details><p>'+link(CHAIN,'technical/tr3r','TR3R measurement tools and offsets →')+'</p></section>')

def approved_setup_body(guide):
    escape = html.escape
    approval = guide['approval']
    body = '<p class="status"><strong>Setup revision ' + str(guide['revision']) + ' · approved ' + escape(approval['date']) + '.</strong> ' + escape(approval['scope']) + '</p>'
    body += '<section id="quick"><h2>Quick Reproduce</h2>'
    if len(guide['step_images']) != len(guide['steps']):
        raise ValueError('Each Setup step needs an image or placeholder')
    body += '<ol class="steps illustrated-steps">'
    for number, ((title, text), picture) in enumerate(zip(guide['steps'], guide['step_images']), 1):
        caption = f'Step {number:02d} · {title}'
        body += '<li><div><div class="step-copy"><h3>' + escape(title) + '</h3><p>' + escape(text) + '</p>'
        substeps = guide.get('step_lists', {}).get(str(number), [])
        if substeps:
            body += '<ol class="step-substeps">' + ''.join('<li>' + escape(item) + '</li>' for item in substeps) + '</ol>'
        note = guide.get('step_notes', {}).get(str(number))
        if note:
            body += '<p>' + escape(note) + '</p>'
        body += '</div>'
        body += '<button type="button" class="step-image" data-step-image data-caption="' + escape(caption, quote=True) + '" aria-label="' + escape('Enlarge image: ' + title, quote=True) + '" aria-haspopup="dialog" aria-controls="step-image-dialog">'
        body += '<img src="' + escape(url(NEVADA, picture['src']), quote=True) + '" alt="' + escape(picture['alt'], quote=True) + '" width="960" height="540" loading="lazy"><span>View image ↗</span></button></div></li>'
    body += '</ol></section>'
    result = guide.get('result')
    if result:
        picture = result['image']
        body += '<section class="guide-result"><h2>' + escape(result['title']) + '</h2><p>' + escape(result['text']) + '</p>'
        body += '<button type="button" class="step-image" data-step-image data-caption="' + escape(result['title'], quote=True) + '" aria-label="Enlarge final result image" aria-haspopup="dialog" aria-controls="step-image-dialog">'
        body += '<img src="' + escape(url(NEVADA, picture['src']), quote=True) + '" alt="' + escape(picture['alt'], quote=True) + '" width="960" height="540" loading="lazy"><span>View image ↗</span></button></section>'
    body += '<dialog id="step-image-dialog" class="image-dialog" data-image-dialog aria-labelledby="step-image-caption"><button type="button" class="image-close" aria-label="Close image" autofocus>Close ×</button><img alt=""><p id="step-image-caption" data-image-caption></p><p class="image-hint">Click anywhere or press Esc to close</p></dialog>'
    body += '<script defer src="' + url(NEVADA, 'assets/step-images.js') + '"></script>'

    body += '<section><h2>Details &amp; evidence</h2>'
    for title, text in guide['details']:
        body += '<details><summary>' + escape(title) + '</summary><p>' + escape(text) + '</p></details>'
    body += '<details><summary>Measurements</summary><p>All checkpoints are in room 116. More positive Y means downward movement. These measurements support the manual instructions above.</p><div class="table-scroll"><table><thead><tr><th>Checkpoint</th><th>X / Y / Z</th><th>Yaw</th><th>State / animation / frame</th></tr></thead><tbody>'
    for row in guide['measurements']:
        body += '<tr>' + ''.join('<td>' + escape(value) + '</td>' for value in row) + '</tr>'
    body += '</tbody></table></div></details><p>' + link(NEVADA, CHAIN, 'Shared glitch explanation') + ' · ' + link(NEVADA, 'technical/tr3r', 'TR3R offsets and bridge') + '</p></section>'
    return body

page(NEVADA, 'TR3R Nevada – Quick Quad Access Flare Climb', GUIDES[NEVADA]['intro'], approved_setup_body(GUIDES[NEVADA]))

page(MUD,'TR3R Temple Mudslide','The first documented application of this glitch chain.',
    '<section><h2>Quick Reproduce</h2>'+steps([('Prepare the lower setup','Use the lower starting position and alignment described in the published guide.'),('Create the crouch save','Perform the flare cycles, pause the final pickup and buffer into crouch. Save that state.'),('Slide and load','Load the prepared slope start, actually slide, then load the crouch save and leave the upper area.')])+'<p class="note">This overview does not replace the exact published input sequence. The existing walkthrough remains the detailed reference.</p><a class="button" href="https://MarkSchareina.github.io/tr3-temple-mudslide-delivery-package/">Open the published guide & videos ↗</a></section><section><h2>Details & evidence</h2><p>The existing pages and recordings remain at their published location for now. Their current links are preserved; full migration will follow.</p><p>'+link(MUD,CHAIN,'Shared glitch explanation')+' · '+link(MUD,'technical/tr3r','TR3R measurement tools')+'</p></section>')

for i in (1,2,3):
    path=f'tr{i}r'
    applications = [e for e in CATALOG if e['type'] == 'Application' and e['game'] == f'TR{i}R']
    body='<section><h2>Applications</h2><p>Level-specific routes with the setup, inputs and expected result.</p>'+catalogue(path, applications, True)+'</section>' if applications else '<section><p>No verified applications have been documented here yet. A working technique in another game does not establish compatibility with this game.</p></section>'
    page(path,f'TR{i}R',f'Tomb Raider {i} Remastered · Applications',body+'<p>'+link(path,f'technical/tr{i}r',f'TR{i}R technical reference')+'</p>')

page('technical','Technical reference','Cheat Engine, game-specific offsets and the future live Lua automation workflow.',
    '<section><h2>Level inspection</h2><p>'+link('technical','tools/ten-viewer','Glitch Lab · Level Inspector: open a local TEN or TR3 level')+'</p><p>Standalone browser inspection for TEN 1.10.1.0 and TR3 PC levels. No upload or game installation required.</p></section><section><h2>Choose a game</h2><div class="ingredients">'+''.join(card('technical',f'technical/tr{i}r',f'TR{i}R', 'Local measurements and bridge behavior documented.' if i==3 else 'Reserved for independently verified locators and offsets.') for i in (1,2,3))+'</div></section><section><h2>Live automation</h2><p>'+link('technical','technical/lua-automation','Lua bridge, replay recipes and recording checkpoints →')+'</p><p>Shared orchestration, separate game adapters. Existing measurements and planned capabilities are clearly distinguished.</p></section><section><h2>Documentation rules</h2><p>Every offset needs a game, process, module, base definition and data type. Record the build, identity checks and verification status. Never assume offsets carry across games or updates.</p><p>Keyboard-only reproduction must be distinguished from a test that externally sets the starting position.</p></section>')

for i in (1,2):
    page(f'technical/tr{i}r',f'TR{i}R · Technical reference', 'No verified memory locator or bridge adapter is available here yet.', '<section><p>After measurement, this page will document the process and module, validated locator, field offsets and supported tools. TR3R offsets are not reused as placeholders.</p></section>')

fields=[('X','+0 / +0x00','int32'),('Y','+4 / +0x04','int32'),('Z','+8 / +0x08','int32'),('Yaw','+14 / +0x0E','int16'),('Current state','−70 / −0x46','int16'),('Goal state','−68 / −0x44','int16'),('Animation','−64 / −0x40','int16'),('Frame','−62 / −0x3E','int16'),('Room','−60 / −0x3C','int16')]
page('technical/tr3r','TR3R · Cheat Engine & offsets','Measured fields from the local Windows installation and the existing Lua bridge.',
    '<p class="status">Observed locally. An exact build number and module hash have not been recorded on this page; these are not version-independent addresses.</p><section><h2>Read Lara’s state</h2><p>CE process: <code>tomb123.exe</code>. Module: <code>tomb3.dll</code>. Observed locator:</p><pre><code>["tomb3.dll"+3D4D30]+58</code></pre><p><strong>Base B points to Lara’s X field</strong>, not the start of the entire object structure. All offsets below are relative to B. Multi-byte values are little-endian and interpreted as signed integers.</p><div class="table-scroll"><table><thead><tr><th>Field</th><th>Offset from B</th><th>Type</th></tr></thead><tbody>'+''.join(f'<tr><td>{a}</td><td><code>{b}</code></td><td>{c}</td></tr>' for a,b,c in fields)+'</tbody></table></div><p>Source: the locally used <code>ce_lara_resolver.lua</code>. Loading can move B. The resolver detects this and normally requires validation and a bridge reload; its explicit reproduction mode also checks locator and identity fields.</p><p>Yaw uses 65536 units per revolution; −3250 is approximately −17.85°. In these measured coordinates, a more negative Y value is higher.</p></section><section><h2>Bridge and reproduction status</h2><p>The local bridge checks process identity and game focus. It releases held keys on abort. UI timers are used: millisecond arguments are not a frame-accurate guarantee.</p><p><code>SET</code> is a separate research operation. It must not appear in evidence claimed to be a keyboard-only replay. A historical Nevada reference used it at the lower start. The approved Setup revision 1 uses keyboard inputs for positioning and ascent without position or yaw writes.</p><p>Local bindings: action E, crouch Y, weapons Space, flare comma, inventory Esc. These are not claimed as default bindings.</p><p>'+link('technical/tr3r','technical/lua-automation','Live Lua automation design →')+' · '+link('technical/tr3r',NEVADA,'Nevada Quick Reproduce →')+'</p></section>')

page('technical/lua-automation','Live Lua automation','A planned replay and recording workflow built around the existing local CE bridge.',
    '<p class="status"><strong>Existing:</strong> local input/telemetry bridge and guarded experiments. <strong>Planned:</strong> portable adapters, reusable replay recipes and a live control panel.</p><section><h2>The intended workflow</h2>'+steps([('Observe','Resolve the game-specific locator and read position, room, angle and animation. Confirm the expected starting state.'),('Replay','Execute a bounded sequence of keyboard inputs. Wait for each acknowledgement and check the resulting state.'),('Verify and pause','Stop at a meaningful checkpoint: pickup count, crouch transition or upper landing. Unexpected state or focus loss pauses the run.'),('Record','Capture the agreed demonstration only after a successful rehearsal. Associate video checkpoints with telemetry events.')])+'</section><section><h2>Keep three responsibilities separate</h2><div class="ingredients"><article><h3>Game adapter</h3><p>TR1R, TR2R or TR3R identity checks, locator, offsets and state names. Only TR3R has measured values in this draft.</p></article><article><h3>Replay recipe</h3><p>Application-specific prerequisites, inputs, expected checkpoints and stopping conditions. No hidden position or animation writes in a keyboard-only recipe.</p></article><article><h3>Local runner</h3><p>Owns one command at a time, validates acknowledgements, logs evidence and coordinates recording. The planned panel will expose start, pause and stop.</p></article></div></section><section><h2>Existing file protocol</h2><pre><code>session|unique-id|COMMAND|argument\n\nProtocol examples:\nsession|unique-id|READ|0\nsession|unique-id|BUFFERDUCK|180</code></pre><p><code>session</code> and <code>unique-id</code> above are placeholders, not ready-to-run commands.</p><ul><li><code>ce_bridge_command.txt</code>: a command tied to the current session.</li><li><code>ce_bridge_status.txt</code>: matching acknowledgement; states include RUNNING, DONE, REJECTED, PAUSED and STOPPED.</li><li><code>ce_bridge_stop.txt</code>: session-tagged stop request.</li></ul><p>The client waits for DONE before replacing a command. A load can invalidate the locator. Do not silently resume a run against an unverified pointer.</p></section><section><h2>Before a public automation package</h2><ul><li>Remove machine-specific paths and define explicit per-game configuration.</li><li>Record executable/module versions or hashes with offset verification.</li><li>Integrate the approved Nevada Setup into the runner and independently validate the complete replay. Manual approval does not validate the older Lua runner.</li><li>Keep research writes separate from input-only replay mode.</li><li>Document the recording backend, stop behavior and manual save/load boundaries.</li></ul><p>This website is static documentation. It does not connect to Cheat Engine or control the game. No portable Lua package or live web panel is included yet.</p></section>')

for old,new in [('tr1','tr1r'),('tr2','tr2r'),('tr3','tr3r'),('tr3/temple-mudslide',MUD),('tr3/nevada-quick-quad-access',NEVADA),('techniques/flare-climb-slide-load',CHAIN)]:
    page(old,'This page has moved','There is now one canonical copy in the shared guide structure.', '<section><p>'+link(old,new,'Open the current page →')+'</p></section>')

for path in (CHAIN+'/media/tr3r',MUD+'/media',NEVADA+'/media','tr3/nevada-quick-quad-access/media'):
    p=DOCS/path;p.mkdir(parents=True,exist_ok=True)
    if not (p/'README.md').exists():
        (p/'README.md').write_text('Media for this guide. Reuse links to application videos rather than duplicating files on the shared glitch page.\n',encoding='utf-8')

print('English draft generated:',DOCS/'index.html')

# Generate the offline viewer from the same modules served by Pages.
from build_ten_viewer import build as build_viewer
build_viewer()
