from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Company, User, RoleEnum
from app.schemas.schemas import CompanyResponse, CompanyCreate, CompanyAdminCreate, UserResponse, CompanyUpdate, UserRoleUpdate
from app.core.security import require_super_admin_role, get_password_hash, require_admin_role, require_partner_role


router = APIRouter(tags=["Companies (Super Admin)"])

@router.get("/companies/orphaned-partners", response_model=List[UserResponse])
def list_orphaned_partners(
    db: Session = Depends(get_db),
    claims: dict = Depends(require_super_admin_role)
):
    """List all users with RoleEnum.PARTNER who are not linked to any company."""
    orphans = db.query(User).filter(User.company_id == None, User.role == RoleEnum.PARTNER).all()
    return orphans

@router.get("/companies", response_model=List[CompanyResponse])
def get_all_companies(
    db: Session = Depends(get_db),
    claims: dict = Depends(require_super_admin_role)
):
    """List all companies."""
    companies = db.query(Company).all()
    # Manual mapping to include admin info
    result = []
    for company in companies:
        admin = db.query(User).filter(User.company_id == company.id, User.role == RoleEnum.COMPANY_ADMIN).first()
        comp_dict = company.__dict__.copy()
        if admin:
            comp_dict["admin_id"] = admin.id
            comp_dict["admin_username"] = admin.username
        result.append(comp_dict)
    return result

@router.post("/companies", response_model=CompanyResponse)
def create_company(
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_super_admin_role)
):
    """Create a new company."""
    existing = db.query(Company).filter(Company.name == company_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Company name already exists")
    
    new_company = Company(name=company_data.name)
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    return new_company


@router.get("/companies/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role)
):
    """Get a specific company."""
    if claims.get("role") != RoleEnum.SUPER_ADMIN.value and claims.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this company")
        
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    admin = db.query(User).filter(User.company_id == company.id, User.role == RoleEnum.COMPANY_ADMIN).first()
    comp_dict = company.__dict__.copy()
    if admin:
        comp_dict["admin_id"] = admin.id
        comp_dict["admin_username"] = admin.username
    return comp_dict

@router.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    company_data: CompanyUpdate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role)
):
    """Update a specific company."""
    if claims.get("role") != RoleEnum.SUPER_ADMIN.value and claims.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this company")
        
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    if company_data.name:
        existing = db.query(Company).filter(Company.name == company_data.name, Company.id != company_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Company name already taken")
        company.name = company_data.name
        
    db.commit()
    db.refresh(company)
    
    admin = db.query(User).filter(User.company_id == company.id, User.role == RoleEnum.COMPANY_ADMIN).first()
    comp_dict = company.__dict__.copy()
    if admin:
        comp_dict["admin_id"] = admin.id
        comp_dict["admin_username"] = admin.username
    return comp_dict


@router.post("/companies/{company_id}/admin", response_model=UserResponse)
def create_company_admin(
    company_id: int,
    admin_data: CompanyAdminCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_super_admin_role)
):
    """Create the initial admin user for a company."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    # Check if a user with this username already exists globally (to avoid login conflicts)
    if not admin_data.username.isalnum():
        raise HTTPException(status_code=400, detail="Username must be alphanumeric and contain no spaces")
        
    existing_user = db.query(User).filter(User.username == admin_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this username already exists in the system")
        
    new_admin = User(
        username=admin_data.username,
        company_id=company_id,
        hashed_password=get_password_hash(admin_data.password),
        role=RoleEnum.COMPANY_ADMIN
    )
    # Ensure role is never Super Admin for company-linked user
    if new_admin.role == RoleEnum.SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="Cannot create a company admin with Super Admin role")

    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin

@router.get("/companies/{company_id}/users", response_model=List[UserResponse])
def get_company_users(
    company_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role)
):
    """List all users for a specific company."""
    if claims.get("role") != RoleEnum.SUPER_ADMIN.value and claims.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to view users for this company")
    
    users = db.query(User).filter(User.company_id == company_id).all()
    return users

@router.put("/companies/{company_id}/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    company_id: int,
    user_id: int,
    role_data: UserRoleUpdate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role)
):
    """Update a user's role."""
    if claims.get("role") != RoleEnum.SUPER_ADMIN.value and claims.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to manage users for this company")
        
    user = db.query(User).filter(User.id == user_id, User.company_id == company_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if role_data.role == RoleEnum.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot promote a company user to Super Admin role")
        
    user.role = role_data.role
    if user.role == RoleEnum.SUPER_ADMIN:
         user.company_id = None # Safety measure

    db.commit()
    db.refresh(user)
    return user

@router.delete("/companies/{company_id}/users/{user_id}", status_code=204)
def deactivate_user(
    company_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role)
):
    """Deactivate a user (soft delete)."""
    if claims.get("role") != RoleEnum.SUPER_ADMIN.value and claims.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to manage users for this company")
        
    user = db.query(User).filter(User.id == user_id, User.company_id == company_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = False
    db.commit()
    return None

@router.put("/companies/{company_id}/toggle-active", response_model=CompanyResponse)
def toggle_company_active(
    company_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_super_admin_role)
):
    """Toggle company active status (Soft Delete)."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company.is_active = not company.is_active
    db.commit()
    db.refresh(company)
    return company

@router.delete("/companies/{company_id}", status_code=204)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_super_admin_role)
):
    """Hard delete a company and all its associated data."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    db.delete(company)
    db.commit()
    return None


@router.post("/companies/{company_id}/adopt-partner/{user_id}", response_model=UserResponse)
def adopt_partner(
    company_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_super_admin_role)
):
    """Link an orphaned partner to a company."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    user = db.query(User).filter(User.id == user_id, User.company_id == None).first()
    if not user:
        raise HTTPException(status_code=404, detail="Orphaned user not found or already assigned")
        
    user.company_id = company_id
    db.commit()
    db.refresh(user)
    return user
