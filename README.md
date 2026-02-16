# Prolific V2

Prolific is a Windows-first personal analytics app for learners and builders who want measurable progress.

It tracks active windows and key frequency locally, then renders:

- a **Daily Analytics** page (`day.html`)
- a **Global Overview** page (`overview.html`)
- a branded **Homepage** (`index.html`)

## Why this exists

This project is built for the stage where consistent effort matters most. The goal is simple: make your hours visible so your improvements are deliberate, not accidental.

## Safety and privacy defaults

- Data stays local by default.
- Server binds to `127.0.0.1`.
- Runtime data files are git-ignored:
  - `logs/`
  - `render/events_*.json`
  - `render/export_list.json`

## Quick start (Windows)

```powershell
cd C:\Users\User\prolific_deployment
python -m pip install -r requirements.txt
python tray_app.py --port 8080 --fallback-port 8090 --idle-seconds 300
```

What you get:

- tray icon (hidden icons area) with status + controls
- collector + server lifecycle management
- one-click open for homepage/day/overview

## Tray controls

- Open Homepage
- Open Daily Analytics
- Open Overview
- Start Tracking
- Stop Tracking
- Restart Tracking
- Exit (Stop Everything)

## Routes

- `http://localhost:<port>/` -> Homepage
- `http://localhost:<port>/day.html` -> Daily Analytics
- `http://localhost:<port>/overview.html` -> Global Overview

Legacy compatibility:

- `index.html?gotoday=<id>` redirects to `day.html?gotoday=<id>`

## Startup at logon

```powershell
cd C:\Users\User\prolific_deployment
.\install_startup_task.ps1 -TaskName ProlificStartup -Port 8080 -FallbackPort 8090 -IdleSeconds 300
```

Remove it later:

```powershell
Unregister-ScheduledTask -TaskName ProlificStartup -Confirm:$false
```

## Manual fallback runner

If needed, you can still run the previous script runner:

```powershell
.\start_windows.ps1 -Port 8080
```

## Core backend contracts (unchanged)

- `POST /refresh` -> `OK`
- `POST /addnote` -> `OK`
- `POST /blog` -> `OK`

Export JSON schema per day (`render/events_<t0>.json`):

- `window_events: [{t,s}]`
- `keyfreq_events: [{t,s}]`
- `notes_events: [{t,s}]`
- `blog: string`
