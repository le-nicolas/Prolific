import os
from pathlib import Path

import pytest

import storage


def _write(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_legacy_backfill_and_live_writes(tmp_path, monkeypatch):
    logs_dir = tmp_path / "logs"
    db_path = logs_dir / "prolific.db"
    day_t0 = 1736550000
    day_t1 = day_t0 + 86400

    monkeypatch.setenv("PROLIFIC_LOG_DIR", str(logs_dir))
    monkeypatch.setenv("PROLIFIC_DB_PATH", str(db_path))

    _write(
        logs_dir / f"window_{day_t0}.txt",
        "\n".join(
            [
                f"{day_t0 + 1} VSCode",
                f"{day_t0 + 10} Browser",
                "badline",
                f"{day_t1 + 5} OutsideWindow",
            ]
        )
        + "\n",
    )
    _write(
        logs_dir / f"keyfreq_{day_t0}.txt",
        "\n".join(
            [
                f"{day_t0 + 1} 1",
                f"{day_t0 + 1} 4",
                f"{day_t0 + 20} 2",
                f"{day_t1 + 9} 99",
            ]
        )
        + "\n",
    )
    _write(
        logs_dir / f"notes_{day_t0}.txt",
        f"{day_t0 + 2} deep work note\n",
    )
    _write(
        logs_dir / f"blog_{day_t0}.txt",
        "legacy blog body",
    )

    storage.init_db()
    summary = storage.backfill_from_legacy_logs(force=True)

    assert summary["files_seen"] == 4
    assert summary["files_imported"] == 4
    assert summary["rows_inserted"] >= 5

    days = storage.list_day_timestamps()
    assert day_t0 in days

    window_events = storage.fetch_window_events(day_t0)
    assert all(day_t0 <= e["t"] < day_t1 for e in window_events)
    assert any("VSCode" in e["s"] for e in window_events)

    key_events = storage.fetch_keyfreq_events(day_t0)
    assert all(day_t0 <= e["t"] < day_t1 for e in key_events)
    assert any(e["s"] == 4 for e in key_events)

    notes = storage.fetch_notes_events(day_t0)
    assert len(notes) == 1
    assert "deep work note" in notes[0]["s"]

    assert storage.get_blog_entry(day_t0) == "legacy blog body"

    storage.insert_window_event(day_t0 + 100, "Fusion 360")
    storage.insert_keyfreq_event(day_t0 + 100, 7)
    storage.insert_note_event("new note", timestamp=day_t0 + 100)
    storage.upsert_blog_for_timestamp(day_t0 + 100, "new blog body")
    storage.insert_coffee_event(timestamp=day_t0 + 100, mg=100)
    storage.insert_coffee_event(timestamp=day_t0 + 200, mg=120)
    storage.insert_coffee_event(timestamp=day_t0 + 300, mg=80)

    assert any(e["s"] == "Fusion 360" for e in storage.fetch_window_events(day_t0))
    assert any(e["s"] == 7 for e in storage.fetch_keyfreq_events(day_t0))
    assert any("new note" in e["s"] for e in storage.fetch_notes_events(day_t0))
    assert storage.get_blog_entry(day_t0) == "new blog body"
    coffees = storage.fetch_coffee_events(day_t0)
    assert len(coffees) == 3
    assert coffees[0]["mg"] == 100

    with pytest.raises(ValueError):
        storage.insert_coffee_event(timestamp=day_t0 + 400, mg=100)

    assert os.path.isfile(db_path)
