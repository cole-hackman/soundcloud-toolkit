import requests
import re

url = "https://developers.soundcloud.com/docs/api/explorer/open-api"
res = requests.get(url)
print(re.findall(r'https?://[^\s"\'\\]+\.json', res.text))
print(re.findall(r'https?://[^\s"\'\\]+\.yaml', res.text))
