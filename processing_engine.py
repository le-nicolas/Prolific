# i love this section! it's so cool to see how the data is being processed and returned to the UI
# this is where the flow state is

import sqlite3
from typing import Dict, List

# Database file path
DB_FILE = "activity_logs.db"

class ProcessingEngine:
    def __init__(self, db_file: str = DB_FILE):
        self.db_file = db_file

    def _fetch_window_activity(self, start_date: str, end_date: str) -> List[Dict]:
        """Fetches raw window activity logs for a date range."""
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

    def _fetch_keystrokes(self, start_date: str, end_date: str) -> List[Dict]:
        """Fetches raw keystroke logs for a date range."""
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

    def calculate_flow_states(self, start_date: str, end_date: str, typing_threshold: int = 20) -> List[Dict]:
        """
        Analyzes flow states based on continuous high typing frequency 
        and working window titles.
        """
        raw_keystrokes = self._fetch_keystrokes(start_date, end_date)
        raw_windows = self._fetch_window_activity(start_date, end_date)

        flow_states = []
        current_state = None

        for keystroke, window in zip(raw_keystrokes, raw_windows):
            if keystroke["keystroke_count"] >= typing_threshold:
                if not current_state:
                    current_state = {
                        "start_time": keystroke["timestamp"],
                        "end_time": keystroke["timestamp"],
                        "window_title": window["window_title"],
                        "keystroke_count": keystroke["keystroke_count"]
                    }
                else:
                    current_state["end_time"] = keystroke["timestamp"]
                    current_state["keystroke_count"] += keystroke["keystroke_count"]
            else:
                if current_state:
                    flow_states.append(current_state)
                    current_state = None

        if current_state:
            flow_states.append(current_state)

        return flow_states

    def aggregate_window_usage(self, start_date: str, end_date: str) -> Dict:
        """
        Aggregates total time spent per window title for the given date range.
        """
        raw_data = self._fetch_window_activity(start_date, end_date)
        aggregation = {}

        for entry in raw_data:
            title = entry["window_title"]
            aggregation[title] = aggregation.get(title, 0) + entry["duration"]

        return aggregation

    def aggregate_keystrokes(self, start_date: str, end_date: str) -> Dict:
        """
        Aggregates total keystrokes and provides hourly breakdown.
        """
        raw_data = self._fetch_keystrokes(start_date, end_date)
        total_keystrokes = 0
        hourly_breakdown = {}

        for entry in raw_data:
            total_keystrokes += entry["keystroke_count"]
            hour = entry["timestamp"].split(" ")[1].split(":")[0]
            hourly_breakdown[hour] = hourly_breakdown.get(hour, 0) + entry["keystroke_count"]

        return {
            "total_keystrokes": total_keystrokes,
            "hourly_breakdown": hourly_breakdown
        }

    def generate_daily_breakdown(self, date: str) -> Dict:
        """
        Generates a daily breakdown of activity.
        """
        window_usage = self.aggregate_window_usage(date, date)
        keystrokes = self.aggregate_keystrokes(date, date)

        return {
            "date": date,
            "window_usage": window_usage,
            "keystrokes": keystrokes
        }

    def generate_overview(self, start_date: str, end_date: str) -> Dict:
        """
        Generates an overview of activities across a date range.
        """
        window_usage = self.aggregate_window_usage(start_date, end_date)
        keystrokes = self.aggregate_keystrokes(start_date, end_date)

        return {
            "start_date": start_date,
            "end_date": end_date,
            "window_usage": window_usage,
            "keystrokes": keystrokes
        }

# Example usage
if __name__ == "__main__":
    engine = ProcessingEngine()

    # Test flow states for a specific date range
    flow_states = engine.calculate_flow_states("2024-12-01", "2024-12-22")
    print("Flow States:", flow_states)

    # Test window usage aggregation
    window_usage = engine.aggregate_window_usage("2024-12-01", "2024-12-22")
    print("Window Usage:", window_usage)

    # Test keystroke aggregation
    keystrokes = engine.aggregate_keystrokes("2024-12-01", "2024-12-22")
    print("Keystroke Aggregation:", keystrokes)

    # Generate daily breakdown
    daily_breakdown = engine.generate_daily_breakdown("2024-12-22")
    print("Daily Breakdown:", daily_breakdown)

    # Generate overview
    overview = engine.generate_overview("2024-12-01", "2024-12-22")
    print("Overview:", overview)
