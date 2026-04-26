import httpx

with httpx.Client() as client:
    res = client.post("http://localhost:8000/api/token", data={"username": "Partner 1", "password": "password"})
    token = res.json().get("access_token")
    
    res2 = client.post("http://localhost:8000/api/distribution/month-end-close", headers={"Authorization": f"Bearer {token}"})
    print("Close out status:", res2.status_code)
    print("Close out response:", res2.text)
