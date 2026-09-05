from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import csv
import io
from app.db.database import get_db
from app.schemas.schemas import TransactionCreate, JournalEntryCreate
from app.services.journal_service import create_journal_transaction
from app.models.models import Account, AccountTypeEnum, EntryTypeEnum, Transaction, JournalEntry
from app.api.endpoints.ledger import _get_or_create_account
from pydantic import BaseModel

from app.core.security import require_partner_role, get_current_company_id

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

@router.post("/bank-statement")
async def ingest_bank_statement(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="CSV file too large. Max 2MB.")

    try:
        decoded_content = content.decode("utf-8")
    except UnicodeDecodeError:
        decoded_content = content.decode("latin-1") # Fallback for some bank CSVs
    
    if not decoded_content.strip():
        raise HTTPException(status_code=400, detail="Empty CSV file.")

    reader = csv.DictReader(io.StringIO(decoded_content))
    headers = reader.fieldnames if reader.fieldnames else []
    
    def get_col(candidates):
        for header in headers:
            if header.strip().lower() in candidates:
                return header
        return None

    date_col = get_col(['date', 'created on'])
    desc_cols = [col for col in headers if col.strip().lower() in (
        'description', 'transaction description', 'reference', 'target name', 'source name', 'note'
    )]
    amount_col = get_col(['amount', 'amount in gbp'])
    paid_in_col = get_col(['paid in'])
    paid_out_col = get_col(['paid out'])
    wise_amount_col = get_col(['source amount (after fees)'])
    wise_direction_col = get_col(['direction'])

    if not date_col:
        raise HTTPException(status_code=400, detail="CSV must contain a Date column ('Date' or 'Created on').")
    if not desc_cols:
        raise HTTPException(status_code=400, detail="CSV must contain a Description column.")
    if not amount_col and not (paid_in_col or paid_out_col) and not (wise_amount_col and wise_direction_col):
        raise HTTPException(status_code=400, detail="CSV must contain Amount columns.")

    try:
        cash_acc = _get_or_create_account(db, "Cash", AccountTypeEnum.ASSET, company_id)
        revenue_acc = _get_or_create_account(db, "Sales Revenue", AccountTypeEnum.REVENUE, company_id)
        expense_acc = _get_or_create_account(db, "Operating Expense", AccountTypeEnum.EXPENSE, company_id)
        
        user_id = claims.get("user_id", 1)
        processed_count = 0
        duplicate_count = 0

        def clean_float(valstr):
            if not valstr: return 0.0
            try:
                return float(valstr.strip().replace('"', '').replace(',', ''))
            except ValueError: return 0.0

        for row in reader:
            amount = 0.0
            if amount_col and row.get(amount_col):
                amount = clean_float(row[amount_col])
            elif paid_in_col or paid_out_col:
                in_val = clean_float(row.get(paid_in_col))
                out_val = clean_float(row.get(paid_out_col))
                amount = abs(in_val) if in_val != 0 else -abs(out_val)
            elif wise_amount_col and wise_direction_col:
                source_amount = clean_float(row.get(wise_amount_col))
                direction = row.get(wise_direction_col, "").strip().upper()
                amount = abs(source_amount) if direction == 'IN' else -abs(source_amount)

            if amount == 0: continue

            desc_parts = [row.get(dcol, "").strip() for dcol in desc_cols if row.get(dcol, "").strip()]
            desc = " | ".join(desc_parts) if desc_parts else "Bank Transaction"
            
            # Sanitize description to prevent CSV injection if exported later
            if desc and desc[0] in ('=', '+', '-', '@', '\t', '\r'):
                desc = "'" + desc
            
            status_col = get_col(['status'])
            if status_col and row.get(status_col, "").strip().upper() in ['REFUNDED', 'CANCELLED', 'FAILED']:
                continue

            date_str = row.get(date_col, "").strip().replace('"', '')
            try:
                # Try common formats
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                    try:
                        tx_date = datetime.strptime(date_str, fmt)
                        break
                    except ValueError: continue
                else:
                    tx_date = datetime.now()
            except:
                tx_date = datetime.now()

            # Duplicate Detection Logic
            # Check for transactions with same amount within +/- 1 day
            from datetime import timedelta
            start_range = tx_date - timedelta(days=1)
            end_range = tx_date + timedelta(days=1)
            
            is_pending = False
            abs_amount = abs(amount)
            
            # Query existing entries with same amount in date range
            existing_tx = db.query(Transaction).join(JournalEntry).filter(
                Transaction.company_id == company_id,
                Transaction.date >= start_range,
                Transaction.date <= end_range,
                JournalEntry.amount == abs_amount,
                Transaction.is_pending == False # Only match against approved/manual ones
            ).first()

            if existing_tx:
                is_pending = True
                duplicate_count += 1

            if amount > 0:
                entries = [
                    JournalEntryCreate(account_id=cash_acc.id, amount=amount, type=EntryTypeEnum.DEBIT),
                    JournalEntryCreate(account_id=revenue_acc.id, amount=amount, type=EntryTypeEnum.CREDIT)
                ]
            else:
                entries = [
                    JournalEntryCreate(account_id=expense_acc.id, amount=abs_amount, type=EntryTypeEnum.DEBIT),
                    JournalEntryCreate(account_id=cash_acc.id, amount=abs_amount, type=EntryTypeEnum.CREDIT)
                ]
                
            transaction_data = TransactionCreate(
                description=f"{desc} (CSV Import - {date_str})"[0:255],
                entries=entries
            )
            
            create_journal_transaction(db, transaction_data, user_id, company_id, is_pending=is_pending)
            processed_count += 1
            
        return {
            "message": f"Processed {processed_count} transactions.",
            "duplicates_flagged": duplicate_count
        }
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Bank statement ingestion failed: %s", str(e))
        raise HTTPException(status_code=400, detail="Failed to process CSV.")
