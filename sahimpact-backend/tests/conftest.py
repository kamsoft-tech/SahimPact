import os
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import Base, engine, SessionLocal
from app.models.models import User, RoleEnum, Company, GlobalSettings
from app.core.security import get_current_user_claims, get_unverified_user_claims

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Run the seed_db function manually
    from app.main import seed_db
    seed_db()
    
    # Create a default company and partner for testing
    db = SessionLocal()
    from app.models.models import Company, User, RoleEnum, GlobalSettings, PartnerShare, UserCompanyLink
    from app.core.security import get_password_hash
    
    test_company = Company(name="Test Company")
    db.add(test_company)
    db.commit()
    db.refresh(test_company)
    
    test_partner = User(
        username="Partner 1",
        hashed_password=get_password_hash("password"),
        role=RoleEnum.PARTNER
    )
    db.add(test_partner)
    
    settings = GlobalSettings(company_id=test_company.id)
    db.add(settings)
    
    db.commit()
    db.refresh(test_partner)

    # Link partner to company
    link_partner = UserCompanyLink(user_id=test_partner.id, company_id=test_company.id)
    db.add(link_partner)

    test_admin = User(
        username="Company Admin",
        hashed_password=get_password_hash("password"),
        role=RoleEnum.COMPANY_ADMIN
    )
    db.add(test_admin)
    db.commit()
    db.refresh(test_admin)

    # Link admin to company
    link_admin = UserCompanyLink(user_id=test_admin.id, company_id=test_company.id)
    db.add(link_admin)

    # Master Admin User
    test_master = User(
        username="master_admin",
        hashed_password=get_password_hash("password"),
        role=RoleEnum.MASTER_ADMIN
    )
    db.add(test_master)
    db.commit()
    db.refresh(test_master)
    
    # Link master admin to company
    link_master = UserCompanyLink(user_id=test_master.id, company_id=test_company.id)
    db.add(link_master)
    
    db.commit()
    db.refresh(test_partner)
    db.refresh(test_admin)

    # Seed PartnerShare for "Partner 1" and "Company Admin"
    for u in [test_partner, test_admin, test_master]:
        partner_share = PartnerShare(
            user_id=u.id,
            company_id=test_company.id,
            capital_share_fixed=1000.0 if u.role == RoleEnum.PARTNER else 0.0,
            labor_share_variable=0.0
        )
        db.add(partner_share)
    db.commit()
    db.close()
    
    # Disable Rate Limiting for tests
    from app.core.rate_limit import limiter
    limiter.enabled = False
    
    yield

@pytest.fixture(scope="session")
def client():
    from fastapi import Request, Depends
    from app.core.security import get_unverified_user_claims, oauth2_scheme
    def override_get_current_user_claims(token: str = Depends(oauth2_scheme)):
        try:
            return get_unverified_user_claims(token)
        except Exception:
            # For tests that send garbage tokens, maybe raise 401?
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
    app.dependency_overrides[get_current_user_claims] = override_get_current_user_claims

    with TestClient(app) as c:
        yield c
        
    app.dependency_overrides.clear()

@pytest.fixture(scope="session")
def admin_token(client):
    """Token for the global Super Admin (previously returned Company Admin, now returns Super Admin to support global tests)."""
    initial_pwd = os.environ.get("SUPER_ADMIN_INITIAL_PASSWORD", "ChangeMe_OnFirstLogin!")
    response = client.post("/api/token", data={"username": "admin", "password": initial_pwd})
    if response.status_code == 200:
        return response.json()["access_token"]
    # Fallbacks
    for pwd in ("admin", "password"):
        response = client.post("/api/token", data={"username": "admin", "password": pwd})
        if response.status_code == 200:
            return response.json()["access_token"]
    raise RuntimeError(f"Could not authenticate as super admin.")

@pytest.fixture(scope="session")
def super_admin_token(client):
    """Token for the global Super Admin (for company management)."""
    initial_pwd = os.environ.get("SUPER_ADMIN_INITIAL_PASSWORD", "ChangeMe_OnFirstLogin!")
    response = client.post("/api/token", data={"username": "admin", "password": initial_pwd})
    if response.status_code == 200:
        return response.json()["access_token"]
    # Fallbacks
    for pwd in ("admin", "password"):
        response = client.post("/api/token", data={"username": "admin", "password": pwd})
        if response.status_code == 200:
            return response.json()["access_token"]
    raise RuntimeError(f"Could not authenticate as super admin.")

@pytest.fixture(scope="session")
def partner_token(client):
    response = client.post("/api/token", data={"username": "Partner 1", "password": "password"})
    return response.json()["access_token"]

@pytest.fixture(scope="session")
def master_admin_token(client):
    response = client.post("/api/token", data={"username": "master_admin", "password": "password"})
    return response.json()["access_token"]
