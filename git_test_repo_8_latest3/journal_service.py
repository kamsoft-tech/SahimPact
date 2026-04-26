from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
import bcrypt
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from app.models.models import RoleEnum

SECRET_KEY = "SUPER_SECRET_KEY_FOR_LOCAL_DEV" # Use environment variable in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def verify_password(plain_password, hashed_password):
    if hashed_password == "hashed_password_placeholder":
        return True # Dev fallback
    try:
        # passlib used to handle string/bytes, but bcrypt 4.0+ is strict
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
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
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

def require_partner_role(claims: dict = Depends(get_current_user_claims)):
    # Partners and Admins can access (Super Admins bypass)
    role = claims.get("role")
    if role not in [RoleEnum.PARTNER.value, RoleEnum.ADMIN.value, RoleEnum.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return claims

def require_admin_role(claims: dict = Depends(get_current_user_claims)):
    role = claims.get("role")
    if role not in [RoleEnum.ADMIN.value, RoleEnum.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return claims

def require_super_admin_role(claims: dict = Depends(get_current_user_claims)):
    role = claims.get("role")
    if role != RoleEnum.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super Admin permissions required")
    return claims

def get_current_company_id(claims: dict = Depends(get_current_user_claims)):
    # Super admins might not inherently have a company_id if they manage across, but for now we look for it
    company_id = claims.get("company_id")
    role = claims.get("role")
    if not company_id and role != RoleEnum.SUPER_ADMIN.value:
        raise HTTPException(status_code=400, detail="User is not associated with a company")
    return company_id
