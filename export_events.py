import glob
import json
import os
import re
from datetime import datetime

LOG_GLOBS = (
    "logs/window_*.txt",
    "logs/keyfreq_*.txt",
    "logs/notes_*.txt",
    "logs/blog_*.txt",
)
LOG_NAME_RE = re.compile(r"^(window|keyfreq|notes|blog)_(\d+)\.txt$")


def load_events(path, cast_int_value=False):
    """
    Reads "<unix_timestamp> <value>" lines and returns [{"t": int, "s": value}, ...].
    """
    events = []
    if not os.path.isfile(path):
        return events

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue

            parts = line.split(" ", 1)
            if len(parts) != 2:
                continue

            stamp_raw, value_raw = parts
            try:
                stamp = int(float(stamp_raw))
            except ValueError:
                continue

            value = value_raw
            if cast_int_value:
                try:
                    value = int(value_raw.strip())
                except ValueError:
                    continue

            events.append({"t": stamp, "s": value})

    return events


def collect_timestamps():
    """
    Discovers all day-start timestamps from logs/*_<t0>.txt files.
    """
    timestamps = set()
    for pattern in LOG_GLOBS:
        for path in glob.glob(pattern):
            name = os.path.basename(path)
            match = LOG_NAME_RE.match(name)
            if not match:
                continue
            timestamps.add(int(match.group(2)))
    return sorted(timestamps)


def read_blog(path):
    if not os.path.isfile(path):
        return ""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def updateEvents():
    """
    Writes per-day render/events_<t0>.json files and render/export_list.json.
    """
    timestamps = collect_timestamps()
    if not timestamps:
        print("No valid log files found. Exiting.")
        return

    render_root = os.path.join(os.getcwd(), "render")
    os.makedirs(render_root, exist_ok=True)

    export_list = []

    for t0 in timestamps:
        t1 = t0 + 86400
        out_name = f"events_{t0}.json"
        out_path = os.path.join(render_root, out_name)

        window_path = f"logs/window_{t0}.txt"
        keyfreq_path = f"logs/keyfreq_{t0}.txt"
        notes_path = f"logs/notes_{t0}.txt"
        blog_path = f"logs/blog_{t0}.txt"
        payload = {
            "window_events": load_events(window_path),
            "keyfreq_events": load_events(keyfreq_path, cast_int_value=True),
            "notes_events": load_events(notes_path),
            "blog": read_blog(blog_path),
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        print(f"[{datetime.now()}] wrote {out_path}")

        export_list.append({"t0": t0, "t1": t1, "fname": out_name})

    export_list_path = os.path.join(render_root, "export_list.json")
    with open(export_list_path, "w", encoding="utf-8") as f:
        json.dump(export_list, f, ensure_ascii=False)
    print(f"[{datetime.now()}] wrote {export_list_path}")


if __name__ == "__main__":
    updateEvents()
