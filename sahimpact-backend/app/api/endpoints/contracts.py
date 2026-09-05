from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User, RoleEnum
from app.models.contracts import ContractClause, ContractTemplate
from app.core.security import require_admin_role
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class ContractClauseCreate(BaseModel):
    key: str
    category: str
    title: str
    body: str
    mandatory: bool = False
    locked: bool = True
    contract_type: str
    madhhab: Optional[str] = None
    certification_ref: Optional[str] = None
    scholar: Optional[str] = None

class ContractTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    contract_type: str
    clause_keys: List[str]

@router.post("/contracts/clauses")
def create_clause(clause: ContractClauseCreate, db: Session = Depends(get_db), claims: dict = Depends(require_admin_role)):
    # In reality check for SUPER_ADMIN + Scholar
    new_clause = ContractClause(
        key=clause.key,
        category=clause.category,
        title=clause.title,
        body=clause.body,
        mandatory=clause.mandatory,
        locked=clause.locked,
        contract_type=clause.contract_type,
        madhhab=clause.madhhab,
        certification_ref=clause.certification_ref,
        scholar=clause.scholar
    )
    db.add(new_clause)
    db.commit()
    db.refresh(new_clause)
    return new_clause

@router.get("/contracts/clauses")
def list_clauses(contract_type: Optional[str] = None, db: Session = Depends(get_db), claims: dict = Depends(require_admin_role)):
    query = db.query(ContractClause).filter(ContractClause.active == True)
    if contract_type:
        query = query.filter(ContractClause.contract_type == contract_type)
    return query.all()

@router.post("/contracts/templates")
def create_template(template: ContractTemplateCreate, db: Session = Depends(get_db), claims: dict = Depends(require_admin_role)):
    new_temp = ContractTemplate(
        name=template.name,
        description=template.description,
        contract_type=template.contract_type,
        clause_order=template.clause_keys
    )
    db.add(new_temp)
    db.commit()
    db.refresh(new_temp)
    return new_temp

@router.get("/contracts/templates")
def list_templates(db: Session = Depends(get_db), claims: dict = Depends(require_admin_role)):
    return db.query(ContractTemplate).filter(ContractTemplate.is_active == True).all()

@router.get("/contracts/templates/{template_id}/render")
def render_template(template_id: int, db: Session = Depends(get_db), claims: dict = Depends(require_admin_role)):
    template = db.query(ContractTemplate).filter(ContractTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    clauses = db.query(ContractClause).filter(ContractClause.key.in_(template.clause_order)).all()
    clause_dict = {c.key: c for c in clauses}
    
    rendered_clauses = []
    for key in template.clause_order:
        if key in clause_dict:
            rendered_clauses.append(clause_dict[key])
            
    return {
        "template_name": template.name,
        "contract_type": template.contract_type,
        "clauses": rendered_clauses
    }
