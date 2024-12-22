import time
import sqlite3
import psutil
from pynput import keyboard
import win32gui
import threading
import os
from queue import Queue
import logging

# Constants
DB_FILE = "activity_logs.db"
POLLING_INTERVAL = 2  # in seconds
KEYSTROKE_LOG_INTERVAL = 60  # Log keystroke count every 60 seconds

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Global Stop Event
stop_event = threading.Event()

# Utility for Database Operations
def execute_query(query, params=()):
    """Executes a database query with optional parameters."""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
    except sqlite3.Error as e:
        logging.error(f"Database error: {e}")
    finally:
        conn.close()

# Database setup
def setup_database():
    """Sets up the SQLite database for storing activity logs."""
    execute_query("""
        CREATE TABLE IF NOT EXISTS window_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            window_title TEXT NOT NULL,
            duration INTEGER DEFAULT 0
        )
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS keystrokes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            keystroke_count INTEGER NOT NULL
        )
    """)
    logging.info("Database setup completed.")

# Active window tracking
class WindowTracker:
    def __init__(self):
        self.current_window = None
        self.start_time = time.time()

    def get_active_window(self):
        """Returns the title of the currently active window."""
        try:
            return win32gui.GetWindowText(win32gui.GetForegroundWindow())
        except Exception:
            return "Unknown"

    def log_window_activity(self):
        """Logs active window activity into the database."""
        while not stop_event.is_set():
            active_window = self.get_active_window()
            if active_window != self.current_window:
                self._save_current_window()
                self.current_window = active_window
                self.start_time = time.time()
            time.sleep(POLLING_INTERVAL)

    def _save_current_window(self):
        """Saves the current window's activity duration to the database."""
        if self.current_window:
            duration = int(time.time() - self.start_time)
            if duration > 0:
                execute_query("""
                    INSERT INTO window_activity (timestamp, window_title, duration)
                    VALUES (datetime('now'), ?, ?)
                """, (self.current_window, duration))
                logging.info(f"Logged window activity: {self.current_window} for {duration} seconds.")

# Keystroke Monitoring
class KeystrokeTracker:
    def __init__(self):
        self.keystroke_count = 0
        self.lock = threading.Lock()

    def on_key_press(self, key):
        """Handles key press events and increments keystroke count."""
        with self.lock:
            self.keystroke_count += 1

    def log_keystrokes(self):
        """Logs keystroke count into the database at regular intervals."""
        while not stop_event.is_set():
            time.sleep(KEYSTROKE_LOG_INTERVAL)
            with self.lock:
                count = self.keystroke_count
                self.keystroke_count = 0

            execute_query("""
                INSERT INTO keystrokes (timestamp, keystroke_count)
                VALUES (datetime('now'), ?)
            """, (count,))
            logging.info(f"Logged keystroke count: {count}.")

# Main Execution
def main():
    """Main function to start activity tracking."""
    if not os.path.exists(DB_FILE):
        setup_database()

    # Initialize trackers
    window_tracker = WindowTracker()
    keystroke_tracker = KeystrokeTracker()

    # Start window tracking in a separate thread
    window_thread = threading.Thread(target=window_tracker.log_window_activity, daemon=True)
    window_thread.start()

    # Start keystroke tracking in a separate thread
    keystroke_thread = threading.Thread(target=keystroke_tracker.log_keystrokes, daemon=True)
    keystroke_thread.start()

    # Listen to keystrokes
    logging.info("Activity tracking started. Press Ctrl+C to stop.")
    try:
        with keyboard.Listener(on_press=keystroke_tracker.on_key_press) as listener:
            listener.join()
    except KeyboardInterrupt:
        logging.info("Shutting down activity tracker.")
        stop_event.set()

if __name__ == "__main__":
    main()
