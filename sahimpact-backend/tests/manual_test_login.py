import requests

# Test admin
res = requests.post("http://localhost:8000/api/token", data={"username": "admin", "password": "admin"})
print("Admin login:", res.status_code, res.text)

if res.status_code == 200:
    token = res.json()["access_token"]
    res2 = requests.get("http://localhost:8000/api/me", headers={"Authorization": f"Bearer {token}"})
    print("Admin me:", res2.status_code, res2.text)

# Test partner
res3 = requests.post("http://localhost:8000/api/token", data={"username": "Partner 1", "password": "password"})
print("Partner login:", res3.status_code, res3.text)

if res3.status_code == 200:
    token3 = res3.json()["access_token"]
    res4 = requests.get("http://localhost:8000/api/me", headers={"Authorization": f"Bearer {token3}"})
    print("Partner me:", res4.status_code, res4.text)
