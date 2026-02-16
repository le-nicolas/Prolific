from datetime import datetime

from storage import backfill_from_legacy_logs, get_db_path, init_db


def main():
    init_db()
    summary = backfill_from_legacy_logs(force=True)
    print(f"[{datetime.now()}] SQLite DB: {get_db_path()}")
    print(f"[{datetime.now()}] Files scanned: {summary['files_seen']}")
    print(f"[{datetime.now()}] Files imported: {summary['files_imported']}")
    print(f"[{datetime.now()}] Rows inserted: {summary['rows_inserted']}")
    print(f"[{datetime.now()}] Rows malformed: {summary['rows_malformed']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
