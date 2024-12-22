import sqlite3
from typing import List, Dict

# Database file path
DB_FILE = "activity_logs.db"

class LocalDataStore:
    def __init__(self, db_file: str = DB_FILE):
        self.db_file = db_file
        self._initialize_database()

    def _initialize_database(self):
        """Initializes the SQLite database and required tables."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        # Create tables if they don't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS window_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                window_title TEXT NOT NULL,
                duration INTEGER DEFAULT 0
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS keystrokes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                keystroke_count INTEGER NOT NULL
            )
        """)
        conn.commit()
        conn.close()

    def insert_window_activity(self, timestamp: str, window_title: str, duration: int):
        """Inserts a new window activity record into the database."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO window_activity (timestamp, window_title, duration)
            VALUES (?, ?, ?)
        """, (timestamp, window_title, duration))
        conn.commit()
        conn.close()

    def insert_keystroke_log(self, timestamp: str, keystroke_count: int):
        """Inserts a new keystroke log record into the database."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO keystrokes (timestamp, keystroke_count)
            VALUES (?, ?)
        """, (timestamp, keystroke_count))
        conn.commit()
        conn.close()

    def fetch_window_activity(self, start_date: str, end_date: str) -> List[Dict]:
        """Fetches window activity data for a given date range."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, window_title, duration
            FROM window_activity
            WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
        """, (start_date, end_date))
        rows = cursor.fetchall()
        conn.close()

        return [{"timestamp": row[0], "window_title": row[1], "duration": row[2]} for row in rows]

    def fetch_keystroke_logs(self, start_date: str, end_date: str) -> List[Dict]:
        """Fetches keystroke logs for a given date range."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, keystroke_count
            FROM keystrokes
            WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
        """, (start_date, end_date))
        rows = cursor.fetchall()
        conn.close()

        return [{"timestamp": row[0], "keystroke_count": row[1]} for row in rows]

    def fetch_summary_statistics(self) -> Dict:
        """Fetches summary statistics for all logged data."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        # Total duration per window title
        cursor.execute("""
            SELECT window_title, SUM(duration) as total_duration
            FROM window_activity
            GROUP BY window_title
            ORDER BY total_duration DESC
        """)
        window_summary = cursor.fetchall()

        # Total keystrokes
        cursor.execute("""
            SELECT COUNT(*), SUM(keystroke_count)
            FROM keystrokes
        """)
        keystroke_stats = cursor.fetchone()

        conn.close()

        return {
            "window_summary": [{"window_title": row[0], "total_duration": row[1]} for row in window_summary],
            "keystroke_stats": {
                "total_entries": keystroke_stats[0],
                "total_keystrokes": keystroke_stats[1],
            }
        }

    def delete_old_data(self, cutoff_date: str):
        """Deletes data older than the cutoff date."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM window_activity WHERE DATE(timestamp) < DATE(?)
        """, (cutoff_date,))
        cursor.execute("""
            DELETE FROM keystrokes WHERE DATE(timestamp) < DATE(?)
        """, (cutoff_date,))
        conn.commit()
        conn.close()

# Example usage
if __name__ == "__main__":
    store = LocalDataStore()

    # Insert example data
    store.insert_window_activity("2024-12-22 10:00:00", "Google Chrome", 120)
    store.insert_keystroke_log("2024-12-22 10:00:00", 200)

    # Fetch data
    window_data = store.fetch_window_activity("2024-12-20", "2024-12-22")
    keystroke_data = store.fetch_keystroke_logs("2024-12-20", "2024-12-22")
    summary = store.fetch_summary_statistics()

    print("Window Activity:", window_data)
    print("Keystroke Logs:", keystroke_data)
    print("Summary:", summary)
import sqlite3
from typing import List, Dict

# Database file path
DB_FILE = "activity_logs.db"

class LocalDataStore:
    def __init__(self, db_file: str = DB_FILE):
        self.db_file = db_file
        self._initialize_database()

    def _initialize_database(self):
        """Initializes the SQLite database and required tables."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        # Create tables if they don't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS window_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                window_title TEXT NOT NULL,
                duration INTEGER DEFAULT 0
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS keystrokes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                keystroke_count INTEGER NOT NULL
            )
        """)
        conn.commit()
        conn.close()

    def insert_window_activity(self, timestamp: str, window_title: str, duration: int):
        """Inserts a new window activity record into the database."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO window_activity (timestamp, window_title, duration)
            VALUES (?, ?, ?)
        """, (timestamp, window_title, duration))
        conn.commit()
        conn.close()

    def insert_keystroke_log(self, timestamp: str, keystroke_count: int):
        """Inserts a new keystroke log record into the database."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO keystrokes (timestamp, keystroke_count)
            VALUES (?, ?)
        """, (timestamp, keystroke_count))
        conn.commit()
        conn.close()

    def fetch_window_activity(self, start_date: str, end_date: str) -> List[Dict]:
        """Fetches window activity data for a given date range."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, window_title, duration
            FROM window_activity
            WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
        """, (start_date, end_date))
        rows = cursor.fetchall()
        conn.close()

        return [{"timestamp": row[0], "window_title": row[1], "duration": row[2]} for row in rows]

    def fetch_keystroke_logs(self, start_date: str, end_date: str) -> List[Dict]:
        """Fetches keystroke logs for a given date range."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, keystroke_count
            FROM keystrokes
            WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
        """, (start_date, end_date))
        rows = cursor.fetchall()
        conn.close()

        return [{"timestamp": row[0], "keystroke_count": row[1]} for row in rows]

    def fetch_summary_statistics(self) -> Dict:
        """Fetches summary statistics for all logged data."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        # Total duration per window title
        cursor.execute("""
            SELECT window_title, SUM(duration) as total_duration
            FROM window_activity
            GROUP BY window_title
            ORDER BY total_duration DESC
        """)
        window_summary = cursor.fetchall()

        # Total keystrokes
        cursor.execute("""
            SELECT COUNT(*), SUM(keystroke_count)
            FROM keystrokes
        """)
        keystroke_stats = cursor.fetchone()

        conn.close()

        return {
            "window_summary": [{"window_title": row[0], "total_duration": row[1]} for row in window_summary],
            "keystroke_stats": {
                "total_entries": keystroke_stats[0],
                "total_keystrokes": keystroke_stats[1],
            }
        }

    def delete_old_data(self, cutoff_date: str):
        """Deletes data older than the cutoff date."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM window_activity WHERE DATE(timestamp) < DATE(?)
        """, (cutoff_date,))
        cursor.execute("""
            DELETE FROM keystrokes WHERE DATE(timestamp) < DATE(?)
        """, (cutoff_date,))
        conn.commit()
        conn.close()

# Example usage
if __name__ == "__main__":
    store = LocalDataStore()

    # Insert example data
    store.insert_window_activity("2024-12-22 10:00:00", "Google Chrome", 120)
    store.insert_keystroke_log("2024-12-22 10:00:00", 200)

    # Fetch data
    window_data = store.fetch_window_activity("2024-12-20", "2024-12-22")
    keystroke_data = store.fetch_keystroke_logs("2024-12-20", "2024-12-22")
    summary = store.fetch_summary_statistics()

    print("Window Activity:", window_data)
    print("Keystroke Logs:", keystroke_data)
    print("Summary:", summary)
