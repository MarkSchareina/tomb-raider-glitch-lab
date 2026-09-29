"""Optional loopback preview. Offline users can open standalone.html directly."""
import argparse
import functools
import http.server
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--open', action='store_true')
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(
        ('127.0.0.1', args.port), functools.partial(Handler, directory=str(ROOT / 'docs')))
    url = f'http://127.0.0.1:{server.server_port}/tools/ten-viewer/'
    print(url, flush=True)
    if args.open:
        threading.Timer(.3, lambda: webbrowser.open(url)).start()
    server.serve_forever()
