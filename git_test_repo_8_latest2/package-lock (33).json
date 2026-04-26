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

router = APIRouter(prefix="/expenses", tags=["Expenses"])

UPLOAD_DIR = "uploads/receipts"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/")
def create_expense(
    amount: float = Form(...),
    description: str = Form(...),
    category_id: int = Form(...), # Should be a valid Expense Account ID
    receipt_file: UploadFile = File(None),
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    # Retrieve operating cash account (defaulting to 'Cash' for demo)
    cash_account = db.query(Account).filter_by(name="Cash", type=AccountTypeEnum.ASSET, company_id=company_id).first()
    if not cash_account:
        raise HTTPException(status_code=500, detail="Cash account not found")

    # 1. Record Double-Entry Journal
    transaction_data = TransactionCreate(
        description=description,
        entries=[
            # Debit Expense Account
            JournalEntryCreate(
                account_id=category_id,
                amount=amount,
                type=EntryTypeEnum.DEBIT
            ),
            # Credit Cash Account
            JournalEntryCreate(
                account_id=cash_account.id,
                amount=amount,
                type=EntryTypeEnum.CREDIT
            )
        ]
    )
    
    user_id = claims.get("user_id", 1)
    db_transaction = create_journal_transaction(db, transaction_data, user_id, company_id)

    # 2. Handle Receipt Upload & OCR preparation
    receipt_url = None
    if receipt_file:
        file_ext = receipt_file.filename.split(".")[-1]
        unique_filename = f"{uuid4()}.{file_ext}"
        filepath = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(receipt_file.file, buffer)
        
        receipt_url = filepath
        
        # Link receipt to transaction
        db_receipt = ExpenseReceipt(transaction_id=db_transaction.id, receipt_url=receipt_url)
        db.add(db_receipt)
        db.commit()

        # NOTE FOR FUTURE: Trigger async OCR task here using AWS Textract or Tesseract
        # ocr_service.extract_text.delay(filepath)

    return {"message": "Expense logged successfully", "transaction_id": db_transaction.id, "receipt_url": receipt_url}
