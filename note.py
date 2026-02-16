import os
import time
from rewind7am import rewindTime  # Import the rewindTime function

LOG_DIR = "logs"

def log_note(note, timestamp=None):
    """
    Logs a note with the current or provided timestamp into a daily log file.
    File and line format follow Prolific's daily notes format:
    logs/notes_<t0>.txt and "<timestamp> <note>".
    """
    # Ensure logs directory exists
    os.makedirs(LOG_DIR, exist_ok=True)

    # Use the current timestamp if none is provided
    if timestamp is None:
        timestamp = int(time.time())
    
    # Get the appropriate 7 AM timestamp using rewindTime
    log_time = rewindTime(timestamp)
    
    # Create the log file name based on the 7 AM timestamp
    log_filename = f"notes_{log_time}.txt"
    log_path = os.path.join(LOG_DIR, log_filename)

    safe_note = str(note).replace("\r", " ").replace("\n", " ").strip()
    log_entry = f"{timestamp} {safe_note}\n"

    # Append the note to the log file using open() and write()
    with open(log_path, 'a', encoding='utf-8', errors='replace') as log_file:
        log_file.write(log_entry)

    print(f"Logged note: {log_entry.strip()} in {log_path}")
