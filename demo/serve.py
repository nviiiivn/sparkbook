#!/usr/bin/env python3
"""Run sparkbook locally with made-up demo sparks, no backend needed.

    python3 demo/serve.py            # then open http://127.0.0.1:8911/
    python3 demo/serve.py 9000       # another port

Serves the site files from the repo root and answers the three API calls the
page makes (GET /book/sparks, /book/directory, /book/spark/<name>) from
demo/data.json. Point your own backend at the same three routes to use real
data instead.
"""
import json
import pathlib
import sys
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "demo" / "data.json").read_text(encoding="utf-8"))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/book/sparks":
            return self._json({"sparks": [{"name": n, "location": p["identity"].get("location", "")}
                                          for n, p in DATA["profiles"].items()]})
        if path == "/book/directory":
            return self._json(DATA["directory"])
        if path.startswith("/book/spark/"):
            name = urllib.parse.unquote(path[len("/book/spark/"):])
            if name in DATA["profiles"]:
                return self._json(DATA["profiles"][name])
            return self._json({"error": "no spark named " + name}, 404)
        if path.startswith("/demo/") or path.startswith("/.git"):
            self.send_error(404)
            return
        return super().do_GET()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8911
    print(f"sparkbook demo on http://127.0.0.1:{port}/")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
