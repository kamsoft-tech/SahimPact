from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.db.database import get_db
from app.models.models import GlobalSettings, User, PartnerShare
from app.schemas.schemas import GlobalSettingsResponse, GlobalSettingsUpdate
from app.core.security import require_partner_role, get_current_company_id, get_current_active_user, require_admin_role
from datetime import datetime, timezone

router = APIRouter()

@router.get("/settings", response_model=GlobalSettingsResponse)
def get_settings(db: Session = Depends(get_db), company_id: Optional[int] = Depends(get_current_company_id)):
    if not company_id:
        return GlobalSettings(
            charity_percentage=0.06,
            currency_symbol="£",
            primary_color="#2EDEA4",
            secondary_color="#F59E0B",
            partnership_mode="both",
            labour_share_mode="time",
            is_setup_complete=False,
            capital_pool_percentage=0.50,
            labour_pool_percentage=0.50,
            contingency_pot_minimum=10000.0
        )

    settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
    if not settings:
        # Create default settings if none exist
        settings = GlobalSettings(
            company_id=company_id,
            charity_percentage=0.06,
            partnership_mode="both",
            labour_share_mode="time",
            currency_symbol="£",
            capital_pool_percentage=0.50,
            labour_pool_percentage=0.50,
            contingency_pot_minimum=10000.0
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/settings", response_model=GlobalSettingsResponse)
def update_settings(
    settings_update: GlobalSettingsUpdate, 
    db: Session = Depends(get_db), 
    company_id: Optional[int] = Depends(get_current_company_id), 
    current_user: User = Depends(get_current_active_user),
    claims: dict = Depends(require_admin_role)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Fetch current settings to compare or use as base
    current_settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
    
    # Prepare the proposed settings dict
    proposed_settings = settings_update.model_dump()
    provided_summary = proposed_settings.pop('summary', None)
    
    # Check for existing pending agreement
    from app.models.models import Agreement, AgreementSignoff, AgreementStatus, RoleEnum
    from sqlalchemy import or_

    existing_agreement = db.query(Agreement).filter(
        Agreement.company_id == company_id,
        Agreement.status == AgreementStatus.PENDING
    ).first()

    if existing_agreement:
        # Update existing
        existing_agreement.proposed_settings = proposed_settings
        # PRESERVE existing proposed_shares if they exist, otherwise use current DB state
        if not existing_agreement.proposed_shares:
            current_shares = db.query(PartnerShare).filter(PartnerShare.company_id == company_id).all()
            existing_agreement.proposed_shares = [
                {
                    "user_id": s.user_id,
                    "capital_share_fixed": s.capital_share_fixed,
                    "labor_share_variable": s.labor_share_variable,
                    "voluntary_charity_percentage": s.voluntary_charity_percentage
                } for s in current_shares
            ]
        
        existing_agreement.proposed_by_id = current_user.id
        existing_agreement.created_at = datetime.now(timezone.utc)
        
        if provided_summary:
            existing_agreement.change_summary = provided_summary
            
        # Reset signoffs
        db.query(AgreementSignoff).filter(AgreementSignoff.agreement_id == existing_agreement.id).delete()
        agreement = existing_agreement
    else:
        # Create new
        # Fetch all current shares to include in the agreement snapshot
        current_shares = db.query(PartnerShare).filter(PartnerShare.company_id == company_id).all()
        proposed_shares = [
            {
                "user_id": s.user_id,
                "capital_share_fixed": s.capital_share_fixed,
                "labor_share_variable": s.labor_share_variable,
                "voluntary_charity_percentage": s.voluntary_charity_percentage
            } for s in current_shares
        ]

        agreement = Agreement(
            company_id=company_id,
            proposed_by_id=current_user.id,
            proposed_settings=proposed_settings,
            proposed_shares=proposed_shares,
            status=AgreementStatus.PENDING,
            change_summary=provided_summary if provided_summary else "Update financial parameters"
        )
        db.add(agreement)
        db.commit()
        db.refresh(agreement)

    # Create signoffs for all active admins and partners
    from app.models.models import UserCompanyLink
    active_users = db.query(User).join(UserCompanyLink).filter(
        UserCompanyLink.company_id == company_id,
        User.is_active == True,
        or_(User.role == RoleEnum.COMPANY_ADMIN, User.role == RoleEnum.PARTNER)
    ).all()

    for user in active_users:
        signoff = AgreementSignoff(
            agreement_id=agreement.id,
            user_id=user.id,
            status=AgreementStatus.PENDING
        )
        # Auto-approve for the person who proposed it? 
        # User said "notify everyone and require them to agree", so let's keep it pending even for the proposer for clarity, 
        # or auto-approve for the proposer. Usually auto-approving for the proposer is better UX.
        if user.id == current_user.id:
            signoff.status = AgreementStatus.APPROVED
            signoff.signed_at = datetime.now(timezone.utc)
            
        db.add(signoff)

    db.commit()
    
    from app.core.security import log_audit_event
    log_audit_event(
        db, action="PROPOSE_SETTINGS_CHANGE", user_id=current_user.id, company_id=company_id,
        target_id=str(agreement.id), details={"summary": provided_summary}
    )
    
    # Return the current (un-updated) settings so the UI knows nothing changed yet in the active state
    if not current_settings:
        return GlobalSettings(
            company_id=company_id,
            charity_percentage=0.06,
            currency_symbol="£",
            primary_color="#2EDEA4",
            secondary_color="#F59E0B",
            partnership_mode="both",
            labour_share_mode="time",
            is_setup_complete=False,
            capital_pool_percentage=0.50,
            labour_pool_percentage=0.50,
            contingency_pot_minimum=10000.0
        )
    return current_settings
