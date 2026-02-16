import argparse
import ctypes
import os
import signal
import threading
import time

import psutil
import win32gui
import win32process
from pynput import keyboard

from rewind7am import rewindTime

LOG_DIR = "logs"
WINDOW_POLL_SECONDS = 2.0
WINDOW_HEARTBEAT_SECONDS = 600
KEY_BUCKET_SECONDS = 9.0
USER_IDLE_SECONDS = 120


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


def get_idle_seconds():
    info = LASTINPUTINFO()
    info.cbSize = ctypes.sizeof(LASTINPUTINFO)
    if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):
        return 0.0
    now_ms = ctypes.windll.kernel32.GetTickCount()
    elapsed_ms = (now_ms - info.dwTime) & 0xFFFFFFFF
    return max(0.0, float(elapsed_ms) / 1000.0)


def ensure_log_dir():
    os.makedirs(LOG_DIR, exist_ok=True)


def sanitize_text(text):
    return str(text).replace("\r", " ").replace("\n", " ").strip()


def day_log_path(prefix, unix_time):
    day_stamp = rewindTime(unix_time)
    return os.path.join(LOG_DIR, f"{prefix}_{day_stamp}.txt")


def append_log_line(path, line):
    with open(path, "a", encoding="utf-8", errors="replace") as f:
        f.write(f"{line}\n")


def active_window_snapshot():
    if get_idle_seconds() >= USER_IDLE_SECONDS:
        return "__IDLE__", "idle"

    hwnd = win32gui.GetForegroundWindow()
    if hwnd == 0:
        return "__LOCKEDSCREEN", "unknown.exe"

    title = sanitize_text(win32gui.GetWindowText(hwnd))
    if not title:
        title = "__LOCKEDSCREEN"

    process_name = "unknown.exe"
    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        process_name = psutil.Process(pid).name()
    except Exception:
        pass

    return title, sanitize_text(process_name)


def log_active_windows(stop_event, poll_seconds=WINDOW_POLL_SECONDS, heartbeat_seconds=WINDOW_HEARTBEAT_SECONDS):
    last_payload = None
    last_write_time = 0

    while not stop_event.is_set():
        now = int(time.time())
        try:
            title, process_name = active_window_snapshot()
            payload = f"{title} ({process_name})"
            should_write = payload != last_payload or (now - last_write_time) >= heartbeat_seconds

            if should_write:
                log_path = day_log_path("window", now)
                append_log_line(log_path, f"{now} {payload}")
                print(f"window: {payload}")
                last_payload = payload
                last_write_time = now
        except Exception as exc:
            print(f"window logger error: {exc}")

        stop_event.wait(poll_seconds)


def log_key_frequency(stop_event, bucket_seconds=KEY_BUCKET_SECONDS):
    count_lock = threading.Lock()
    bucket_count = 0

    def on_release(_):
        nonlocal bucket_count
        with count_lock:
            bucket_count += 1

    listener = keyboard.Listener(on_release=on_release)
    listener.start()

    try:
        while not stop_event.is_set():
            stop_event.wait(bucket_seconds)
            now = int(time.time())

            with count_lock:
                count = bucket_count
                bucket_count = 0

            log_path = day_log_path("keyfreq", now)
            append_log_line(log_path, f"{now} {count}")
            print(f"keyfreq: {count}")
    finally:
        listener.stop()
        listener.join(timeout=2)


def start_logging(stop_event, window_poll_seconds=WINDOW_POLL_SECONDS, key_bucket_seconds=KEY_BUCKET_SECONDS):
    window_thread = threading.Thread(
        target=log_active_windows,
        args=(stop_event, window_poll_seconds, WINDOW_HEARTBEAT_SECONDS),
        daemon=True,
    )
    key_thread = threading.Thread(
        target=log_key_frequency,
        args=(stop_event, key_bucket_seconds),
        daemon=True,
    )
    window_thread.start()
    key_thread.start()
    return window_thread, key_thread


def parse_args():
    parser = argparse.ArgumentParser(
        description="Windows-native Prolific collector: active windows + key frequency."
    )
    parser.add_argument("command", choices=["start"], help="Start the collectors.")
    parser.add_argument(
        "--window-poll-seconds",
        type=float,
        default=WINDOW_POLL_SECONDS,
        help="Polling interval for active window checks.",
    )
    parser.add_argument(
        "--key-bucket-seconds",
        type=float,
        default=KEY_BUCKET_SECONDS,
        help="Aggregation window for key frequency logging.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    if args.command != "start":
        return 1

    ensure_log_dir()
    stop_event = threading.Event()

    def request_shutdown(_signum, _frame):
        stop_event.set()

    signal.signal(signal.SIGINT, request_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, request_shutdown)

    print("starting prolific logger (windows mode)")
    threads = start_logging(
        stop_event=stop_event,
        window_poll_seconds=args.window_poll_seconds,
        key_bucket_seconds=args.key_bucket_seconds,
    )

    try:
        while not stop_event.is_set():
            stop_event.wait(1)
    finally:
        stop_event.set()
        for thread in threads:
            thread.join(timeout=3)
        print("logger stopped")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
