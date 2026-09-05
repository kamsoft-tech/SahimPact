from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_password_hash
import json

with TestClient(app) as client:
    res = client.post("/api/token", data={"username": "master_admin", "password": "password"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "X-Company-ID": "1"}
    res2 = client.post("/api/master/entities?name=Global Master Fund", headers=headers)
    print("CREATE ENTITY RESPONSE:", res2.status_code, res2.text)
