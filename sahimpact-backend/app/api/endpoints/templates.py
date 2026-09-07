from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.templates import DocumentSection, CompanyDocumentSection, CompanySectionSelection
from app.schemas.schemas import (
    DocumentSectionCreate, DocumentSectionResponse,
    CompanyDocumentSectionCreate, CompanyDocumentSectionResponse,
    CompanySectionSelectionUpdate, CompanySectionSelectionResponse
)
from app.core.security import require_master_admin_role, get_current_company_id

router = APIRouter()

# --- GLOBAL SECTIONS (Super Admin Only) ---

@router.get("/global", response_model=List[DocumentSectionResponse])
def list_global_sections(
    db: Session = Depends(get_db)
):
    """List all global sections (accessible by everyone for reading)."""
    return db.query(DocumentSection).order_by(DocumentSection.order_index).all()

@router.post("/global", response_model=DocumentSectionResponse)
def create_global_section(
    section_in: DocumentSectionCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_master_admin_role)
):
    """Create a new global section (Super Admin only)."""
    section = DocumentSection(**section_in.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    return section

@router.put("/global/{section_id}", response_model=DocumentSectionResponse)
def update_global_section(
    section_id: int,
    section_in: DocumentSectionCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_master_admin_role)
):
    """Update a global section."""
    section = db.query(DocumentSection).filter(DocumentSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    for key, value in section_in.model_dump().items():
        setattr(section, key, value)
        
    db.commit()
    db.refresh(section)
    return section

@router.delete("/global/{section_id}")
def delete_global_section(
    section_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_master_admin_role)
):
    """Delete a global section."""
    section = db.query(DocumentSection).filter(DocumentSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    db.delete(section)
    db.commit()
    return {"message": "Section deleted successfully"}


# --- COMPANY CUSTOM SECTIONS (Company Admin Only) ---

@router.get("/company", response_model=List[CompanyDocumentSectionResponse])
def list_company_sections(
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id)
):
    """List custom sections for the current company."""
    return db.query(CompanyDocumentSection).filter(CompanyDocumentSection.company_id == company_id).order_by(CompanyDocumentSection.order_index).all()

@router.post("/company", response_model=CompanyDocumentSectionResponse)
def create_company_section(
    section_in: CompanyDocumentSectionCreate,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id)
):
    """Create a custom section for the current company."""
    section = CompanyDocumentSection(**section_in.model_dump(), company_id=company_id)
    db.add(section)
    db.commit()
    db.refresh(section)
    return section

@router.put("/company/{section_id}", response_model=CompanyDocumentSectionResponse)
def update_company_section(
    section_id: int,
    section_in: CompanyDocumentSectionCreate,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id)
):
    """Update a custom company section."""
    section = db.query(CompanyDocumentSection).filter(
        CompanyDocumentSection.id == section_id,
        CompanyDocumentSection.company_id == company_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Company section not found")
    
    for key, value in section_in.model_dump().items():
        setattr(section, key, value)
        
    db.commit()
    db.refresh(section)
    return section

@router.delete("/company/{section_id}")
def delete_company_section(
    section_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id)
):
    """Delete a custom company section."""
    section = db.query(CompanyDocumentSection).filter(
        CompanyDocumentSection.id == section_id,
        CompanyDocumentSection.company_id == company_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Company section not found")
    
    db.delete(section)
    db.commit()
    return {"message": "Company section deleted successfully"}


# --- COMPANY SELECTIONS (Optional Globals + Custom inclusions) ---

@router.get("/selection", response_model=List[CompanySectionSelectionResponse])
def get_company_selections(
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id)
):
    """Get the active selections for a company."""
    return db.query(CompanySectionSelection).filter(CompanySectionSelection.company_id == company_id).all()

@router.put("/selection")
def update_company_selections(
    selections_in: List[CompanySectionSelectionUpdate],
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id)
):
    """Update which optional global sections and which custom sections are included."""
    # First, clear existing selections
    db.query(CompanySectionSelection).filter(CompanySectionSelection.company_id == company_id).delete()
    
    # Then add the new ones
    for sel in selections_in:
        db.add(CompanySectionSelection(
            company_id=company_id,
            global_section_id=sel.global_section_id,
            company_section_id=sel.company_section_id,
            is_included=sel.is_included
        ))
        
    db.commit()
    return {"message": "Selections updated successfully"}
