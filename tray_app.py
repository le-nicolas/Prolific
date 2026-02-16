import argparse
import ctypes
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser

import psutil
import pystray
from PIL import Image, ImageDraw

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
CREATE_NO_WINDOW = 0x08000000
ERROR_ALREADY_EXISTS = 183
MUTEX_NAME = "Global\\ProlificTraySingleton"


def port_listening(port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.3)
    try:
        return sock.connect_ex(("127.0.0.1", int(port))) == 0
    finally:
        sock.close()


def http_ready(port, timeout_seconds=10):
    deadline = time.time() + timeout_seconds
    url = f"http://127.0.0.1:{int(port)}/index.html"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        time.sleep(0.5)
    return False


def process_cmdline(proc):
    try:
        cmd = proc.cmdline()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return ""
    if not cmd:
        return ""
    return " ".join(cmd)


def iter_python_processes():
    for proc in psutil.process_iter(["name"]):
        try:
            name = (proc.info.get("name") or "").lower()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        if "python" not in name:
            continue
        yield proc


class RuntimeController:
    def __init__(self, port):
        self.port = int(port)
        self.python_exe = sys.executable
        self.active_port = None
        self.last_error = ""

    def collector_procs(self):
        out = []
        for proc in iter_python_processes():
            cmd = process_cmdline(proc)
            if re.search(r"\bprolific\.py\b", cmd) and re.search(r"\bstart\b", cmd):
                out.append(proc)
        return out

    def server_procs(self, port=None):
        out = []
        for proc in iter_python_processes():
            cmd = process_cmdline(proc)
            if not re.search(r"\bserver\.py\b", cmd):
                continue
            if port is None:
                out.append(proc)
            else:
                pat = rf"\bserver\.py\b\s+{int(port)}(?:\b|$)"
                if re.search(pat, cmd):
                    out.append(proc)
        return out

    def collector_running(self):
        return len(self.collector_procs()) > 0

    def detect_server_port(self):
        if self.server_procs(self.port):
            return self.port
        return None

    def _spawn(self, args):
        return subprocess.Popen(
            [self.python_exe] + list(args),
            cwd=ROOT_DIR,
            creationflags=CREATE_NO_WINDOW,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def ensure_collector(self):
        if self.collector_running():
            return True
        self._spawn(["prolific.py", "start"])
        time.sleep(0.5)
        return self.collector_running()

    def ensure_server_port(self, port):
        port = int(port)
        if self.server_procs(port):
            self.last_error = ""
            return True
        if port_listening(port):
            self.last_error = f"port {port} is occupied by another app"
            return False
        self._spawn(["server.py", str(port)])
        if http_ready(port, timeout_seconds=12):
            self.last_error = ""
            return True
        self.last_error = f"server failed to start on port {port}"
        return False

    def ensure_runtime(self):
        self.ensure_collector()
        active = self.detect_server_port()
        if active is not None:
            self.active_port = active
            self.last_error = ""
            return self.active_port

        if self.ensure_server_port(self.port):
            self.active_port = self.port
            return self.active_port

        self.active_port = None
        return None

    def stop_all(self):
        targets = self.collector_procs() + self.server_procs()
        seen = set()
        for proc in targets:
            if proc.pid in seen:
                continue
            seen.add(proc.pid)
            try:
                proc.terminate()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        gone, alive = psutil.wait_procs(targets, timeout=2)
        for proc in alive:
            try:
                proc.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        self.active_port = None
        self.last_error = ""

    def restart(self):
        self.stop_all()
        return self.ensure_runtime()

    def base_url(self):
        port = self.active_port or self.detect_server_port() or self.ensure_runtime()
        if port is None:
            return None
        self.active_port = port
        return f"http://localhost:{int(port)}"


def make_icon_image():
    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((4, 4, 60, 60), radius=14, fill=(31, 19, 12, 255), outline=(255, 128, 34, 255), width=2)
    draw.rounded_rectangle((10, 10, 54, 54), radius=11, fill=(255, 122, 24, 255))
    draw.rectangle((22, 19, 32, 49), fill=(18, 12, 8, 255))
    draw.ellipse((28, 18, 46, 34), fill=(18, 12, 8, 255))
    return image


def build_tray(port, open_on_start):
    controller = RuntimeController(port=port)
    controller.ensure_runtime()

    if open_on_start:
        url = controller.base_url()
        if url:
            webbrowser.open(url)

    def refresh_menu(icon):
        try:
            icon.update_menu()
        except Exception:
            pass

    def status_label(_item):
        collector = controller.collector_running()
        srv = controller.detect_server_port()
        if collector and srv is not None:
            return f"Status: running on :{srv}"
        if controller.last_error:
            return f"Status: {controller.last_error}"
        if collector:
            return "Status: collector only"
        return "Status: stopped"

    def open_home(icon, _item):
        controller.ensure_runtime()
        url = controller.base_url()
        if url:
            webbrowser.open(url + "/")
        refresh_menu(icon)

    def open_day(icon, _item):
        controller.ensure_runtime()
        url = controller.base_url()
        if url:
            webbrowser.open(url + "/day.html")
        refresh_menu(icon)

    def open_overview(icon, _item):
        controller.ensure_runtime()
        url = controller.base_url()
        if url:
            webbrowser.open(url + "/overview.html")
        refresh_menu(icon)

    def start_tracking(icon, _item):
        controller.ensure_runtime()
        refresh_menu(icon)

    def stop_tracking(icon, _item):
        controller.stop_all()
        refresh_menu(icon)

    def restart_tracking(icon, _item):
        controller.restart()
        refresh_menu(icon)

    def exit_tray(icon, _item):
        controller.stop_all()
        icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem(status_label, lambda _icon, _item: None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Open Homepage", open_home, default=True),
        pystray.MenuItem("Open Daily Analytics", open_day),
        pystray.MenuItem("Open Overview", open_overview),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Start Tracking", start_tracking),
        pystray.MenuItem("Stop Tracking", stop_tracking),
        pystray.MenuItem("Restart Tracking", restart_tracking),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Exit (Stop Everything)", exit_tray),
    )

    return pystray.Icon("Prolific", make_icon_image(), "Prolific", menu)


def acquire_singleton_mutex():
    kernel32 = ctypes.windll.kernel32
    mutex = kernel32.CreateMutexW(None, False, MUTEX_NAME)
    if not mutex:
        raise RuntimeError("Failed to create singleton mutex")
    last_error = kernel32.GetLastError()
    if last_error == ERROR_ALREADY_EXISTS:
        return None
    return mutex


def parse_args():
    parser = argparse.ArgumentParser(description="Prolific tray controller")
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--fallback-port", type=int, default=None, help=argparse.SUPPRESS)
    parser.add_argument("--no-open", action="store_true", help="Do not open homepage on startup")
    return parser.parse_args()


def main():
    args = parse_args()
    mutex = acquire_singleton_mutex()
    if mutex is None:
        return 0

    icon = build_tray(args.port, open_on_start=not args.no_open)
    try:
        icon.run()
    finally:
        ctypes.windll.kernel32.ReleaseMutex(mutex)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
