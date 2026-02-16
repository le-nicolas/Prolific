import json
import os
from datetime import datetime

from storage import (
    backfill_from_legacy_logs,
    fetch_keyfreq_events,
    fetch_notes_events,
    fetch_window_events,
    get_blog_entry,
    init_db,
    list_day_timestamps,
)

INFERRED_IDLE_TITLE = "__IDLE__"
try:
    MAX_WINDOW_ACTIVE_GAP_SECONDS = int(
        os.environ.get("PROLIFIC_MAX_WINDOW_ACTIVE_GAP_SECONDS", "1200")
    )
except ValueError:
    MAX_WINDOW_ACTIVE_GAP_SECONDS = 1200


def _normalize_text_events(rows, day_t0, day_t1, dedupe_exact=True):
    normalized = []
    for row in rows:
        try:
            stamp = int(row.get("t", 0))
        except (TypeError, ValueError):
            continue
        if stamp < day_t0 or stamp >= day_t1:
            continue
        value = str(row.get("s", "")).strip()
        if not value:
            continue
        normalized.append((stamp, value))

    normalized.sort(key=lambda x: x[0])
    if not dedupe_exact:
        return [{"t": t, "s": s} for t, s in normalized]

    out = []
    last_t = None
    last_s = None
    for stamp, value in normalized:
        if stamp == last_t and value == last_s:
            continue
        out.append({"t": stamp, "s": value})
        last_t = stamp
        last_s = value
    return out


def _normalize_keyfreq_events(rows, day_t0, day_t1):
    collapsed = {}
    for row in rows:
        try:
            stamp = int(row.get("t", 0))
            value = int(row.get("s", 0))
        except (TypeError, ValueError):
            continue
        if stamp < day_t0 or stamp >= day_t1:
            continue
        if value < 0:
            continue
        prev = collapsed.get(stamp)
        if prev is None or value > prev:
            collapsed[stamp] = value

    return [{"t": t, "s": collapsed[t]} for t in sorted(collapsed)]


def _normalize_window_events(rows, day_t0, day_t1):
    events = _normalize_text_events(rows, day_t0, day_t1, dedupe_exact=True)
    if len(events) < 2 or MAX_WINDOW_ACTIVE_GAP_SECONDS <= 0:
        return events

    out = [events[0]]
    for event in events[1:]:
        prev = out[-1]
        gap = event["t"] - prev["t"]
        if gap > MAX_WINDOW_ACTIVE_GAP_SECONDS and prev["s"] != INFERRED_IDLE_TITLE:
            inferred_t = prev["t"] + MAX_WINDOW_ACTIVE_GAP_SECONDS
            if inferred_t < event["t"]:
                out.append({"t": inferred_t, "s": INFERRED_IDLE_TITLE})
        out.append(event)
    return out


def updateEvents():
    """
    Writes per-day render/events_<t0>.json files and render/export_list.json
    from SQLite storage. Legacy text logs are backfilled into SQLite once.
    """
    init_db()
    summary = backfill_from_legacy_logs(force=False)
    if summary["files_imported"] > 0:
        print(
            f"[{datetime.now()}] sqlite backfill imported "
            f"{summary['files_imported']} files, {summary['rows_inserted']} rows"
        )

    timestamps = list_day_timestamps()
    if not timestamps:
        print("No valid event data found. Exiting.")
        return

    render_root = os.path.join(os.getcwd(), "render")
    os.makedirs(render_root, exist_ok=True)

    export_list = []
    for t0 in timestamps:
        t1 = t0 + 86400
        out_name = f"events_{t0}.json"
        out_path = os.path.join(render_root, out_name)

        payload = {
            "window_events": _normalize_window_events(fetch_window_events(t0), t0, t1),
            "keyfreq_events": _normalize_keyfreq_events(fetch_keyfreq_events(t0), t0, t1),
            "notes_events": _normalize_text_events(fetch_notes_events(t0), t0, t1, dedupe_exact=False),
            "blog": get_blog_entry(t0),
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
