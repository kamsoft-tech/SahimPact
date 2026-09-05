import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.models import User, Company, PartnerShare, RoleEnum
from app.db.database import SessionLocal
from app.core.security import get_password_hash

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()

@pytest.fixture
def get_auth_headers():
    def _get_auth_headers(client, username, password):
        response = client.post("/api/token", data={"username": username, "password": password})
        if response.status_code == 200:
            return {"Authorization": f"Bearer {response.json()['access_token']}"}
        raise Exception(f"Failed to login: {response.text}")
    return _get_auth_headers

@pytest.fixture(scope="module")
def test_companies(db_session):
    company1 = Company(name="Venture A Secure", is_active=True)
    company2 = Company(name="Venture B Secure", is_active=True)
    db_session.add(company1)
    db_session.add(company2)
    db_session.commit()
    db_session.refresh(company1)
    db_session.refresh(company2)
    return company1, company2

@pytest.fixture(scope="module")
def test_users(db_session, test_companies):
    c1, c2 = test_companies
    
    # Partner in Company 1
    user_partner = User(
        username="partner_sec",
        hashed_password=get_password_hash("password"),
        role=RoleEnum.PARTNER,
        company_id=c1.id
    )
    db_session.add(user_partner)
    
    # Super Admin
    user_super = User(
        username="super_admin_sec",
        hashed_password=get_password_hash("password"),
        role=RoleEnum.SUPER_ADMIN,
        company_id=None
    )
    db_session.add(user_super)
    
    # Master Admin
    user_master = User(
        username="master_admin_sec",
        hashed_password=get_password_hash("password"),
        role=RoleEnum.MASTER_ADMIN,
        company_id=None
    )
    db_session.add(user_master)
    
    db_session.commit()
    db_session.refresh(user_partner)
    db_session.refresh(user_super)
    db_session.refresh(user_master)
    
    return {
        "partner": user_partner,
        "super": user_super,
        "master": user_master
    }

def test_idor_protection_company_switch(client: TestClient, test_users, test_companies, get_auth_headers, db_session):
    c1, c2 = test_companies
    user = test_users["partner"]
    headers = get_auth_headers(client, user.username, "password")
    
    # Promote user to COMPANY_ADMIN
    user.role = RoleEnum.COMPANY_ADMIN
    db_session.commit()
    
    headers["X-Company-ID"] = str(c1.id)
    res = client.get("/api/admin/users", headers=headers)
    assert res.status_code == 200
    
    # Invalid: try to access company 2 without a PartnerShare
    headers["X-Company-ID"] = str(c2.id)
    res = client.get("/api/admin/users", headers=headers)
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"] or "read-only" in res.json()["detail"]
    
    # Grant access via PartnerShare
    share = PartnerShare(user_id=user.id, company_id=c2.id, capital_share_fixed=1000)
    db_session.add(share)
    db_session.commit()
    
    # Valid: access company 2 now
    res = client.get("/api/admin/users", headers=headers)
    assert res.status_code == 200

def test_master_admin_role_enforcement(client: TestClient, test_users, get_auth_headers):
    # Partner should be rejected
    headers = get_auth_headers(client, test_users["partner"].username, "password")
    res = client.get("/api/master/entities", headers=headers)
    assert res.status_code == 403
    assert "Master Admin permissions required" in res.json()["detail"]
    
    # Master Admin should be accepted
    headers = get_auth_headers(client, test_users["master"].username, "password")
    res = client.get("/api/master/entities", headers=headers)
    assert res.status_code == 200
    
    # Super Admin should be accepted
    headers = get_auth_headers(client, test_users["super"].username, "password")
    res = client.get("/api/master/entities", headers=headers)
    assert res.status_code == 200
