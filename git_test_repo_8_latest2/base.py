from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
from app.db.database import get_db
from sqlalchemy import or_
from app.models.models import Transaction, JournalEntry, EntryTypeEnum, Account, AccountTypeEnum, ExpenseReceipt
from app.core.security import require_partner_role, require_admin_role, get_current_company_id

router = APIRouter(prefix="/ledger", tags=["Ledger"])

class SimpleTxCreate(BaseModel):
    type: str  # "sales", "expense", "salary"
    amount: float
    description: str

class SimpleTxResponse(BaseModel):
    id: int
    date: str
    type: str
    amount: float
    description: str
    is_closed: bool

    class Config:
        from_attributes = True


def _get_or_create_account(db: Session, name: str, acc_type: AccountTypeEnum, company_id: int) -> Account:
    acc = db.query(Account).filter(Account.name == name, Account.company_id == company_id).first()
    if not acc:
        acc = Account(name=name, type=acc_type, company_id=company_id)
        db.add(acc)
        db.commit()
        db.refresh(acc)
    return acc


@router.get("/", response_model=List[SimpleTxResponse])
def list_ledger(
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id)
):
    """Return all simple ledger transactions."""
    txns = db.query(Transaction).filter(Transaction.company_id == company_id).order_by(Transaction.id.desc()).all()
    result = []
    for tx in txns:
        # Infer type from entries
        tx_type = "sales"
        total_amount = 0.0
        for entry in tx.entries:
            acc = db.query(Account).filter(Account.id == entry.account_id).first()
            if acc:
                if acc.type == AccountTypeEnum.REVENUE and entry.type == EntryTypeEnum.CREDIT:
                    tx_type = "sales"
                    total_amount = entry.amount
                elif acc.type == AccountTypeEnum.EXPENSE and entry.type == EntryTypeEnum.DEBIT:
                    # Check if it's salary
                    if "salary" in acc.name.lower():
                        tx_type = "salary"
                    else:
                        tx_type = "expense"
                    total_amount = entry.amount
        
        result.append(SimpleTxResponse(
            id=tx.id,
            date=tx.date.strftime("%Y-%m-%d") if tx.date else "",
            type=tx_type,
            amount=total_amount,
            description=tx.description,
            is_closed=tx.is_closed or False
        ))
    return result


@router.post("/", response_model=SimpleTxResponse)
def create_ledger_entry(
    payload: SimpleTxCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    """Create a simple revenue or expense transaction."""
    user_id = claims.get("user_id", 1)
    
    # Ensure accounts exist
    cash_acc = _get_or_create_account(db, "Cash", AccountTypeEnum.ASSET, company_id)
    
    if payload.type == "sales":
        revenue_acc = _get_or_create_account(db, "Sales Revenue", AccountTypeEnum.REVENUE, company_id)
        debit_acc = cash_acc
        credit_acc = revenue_acc
    elif payload.type == "salary":
        expense_acc = _get_or_create_account(db, "Salary Expense", AccountTypeEnum.EXPENSE, company_id)
        debit_acc = expense_acc
        credit_acc = cash_acc
    else:
        expense_acc = _get_or_create_account(db, "Operating Expense", AccountTypeEnum.EXPENSE, company_id)
        debit_acc = expense_acc
        credit_acc = cash_acc

    # Create Transaction
    tx = Transaction(
        description=payload.description,
        created_by_id=user_id,
        company_id=company_id,
        is_reversing=False,
        is_closed=False
    )
    db.add(tx)
    db.flush()

    # Double-entry: Debit
    db.add(JournalEntry(
        transaction_id=tx.id,
        account_id=debit_acc.id,
        amount=payload.amount,
        type=EntryTypeEnum.DEBIT
    ))
    # Double-entry: Credit
    db.add(JournalEntry(
        transaction_id=tx.id,
        account_id=credit_acc.id,
        amount=payload.amount,
        type=EntryTypeEnum.CREDIT
    ))

    db.commit()
    db.refresh(tx)

    return SimpleTxResponse(
        id=tx.id,
        date=tx.date.strftime("%Y-%m-%d") if tx.date else "",
        type=payload.type,
        amount=payload.amount,
        description=payload.description,
        is_closed=False
    )

@router.delete("/{tx_id}")
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(require_admin_role),
    company_id: int = Depends(get_current_company_id)
):
    """Admin endpoint to delete a specific transaction."""
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.company_id == company_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Delete associated records manually to ensure constraints are met
    db.query(JournalEntry).filter(JournalEntry.transaction_id == tx_id).delete()
    db.query(ExpenseReceipt).filter(ExpenseReceipt.transaction_id == tx_id).delete()
    
    db.delete(tx)
    db.commit()
    return {"message": "Transaction deleted successfully"}

@router.delete("/")
def delete_all_open_transactions(
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(require_admin_role),
    company_id: int = Depends(get_current_company_id)
):
    """Admin endpoint to delete ALL open (unclosed) transactions."""
    # Handle both is_closed=False and is_closed=None (NULL)
    open_tx_ids = [tx.id for tx in db.query(Transaction).filter(
        Transaction.company_id == company_id,
        or_(Transaction.is_closed == False, Transaction.is_closed == None)
    ).all()]
    
    if open_tx_ids:
        # Delete dependencies first
        db.query(JournalEntry).filter(JournalEntry.transaction_id.in_(open_tx_ids)).delete(synchronize_session=False)
        db.query(ExpenseReceipt).filter(ExpenseReceipt.transaction_id.in_(open_tx_ids)).delete(synchronize_session=False)
        db.query(Transaction).filter(Transaction.id.in_(open_tx_ids)).delete(synchronize_session=False)
        db.commit()
        
    return {"message": f"Deleted {len(open_tx_ids)} open transactions."}
