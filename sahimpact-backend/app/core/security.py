import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
import bcrypt
import httpx
import hashlib
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.models.models import RoleEnum, User, AuditLog
from app.db.database import get_db
import json

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

def log_audit_event(db: Session, action: str, user_id: Optional[int] = None, company_id: Optional[int] = None, target_id: Optional[str] = None, details: Optional[dict] = None, ip_address: Optional[str] = None):
    try:
        details_str = json.dumps(details) if details else None
        log_entry = AuditLog(
            user_id=user_id,
            company_id=company_id,
            action=action,
            target_id=target_id,
            details=details_str,
            ip_address=ip_address
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        print(f"Failed to log audit event: {e}")
        db.rollback()

def check_password_pwned(password: str) -> bool:
    """Check if the password appears in the HaveIBeenPwned database."""
    sha1_password = hashlib.sha1(password.encode('utf-8')).hexdigest().upper()
    prefix = sha1_password[:5]
    suffix = sha1_password[5:]
    try:
        with httpx.Client(timeout=3.0) as client:
            response = client.get(f"https://api.pwnedpasswords.com/range/{prefix}")
            if response.status_code == 200:
                return suffix in response.text
    except Exception:
        pass # Fail open if API is unreachable
    return False

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

def get_unverified_user_claims(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user_claims(claims: dict = Depends(get_unverified_user_claims)):
    if claims.get("mfa_verified") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MFA_SETUP_REQUIRED"
        )
    if claims.get("requires_password_change") is True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PASSWORD_CHANGE_REQUIRED"
        )
    return claims

def require_partner_role(request: Request, claims: dict = Depends(get_current_user_claims)):
    role = claims.get("role")
    user_id = claims.get("user_id")
    
    from app.db.database import SessionLocal
    from app.models.models import Company, User, UserCompanyLink
    
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="Your account is inactive.")

        if role == RoleEnum.MASTER_ADMIN.value:
            return claims # Master admins can access if the endpoint allows them
            
        if role == RoleEnum.SUPER_ADMIN.value:
            return claims

        company_id_str = request.headers.get("X-Company-ID")
        if not company_id_str:
            raise HTTPException(status_code=400, detail="X-Company-ID header is required for this operation.")
        company_id = int(company_id_str)
        
        # Validate that user is linked to this company
        link = db.query(UserCompanyLink).filter(UserCompanyLink.user_id == user_id, UserCompanyLink.company_id == company_id).first()
        if not link:
            raise HTTPException(status_code=403, detail="You do not have access to this company.")

        company = link.company
        if not company or not company.is_active:
            if request.method not in ["GET", "HEAD", "OPTIONS"]:
                raise HTTPException(status_code=403, detail="Your company account is inactive and in read-only mode.")

    return claims

def require_admin_role(request: Request, claims: dict = Depends(get_current_user_claims)):
    role = claims.get("role")
    user_id = claims.get("user_id")
    
    from app.db.database import SessionLocal
    from app.models.models import Company, User, UserCompanyLink
    
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="Your account is inactive.")

        if role == RoleEnum.MASTER_ADMIN.value:
            return claims
            
        if role == RoleEnum.SUPER_ADMIN.value:
            return claims
            
        if role != RoleEnum.COMPANY_ADMIN.value:
            raise HTTPException(status_code=403, detail="Insufficient permissions: COMPANY_ADMIN required")

        company_id_str = request.headers.get("X-Company-ID")
        if not company_id_str:
            raise HTTPException(status_code=400, detail="X-Company-ID header is required for this operation.")
        company_id = int(company_id_str)
        
        link = db.query(UserCompanyLink).filter(UserCompanyLink.user_id == user_id, UserCompanyLink.company_id == company_id).first()
        if not link:
            raise HTTPException(status_code=403, detail="You do not have access to this company.")

        company = link.company
        if not company or not company.is_active:
            if request.method not in ["GET", "HEAD", "OPTIONS"]:
                raise HTTPException(status_code=403, detail="Your company account is inactive and in read-only mode.")

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

def require_master_admin_role(claims: dict = Depends(get_current_user_claims)):
    role = claims.get("role")
    user_id = claims.get("user_id")
    
    if role not in [RoleEnum.MASTER_ADMIN.value, RoleEnum.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Master Admin permissions required")
        
    from app.db.database import SessionLocal
    from app.models.models import User
    
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="Master Admin account is inactive or deleted.")
            
    return claims

def get_current_company_id(request: Request, claims: dict = Depends(get_current_user_claims)):
    header_company_id = request.headers.get("X-Company-ID")
    target_company_id = int(header_company_id) if header_company_id and header_company_id.isdigit() else claims.get("company_id")
    role = claims.get("role")
    user_id = claims.get("user_id")

    if not target_company_id and role != RoleEnum.SUPER_ADMIN.value:
        raise HTTPException(status_code=400, detail="X-Company-ID header is required")

    if target_company_id:
        from app.db.database import SessionLocal
        from app.models.models import Company, User, UserCompanyLink
        with SessionLocal() as db:
            company = db.query(Company).filter(Company.id == target_company_id).first()
            if not company or not company.is_active:
                if request.method not in ["GET", "HEAD", "OPTIONS"]:
                    raise HTTPException(status_code=403, detail="Company account is inactive and in read-only mode.")
            
            if role != RoleEnum.SUPER_ADMIN.value and role != RoleEnum.MASTER_ADMIN.value:
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    raise HTTPException(status_code=403, detail="Access denied")
                link = db.query(UserCompanyLink).filter(UserCompanyLink.user_id == user_id, UserCompanyLink.company_id == target_company_id).first()
                if not link:
                    raise HTTPException(status_code=403, detail="Access denied. You do not belong to this company.")

    return target_company_id

def get_current_active_user(db: Session = Depends(get_db), claims: dict = Depends(get_current_user_claims)):
    user_id = claims.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user
