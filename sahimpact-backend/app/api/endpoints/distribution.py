from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.distribution_service import calculate_month_end_close

from app.core.security import require_partner_role, get_current_company_id
from app.models.models import MonthlyReport, Account, JournalEntry, Transaction, AccountTypeEnum, EntryTypeEnum
from sqlalchemy import func
from app.schemas.schemas import MonthlyReportResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/distribution", tags=["Profit Distribution"])

class CharityPayoutCreate(BaseModel):
    amount: float
    description: str # Recipient or cause
    date: Optional[str] = None # YYYY-MM-DD

@router.get("/forecast")
def get_distribution_forecast(db: Session = Depends(get_db), company_id: Optional[int] = Depends(get_current_company_id)):
    from app.services.distribution_service import get_forecasted_shares
    return get_forecasted_shares(db, company_id)

@router.get("/contingency-balance")
def get_contingency_balance(db: Session = Depends(get_db), company_id: Optional[int] = Depends(get_current_company_id)):
    acc_query = db.query(Account).filter(Account.name == "Contingency Reserve", Account.type == AccountTypeEnum.EQUITY)
    if company_id:
        acc_query = acc_query.filter(Account.company_id == company_id)
    
    contingency_accounts = acc_query.all()
    if not contingency_accounts:
        return {"balance": 0.0}
    
    acc_ids = [a.id for a in contingency_accounts]
    
    credits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
        JournalEntry.account_id.in_(acc_ids), 
        JournalEntry.type == EntryTypeEnum.CREDIT,
        Transaction.is_closed == True
    ).scalar() or 0.0
    
    debits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
        JournalEntry.account_id.in_(acc_ids), 
        JournalEntry.type == EntryTypeEnum.DEBIT,
        Transaction.is_closed == True
    ).scalar() or 0.0
    
    return {"balance": credits - debits}

@router.get("/charity-balance")
def get_charity_balance(db: Session = Depends(get_db), company_id: Optional[int] = Depends(get_current_company_id)):
    acc_query = db.query(Account).filter(Account.name == "Global Charity Reserve", Account.type == AccountTypeEnum.LIABILITY)
    if company_id:
        acc_query = acc_query.filter(Account.company_id == company_id)
    
    charity_accounts = acc_query.all()
    if not charity_accounts:
        return {"balance": 0.0}
    
    acc_ids = [a.id for a in charity_accounts]
    
    credits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
        JournalEntry.account_id.in_(acc_ids), 
        JournalEntry.type == EntryTypeEnum.CREDIT,
        Transaction.is_closed == True
    ).scalar() or 0.0
    
    debits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
        JournalEntry.account_id.in_(acc_ids), 
        JournalEntry.type == EntryTypeEnum.DEBIT,
        Transaction.is_closed == True
    ).scalar() or 0.0
    
    return {"balance": credits - debits}

@router.post("/month-end-close")
def trigger_month_end_close(db: Session = Depends(get_db), claims: dict = Depends(require_partner_role), company_id: Optional[int] = Depends(get_current_company_id)):
    admin_id = claims.get("user_id", 1) # Fallback to 1 if not in claims
    if company_id is None:
        raise HTTPException(status_code=400, detail="Company ID is required for month-end close.")
        
    result = calculate_month_end_close(db, admin_id, company_id)
    
    from app.core.security import log_audit_event
    log_audit_event(
        db, action="RUN_DISTRIBUTION", user_id=admin_id, company_id=company_id,
        details={"net_profit": result.get("net_profit"), "distributable_profit": result.get("distributable_profit")}
    )
    
    return result

@router.get("/reports", response_model=List[MonthlyReportResponse])
def get_monthly_reports(db: Session = Depends(get_db), company_id: Optional[int] = Depends(get_current_company_id)):
    query = db.query(MonthlyReport)
    if company_id:
        query = query.filter(MonthlyReport.company_id == company_id)
    return query.order_by(MonthlyReport.created_at.desc()).all()

@router.post("/charity-payout")
def record_charity_payout(
    payload: CharityPayoutCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    """Record an outgoing payment from the Charity Reserve."""
    user_id = claims.get("user_id")
    from app.services.distribution_service import ensure_system_accounts
    _, _, charity_acc = ensure_system_accounts(db, company_id)
    
    # We also need a Cash account
    cash_acc = db.query(Account).filter(Account.name == "Cash", Account.company_id == company_id).first()
    if not cash_acc:
        cash_acc = Account(name="Cash", type=AccountTypeEnum.ASSET, company_id=company_id)
        db.add(cash_acc)
        db.flush()

    tx = Transaction(
        company_id=company_id,
        description=f"Charity Payout: {payload.description}",
        created_by_id=user_id,
        is_closed=True
    )
    if payload.date:
        tx.date = datetime.strptime(payload.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    
    db.add(tx)
    db.flush()

    # Debit Charity Reserve (Decrease Liability)
    db.add(JournalEntry(
        transaction_id=tx.id,
        account_id=charity_acc.id,
        amount=payload.amount,
        type=EntryTypeEnum.DEBIT
    ))
    # Credit Cash (Decrease Asset)
    db.add(JournalEntry(
        transaction_id=tx.id,
        account_id=cash_acc.id,
        amount=payload.amount,
        type=EntryTypeEnum.CREDIT
    ))

    db.commit()
    db.refresh(tx)
    return {"message": "Charity payout recorded", "transaction_id": tx.id}

@router.get("/charity-payouts")
def get_charity_payouts(
    db: Session = Depends(get_db),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """List all transactions that debited the Charity Reserve."""
    # Find all relevant accounts
    acc_query = db.query(Account).filter(Account.name == "Global Charity Reserve", Account.type == AccountTypeEnum.LIABILITY)
    if company_id:
        acc_query = acc_query.filter(Account.company_id == company_id)
    
    charity_accounts = acc_query.all()
    if not charity_accounts:
        return []
    
    acc_ids = [a.id for a in charity_accounts]
    
    # Find all transactions that debited these accounts
    query = db.query(Transaction).join(JournalEntry, Transaction.id == JournalEntry.transaction_id).filter(
        JournalEntry.account_id.in_(acc_ids),
        JournalEntry.type == EntryTypeEnum.DEBIT
    )
    
    if company_id is not None:
        query = query.filter(Transaction.company_id == company_id)
        
    payouts = query.order_by(Transaction.date.desc()).distinct().all()
    
    return [
        {
            "id": p.id,
            "date": p.date.strftime("%Y-%m-%d") if p.date else "",
            "description": p.description.replace("Charity Payout: ", "") if p.description.startswith("Charity Payout: ") else p.description,
            "amount": sum(e.amount for e in p.entries if e.account_id in acc_ids and e.type == EntryTypeEnum.DEBIT)
        }
        for p in payouts
    ]
