"""Check local HTML href/src targets including directory index pages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1] / 'docs'
errors = []

class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ('href', 'src') or not value:
                continue
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue
            if url.path.startswith('/'):
                errors.append(f'{self.page}: root-relative URL {value}')
                continue
            target = (self.page.parent / unquote(url.path)).resolve()
            if target.is_dir():
                target /= 'index.html'
            if not target.is_file():
                errors.append(f'{self.page}: missing {value}')

pages = list(root.rglob('*.html'))
for page in pages:
    parser = Links()
    parser.page = page
    parser.feed(page.read_text(encoding='utf-8'))
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {len(pages)} HTML pages; all local links and resources resolve.')
