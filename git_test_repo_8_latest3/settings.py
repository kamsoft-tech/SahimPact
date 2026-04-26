from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.distribution_service import calculate_month_end_close

from app.core.security import require_partner_role, get_current_company_id
from app.models.models import MonthlyReport
from app.schemas.schemas import MonthlyReportResponse
from typing import List

router = APIRouter(prefix="/distribution", tags=["Profit Distribution"])

@router.post("/month-end-close")
def trigger_month_end_close(db: Session = Depends(get_db), claims: dict = Depends(require_partner_role), company_id: int = Depends(get_current_company_id)):
    admin_id = claims.get("user_id", 1) # Fallback to 1 if not in claims
    return calculate_month_end_close(db, admin_id, company_id)

@router.get("/reports", response_model=List[MonthlyReportResponse])
def get_monthly_reports(db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    return db.query(MonthlyReport).filter(MonthlyReport.company_id == company_id).order_by(MonthlyReport.created_at.desc()).all()
