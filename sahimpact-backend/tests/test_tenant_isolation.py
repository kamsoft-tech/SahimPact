import pytest
from fastapi.testclient import TestClient

def test_tenant_isolation(client: TestClient, super_admin_token: str):
    # 1. Create Company A and Company B
    res = client.post("/api/companies", json={"name": "Tenant A"}, headers={"Authorization": f"Bearer {super_admin_token}"})
    assert res.status_code == 200
    company_a_id = res.json()["id"]

    res = client.post("/api/companies", json={"name": "Tenant B"}, headers={"Authorization": f"Bearer {super_admin_token}"})
    assert res.status_code == 200
    company_b_id = res.json()["id"]

    # 2. Create Users for Company A and Company B
    # Admin A
    strong_pwd = "TenantPass123!_safe"
    res = client.post(
        "/api/admin/users",
        json={"username": "admin_a", "password": strong_pwd, "full_name": "Admin A", "role": "COMPANY_ADMIN"},
        headers={"Authorization": f"Bearer {super_admin_token}", "X-Company-ID": str(company_a_id)}
    )
    assert res.status_code == 200

    res = client.post(
        "/api/admin/users",
        json={"username": "admin_b", "password": strong_pwd, "full_name": "Admin B", "role": "COMPANY_ADMIN"},
        headers={"Authorization": f"Bearer {super_admin_token}", "X-Company-ID": str(company_b_id)}
    )
    assert res.status_code == 200

    # 3. Get tokens for Admin A and Admin B
    res_a = client.post("/api/token", data={"username": "admin_a", "password": strong_pwd})
    assert res_a.status_code == 200
    token_a = res_a.json()["access_token"]

    res_b = client.post("/api/token", data={"username": "admin_b", "password": strong_pwd})
    assert res_b.status_code == 200
    token_b = res_b.json()["access_token"]

    # 4. Check Isolation (Admin B should not see Company A's users or settings)
    res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token_b}", "X-Company-ID": str(company_a_id)})
    assert res.status_code == 403

    res = client.get("/api/settings", headers={"Authorization": f"Bearer {token_b}", "X-Company-ID": str(company_a_id)})
    assert res.status_code == 403
