import chardet

with open(r"C:\Users\User\prolific_deployment\logs\keyfreq_1736722800.txt", 'rb') as file:
    raw_data = file.read()
    detected = chardet.detect(raw_data)
    print(detected)

"woah!!!"