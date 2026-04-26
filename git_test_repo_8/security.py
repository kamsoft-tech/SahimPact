from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import TransactionCreate, TransactionResponse
from app.services.journal_service import create_journal_transaction

from app.core.security import require_partner_role, get_current_company_id

router = APIRouter(prefix="/journal", tags=["Journal"])

@router.post("/", response_model=TransactionResponse)
def post_transaction(
    transaction: TransactionCreate, 
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    user_id = claims.get("user_id", 1) 
    return create_journal_transaction(db, transaction, user_id, company_id)
