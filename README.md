# Prolific

Prolific is a local, Windows-first tracking app for people who want real effort data instead of guesses.

## What It Does

- Tracks active window title + process name
- Tracks keyboard activity in time buckets
- Stores events in SQLite (`logs/prolific.db`)
- Exports daily event JSON files for dashboards
- Provides a tray app with start/stop/open controls
- Can auto-start at logon with Scheduled Task

## What It Does Not Do

- No cloud sync by default
- No screenshots
- No microphone capture
- No content-level logging (it tracks window/process activity, not document text)

## How Tracking Works

- Foreground window is sampled every `2s`
- Window event is written when it changes (with `10m` heartbeat)
- Key frequency is logged every `9s`
- Idle is detected after `300s` by default (`__IDLE__`)
- Runtime storage is SQLite (`logs/prolific.db`)
- Legacy text logs in `logs/*.txt` can be imported once

## Dashboards

- Home: `http://localhost:<port>/`
- Daily: `http://localhost:<port>/day.html`
- Overview: `http://localhost:<port>/overview.html`

Legacy route compatibility remains:

- `index.html?gotoday=<id>` redirects to `day.html?gotoday=<id>`

## Quick Start (Windows)

```powershell
cd C:\Users\User\prolific_deployment
python -m pip install -r requirements.txt
python tray_app.py --port 8080 --fallback-port 8090 --idle-seconds 300
```

This starts collector + server and puts a Prolific icon in the Windows tray.

## Tray Menu

- Open Homepage
- Open Daily Analytics
- Open Overview
- Start Tracking
- Stop Tracking
- Restart Tracking
- Exit (Stop Everything)

## Start At Logon

```powershell
cd C:\Users\User\prolific_deployment
.\install_startup_task.ps1 -TaskName ProlificStartup -Port 8080 -FallbackPort 8090 -IdleSeconds 300
```

Remove later:

```powershell
Unregister-ScheduledTask -TaskName ProlificStartup -Confirm:$false
```

## Optional Script Runner

If you prefer no tray:

```powershell
.\start_windows.ps1 -Port 8080 -FallbackPort 8090 -IdleSeconds 300
```

## API Contracts

- `POST /refresh` -> `OK`
- `POST /addnote` -> `OK`
- `POST /blog` -> `OK`

Daily export schema (`render/events_<t0>.json`):

- `window_events: [{t,s}]`
- `keyfreq_events: [{t,s}]`
- `notes_events: [{t,s}]`
- `blog: string`

## SQLite Migration

Import existing legacy log files into SQLite:

```powershell
cd C:\Users\User\prolific_deployment
python migrate_logs_to_sqlite.py
```

You can inspect data with DB Browser for SQLite using:

- `logs/prolific.db`

## Historical Data Cleaning

`export_events.py` cleans old/noisy logs before writing `render/events_*.json`:

- keeps only in-day records (`t0 <= t < t1`)
- sorts events by timestamp
- collapses duplicate keyfreq timestamps (keeps the highest value)
- inserts inferred `__IDLE__` markers on stale long gaps

Tune stale-gap cleanup:

```powershell
$env:PROLIFIC_MAX_WINDOW_ACTIVE_GAP_SECONDS = 1200
python export_events.py
```

Set it to `0` to disable inferred-idle insertion.

## Data And Privacy

- Server binds to `127.0.0.1` (local machine)
- Runtime artifacts ignored by git: `logs/`, `render/events_*.json`, `render/export_list.json`

## Testing

Run tests locally:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q tests
```

CI runs tests on GitHub Actions (`.github/workflows/tests.yml`) for pushes and PRs.

## Accuracy Notes

- This is an activity tracker, not a perfect truth engine.
- Time is inferred from event intervals.
- Category quality depends on rules in `render/render_settings.js`.
- If your category labels look wrong, fix mappings first, then refresh exports.
