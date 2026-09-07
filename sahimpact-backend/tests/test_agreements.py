from fastapi.testclient import TestClient
from app.main import app
from app.db.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Company, RoleEnum, Agreement, AgreementStatus, PartnerShare, UserCompanyLink
from app.core.security import get_password_hash
import pytest
import os
from unittest.mock import patch, MagicMock

# Use the same setup as other tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_agreements.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test company and users
    company = Company(name="Agreement Test Company")
    db.add(company)
    db.commit()
    db.refresh(company)
    
    admin = User(username="admin_agreement", hashed_password=get_password_hash("password"), role=RoleEnum.COMPANY_ADMIN, company_id=company.id, is_active=True)
    partner1 = User(username="partner1_agreement", hashed_password=get_password_hash("password"), role=RoleEnum.PARTNER, company_id=company.id, is_active=True)
    partner2 = User(username="partner2_agreement", hashed_password=get_password_hash("password"), role=RoleEnum.PARTNER, company_id=company.id, is_active=True)
    
    db.add_all([admin, partner1, partner2])
    db.commit()
    
    link1 = UserCompanyLink(user_id=admin.id, company_id=company.id)
    link2 = UserCompanyLink(user_id=partner1.id, company_id=company.id)
    link3 = UserCompanyLink(user_id=partner2.id, company_id=company.id)
    db.add_all([link1, link2, link3])
    db.commit()
    
    yield
    
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers(client):
    res = client.post("/api/token", data={"username": "admin_agreement", "password": "password"})
    token = res.json()["access_token"]
    companies = res.json()["companies"]
    company_id = str(companies[0]["id"]) if companies else "1"
    return {"Authorization": f"Bearer {token}", "X-Company-ID": company_id}

@pytest.fixture
def partner1_headers(client):
    res = client.post("/api/token", data={"username": "partner1_agreement", "password": "password"})
    token = res.json()["access_token"]
    companies = res.json()["companies"]
    company_id = str(companies[0]["id"]) if companies else "1"
    return {"Authorization": f"Bearer {token}", "X-Company-ID": company_id}

@pytest.fixture
def partner2_headers(client):
    res = client.post("/api/token", data={"username": "partner2_agreement", "password": "password"})
    token = res.json()["access_token"]
    companies = res.json()["companies"]
    company_id = str(companies[0]["id"]) if companies else "1"
    return {"Authorization": f"Bearer {token}", "X-Company-ID": company_id}

@patch('app.api.endpoints.agreements.get_signing_provider')
def test_propose_and_approve_agreement(mock_get_signing_provider, client, auth_headers, partner1_headers, partner2_headers):
    # Mock the signing provider
    mock_provider = MagicMock()
    mock_provider.create_envelope.return_value = {
        "provider": "MANUAL",
        "provider_ref": "mock_env_123",
        "status": "SENT"
    }
    mock_get_signing_provider.return_value = mock_provider

    db = TestingSessionLocal()
    admin = db.query(User).filter(User.username == "admin_agreement").first()
    partner1 = db.query(User).filter(User.username == "partner1_agreement").first()
    partner2 = db.query(User).filter(User.username == "partner2_agreement").first()
    
    # Debugging
    links = db.query(UserCompanyLink).all()
    print("ALL LINKS:", [(l.user_id, l.company_id) for l in links])
    print("HEADERS ADMIN:", auth_headers)
    print("HEADERS PARTNER1:", partner1_headers)
    
    # 1. Propose Agreement
    res = client.post("/api/agreements/propose-parameters", json={
        "proposed_settings": {"currency_symbol": "$"},
        "proposed_shares": [
            {"user_id": partner1.id, "capital_share_fixed": 50, "labor_share_variable": 50, "voluntary_charity_percentage": 0},
            {"user_id": partner2.id, "capital_share_fixed": 50, "labor_share_variable": 50, "voluntary_charity_percentage": 0}
        ],
        "change_summary": "Initial Setup"
    }, headers=auth_headers)
    assert res.status_code == 200, res.text
    
    # Get pending agreement
    res = client.get("/api/agreements/pending", headers=auth_headers)
    assert res.status_code == 200
    agreement_data = res.json()
    assert agreement_data["status"] == "PENDING"
    agreement_id = agreement_data["id"]
    
    # 2. Admin signs
    res = client.post(f"/api/agreements/{agreement_id}/sign", json={"action": "APPROVE"}, headers=auth_headers)
    assert res.status_code == 200
    
    # 3. Partner 1 signs
    res = client.post(f"/api/agreements/{agreement_id}/sign", json={"action": "APPROVE"}, headers=partner1_headers)
    assert res.status_code == 200
    
    # Check status - should still be pending since partner2 hasn't signed
    res = client.get("/api/agreements/pending", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "PENDING"
    
    # 4. Partner 2 signs
    res = client.post(f"/api/agreements/{agreement_id}/sign", json={"action": "APPROVE"}, headers=partner2_headers)
    assert res.status_code == 200
    
    # Check status - should be executed (or approved, depending on if execute is auto)
    # wait, the code says: `check_and_apply_agreement` changes status to APPROVED and sends to e-signature
    res = client.get(f"/api/agreements/history", headers=auth_headers)
    assert res.status_code == 200
    history = res.json()
    assert len(history) > 0
    assert history[0]["status"] == "APPROVED"
    assert history[0]["envelope_provider"] == "MANUAL"

    # PDF generation should have been called during the approval process
    mock_provider.create_envelope.assert_called_once()
