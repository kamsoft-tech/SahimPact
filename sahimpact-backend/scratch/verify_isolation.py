import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.models import RoleEnum

def test_multi_tenant_isolation():
    client = TestClient(app)
    
    # 1. Get Super Admin Token
    initial_pwd = "ChangeMe_OnFirstLogin!"
    sa_login = client.post("/api/token", data={"username": "admin", "password": initial_pwd})
    if sa_login.status_code != 200:
        sa_login = client.post("/api/token", data={"username": "admin", "password": "password"})
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}
    
    def check_res(res, msg):
        if res.status_code >= 400:
            print(f"FAILED: {msg} - {res.status_code} - {res.text}")
            raise Exception(f"Test failed at {msg}")
        return res.json()

    import time
    ts = int(time.time())
    # 2. Create Company A and its Admin
    res = client.post("/api/companies/", headers=sa_headers, json={"name": f"CompanyA{ts}"})
    co_a = check_res(res, "Create Co A")
    co_a_id = co_a["id"]
    
    res = client.post(f"/api/companies/{co_a_id}/admin", headers=sa_headers, 
                json={"username": f"admina{ts}", "password": "password123"})
    check_res(res, "Create Admin A")
    
    # 3. Create Company B and its Admin
    res = client.post("/api/companies/", headers=sa_headers, json={"name": f"CompanyB{ts}"})
    co_b = check_res(res, "Create Co B")
    co_b_id = co_b["id"]
    
    res = client.post(f"/api/companies/{co_b_id}/admin", headers=sa_headers, 
                json={"username": f"adminb{ts}", "password": "password123"})
    check_res(res, "Create Admin B")
    
    # 4. Log in as Admin A and Admin B
    token_a = client.post("/api/token", data={"username": f"admina{ts}", "password": "password123"}).json()["access_token"]
    token_b = client.post("/api/token", data={"username": f"adminb{ts}", "password": "password123"}).json()["access_token"]
    
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # 5. Create a transaction in Company A
    tx_a = client.post("/api/ledger", headers=headers_a, json={
        "type": "sales", "amount": 100.0, "description": "Tx A"
    }).json()
    tx_a_id = tx_a["id"]
    
    # 6. Create a transaction in Company B
    tx_b = client.post("/api/ledger", headers=headers_b, json={
        "type": "sales", "amount": 200.0, "description": "Tx B"
    }).json()
    tx_b_id = tx_b["id"]
    
    # 7. VERIFY ISOLATION
    # Admin A should see Tx A but NOT Tx B
    res_a = client.get("/api/ledger", headers=headers_a)
    tx_ids_a = [t["id"] for t in res_a.json()]
    assert tx_a_id in tx_ids_a
    assert tx_b_id not in tx_ids_a
    
    # Admin B should see Tx B but NOT Tx A
    res_b = client.get("/api/ledger", headers=headers_b)
    tx_ids_b = [t["id"] for t in res_b.json()]
    assert tx_b_id in tx_ids_b
    assert tx_a_id not in tx_ids_b
    
    # 8. VERIFY SUPER ADMIN AGGREGATION
    # Super Admin should see BOTH
    res_sa = client.get("/api/ledger", headers=sa_headers)
    tx_ids_sa = [t["id"] for t in res_sa.json()]
    assert tx_a_id in tx_ids_sa
    assert tx_b_id in tx_ids_sa
    
    # 9. VERIFY SUPER ADMIN STATS
    stats = client.get("/api/ledger/stats", headers=sa_headers).json()
    # It should count users/companies across the whole system
    assert stats["company_count"] >= 2
    
    print("\n[SUCCESS] Multi-tenant isolation and Super Admin aggregation verified!")

if __name__ == "__main__":
    test_multi_tenant_isolation()
