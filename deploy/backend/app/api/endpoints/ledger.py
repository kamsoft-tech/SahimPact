from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.db.database import get_db
from sqlalchemy import or_, func
from app.models.models import Transaction, JournalEntry, EntryTypeEnum, Account, AccountTypeEnum, ExpenseReceipt, User, RoleEnum
from app.core.security import require_partner_role, require_admin_role, get_current_company_id
from app.schemas.schemas import AccountResponse

router = APIRouter(prefix="/ledger", tags=["Ledger"])

@router.get("/stats")
def get_ledger_stats(
    db: Session = Depends(get_db), 
    company_id: Optional[int] = Depends(get_current_company_id),
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Summary stats for the dashboard, with optional period filtering."""
    revenue_query = db.query(Account).filter(Account.type == AccountTypeEnum.REVENUE)
    expense_query = db.query(Account).filter(Account.type == AccountTypeEnum.EXPENSE)
    partner_query = db.query(User).filter(or_(User.role == RoleEnum.PARTNER, User.role == RoleEnum.COMPANY_ADMIN))
    
    if company_id:
        revenue_query = revenue_query.filter(Account.company_id == company_id)
        expense_query = expense_query.filter(Account.company_id == company_id)
        partner_query = partner_query.filter(User.company_id == company_id)
        
    revenue_acc = revenue_query.all()
    revenue_ids = [a.id for a in revenue_acc]
    
    expense_acc = expense_query.all()
    expense_ids = [a.id for a in expense_acc]
    
    rev_tx_query = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
        JournalEntry.account_id.in_(revenue_ids) if revenue_ids else JournalEntry.id == -1,
        JournalEntry.type == EntryTypeEnum.CREDIT,
        Transaction.is_pending == False
    )
    
    exp_tx_query = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
        JournalEntry.account_id.in_(expense_ids) if expense_ids else JournalEntry.id == -1,
        JournalEntry.type == EntryTypeEnum.DEBIT,
        Transaction.is_pending == False
    )

    # Period Filtering
    if month and year:
        rev_tx_query = rev_tx_query.filter(
            func.extract('month', Transaction.date) == month,
            func.extract('year', Transaction.date) == year
        )
        exp_tx_query = exp_tx_query.filter(
            func.extract('month', Transaction.date) == month,
            func.extract('year', Transaction.date) == year
        )
    else:
        # Default to unclosed if no period specified?
        # No, dashboard usually shows everything or current unclosed.
        # Let's default to EVERYTHING if no filter, or user can select.
        pass

    if company_id:
        rev_tx_query = rev_tx_query.filter(Transaction.company_id == company_id)
        exp_tx_query = exp_tx_query.filter(Transaction.company_id == company_id)

    total_revenue = rev_tx_query.scalar() or 0.0
    total_expenses = exp_tx_query.scalar() or 0.0
    
    active_partners = partner_query.count()
    
    company_count = 0
    user_count = 0
    if not company_id:
        from app.models.models import Company
        company_count = db.query(Company).count()
        user_count = db.query(User).count()
    else:
        user_count = db.query(User).filter(User.company_id == company_id).count()

    return {
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_profit": total_revenue - total_expenses,
        "active_partners": active_partners,
        "company_count": company_count,
        "user_count": user_count
    }

@router.get("/accounts", response_model=List[AccountResponse])
def get_accounts(db: Session = Depends(get_db), company_id: Optional[int] = Depends(get_current_company_id)):
    """List all accounts for the company."""
    query = db.query(Account)
    if company_id:
        query = query.filter(Account.company_id == company_id)
        
    accounts = query.all()
    
    # Optional: Calculate balances here if the schema supports it
    # For now, just return the accounts
    return accounts

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
    created_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


def _get_or_create_account(db: Session, name: str, acc_type: AccountTypeEnum, company_id: int) -> Account:
    acc = db.query(Account).filter(Account.name == name, Account.company_id == company_id).first()
    if not acc:
        acc = Account(name=name, type=acc_type, company_id=company_id)
        db.add(acc)
        db.commit()
        db.refresh(acc)
    return acc


@router.get("", response_model=List[SimpleTxResponse])
def list_ledger(
    db: Session = Depends(get_db),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Return all simple ledger transactions."""
    query = db.query(Transaction)
    if company_id:
        query = query.filter(Transaction.company_id == company_id)
    txns = query.order_by(Transaction.id.desc()).all()
    result = []
    for tx in txns:
        # Infer type from entries
        tx_type = "transfer"
        total_amount = 0.0
        
        # Check for specific patterns
        if tx.description.startswith("Charity Payout:"):
            tx_type = "charity"
        elif tx.description.startswith("Global Charity Allocation"):
            tx_type = "allocation"
        
        for entry in tx.entries:
            acc = db.query(Account).filter(Account.id == entry.account_id).first()
            if acc:
                if acc.type == AccountTypeEnum.REVENUE and entry.type == EntryTypeEnum.CREDIT:
                    tx_type = "sales"
                    total_amount = entry.amount
                elif acc.type == AccountTypeEnum.EXPENSE and entry.type == EntryTypeEnum.DEBIT:
                    if "salary" in acc.name.lower():
                        tx_type = "salary"
                    else:
                        tx_type = "expense"
                    total_amount = entry.amount
                elif tx_type in ["charity", "allocation"] and entry.amount > total_amount:
                    # For charity/allocation, track the max amount in the entries
                    total_amount = entry.amount
        
        if tx_type == "transfer" and not total_amount:
            # Fallback for other transfers: use the amount of the first entry
            if tx.entries:
                total_amount = tx.entries[0].amount
        
        result.append(SimpleTxResponse(
            id=tx.id,
            date=tx.date.strftime("%Y-%m-%d") if tx.date else "",
            type=tx_type,
            amount=total_amount,
            description=tx.description,
            is_closed=tx.is_closed or False,
            created_by=tx.created_by_user.username if tx.created_by_user else "System"
        ))
    return result


@router.post("", response_model=SimpleTxResponse)
def create_ledger_entry(
    payload: SimpleTxCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    """Create a simple revenue or expense transaction."""
    user_id = claims.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID missing from token")
    
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
        is_closed=False,
        created_by=tx.created_by_user.username if tx.created_by_user else "System"
    )

@router.delete("/{tx_id}")
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(require_admin_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Admin endpoint to delete a specific transaction."""
    query = db.query(Transaction).filter(Transaction.id == tx_id)
    if company_id:
        query = query.filter(Transaction.company_id == company_id)
    tx = query.first()
    
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Delete associated records manually to ensure constraints are met
    db.query(JournalEntry).filter(JournalEntry.transaction_id == tx_id).delete()
    db.query(ExpenseReceipt).filter(ExpenseReceipt.transaction_id == tx_id).delete()
    
    db.delete(tx)
    db.commit()
    return {"message": "Transaction deleted successfully"}

class BulkDeleteRequest(BaseModel):
    transaction_ids: List[int]

@router.post("/bulk-delete")
def bulk_delete_transactions(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(require_admin_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Admin endpoint to bulk delete specific transactions."""
    if not payload.transaction_ids:
        return {"message": "No transactions provided for deletion."}

    # Only delete unclosed transactions to maintain historical integrity
    query = db.query(Transaction).filter(
        Transaction.id.in_(payload.transaction_ids),
        or_(Transaction.is_closed == False, Transaction.is_closed == None)
    )
    if company_id:
        query = query.filter(Transaction.company_id == company_id)
    valid_txs = query.all()

    valid_ids = [tx.id for tx in valid_txs]

    if valid_ids:
        # Delete dependencies first
        db.query(JournalEntry).filter(JournalEntry.transaction_id.in_(valid_ids)).delete(synchronize_session=False)
        db.query(ExpenseReceipt).filter(ExpenseReceipt.transaction_id.in_(valid_ids)).delete(synchronize_session=False)
        db.query(Transaction).filter(Transaction.id.in_(valid_ids)).delete(synchronize_session=False)
        db.commit()

    return {"message": f"Deleted {len(valid_ids)} transactions successfully."}

@router.delete("")
def delete_all_open_transactions(
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(require_admin_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Admin endpoint to delete ALL open (unclosed) transactions."""
    query = db.query(Transaction).filter(
        or_(Transaction.is_closed == False, Transaction.is_closed == None)
    )
    if company_id:
        query = query.filter(Transaction.company_id == company_id)
        
    open_tx_ids = [tx.id for tx in query.all()]
    
    if open_tx_ids:
        # Delete dependencies first
        db.query(JournalEntry).filter(JournalEntry.transaction_id.in_(open_tx_ids)).delete(synchronize_session=False)
        db.query(ExpenseReceipt).filter(ExpenseReceipt.transaction_id.in_(open_tx_ids)).delete(synchronize_session=False)
        db.query(Transaction).filter(Transaction.id.in_(open_tx_ids)).delete(synchronize_session=False)
        db.commit()
        
    return {"message": f"Deleted {len(open_tx_ids)} open transactions."}

@router.get("/pending/count")
def get_pending_count(
    db: Session = Depends(get_db),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Return the number of pending transactions."""
    query = db.query(Transaction).filter(Transaction.is_pending == True)
    if company_id:
        query = query.filter(Transaction.company_id == company_id)
    return {"count": query.count()}

@router.get("/pending", response_model=List[SimpleTxResponse])
def list_pending_transactions(
    db: Session = Depends(get_db),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """List all transactions flagged as pending (potential duplicates)."""
    query = db.query(Transaction).filter(Transaction.is_pending == True)
    if company_id:
        query = query.filter(Transaction.company_id == company_id)
    
    txns = query.order_by(Transaction.date.desc()).all()
    result = []
    for tx in txns:
        tx_type = "expense"
        amount = 0.0
        # Basic inference for simple list
        for entry in tx.entries:
            acc = entry.account
            if acc.type == AccountTypeEnum.REVENUE:
                tx_type = "sales"
                amount = entry.amount
                break
            elif acc.type == AccountTypeEnum.EXPENSE:
                tx_type = "expense"
                amount = entry.amount
                break

        result.append(SimpleTxResponse(
            id=tx.id,
            date=tx.date.strftime("%Y-%m-%d") if tx.date else "",
            type=tx_type,
            amount=amount,
            description=tx.description,
            is_closed=False,
            created_by=tx.created_by_user.username if tx.created_by_user else "System"
        ))
    return result

@router.put("/{tx_id}/approve")
def approve_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Admin endpoint to approve a pending transaction."""
    query = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.is_pending == True)
    if company_id:
        query = query.filter(Transaction.company_id == company_id)
    
    tx = query.first()
    if not tx:
        raise HTTPException(status_code=404, detail="Pending transaction not found")
    
    tx.is_pending = False
    db.commit()
    return {"message": "Transaction approved successfully"}

@router.delete("/{tx_id}/reject")
def reject_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Admin endpoint to reject (delete) a pending transaction."""
    query = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.is_pending == True)
    if company_id:
        query = query.filter(Transaction.company_id == company_id)
    
    tx = query.first()
    if not tx:
        raise HTTPException(status_code=404, detail="Pending transaction not found")
    
    # Delete associated entries
    db.query(JournalEntry).filter(JournalEntry.transaction_id == tx_id).delete()
    db.delete(tx)
    db.commit()
    return {"message": "Transaction rejected and deleted"}
