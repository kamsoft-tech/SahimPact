from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, timezone

from app.db.database import get_db
from app.models.models import (
    PartnerShare, User, RoleEnum, GlobalSettings, TimeEntry,
    Agreement, AgreementStatus, AgreementSignoff
)
from app.schemas.schemas import PartnerShareResponse, PartnerShareUpdate, PartnerCreate, PartnerRename
from app.core.security import get_password_hash, get_current_company_id, get_current_active_user

router = APIRouter()

@router.get("/admin/shares", response_model=List[PartnerShareResponse])
def get_partner_shares(db: Session = Depends(get_db), company_id: Optional[int] = Depends(get_current_company_id)):
    # Fetch all users who should have shares (Partners and Admins, but NOT Super Admins)
    query = db.query(User).filter(
        User.role != RoleEnum.SUPER_ADMIN
    )
    if company_id:
        query = query.filter(User.company_id == company_id)
        
    users = query.all()
    
    shares_data = []
    for user in users:
        # Get or create share record for display (not necessarily persisting yet)
        share_query = db.query(PartnerShare).filter(PartnerShare.user_id == user.id)
        if company_id:
            share_query = share_query.filter(PartnerShare.company_id == company_id)
        share = share_query.first()
        if not share:
            # Return a virtual share object for the UI to edit
            share = PartnerShare(
                user_id=user.id,
                company_id=company_id,
                capital_share_fixed=0.0,
                labor_share_variable=0.0,
                voluntary_charity_percentage=0.0
            )
        
        # Attach transient name for the response schema
        share.partner_name = user.full_name if user.full_name else user.username
        shares_data.append(share)
    
    shares = shares_data
    
    # Calculate capital percentages
    total_capital = sum((s.capital_share_fixed or 0) for s in shares)
    for share in shares:
        if total_capital > 0:
            share.capital_share_percentage = ((share.capital_share_fixed or 0) / total_capital) * 100
        else:
            share.capital_share_percentage = 0.0

    # Fetch global settings to determine how to calculate labor share
    settings_query = db.query(GlobalSettings)
    if company_id:
        settings_query = settings_query.filter(GlobalSettings.company_id == company_id)
    settings = settings_query.first()
    labour_mode = settings.labour_share_mode if settings else "time"

    if labour_mode == "time":
        # Calculate labor shares dynamically based on logged time
        time_query = db.query(TimeEntry).filter(or_(TimeEntry.is_closed == False, TimeEntry.is_closed == None))
        if company_id:
            time_query = time_query.filter(TimeEntry.company_id == company_id)
        open_entries = time_query.all()
        total_hours = sum(e.hours for e in open_entries)

        partner_hours = {}
        for entry in open_entries:
            partner_hours[entry.user_id] = partner_hours.get(entry.user_id, 0.0) + entry.hours

        for share in shares:
            if total_hours > 0:
                hrs = partner_hours.get(share.user_id, 0.0)
                share.labor_share_variable = (hrs / total_hours) * 100
            else:
                share.labor_share_variable = 0.0
    
    # If labour_mode == "percentage", we just return the labor_share_variable currently in DB (which the admin manually edits)

    return shares

@router.put("/admin/shares/{user_id}", response_model=PartnerShareResponse)
def update_partner_share(
    user_id: int, 
    share_update: PartnerShareUpdate, 
    db: Session = Depends(get_db), 
    company_id: Optional[int] = Depends(get_current_company_id),
    current_user: User = Depends(get_current_active_user)
):
    try:
        # 1. Basic Validations
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if target_user.role == RoleEnum.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Super Admins cannot be partners")
            
        if not company_id:
            if current_user.role == RoleEnum.SUPER_ADMIN:
                company_id = target_user.company_id
            else:
                raise HTTPException(status_code=400, detail="Company ID required")

        if not company_id:
             raise HTTPException(status_code=400, detail="Target user has no associated company")

        if current_user.role != RoleEnum.SUPER_ADMIN and target_user.company_id != company_id:
             raise HTTPException(status_code=403, detail="User does not belong to your company")

        # 3. Handle Agreement and Shares
        existing_agreement = db.query(Agreement).filter(
            Agreement.company_id == company_id,
            Agreement.status == AgreementStatus.PENDING
        ).first()

        if existing_agreement:
            # PRESERVE existing proposed_settings if they exist
            if existing_agreement.proposed_settings:
                proposed_settings = existing_agreement.proposed_settings
            else:
                # Prepare Settings Snapshot from DB
                settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
                proposed_settings = {
                    "charity_percentage": settings.charity_percentage if settings else 0.06,
                    "partnership_mode": settings.partnership_mode if settings else "both",
                    "labour_share_mode": settings.labour_share_mode if settings else "time",
                    "currency_symbol": settings.currency_symbol if settings else "£",
                    "capital_pool_percentage": settings.capital_pool_percentage if settings else 0.50,
                    "labour_pool_percentage": settings.labour_pool_percentage if settings else 0.50,
                    "contingency_pot_minimum": settings.contingency_pot_minimum if settings else 10000.0,
                    "logo_url": settings.logo_url if settings else None,
                    "favicon_url": settings.favicon_url if settings else None,
                    "primary_color": settings.primary_color if settings else "#94d4ad",
                    "secondary_color": settings.secondary_color if settings else "#bfc1ff"
                }

            # Update existing agreement
            # Update existing agreement
            proposed_shares = list(existing_agreement.proposed_shares or [])
            found = False
            for i, s in enumerate(proposed_shares):
                try:
                    s_user_id = int(s.get('user_id'))
                    if s_user_id == int(user_id):
                        new_s = s.copy()
                        new_s["capital_share_fixed"] = round(share_update.capital_share_fixed, 2)
                        new_s["labor_share_variable"] = round(share_update.labor_share_variable, 4)
                        new_s["voluntary_charity_percentage"] = round(share_update.voluntary_charity_percentage, 4)
                        proposed_shares[i] = new_s
                        found = True
                        break
                except (TypeError, ValueError):
                    continue

            if not found:
                proposed_shares.append({
                    "user_id": int(user_id),
                    "capital_share_fixed": round(share_update.capital_share_fixed, 2),
                    "labor_share_variable": round(share_update.labor_share_variable, 4),
                    "voluntary_charity_percentage": round(share_update.voluntary_charity_percentage, 4)
                })
            
            existing_agreement.proposed_settings = proposed_settings
            existing_agreement.proposed_shares = proposed_shares
            flag_modified(existing_agreement, "proposed_shares")
            existing_agreement.proposed_by_id = current_user.id
            existing_agreement.created_at = datetime.now(timezone.utc)
            
            if share_update.summary:
                existing_agreement.change_summary = share_update.summary
            
            # Clear old signoffs
            db.query(AgreementSignoff).filter(AgreementSignoff.agreement_id == existing_agreement.id).delete()
            agreement = existing_agreement
        else:
            # Create new agreement
            # Prepare Settings Snapshot from DB
            settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
            proposed_settings = {
                "charity_percentage": settings.charity_percentage if settings else 0.06,
                "partnership_mode": settings.partnership_mode if settings else "both",
                "labour_share_mode": settings.labour_share_mode if settings else "time",
                "currency_symbol": settings.currency_symbol if settings else "£",
                "capital_pool_percentage": settings.capital_pool_percentage if settings else 0.50,
                "labour_pool_percentage": settings.labour_pool_percentage if settings else 0.50,
                "contingency_pot_minimum": settings.contingency_pot_minimum if settings else 10000.0,
                "logo_url": settings.logo_url if settings else None,
                "favicon_url": settings.favicon_url if settings else None,
                "primary_color": settings.primary_color if settings else "#94d4ad",
                "secondary_color": settings.secondary_color if settings else "#bfc1ff"
            }

            current_shares = db.query(PartnerShare).filter(PartnerShare.company_id == company_id).all()
            proposed_shares = []
            found_target = False
            for s in current_shares:
                p_share = {
                    "user_id": s.user_id,
                    "capital_share_fixed": s.capital_share_fixed,
                    "labor_share_variable": s.labor_share_variable,
                    "voluntary_charity_percentage": s.voluntary_charity_percentage
                }
                if s.user_id == user_id:
                    p_share["capital_share_fixed"] = round(share_update.capital_share_fixed, 2)
                    p_share["labor_share_variable"] = round(share_update.labor_share_variable, 4)
                    p_share["voluntary_charity_percentage"] = round(share_update.voluntary_charity_percentage, 4)
                    found_target = True
                proposed_shares.append(p_share)
                
            if not found_target:
                proposed_shares.append({
                    "user_id": int(user_id),
                    "capital_share_fixed": round(share_update.capital_share_fixed, 2),
                    "labor_share_variable": round(share_update.labor_share_variable, 4),
                    "voluntary_charity_percentage": round(share_update.voluntary_charity_percentage, 4)
                })

            agreement = Agreement(
                company_id=company_id,
                proposed_by_id=current_user.id,
                proposed_settings=proposed_settings,
                proposed_shares=proposed_shares,
                status=AgreementStatus.PENDING,
                change_summary=share_update.summary if share_update.summary else f"Update shares for {target_user.full_name or target_user.username}"
            )
            db.add(agreement)
            db.flush() # Get the ID without committing yet

        # 4. Create Signoffs
        active_users = db.query(User).filter(
            User.company_id == company_id,
            User.is_active == True,
            or_(User.role == RoleEnum.COMPANY_ADMIN, User.role == RoleEnum.PARTNER)
        ).all()

        for u in active_users:
            signoff = AgreementSignoff(
                agreement_id=agreement.id,
                user_id=u.id,
                status=AgreementStatus.PENDING
            )
            if u.id == current_user.id:
                signoff.status = AgreementStatus.APPROVED
                signoff.signed_at = datetime.now(timezone.utc)
            db.add(signoff)

        db.commit()

        # 5. Return current (non-pending) share state
        share = db.query(PartnerShare).filter(PartnerShare.user_id == user_id, PartnerShare.company_id == company_id).first()
        if not share:
            share = PartnerShare(
                user_id=user_id,
                company_id=company_id,
                capital_share_fixed=0.0,
                labor_share_variable=0.0,
                voluntary_charity_percentage=0.0
            )
        share.partner_name = target_user.full_name if target_user.full_name else target_user.username
        return share

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"DEBUG: 500 Error in update_partner_share: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/my-share", response_model=PartnerShareResponse)
def get_my_share(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Fetch the current user's share details."""
    share = db.query(PartnerShare).filter(
        PartnerShare.user_id == current_user.id
    )
    if company_id:
        share = share.filter(PartnerShare.company_id == company_id)
    
    res_share = share.first()
    
    if not res_share:
        # Return a transient default share if none exists yet
        res_share = PartnerShare(
            user_id=current_user.id,
            company_id=company_id,
            capital_share_fixed=0.0,
            labor_share_variable=0.0,
            voluntary_charity_percentage=0.0
        )
    
    res_share.partner_name = current_user.full_name or current_user.username
    return res_share

@router.put("/my-share", response_model=PartnerShareResponse)
def update_my_share(
    share_update: PartnerShareUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Allow user to update their own voluntary charity percentage."""
    if not company_id:
        raise HTTPException(status_code=400, detail="Company context required to update shares")

    share = db.query(PartnerShare).filter(
        PartnerShare.user_id == current_user.id,
        PartnerShare.company_id == company_id
    ).first()
    
    if not share:
        share = PartnerShare(
            user_id=current_user.id,
            company_id=company_id,
            capital_share_fixed=0.0,
            labor_share_variable=0.0
        )
        db.add(share)
    
    # Users can ONLY update their voluntary charity percentage.
    # Capital and labor shares must go through the admin/agreement flow.
    share.voluntary_charity_percentage = round(share_update.voluntary_charity_percentage, 4)
    
    db.commit()
    db.refresh(share)
    
    share.partner_name = current_user.full_name or current_user.username
    return share

@router.post("/shares/new_partner", response_model=PartnerShareResponse)
def create_new_partner(
    partner_data: PartnerCreate, 
    db: Session = Depends(get_db), 
    company_id: Optional[int] = Depends(get_current_company_id),
    current_user: User = Depends(get_current_active_user)
):
    if not company_id:
        if current_user.role == RoleEnum.SUPER_ADMIN:
            # For new partners, we must have a company_id from header
            raise HTTPException(status_code=400, detail="X-Company-ID header required for Super Admin to create partner")
        else:
            raise HTTPException(status_code=400, detail="Company context required")
            
    # Check if user already has a share
    existing = db.query(PartnerShare).filter(PartnerShare.user_id == partner_data.user_id, PartnerShare.company_id == company_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Partner already has a share record")
    
    new_share = PartnerShare(
        user_id=partner_data.user_id,
        company_id=company_id,
        capital_share_fixed=partner_data.capital_share_fixed,
        labor_share_variable=partner_data.labor_share_variable,
        voluntary_charity_percentage=partner_data.voluntary_charity_percentage
    )
    db.add(new_share)
    db.commit()
    db.refresh(new_share)
    
    user = db.query(User).filter(User.id == partner_data.user_id).first()
    new_share.partner_name = user.full_name if user.full_name else user.username
    return new_share

@router.put("/shares/rename/{user_id}", response_model=PartnerShareResponse)
def rename_partner(
    user_id: int, 
    rename_data: PartnerRename, 
    db: Session = Depends(get_db), 
    company_id: Optional[int] = Depends(get_current_company_id),
    current_user: User = Depends(get_current_active_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not company_id:
        if current_user.role == RoleEnum.SUPER_ADMIN:
            company_id = user.company_id
        else:
            raise HTTPException(status_code=400, detail="Company context required")
            
    user.full_name = rename_data.name
    db.commit()
    
    share = db.query(PartnerShare).filter(PartnerShare.user_id == user_id, PartnerShare.company_id == company_id).first()
    if not share:
         share = PartnerShare(
            user_id=user_id,
            company_id=company_id,
            capital_share_fixed=0.0,
            labor_share_variable=0.0,
            voluntary_charity_percentage=0.0
        )
    share.partner_name = user.full_name if user.full_name else user.username
    return share
