from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import shutil
import os
from uuid import uuid4
from app.db.database import get_db
from app.schemas.schemas import TransactionCreate, JournalEntryCreate
from app.services.journal_service import create_journal_transaction
from app.models.models import Account, AccountTypeEnum, EntryTypeEnum, ExpenseReceipt

from app.core.security import require_partner_role, get_current_company_id
from app.api.endpoints.ledger import _get_or_create_account

router = APIRouter(prefix="/expenses", tags=["Expenses"])

UPLOAD_DIR = "uploads/receipts"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("")
def get_expenses(
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    """List expenses for the current company."""
    # This is a simplified view. In a real app, you'd join with Transactions and Receipts.
    receipts = db.query(ExpenseReceipt).all()
    # Filter by company if possible (ExpenseReceipt doesn't have company_id, but Transactions do)
    # For now, return all for simplicity or add filtering
    return receipts

@router.post("")
def create_expense(
    amount: float = Form(...),
    description: str = Form(...),
    category_id: int = Form(...), # Should be a valid Expense Account ID
    is_out_of_pocket: bool = Form(False),
    partner_id: int = Form(None), # If out-of-pocket, who spent the money?
    receipt_file: UploadFile = File(None),
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    # 1. Determine the Credit Account
    credit_account = None
    
    if is_out_of_pocket:
        # Use partner_id if provided (admin logging for partner), otherwise use current user's ID
        target_partner_id = partner_id if partner_id else claims.get("user_id")
        
        # Check if the Reimbursement account for this partner exists
        account_name = f"Partner {target_partner_id} Reimbursement"
        credit_account = db.query(Account).filter_by(name=account_name, type=AccountTypeEnum.LIABILITY, company_id=company_id).first()
        
        if not credit_account:
            # Auto-create reimbursement account if it doesn't exist
            credit_account = Account(name=account_name, type=AccountTypeEnum.LIABILITY, company_id=company_id)
            db.add(credit_account)
            db.flush()
    else:
        # Standard expense: Credit Cash
        credit_account = _get_or_create_account(db, "Cash", AccountTypeEnum.ASSET, company_id)

    # 2. Record Double-Entry Journal
    transaction_data = TransactionCreate(
        description=description,
        entries=[
            # Debit Expense Account
            JournalEntryCreate(
                account_id=category_id,
                amount=amount,
                type=EntryTypeEnum.DEBIT
            ),
            # Credit Cash or Liability
            JournalEntryCreate(
                account_id=credit_account.id,
                amount=amount,
                type=EntryTypeEnum.CREDIT
            )
        ]
    )
    
    user_id = claims.get("user_id", 1)
    db_transaction = create_journal_transaction(db, transaction_data, user_id, company_id)

    # 3. Handle Receipt Upload
    receipt_url = None
    if receipt_file:
        file_ext = receipt_file.filename.split(".")[-1]
        unique_filename = f"{uuid4()}.{file_ext}"
        filepath = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(receipt_file.file, buffer)
        
        receipt_url = filepath
        
        db_receipt = ExpenseReceipt(transaction_id=db_transaction.id, receipt_url=receipt_url)
        db.add(db_receipt)
        db.commit()

    return {"message": "Expense logged successfully", "transaction_id": db_transaction.id, "receipt_url": receipt_url, "is_out_of_pocket": is_out_of_pocket}
