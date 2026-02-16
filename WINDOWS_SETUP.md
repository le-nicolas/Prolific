# Prolific on Windows (V2)

This setup runs Prolific with a tray-first workflow and local-only analytics pages.
Runtime storage is SQLite at `logs/prolific.db`.

## 1) Install dependencies

```powershell
cd C:\Users\User\prolific_deployment
python -m pip install -r requirements.txt
```

## 2) Start via tray (recommended)

```powershell
cd C:\Users\User\prolific_deployment
python tray_app.py --port 8080 --fallback-port 8090 --idle-seconds 300
```

Tray menu includes:

- open homepage/day/overview
- start/stop/restart tracking
- exit and stop everything

## 3) Install startup task (auto-start at logon)

```powershell
cd C:\Users\User\prolific_deployment
.\install_startup_task.ps1 -TaskName ProlificStartup -Port 8080 -FallbackPort 8090 -IdleSeconds 300
```

This task launches:

```text
pythonw.exe tray_app.py --port 8080 --fallback-port 8090 --idle-seconds 300
```

Remove later:

```powershell
Unregister-ScheduledTask -TaskName ProlificStartup -Confirm:$false
```

## 4) Routes

- Homepage: `http://localhost:8080/` (or fallback port)
- Daily analytics: `http://localhost:8080/day.html`
- Overview: `http://localhost:8080/overview.html`

## 5) Manual fallback script

If you prefer script-based startup:

```powershell
.\start_windows.ps1 -Port 8080
```

## Troubleshooting

### Port collisions

- If `8080` is occupied, runtime falls back to `8090`.
- You can set another port explicitly in both tray and startup task.

### Idle threshold

- Default idle threshold is `300` seconds.
- Change it with `--idle-seconds` (tray/manual) or `-IdleSeconds` (startup task).

### Historical export cleaning

- `export_events.py` filters records to each day boundary (`t0 <= t < t1`).
- It collapses duplicate keyfreq timestamps and inserts inferred `__IDLE__` on stale window gaps.
- Tune stale-gap cutoff with `PROLIFIC_MAX_WINDOW_ACTIVE_GAP_SECONDS` (default `1200`).

### Legacy text logs to SQLite

- Import old `logs/*.txt` into SQLite:
  - `python migrate_logs_to_sqlite.py`
- Open `logs/prolific.db` in DB Browser for SQLite if you want direct inspection.

### Duplicate process protection

- Collector pattern: `prolific.py start`
- Server pattern: `server.py <port>`
- Existing matching processes are reused instead of duplicated.

### Tray icon not visible

- Check hidden icons in Windows taskbar.
- If policy blocks background startup, run `python tray_app.py ...` manually.

### Browser does not open

- Use tray menu actions to open homepage/day/overview.
- Open manually if needed with the URLs above.

### Task registration denied

- Run PowerShell as Administrator.
- In managed environments, local Task Scheduler policy can block registration.

### Privacy defaults for GitHub sharing

- Runtime data is ignored by `.gitignore`:
  - `logs/`
  - `render/events_*.json`
  - `render/export_list.json`
