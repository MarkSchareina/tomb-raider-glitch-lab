"""Validate guide/source consistency and repository Markdown links."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
errors = []


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, value):
        self.parts.append(value)


def normalized(value):
    return ' '.join(value.split())


def page_text(path):
    parser = Text()
    parser.feed(path.read_text(encoding='utf-8'))
    return normalized(' '.join(parser.parts))


catalogue = json.loads((ROOT / 'content/catalog.json').read_text(encoding='utf-8'))
for entry in catalogue:
    if 'guide_source' not in entry:
        continue
    source = json.loads((ROOT / 'content' / entry['guide_source']).read_text(encoding='utf-8'))
    if 'status' in entry or 'summary' in entry:
        errors.append(f"{entry['path']}: duplicated guide status or summary in catalogue")
    approval = source['approval']
    if source['language'] != 'en' or approval['status'] != 'approved':
        errors.append(f"{source['id']}: source is not an approved English guide")
    for field in ('date', 'approved_by', 'scope', 'evidence'):
        if not approval.get(field):
            errors.append(f"{source['id']}: missing approval {field}")
    if not (ROOT / approval['evidence']).is_file():
        errors.append(f"{source['id']}: missing approval evidence")
    rendered = page_text(ROOT / 'docs' / entry['path'] / 'index.html')
    expected = [source['intro'], source['status'], approval['scope'],
                f"Setup revision {source['revision']} · approved {approval['date']}."]
    for group in ('steps', 'details', 'measurements'):
        expected.extend(value for row in source[group] for value in row)
    for items in source.get('step_lists', {}).values():
        expected.extend(items)
    expected.extend(source.get('step_notes', {}).values())
    if source.get('result'):
        expected.extend(source['result'][key] for key in ('title', 'text'))
    for value in expected:
        if normalized(value) not in rendered:
            errors.append(f"{source['id']}: generated HTML is missing {value!r}")
    for page in ('index.html', f"{entry['game'].lower()}/index.html"):
        text = page_text(ROOT / 'docs' / page)
        for value in (source['status'], source['summary']):
            if normalized(value) not in text:
                errors.append(f'{page}: stale guide metadata')

for folder in ('research', 'content', 'automation'):
    for path in (ROOT / folder).rglob('*.md'):
        content = path.read_text(encoding='utf-8')
        for value in re.findall(r'\[[^\]\n]+\]\(([^)\n]+)\)', content):
            link = urlsplit(value)
            if link.scheme or link.netloc or not link.path:
                continue
            if not (path.parent / unquote(link.path)).exists():
                errors.append(f'{path.relative_to(ROOT)}: missing {value}')

if errors:
    raise SystemExit('\n'.join(errors))
print('PASS: approved source matches HTML and catalogue; research/content/automation links resolve.')
