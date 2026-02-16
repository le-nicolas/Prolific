import time
from storage import insert_note_event

def log_note(note, timestamp=None):
    """
    Logs a note with current or provided timestamp into SQLite storage.
    """
    if timestamp is None:
        timestamp = int(time.time())

    insert_note_event(note=note, timestamp=timestamp)
    print(f"Logged note at {int(timestamp)}")
