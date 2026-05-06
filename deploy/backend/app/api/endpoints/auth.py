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
from app.core.security import (
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    require_partner_role,
    require_admin_role,
    require_super_admin_role,
    get_password_hash,
    get_current_user_claims,
    get_current_company_id,
    RoleEnum
)
from app.models.models import Company, PartnerShare

from typing import List, Optional

router = APIRouter(tags=["Authentication"])



@router.get("/admin/users", response_model=List[UserResponse])
def list_company_users(
    request: Request,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role)
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

    new_user = User(
        username=payload.username,
        full_name=payload.full_name,
        company_id=company_id,
        hashed_password=get_password_hash(payload.password),
        role=payload.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

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
            db_user.company_id = None
    
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/token", response_model=Token)
def login_for_access_token(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    # Use case-insensitive username matching
    user = db.query(User).filter(func.lower(User.username) == form_data.username.lower()).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Security Checks: Account and Company Status
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Please contact your administrator.")

    if user.role != RoleEnum.SUPER_ADMIN and user.company_id:
        from app.models.models import Company
        company = db.query(Company).filter(Company.id == user.company_id).first()
        if company and not company.is_active:
             raise HTTPException(status_code=403, detail="Your company account is currently inactive. Please contact support.")

    # Multi-company detection
    from app.models.models import Company, PartnerShare
    
    # Base company association
    associated_companies = []
    if user.company_id:
        c = db.query(Company).filter(Company.id == user.company_id).first()
        if c: associated_companies.append(c)
    
    # Shares association (Many-to-Many)
    shares = db.query(PartnerShare).filter(PartnerShare.user_id == user.id).all()
    share_company_ids = [s.company_id for s in shares if s.company_id and s.company_id != user.company_id]
    if share_company_ids:
        c_list = db.query(Company).filter(Company.id.in_(share_company_ids)).all()
        associated_companies.extend(c_list)
        
    # Super Admin special case: If not linked to anything, they can manage ALL companies?
    # User said: "Super admin should only see the data for companies he is linked with. In cases, super admin might even not be linked to any company."
    # So we don't auto-add all companies for super admin.
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {
        "sub": user.username, 
        "role": user.role.value, 
        "user_id": user.id
    }
    # We include the primary company_id in the token for backward compatibility, 
    # but the frontend should use the selector if companies.length > 1
    if user.company_id is not None:
        token_data["company_id"] = user.company_id

    access_token = create_access_token(
        data=token_data, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "role": user.role.value,
        "company_id": user.company_id,
        "companies": [CompanyResponse.model_validate(c) for c in associated_companies]
    }

@router.get("/me/companies", response_model=List[CompanyResponse])
def get_my_companies(db: Session = Depends(get_db), claims: dict = Depends(require_partner_role)):
    """Fetch all companies associated with the current user."""
    user_id = claims.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    
    associated_companies = []
    if user.company_id:
        c = db.query(Company).filter(Company.id == user.company_id).first()
        if c: associated_companies.append(c)
        
    shares = db.query(PartnerShare).filter(PartnerShare.user_id == user.id).all()
    share_company_ids = [s.company_id for s in shares if s.company_id and s.company_id != user.company_id]
    if share_company_ids:
        c_list = db.query(Company).filter(Company.id.in_(share_company_ids)).all()
        associated_companies.extend(c_list)
        
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
    claims: dict = Depends(get_current_user_claims)
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
        
    user.hashed_password = get_password_hash(body.new_password)
    db.commit()
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
        
    target_user.hashed_password = get_password_hash(body.new_password)
    db.commit()
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
    
    # 4. Reset current admin to no company
    admin = db.query(User).filter(User.id == current_admin_id).first()
    if admin:
        admin.company_id = None
    
    db.commit()
    return {"message": "System data wiped successfully. Please create a new company to begin."}
