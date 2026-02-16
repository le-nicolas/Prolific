import datetime

# Specify the date in YYYY-MM-DD format
date_str = "2025-01-13"
date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%d")

# Convert to Unix timestamp
unix_timestamp = int(date_obj.timestamp())
print(unix_timestamp)
