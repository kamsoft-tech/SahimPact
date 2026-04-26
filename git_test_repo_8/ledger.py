from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Company, User, RoleEnum
from app.schemas.schemas import CompanyResponse, CompanyCreate, CompanyAdminCreate, UserResponse
from app.core.security import require_super_admin_role, get_password_hash

router = APIRouter(prefix="/companies", tags=["Companies (Super Admin)"])

@router.get("/", response_model=List[CompanyResponse])
def get_all_companies(
    db: Session = Depends(get_db),
    claims: dict = Depends(require_super_admin_role)
):
    """List all companies."""
    return db.query(Company).all()

@router.post("/", response_model=CompanyResponse)
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

@router.post("/{company_id}/admin", response_model=UserResponse)
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
    existing_user = db.query(User).filter(User.username == admin_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this username already exists in the system")
        
    new_admin = User(
        username=admin_data.username,
        company_id=company_id,
        hashed_password=get_password_hash(admin_data.password),
        role=RoleEnum.ADMIN
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin
