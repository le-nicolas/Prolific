import os
from collections import defaultdict

# Input and output file paths
INPUT_FILE = r"C:\Users\User\prolific_deployment\logs\keyfreq_1736550000.txt"  # Replace with your input file name
OUTPUT_FILE = "aggregated_keyfreq4.txt"  # Replace with your desired output file name
INTERVAL = 9  # 9-second intervals

def process_key_events(input_file, output_file, interval):
    """
    Processes the key events log, aggregates key counts over 9-second intervals,
    and writes the results to a new log file.

    :param input_file: Path to the input file containing key events.
    :param output_file: Path to the output file for aggregated results.
    :param interval: Interval in seconds for aggregation.
    """
    # Read the input file and parse key event timestamps
    with open(input_file, "r") as f:
        lines = f.readlines()

    # Dictionary to store aggregated counts per interval
    interval_counts = defaultdict(int)

    # Process each line in the file
    for line in lines:
        try:
            # Extract the timestamp from the line
            timestamp, _ = line.split(" ", 1)
            timestamp = int(timestamp)

            # Determine the interval for this timestamp
            interval_start = (timestamp // interval) * interval

            # Increment the count for this interval
            interval_counts[interval_start] += 1
        except ValueError:
            print(f"Skipping malformed line: {line.strip()}")

    # Write aggregated counts to the output file
    with open(output_file, "w") as f:
        for interval_start in sorted(interval_counts.keys()):
            count = interval_counts[interval_start]
            f.write(f"{interval_start} {count}\n")
            print(f"Logged: {interval_start} {count} events")

if __name__ == "__main__":
    # Ensure input file exists
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Input file '{INPUT_FILE}' not found.")
    else:
        process_key_events(INPUT_FILE, OUTPUT_FILE, INTERVAL)
        print(f"Aggregated key frequency written to '{OUTPUT_FILE}'")
