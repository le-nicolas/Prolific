import glob
import os
import re
import sqlite3
import threading
import time

from rewind7am import rewindTime

LOG_NAME_RE = re.compile(r"^(window|keyfreq|notes|blog)_(\d+)\.txt$")
LOG_PATTERNS = (
    "window_*.txt",
    "keyfreq_*.txt",
    "notes_*.txt",
    "blog_*.txt",
)

_WRITE_LOCK = threading.Lock()


def _root_dir():
    return os.path.dirname(os.path.abspath(__file__))


def _resolve_path(path):
    if not path:
        return path
    if os.path.isabs(path):
        return path
    return os.path.join(_root_dir(), path)


def get_logs_dir():
    configured = os.environ.get("PROLIFIC_LOG_DIR", "logs")
    return _resolve_path(configured)


def get_db_path():
    configured = os.environ.get("PROLIFIC_DB_PATH")
    if configured:
        return _resolve_path(configured)
    return os.path.join(get_logs_dir(), "prolific.db")


def _connect(db_path=None):
    path = _resolve_path(db_path) if db_path else get_db_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_db(db_path=None):
    with _WRITE_LOCK:
        with _connect(db_path=db_path) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS window_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    t INTEGER NOT NULL,
                    day_t0 INTEGER NOT NULL,
                    s TEXT NOT NULL,
                    source_path TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_window_day_t ON window_events(day_t0, t);

                CREATE TABLE IF NOT EXISTS keyfreq_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    t INTEGER NOT NULL,
                    day_t0 INTEGER NOT NULL,
                    s INTEGER NOT NULL,
                    source_path TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_keyfreq_day_t ON keyfreq_events(day_t0, t);

                CREATE TABLE IF NOT EXISTS notes_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    t INTEGER NOT NULL,
                    day_t0 INTEGER NOT NULL,
                    s TEXT NOT NULL,
                    source_path TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_notes_day_t ON notes_events(day_t0, t);

                CREATE TABLE IF NOT EXISTS blog_entries (
                    day_t0 INTEGER PRIMARY KEY,
                    post TEXT NOT NULL DEFAULT '',
                    updated_at INTEGER NOT NULL,
                    source_path TEXT
                );

                CREATE TABLE IF NOT EXISTS legacy_import_state (
                    source_path TEXT PRIMARY KEY,
                    mtime INTEGER NOT NULL,
                    size INTEGER NOT NULL,
                    imported_at INTEGER NOT NULL
                );
                """
            )


def _sanitize_text(value):
    return str(value).replace("\r", " ").replace("\n", " ").strip()


def insert_window_event(timestamp, title):
    ts = int(timestamp)
    day_t0 = rewindTime(ts)
    safe_title = _sanitize_text(title)
    with _WRITE_LOCK:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO window_events(t, day_t0, s, source_path) VALUES(?, ?, ?, NULL)",
                (ts, day_t0, safe_title),
            )


def insert_keyfreq_event(timestamp, count):
    ts = int(timestamp)
    day_t0 = rewindTime(ts)
    safe_count = max(0, int(count))
    with _WRITE_LOCK:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO keyfreq_events(t, day_t0, s, source_path) VALUES(?, ?, ?, NULL)",
                (ts, day_t0, safe_count),
            )


def insert_note_event(note, timestamp=None):
    ts = int(time.time()) if timestamp is None else int(timestamp)
    day_t0 = rewindTime(ts)
    safe_note = _sanitize_text(note)
    with _WRITE_LOCK:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO notes_events(t, day_t0, s, source_path) VALUES(?, ?, ?, NULL)",
                (ts, day_t0, safe_note),
            )


def upsert_blog_entry(day_t0, post):
    day_stamp = int(day_t0)
    safe_post = str(post)
    now = int(time.time())
    with _WRITE_LOCK:
        with _connect() as conn:
            conn.execute(
                """
                INSERT INTO blog_entries(day_t0, post, updated_at, source_path)
                VALUES(?, ?, ?, NULL)
                ON CONFLICT(day_t0) DO UPDATE SET
                    post = excluded.post,
                    updated_at = excluded.updated_at,
                    source_path = NULL
                """,
                (day_stamp, safe_post, now),
            )


def upsert_blog_for_timestamp(timestamp, post):
    ts = int(timestamp)
    upsert_blog_entry(rewindTime(ts), post)


def get_blog_entry(day_t0):
    day_stamp = int(day_t0)
    with _connect() as conn:
        row = conn.execute(
            "SELECT post FROM blog_entries WHERE day_t0 = ?",
            (day_stamp,),
        ).fetchone()
    return row["post"] if row else ""


def fetch_window_events(day_t0):
    day_stamp = int(day_t0)
    with _connect() as conn:
        rows = conn.execute(
            "SELECT t, s FROM window_events WHERE day_t0 = ? ORDER BY t ASC, id ASC",
            (day_stamp,),
        ).fetchall()
    return [{"t": int(r["t"]), "s": str(r["s"])} for r in rows]


def fetch_keyfreq_events(day_t0):
    day_stamp = int(day_t0)
    with _connect() as conn:
        rows = conn.execute(
            "SELECT t, s FROM keyfreq_events WHERE day_t0 = ? ORDER BY t ASC, id ASC",
            (day_stamp,),
        ).fetchall()
    return [{"t": int(r["t"]), "s": int(r["s"])} for r in rows]


def fetch_notes_events(day_t0):
    day_stamp = int(day_t0)
    with _connect() as conn:
        rows = conn.execute(
            "SELECT t, s FROM notes_events WHERE day_t0 = ? ORDER BY t ASC, id ASC",
            (day_stamp,),
        ).fetchall()
    return [{"t": int(r["t"]), "s": str(r["s"])} for r in rows]


def list_day_timestamps():
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT day_t0 FROM window_events
            UNION
            SELECT day_t0 FROM keyfreq_events
            UNION
            SELECT day_t0 FROM notes_events
            UNION
            SELECT day_t0 FROM blog_entries
            ORDER BY day_t0 ASC
            """
        ).fetchall()
    return [int(r["day_t0"]) for r in rows]


def _legacy_file_records(logs_dir):
    files = []
    for pattern in LOG_PATTERNS:
        files.extend(glob.glob(os.path.join(logs_dir, pattern)))
    records = []
    for path in files:
        name = os.path.basename(path)
        match = LOG_NAME_RE.match(name)
        if not match:
            continue
        kind = match.group(1)
        day_t0 = int(match.group(2))
        records.append((kind, day_t0, os.path.abspath(path)))
    return sorted(records, key=lambda x: x[2])


def _needs_import(conn, source_path, force):
    stat = os.stat(source_path)
    mtime = int(stat.st_mtime)
    size = int(stat.st_size)
    if force:
        return True, mtime, size

    row = conn.execute(
        "SELECT mtime, size FROM legacy_import_state WHERE source_path = ?",
        (source_path,),
    ).fetchone()
    if row is None:
        return True, mtime, size
    return (int(row["mtime"]) != mtime or int(row["size"]) != size), mtime, size


def _mark_imported(conn, source_path, mtime, size):
    conn.execute(
        """
        INSERT INTO legacy_import_state(source_path, mtime, size, imported_at)
        VALUES(?, ?, ?, ?)
        ON CONFLICT(source_path) DO UPDATE SET
            mtime = excluded.mtime,
            size = excluded.size,
            imported_at = excluded.imported_at
        """,
        (source_path, int(mtime), int(size), int(time.time())),
    )


def _clear_imported_rows(conn, kind, source_path):
    if kind == "window":
        conn.execute("DELETE FROM window_events WHERE source_path = ?", (source_path,))
    elif kind == "keyfreq":
        conn.execute("DELETE FROM keyfreq_events WHERE source_path = ?", (source_path,))
    elif kind == "notes":
        conn.execute("DELETE FROM notes_events WHERE source_path = ?", (source_path,))
    elif kind == "blog":
        conn.execute("DELETE FROM blog_entries WHERE source_path = ?", (source_path,))


def _import_legacy_event_file(conn, kind, day_t0, source_path):
    day_t1 = day_t0 + 86400
    inserted = 0
    malformed = 0

    if kind == "blog":
        with open(source_path, "r", encoding="utf-8", errors="replace") as f:
            post = f.read()
        conn.execute(
            """
            INSERT INTO blog_entries(day_t0, post, updated_at, source_path)
            VALUES(?, ?, ?, ?)
            ON CONFLICT(day_t0) DO UPDATE SET
                post = excluded.post,
                updated_at = excluded.updated_at,
                source_path = excluded.source_path
            """,
            (day_t0, post, int(time.time()), source_path),
        )
        return 1, 0

    rows = []
    with open(source_path, "r", encoding="utf-8", errors="replace") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue
            parts = line.split(" ", 1)
            if len(parts) != 2:
                malformed += 1
                continue
            stamp_raw, value_raw = parts
            try:
                stamp = int(float(stamp_raw))
            except ValueError:
                malformed += 1
                continue

            if stamp < day_t0 or stamp >= day_t1:
                continue

            if kind == "keyfreq":
                try:
                    value = int(value_raw.strip())
                except ValueError:
                    malformed += 1
                    continue
                if value < 0:
                    continue
            else:
                value = _sanitize_text(value_raw)
                if not value:
                    continue
            rows.append((stamp, day_t0, value, source_path))

    if not rows:
        return 0, malformed

    if kind == "window":
        conn.executemany(
            "INSERT INTO window_events(t, day_t0, s, source_path) VALUES(?, ?, ?, ?)",
            rows,
        )
    elif kind == "keyfreq":
        conn.executemany(
            "INSERT INTO keyfreq_events(t, day_t0, s, source_path) VALUES(?, ?, ?, ?)",
            rows,
        )
    elif kind == "notes":
        conn.executemany(
            "INSERT INTO notes_events(t, day_t0, s, source_path) VALUES(?, ?, ?, ?)",
            rows,
        )
    inserted = len(rows)
    return inserted, malformed


def backfill_from_legacy_logs(force=False):
    init_db()
    logs_dir = get_logs_dir()
    os.makedirs(logs_dir, exist_ok=True)

    summary = {
        "files_seen": 0,
        "files_imported": 0,
        "rows_inserted": 0,
        "rows_malformed": 0,
    }

    records = _legacy_file_records(logs_dir)
    if not records:
        return summary

    with _WRITE_LOCK:
        with _connect() as conn:
            for kind, day_t0, source_path in records:
                summary["files_seen"] += 1
                should_import, mtime, size = _needs_import(conn, source_path, force=force)
                if not should_import:
                    continue

                _clear_imported_rows(conn, kind, source_path)
                inserted, malformed = _import_legacy_event_file(conn, kind, day_t0, source_path)
                _mark_imported(conn, source_path, mtime, size)

                summary["files_imported"] += 1
                summary["rows_inserted"] += int(inserted)
                summary["rows_malformed"] += int(malformed)

    return summary
