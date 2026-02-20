import importlib
import json
from pathlib import Path


def _write(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_update_events_exports_clean_daily_payload(tmp_path, monkeypatch):
    logs_dir = tmp_path / "logs"
    db_path = logs_dir / "prolific.db"
    day_t0 = 1000
    day_t1 = day_t0 + 86400

    monkeypatch.setenv("PROLIFIC_LOG_DIR", str(logs_dir))
    monkeypatch.setenv("PROLIFIC_DB_PATH", str(db_path))
    monkeypatch.setenv("PROLIFIC_MAX_WINDOW_ACTIVE_GAP_SECONDS", "60")
    monkeypatch.chdir(tmp_path)

    _write(
        logs_dir / f"window_{day_t0}.txt",
        "\n".join(
            [
                f"{day_t0} VSCode",
                f"{day_t0} VSCode",
                f"{day_t0 + 10} VSCode",
                f"{day_t0 + 200} Browser",
                f"{day_t1 + 1} Outside",
            ]
        )
        + "\n",
    )
    _write(
        logs_dir / f"keyfreq_{day_t0}.txt",
        "\n".join(
            [
                f"{day_t0} 1",
                f"{day_t0} 5",
                f"{day_t0 + 10} 2",
                f"{day_t1 + 2} 9",
            ]
        )
        + "\n",
    )
    _write(
        logs_dir / f"notes_{day_t0}.txt",
        f"{day_t0 + 5} standup done\n",
    )
    _write(
        logs_dir / f"coffee_{day_t0}.txt",
        "\n".join(
            [
                f"{day_t0 + 30} 100",
                f"{day_t0 + 30} 120",
                f"{day_t0 + 300} 90",
                f"{day_t1 + 10} 200",
            ]
        )
        + "\n",
    )
    _write(
        logs_dir / f"blog_{day_t0}.txt",
        "Focus day",
    )

    import export_events

    importlib.reload(export_events)
    export_events.updateEvents()

    payload_path = tmp_path / "render" / f"events_{day_t0}.json"
    assert payload_path.exists()

    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    window_events = payload["window_events"]
    keyfreq_events = payload["keyfreq_events"]
    notes_events = payload["notes_events"]
    coffee_events = payload["coffee_events"]

    assert payload["blog"] == "Focus day"
    assert notes_events == [{"t": day_t0 + 5, "s": "standup done"}]

    # Duplicate key timestamp collapsed to max value and out-of-day row removed.
    assert keyfreq_events == [{"t": day_t0, "s": 5}, {"t": day_t0 + 10, "s": 2}]
    assert coffee_events == [{"t": day_t0 + 30, "mg": 120}, {"t": day_t0 + 300, "mg": 90}]

    # Duplicate window row removed; stale gap inserts inferred idle at t0+70.
    assert {"t": day_t0 + 70, "s": "__IDLE__"} in window_events
    assert all(day_t0 <= e["t"] < day_t1 for e in window_events)

    export_list = json.loads((tmp_path / "render" / "export_list.json").read_text(encoding="utf-8"))
    assert export_list == [{"t0": day_t0, "t1": day_t1, "fname": f"events_{day_t0}.json"}]
