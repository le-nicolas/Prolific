import codecs

# Step 1: Read the file with ISO-8859-1 encoding and decode it
with open(r"C:\Users\User\prolific_deployment\logs\window_1736722800.txt", 'rb') as file:
    raw_data = file.read()

# Step 2: Try to decode the content from ISO-8859-1, while handling invalid sequences
decoded_data = raw_data.decode('windows-1252', errors='replace')  # 'replace' will replace invalid characters with �

# Step 3: (Optional) Handle specific known invalid byte sequences or portions of the text
# If there are specific patterns or known areas to fix, you can manually process them here.
# For example, replacing certain placeholders added during decoding:
decoded_data = decoded_data.replace('�', '?')  # Replace replacement character with a specific character, if needed.

# Step 4: Save the decoded data as UTF-8
with open('window_1736722800.txt', 'w', encoding='utf-8') as file:
    file.write(decoded_data)
