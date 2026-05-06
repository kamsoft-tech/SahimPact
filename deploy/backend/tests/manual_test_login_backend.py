import urllib.request
import urllib.parse
import json

data = urllib.parse.urlencode({'username': 'admin', 'password': 'admin'}).encode('ascii')
req = urllib.request.Request('http://localhost:8000/api/token', data=data)
try:
    response = urllib.request.urlopen(req)
    print("Status:", response.status)
    print("Body:", response.read().decode())
except urllib.error.HTTPError as e:
    print("Error Status:", e.code)
    print("Error Body:", e.read().decode())
except Exception as e:
    print("Exception:", str(e))
