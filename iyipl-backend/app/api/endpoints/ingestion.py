from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import csv
import io
from app.db.database import get_db
from app.schemas.schemas import TransactionCreate, JournalEntryCreate
from app.services.journal_service import create_journal_transaction
from app.models.models import Account, AccountTypeEnum, EntryTypeEnum
from app.api.endpoints.ledger import _get_or_create_account
from pydantic import BaseModel

from app.core.security import require_partner_role, get_current_company_id

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

class POSDailySalesPayload(BaseModel):
    date: str
    gross_sales: float
    tax_collected: float
    tips_collected: float
    # Add other POS specific fields as needed

@router.post("/pos")
def ingest_pos_data(
    payload: POSDailySalesPayload, 
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    # 1. Fetch relevant accounts
    cash_asset_account = db.query(Account).filter_by(name="Cash", type=AccountTypeEnum.ASSET, company_id=company_id).first()
    sales_revenue_account = db.query(Account).filter_by(name="Sales Revenue", type=AccountTypeEnum.REVENUE, company_id=company_id).first()
    tax_liability_account = db.query(Account).filter_by(name="Sales Tax Payable", type=AccountTypeEnum.LIABILITY, company_id=company_id).first()

    if not all([cash_asset_account, sales_revenue_account, tax_liability_account]):
        raise HTTPException(status_code=500, detail="Core Accounts not configured in DB.")

    total_cash_received = payload.gross_sales + payload.tax_collected

    # 2. Build Double-Entry Transaction
    transaction_data = TransactionCreate(
        description=f"POS Daily Ingestion - {payload.date}",
        entries=[
            # Debit Cash for the total received
            JournalEntryCreate(
                account_id=cash_asset_account.id, 
                amount=total_cash_received, 
                type=EntryTypeEnum.DEBIT
            ),
            # Credit Sales Revenue
            JournalEntryCreate(
                account_id=sales_revenue_account.id, 
                amount=payload.gross_sales, 
                type=EntryTypeEnum.CREDIT
            ),
            # Credit Tax Payable Liability
            JournalEntryCreate(
                account_id=tax_liability_account.id, 
                amount=payload.tax_collected, 
                type=EntryTypeEnum.CREDIT
            )
        ]
    )

    # 3. Post to Journal
    admin_system_id = claims.get("user_id", 1)
    return create_journal_transaction(db, transaction_data, admin_system_id, company_id)

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

    # Date candidates
    date_col = get_col(['date', 'created on'])
    
    # Description candidates
    desc_cols = [col for col in headers if col.strip().lower() in (
        'description', 'transaction description', 'reference', 'target name', 'source name', 'note'
    )]
    
    # Amount candidates
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
        raise HTTPException(
            status_code=400, 
            detail="CSV must contain Amount columns ('Amount', 'Paid In/Out', or Wise 'Direction' & 'Source amount')."
        )

    try:
        # Ensure accounts exist
        cash_acc = _get_or_create_account(db, "Cash", AccountTypeEnum.ASSET, company_id)
        revenue_acc = _get_or_create_account(db, "Sales Revenue", AccountTypeEnum.REVENUE, company_id)
        expense_acc = _get_or_create_account(db, "Operating Expense", AccountTypeEnum.EXPENSE, company_id)
        
        user_id = claims.get("user_id", 1)
        processed_count = 0

        def clean_float(valstr):
            if not valstr: return 0.0
            try:
                return float(valstr.strip().replace('"', '').replace(',', ''))
            except ValueError:
                return 0.0

        for row in reader:
            amount = 0.0
            
            # 1. Standard Amount column
            if amount_col and row.get(amount_col):
                amount = clean_float(row[amount_col])
                
            # 2. Paid In / Paid Out (Tide)
            elif paid_in_col or paid_out_col:
                in_val = clean_float(row.get(paid_in_col))
                out_val = clean_float(row.get(paid_out_col))
                if in_val != 0:
                    amount = abs(in_val)
                elif out_val != 0:
                    amount = -abs(out_val)
                    
            # 3. Wise Format (Direction + Source amount)
            elif wise_amount_col and wise_direction_col:
                source_amount = clean_float(row.get(wise_amount_col))
                direction = row.get(wise_direction_col, "").strip().upper()
                if direction == 'IN':
                    amount = abs(source_amount)
                elif direction == 'OUT':
                    amount = -abs(source_amount)

            if amount == 0:
                continue

            # Build Description from available columns
            desc_parts = []
            for dcol in desc_cols:
                val = row.get(dcol, "").strip()
                if val and val not in desc_parts:
                    desc_parts.append(val)
            desc = " | ".join(desc_parts) if desc_parts else "Bank Transaction"
            
            # Wise 'Status' check to avoid importing refunded/failed transactions
            status_col = get_col(['status'])
            if status_col:
                status_val = row.get(status_col, "").strip().upper()
                if status_val in ['REFUNDED', 'CANCELLED', 'FAILED']:
                    continue

            date_str = row.get(date_col, "").strip()
            # Clean quotes from date if any
            date_str = date_str.replace('"', '')
            
            # Determine Sales (incoming) or Expense (outgoing)
            if amount > 0:
                # Sales: Debit Cash, Credit Revenue
                entries = [
                    JournalEntryCreate(account_id=cash_acc.id, amount=amount, type=EntryTypeEnum.DEBIT),
                    JournalEntryCreate(account_id=revenue_acc.id, amount=amount, type=EntryTypeEnum.CREDIT)
                ]
            else:
                # Expense: Debit Expense, Credit Cash
                abs_amount = abs(amount)
                entries = [
                    JournalEntryCreate(account_id=expense_acc.id, amount=abs_amount, type=EntryTypeEnum.DEBIT),
                    JournalEntryCreate(account_id=cash_acc.id, amount=abs_amount, type=EntryTypeEnum.CREDIT)
                ]
                
            transaction_data = TransactionCreate(
                description=f"{desc} (CSV Import - {date_str})"[0:255], # Truncate to avoid DB length limits if combined desc is massive
                entries=entries
            )
            
            create_journal_transaction(db, transaction_data, user_id, company_id)
            processed_count += 1
            
        return {"message": f"Successfully processed {processed_count} transactions from bank statement"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Processing Error: {str(e)}")
