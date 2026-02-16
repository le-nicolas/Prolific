import chardet

with open(r"C:\Users\User\prolific_deployment\logs\window_1736722800.txt", 'rb') as file:
    raw_data = file.read()
    result = chardet.detect(raw_data)
    encoding = result['encoding']
    print(encoding)

with open(r"C:\Users\User\prolific_deployment\logs\window_1736722800.txt", encoding=encoding) as file:
    data = file.read()
    