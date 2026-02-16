import json
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

from export_events import updateEvents
from note import log_note
from rewind7am import rewindTime

IP = "127.0.0.1"
PORT = 8080
if len(sys.argv) > 1:
    PORT = int(sys.argv[1])

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
RENDER_DIR = os.path.join(ROOT_DIR, "render")
LOG_DIR = os.path.join(ROOT_DIR, "logs")

# Ensure relative paths in updateEvents/log_note resolve to this project root.
os.chdir(ROOT_DIR)
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(RENDER_DIR, exist_ok=True)


def coerce_int(value, fallback=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


class CustomHandler(SimpleHTTPRequestHandler):
    def parse_post_payload(self):
        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length) if content_length > 0 else b""
        content_type = (self.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()

        if content_type == "application/json":
            try:
                data = json.loads(raw.decode("utf-8"))
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                return {}

        if content_type == "application/x-www-form-urlencoded":
            parsed = parse_qs(raw.decode("utf-8"), keep_blank_values=True)
            return {k: v[0] if isinstance(v, list) and v else "" for k, v in parsed.items()}

        return {}

    def write_text(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))

    def do_POST(self):
        try:
            data = self.parse_post_payload()

            if self.path == "/refresh":
                updateEvents()
                self.write_text(200, "OK")
                return

            if self.path == "/addnote":
                note = str(data.get("note", ""))
                note_time = coerce_int(data.get("time"), None)
                log_note(note, note_time)
                updateEvents()
                self.write_text(200, "OK")
                return

            if self.path == "/blog":
                post = str(data.get("post", ""))
                post_time = coerce_int(data.get("time"), None)
                if post_time is None:
                    self.write_text(400, "Missing or invalid blog time")
                    return

                t_day = rewindTime(post_time)
                blog_path = os.path.join(LOG_DIR, f"blog_{t_day}.txt")
                with open(blog_path, "w", encoding="utf-8", errors="replace") as f:
                    f.write(post)

                updateEvents()
                self.write_text(200, "OK")
                return

            self.write_text(404, "Unknown endpoint")

        except Exception as exc:
            print(f"server error: {exc}")
            self.write_text(500, f"ERROR: {exc}")


Handler = partial(CustomHandler, directory=RENDER_DIR)
httpd = ThreadingHTTPServer((IP, PORT), Handler)
print(f"Serving Prolific at http://localhost:{PORT}")
httpd.serve_forever()
