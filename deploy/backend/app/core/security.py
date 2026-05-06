import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
import bcrypt
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.models.models import RoleEnum, User
from app.db.database import get_db

# NIST SP 800-63B §4.2 — Secrets must NOT be hardcoded. Load from environment.
SECRET_KEY = os.environ.get("SECRET_KEY", "SUPER_SECRET_KEY_FOR_LOCAL_DEV_ONLY")
if SECRET_KEY == "SUPER_SECRET_KEY_FOR_LOCAL_DEV_ONLY" and os.environ.get("APP_ENV") == "production":
    raise RuntimeError("SECRET_KEY environment variable must be set in production (NIST SP 800-63B §4.2)")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def verify_password(plain_password, hashed_password):
    # OWASP A07:2021 — No authentication bypass. The 'placeholder' backdoor has been removed.
    try:
        pwd_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False

def get_password_hash(password):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        # NIST: Use timezone-aware datetimes to avoid server-timezone ambiguity
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

def get_current_user_claims(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_partner_role(request: Request, claims: dict = Depends(get_current_user_claims)):
    # Partners and Admins can access (Super Admins bypass role check but still check activity)
    role = claims.get("role")
    user_id = claims.get("user_id")
    
    if role not in [RoleEnum.PARTNER.value, RoleEnum.COMPANY_ADMIN.value, RoleEnum.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    from app.db.database import SessionLocal
    from app.models.models import Company, User
    
    with SessionLocal() as db:
        # Real-time User Activity Check
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="Your account is inactive. Please contact your administrator.")

        # Check if company is active (Super Admin bypasses company status check)
        if role != RoleEnum.SUPER_ADMIN.value:
            company_id = claims.get("company_id")
            if company_id:
                company = db.query(Company).filter(Company.id == company_id).first()
                if not company or not company.is_active:
                    if request.method not in ["GET", "HEAD", "OPTIONS"]:
                        raise HTTPException(status_code=403, detail="Your company account is inactive and in read-only mode. Changes are not allowed.")

    return claims

def require_admin_role(request: Request, claims: dict = Depends(get_current_user_claims)):
    role = claims.get("role")
    user_id = claims.get("user_id")
    
    if role not in [RoleEnum.COMPANY_ADMIN.value, RoleEnum.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    from app.db.database import SessionLocal
    from app.models.models import Company, User
    
    with SessionLocal() as db:
        # Real-time User Activity Check
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="Your account is inactive. Please contact your administrator.")

        # Check if company is active
        if role != RoleEnum.SUPER_ADMIN.value:
            company_id = claims.get("company_id")
            if company_id:
                company = db.query(Company).filter(Company.id == company_id).first()
                if not company or not company.is_active:
                    if request.method not in ["GET", "HEAD", "OPTIONS"]:
                        raise HTTPException(status_code=403, detail="Your company account is inactive and in read-only mode. Changes are not allowed.")
                    
    return claims

def require_super_admin_role(claims: dict = Depends(get_current_user_claims)):
    role = claims.get("role")
    user_id = claims.get("user_id")
    
    if role != RoleEnum.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super Admin permissions required")
    
    from app.db.database import SessionLocal
    from app.models.models import User
    
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="Super Admin account is inactive or deleted.")
            
    return claims

def get_current_company_id(request: Request, claims: dict = Depends(get_current_user_claims)):
    # 1. Check for X-Company-ID header (allows manual override, e.g. for Super Admins or multi-company users)
    header_company_id = request.headers.get("X-Company-ID")
    if header_company_id and header_company_id.isdigit():
        return int(header_company_id)

    # 2. Fallback to JWT claims
    company_id = claims.get("company_id")
    role = claims.get("role")
    if not company_id and role != RoleEnum.SUPER_ADMIN.value:
        raise HTTPException(status_code=400, detail="User is not associated with a company")
    
    # Validation
    if role != RoleEnum.SUPER_ADMIN.value and company_id:
        from app.db.database import SessionLocal
        from app.models.models import Company
        with SessionLocal() as db:
            company = db.query(Company).filter(Company.id == company_id).first()
            if not company or not company.is_active:
                if request.method not in ["GET", "HEAD", "OPTIONS"]:
                    raise HTTPException(status_code=403, detail="Company account is inactive and in read-only mode.")
                
    return company_id

def get_current_active_user(db: Session = Depends(get_db), claims: dict = Depends(get_current_user_claims)):
    user_id = claims.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user
