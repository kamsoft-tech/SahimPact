from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import Token, UserResponse, GlobalStatsResponse, PasswordChangeRequest, AdminPasswordResetRequest, UserUpdate, UserCreateRequest, CompanyResponse
import pyotp
import qrcode
import io
from datetime import datetime, timezone
from fastapi.responses import StreamingResponse
from app.core.security import (
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    require_partner_role,
    require_admin_role,
    require_super_admin_role,
    get_password_hash,
    check_password_pwned,
    get_current_user_claims,
    get_unverified_user_claims,
    get_current_company_id,
    log_audit_event,
    RoleEnum
)
from app.core.rate_limit import limiter
from app.models.models import Company, PartnerShare

from typing import List, Optional

router = APIRouter(tags=["Authentication"])



@router.get("/admin/users", response_model=List[UserResponse])
def list_company_users(
    request: Request,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role)
):
    """List all users for the authenticated admin's company."""
    company_id = get_current_company_id(request, claims)
    if company_id is None:
        if claims.get("role") == RoleEnum.SUPER_ADMIN.value:
            return db.query(User).all()
        raise HTTPException(status_code=400, detail="Company ID context required")
    return db.query(User).filter(User.company_id == company_id).all()

@router.post("/admin/users", response_model=UserResponse)
def create_partner(
    request: Request,
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role)
):
    """Admin creates a new partner or admin in their company."""
    company_id = get_current_company_id(request, claims)
    role = claims.get("role")
    
    if company_id is None and role != RoleEnum.SUPER_ADMIN.value:
         raise HTTPException(status_code=400, detail="Company ID context required.")
    
    try:
        User.validate_username(payload.username)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
        
    if payload.role == RoleEnum.SUPER_ADMIN:
        company_id = None # Super Admin never has a company_id

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if check_password_pwned(payload.password):
        raise HTTPException(status_code=400, detail="Password has been exposed in a data breach. Please choose a different one.")

    new_user = User(
        username=payload.username,
        full_name=payload.full_name,
        company_id=company_id,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        requires_password_change=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit_event(
        db, action="CREATE_USER", user_id=claims.get("user_id"), company_id=company_id,
        target_id=str(new_user.id), details={"username": new_user.username, "role": new_user.role.value},
        ip_address=request.client.host if request.client else None
    )

    if new_user.role == RoleEnum.SUPER_ADMIN:
        return new_user

    # Automatically create a PartnerShare record for the new user
    from app.models.models import PartnerShare
    new_share = PartnerShare(
        user_id=new_user.id,
        company_id=company_id,
        capital_share_fixed=0.0,
        labor_share_variable=0.0,
        voluntary_charity_percentage=0.0
    )
    db.add(new_share)
    db.commit()

    return new_user

@router.put("/admin/users/{user_id}", response_model=UserResponse)
def update_user(
    request: Request,
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role)
):
    """
    Update a user's details. Only Company Admins can update users in their company.
    """
    admin_company_id = get_current_company_id(request, claims)
    admin_role = claims.get("role")
    current_admin_id = claims.get("user_id")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Security check: Ensure they are in the same company
    if admin_role != RoleEnum.SUPER_ADMIN.value:
        if db_user.company_id != admin_company_id:
            raise HTTPException(status_code=403, detail="Cannot manage users from other companies")

    # If promoting/demoting, ensure not demoting themselves
    if user_in.role and db_user.id == current_admin_id and user_in.role.value != db_user.role.value:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    if user_in.full_name is not None:
        db_user.full_name = user_in.full_name
    if user_in.role is not None:
        db_user.role = user_in.role
        if user_in.role == RoleEnum.SUPER_ADMIN:
            from app.models.models import UserCompanyLink
            db.query(UserCompanyLink).filter(UserCompanyLink.user_id == db_user.id).delete()
    
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/token", response_model=Token)
@limiter.limit("5/minute")
def login_for_access_token(
    request: Request,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    # Use case-insensitive username matching
    user = db.query(User).filter(func.lower(User.username) == form_data.username.lower()).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})

    # Check lockout
    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until.tzinfo is None:
        user.locked_until = user.locked_until.replace(tzinfo=timezone.utc)
    if user.locked_until and user.locked_until > now:
        raise HTTPException(status_code=429, detail="Account temporarily locked due to too many failed attempts")

    if not verify_password(form_data.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = now + timedelta(minutes=15)
            log_audit_event(db, action="USER_LOCKED", user_id=user.id, details={"username": user.username}, ip_address=request.client.host if request.client else None)
        db.commit()
        log_audit_event(db, action="LOGIN_FAILED", user_id=user.id, details={"username": user.username, "reason": "invalid_password"}, ip_address=request.client.host if request.client else None)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})
    
    # Reset lockouts on success
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    
    log_audit_event(db, action="LOGIN_SUCCESS", user_id=user.id, details={"username": user.username}, ip_address=request.client.host if request.client else None)
    
    # Security Checks: Account and Company Status
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Please contact your administrator.")

    # Multi-company detection
    associated_companies = [link.company for link in user.company_links]
    
    # Check if any associated company is inactive
    if user.role != RoleEnum.SUPER_ADMIN:
        for c in associated_companies:
            if not c.is_active:
                pass # You can still login, but endpoints will block write actions
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # MFA Logic
    totp_code = request.headers.get("X-TOTP-Code")
    mfa_verified = not user.mfa_enabled
    if user.mfa_enabled and totp_code:
        totp = pyotp.TOTP(user.mfa_secret)
        if totp.verify(totp_code):
            mfa_verified = True
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")

    token_data = {
        "sub": user.username, 
        "role": user.role.value, 
        "user_id": user.id,
        "mfa_verified": mfa_verified,
        "requires_password_change": user.requires_password_change
    }
    # We no longer include company_id in the token payload. 
    # All authenticated endpoints must receive X-Company-ID header.

    access_token = create_access_token(
        data=token_data, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "role": user.role.value,
        "companies": [CompanyResponse.model_validate(c) for c in associated_companies]
    }

@router.get("/me/companies", response_model=List[CompanyResponse])
def get_my_companies(db: Session = Depends(get_db), claims: dict = Depends(require_partner_role)):
    """Fetch all companies associated with the current user."""
    user_id = claims.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    associated_companies = [link.company for link in user.company_links]
    return associated_companies

@router.get("/me", response_model=UserResponse)
def read_users_me(db: Session = Depends(get_db), claims: dict = Depends(require_partner_role)):
    user = db.query(User).filter(User.username == claims["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/me", response_model=UserResponse)
def update_me(
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role)
):
    user = db.query(User).filter(User.username == claims["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    
    db.commit()
    db.refresh(user)
    return user

@router.get("/admin/stats", response_model=GlobalStatsResponse)
def get_system_stats(db: Session = Depends(get_db), claims: dict = Depends(require_super_admin_role)):
    """Global system statistics for Super Admin dashboard."""
    from app.models.models import Company, Transaction, User, RoleEnum
    
    return {
        "total_companies": db.query(Company).count(),
        "total_users": db.query(User).count(),
        "total_transactions": db.query(Transaction).count(),
        "active_partners": db.query(User).filter(User.role == RoleEnum.PARTNER).count()
    }

@router.put("/me/password")
def change_own_password(
    body: PasswordChangeRequest,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_unverified_user_claims)
):
    """Authenticated user changes their own password."""
    user_id = claims.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
        
    if check_password_pwned(body.new_password):
        raise HTTPException(status_code=400, detail="Password has been exposed in a data breach. Please choose a different one.")
        
    user.hashed_password = get_password_hash(body.new_password)
    user.requires_password_change = False
    db.commit()
    
    log_audit_event(db, action="PASSWORD_CHANGED", user_id=user.id, details={"method": "self"})
    return {"message": "Password changed successfully"}

@router.post("/admin/reset-password")
def admin_reset_password(
    request: Request,
    body: AdminPasswordResetRequest,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role)
):
    """Admin or Super Admin resets a user's password."""
    admin_role = claims.get("role")
    admin_company_id = get_current_company_id(request, claims)
    
    target_user = db.query(User).filter(User.id == body.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Permission logic:
    # 1. Super Admin can reset anyone.
    # 2. Company Admin can reset anyone in their own company.
    if admin_role != RoleEnum.SUPER_ADMIN.value:
        if target_user.company_id != admin_company_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions to reset this user's password")
            
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        
    if check_password_pwned(body.new_password):
        raise HTTPException(status_code=400, detail="Password has been exposed in a data breach. Please choose a different one.")
        
    target_user.hashed_password = get_password_hash(body.new_password)
    target_user.requires_password_change = True
    db.commit()
    
    log_audit_event(db, action="PASSWORD_RESET", user_id=claims.get("user_id"), company_id=admin_company_id, target_id=str(target_user.id), details={"target_username": target_user.username}, ip_address=request.client.host if request.client else None)
    return {"message": f"Password reset successfully for user {target_user.username}"}
@router.post("/admin/system-wipe")
def wipe_system_data(
    db: Session = Depends(get_db),
    claims: dict = Depends(require_super_admin_role)
):
    """
    DANGER: Purges all system data (Companies, Users, Transactions, Shares, etc.)
    Except the current Super Admin. Used for production clean-room setup.
    """
    from app.models.models import Company, User, Transaction, Account, MonthlyReport, PartnerShare, GlobalSettings, TimeEntry
    
    current_admin_id = claims.get("user_id")
    
    # 1. Delete dependent transactional data
    db.query(TimeEntry).delete()
    db.query(Transaction).delete()
    db.query(Account).delete()
    db.query(MonthlyReport).delete()
    db.query(PartnerShare).delete()
    db.query(GlobalSettings).delete()
    
    # 2. Delete all users EXCEPT the current super admin
    db.query(User).filter(User.id != current_admin_id).delete()
    
    # 3. Delete all companies
    db.query(Company).delete()
    
    admin = db.query(User).filter(User.id == current_admin_id).first()
    if admin:
        from app.models.models import UserCompanyLink
        db.query(UserCompanyLink).filter(UserCompanyLink.user_id == current_admin_id).delete()
    
    db.commit()
    return {"message": "System data wiped successfully. Please create a new company to begin."}

@router.get("/mfa/setup")
def setup_mfa(db: Session = Depends(get_db), claims: dict = Depends(get_unverified_user_claims)):
    """Generate a TOTP secret and QR code for the user to set up MFA."""
    user = db.query(User).filter(User.id == claims["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")
        
    if not user.mfa_secret:
        user.mfa_secret = pyotp.random_base32()
        db.commit()
        
    totp = pyotp.TOTP(user.mfa_secret)
    provisioning_uri = totp.provisioning_uri(name=user.username, issuer_name="SahimPact")
    
    img = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    
    return StreamingResponse(buf, media_type="image/png")

class MFAVerifyRequest(BaseModel):
    code: str

@router.post("/mfa/verify")
def verify_mfa(body: MFAVerifyRequest, db: Session = Depends(get_db), claims: dict = Depends(get_unverified_user_claims)):
    """Verify the initial TOTP code to enable MFA."""
    user = db.query(User).filter(User.id == claims["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")
        
    if not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup has not been initiated")
        
    totp = pyotp.TOTP(user.mfa_secret)
    if totp.verify(body.code):
        user.mfa_enabled = True
        db.commit()
        return {"message": "MFA enabled successfully. Please log in again to receive a fully verified token."}
    else:
        raise HTTPException(status_code=400, detail="Invalid MFA code")
