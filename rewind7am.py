import sys
import datetime
import time

def rewindTime(t):
    """
    Utility function that takes Unix time (as int) and returns Unix time at 7 AM
    of the day that the corresponding event belongs to. Day breaks occur at 7 AM.
    """
    try:
        # Ensure t is a valid integer timestamp
        if not isinstance(t, (int, float)) or t < 0:
            raise ValueError(f"Invalid timestamp: {t}")
        
        # Convert timestamp to datetime
        d = datetime.datetime.fromtimestamp(t)
        
        if d.hour >= 7:
            # Between 7 AM and 11:59 PM
            d = datetime.datetime(d.year, d.month, d.day, 7)  # Rewind to 7 AM
        else:
            # Between 12 AM and 7 AM, so event belongs to the previous day
            d = datetime.datetime(d.year, d.month, d.day, 7)  # Rewind to 7 AM
            d -= datetime.timedelta(days=1)  # Subtract a day

        # Return Unix timestamp at 7 AM
        
        return int(d.timestamp())
    
    
    except Exception as e:
        # Log the error and raise it for visibility
        print(f"Error in rewindTime: {e}")
        raise

