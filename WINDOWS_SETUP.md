# Prolific on Windows (V2)

This setup runs Prolific with a tray-first workflow and local-only analytics pages.

## 1) Install dependencies

```powershell
cd C:\Users\User\prolific_deployment
python -m pip install -r requirements.txt
```

## 2) Start via tray (recommended)

```powershell
cd C:\Users\User\prolific_deployment
python tray_app.py --port 8090
```

Tray menu includes:

- open homepage/day/overview
- start/stop/restart tracking
- exit and stop everything

## 3) Install startup task (auto-start at logon)

```powershell
cd C:\Users\User\prolific_deployment
.\install_startup_task.ps1 -TaskName ProlificStartup -Port 8090
```

This task launches:

```text
pythonw.exe tray_app.py --port 8090
```

Remove later:

```powershell
Unregister-ScheduledTask -TaskName ProlificStartup -Confirm:$false
```

## 4) Routes

- Homepage: `http://localhost:8090/`
- Daily analytics: `http://localhost:8090/day.html`
- Overview: `http://localhost:8090/overview.html`

## 5) Manual script

If you prefer script-based startup:

```powershell
.\start_windows.ps1 -Port 8090
```

## Troubleshooting

### Port collisions

- Prolific uses one configured port only (`8090` by default).
- If that port is occupied, Prolific will not auto-switch ports.
- Choose a free port explicitly, then use the same port in tray + startup task.

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
