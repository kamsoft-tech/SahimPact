from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.db.database import get_db
from app.schemas.schemas import TransactionCreate, JournalEntryCreate
from app.services.journal_service import create_journal_transaction
from app.models.models import Account, AccountTypeEnum, EntryTypeEnum
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
