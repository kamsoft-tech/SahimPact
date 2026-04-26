from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import GlobalSettings
from app.schemas.schemas import GlobalSettingsResponse, GlobalSettingsUpdate
from app.core.security import require_partner_role, get_current_company_id

router = APIRouter()

@router.get("/settings", response_model=GlobalSettingsResponse)
def get_settings(db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
    if not settings:
        # Create default settings if none exist
        settings = GlobalSettings(
            company_id=company_id,
            charity_percentage=0.06,
            partnership_mode="both",
            labour_share_mode="time",
            currency_symbol="£"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/settings", response_model=GlobalSettingsResponse)
def update_settings(settings_update: GlobalSettingsUpdate, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
    if not settings:
        settings = GlobalSettings(
            company_id=company_id,
            charity_percentage=settings_update.charity_percentage,
            partnership_mode=settings_update.partnership_mode,
            labour_share_mode=settings_update.labour_share_mode,
            currency_symbol=settings_update.currency_symbol
        )
        db.add(settings)
    else:
        settings.charity_percentage = settings_update.charity_percentage
        settings.partnership_mode = settings_update.partnership_mode
        settings.labour_share_mode = settings_update.labour_share_mode
        settings.currency_symbol = settings_update.currency_symbol
        settings.is_setup_complete = settings_update.is_setup_complete
    db.commit()
    db.refresh(settings)
    return settings
