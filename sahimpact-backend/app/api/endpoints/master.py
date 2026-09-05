from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User, RoleEnum
from app.models.models import MasterEntity, CapitalPool, AllocationRule, Allocation, Company
from app.services.master_service import allocate_capital
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

from app.core.security import require_master_admin_role, log_audit_event

class AllocationRuleCreate(BaseModel):
    pool_id: int
    company_id: int
    basis: str
    value: float
    cap_amount: Optional[float] = None
    schedule_cron: Optional[str] = None

@router.post("/master/entities")
def create_master_entity(name: str, db: Session = Depends(get_db), claims: dict = Depends(require_master_admin_role)):
    entity = MasterEntity(name=name)
    db.add(entity)
    db.commit()
    db.refresh(entity)
    pool = CapitalPool(master_entity_id=entity.id, name=f"{name} Pool", total_balance=1000000.0)
    db.add(pool)
    db.commit()
    log_audit_event(db, action="CREATE_MASTER_ENTITY", user_id=claims.get("user_id"), company_id=None, target_id=str(entity.id), details={"name": name})
    return {"id": entity.id, "name": entity.name}

@router.get("/master/entities")
def list_master_entities(db: Session = Depends(get_db), claims: dict = Depends(require_master_admin_role)):
    return [{"id": e.id, "name": e.name} for e in db.query(MasterEntity).all()]

@router.get("/master/{entity_id}/pools")
def list_master_pools(entity_id: int, db: Session = Depends(get_db), claims: dict = Depends(require_master_admin_role)):
    return [{"id": p.id, "master_entity_id": p.master_entity_id, "name": p.name, "total_balance": p.total_balance} for p in db.query(CapitalPool).filter(CapitalPool.master_entity_id == entity_id).all()]

@router.post("/master/allocation-rules")
def create_allocation_rule(rule: AllocationRuleCreate, db: Session = Depends(get_db), claims: dict = Depends(require_master_admin_role)):
    new_rule = AllocationRule(
        pool_id=rule.pool_id,
        company_id=rule.company_id,
        basis=rule.basis,
        value=rule.value,
        cap_amount=rule.cap_amount,
        schedule_cron=rule.schedule_cron
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    log_audit_event(db, action="CREATE_ALLOCATION_RULE", user_id=claims.get("user_id"), company_id=rule.company_id, target_id=str(new_rule.id), details={"basis": rule.basis, "value": rule.value})
    return {"id": new_rule.id, "basis": new_rule.basis, "value": new_rule.value}

@router.get("/master/{pool_id}/allocation-rules")
def list_allocation_rules(pool_id: int, db: Session = Depends(get_db), claims: dict = Depends(require_master_admin_role)):
    return [{"id": r.id, "basis": r.basis, "value": r.value} for r in db.query(AllocationRule).filter(AllocationRule.pool_id == pool_id).all()]

@router.post("/master/allocate/{rule_id}")
def run_allocation(rule_id: int, db: Session = Depends(get_db), claims: dict = Depends(require_master_admin_role)):
    allocation = allocate_capital(db, rule_id, claims.get("user_id"))
    log_audit_event(db, action="RUN_ALLOCATION", user_id=claims.get("user_id"), company_id=allocation.company_id, target_id=str(allocation.id), details={"amount": allocation.amount, "rule_id": rule_id})
    return {"id": allocation.id, "amount": allocation.amount}

@router.get("/master/{pool_id}/allocations")
def list_allocations(pool_id: int, db: Session = Depends(get_db), claims: dict = Depends(require_master_admin_role)):
    return [{"id": a.id, "amount": a.amount, "status": a.status} for a in db.query(Allocation).filter(Allocation.pool_id == pool_id).all()]
