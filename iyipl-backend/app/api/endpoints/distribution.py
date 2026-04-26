from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.distribution_service import calculate_month_end_close

from app.core.security import require_partner_role, get_current_company_id
from app.models.models import MonthlyReport, Account, JournalEntry, Transaction, AccountTypeEnum, EntryTypeEnum
from sqlalchemy import func
from app.schemas.schemas import MonthlyReportResponse
from typing import List

router = APIRouter(prefix="/distribution", tags=["Profit Distribution"])

@router.get("/contingency-balance")
def get_contingency_balance(db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    contingency_account = db.query(Account).filter(Account.company_id == company_id, Account.name == "Contingency Reserve", Account.type == AccountTypeEnum.EQUITY).first()
    if not contingency_account:
        return {"balance": 0.0}
    
    credits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
        JournalEntry.account_id == contingency_account.id, 
        JournalEntry.type == EntryTypeEnum.CREDIT,
        Transaction.is_closed == True
    ).scalar() or 0.0
    
    debits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
        JournalEntry.account_id == contingency_account.id, 
        JournalEntry.type == EntryTypeEnum.DEBIT,
        Transaction.is_closed == True
    ).scalar() or 0.0
    
    return {"balance": credits - debits}

@router.post("/month-end-close")
def trigger_month_end_close(db: Session = Depends(get_db), claims: dict = Depends(require_partner_role), company_id: int = Depends(get_current_company_id)):
    admin_id = claims.get("user_id", 1) # Fallback to 1 if not in claims
    return calculate_month_end_close(db, admin_id, company_id)

@router.get("/reports", response_model=List[MonthlyReportResponse])
def get_monthly_reports(db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    return db.query(MonthlyReport).filter(MonthlyReport.company_id == company_id).order_by(MonthlyReport.created_at.desc()).all()
