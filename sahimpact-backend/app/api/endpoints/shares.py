from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from app.db.database import get_db
from app.models.models import PartnerShare, User, RoleEnum, GlobalSettings, TimeEntry
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
    # Verify user exists and is NOT a super admin
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user.role == RoleEnum.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super Admins cannot be partners in a company")
        
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Fetch current active settings to include in agreement snapshot
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

    # Fetch current shares and apply the proposed change to the snapshot
    shares = db.query(PartnerShare).filter(PartnerShare.company_id == company_id).all()
    proposed_shares = []
    
    found_target = False
    for s in shares:
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
        # If the share record didn't exist yet, add it to proposed
        proposed_shares.append({
            "user_id": user_id,
            "capital_share_fixed": round(share_update.capital_share_fixed, 2),
            "labor_share_variable": round(share_update.labor_share_variable, 4),
            "voluntary_charity_percentage": round(share_update.voluntary_charity_percentage, 4)
        })

    # Check for existing pending agreement
    from app.models.models import Agreement, AgreementStatus, AgreementSignoff, RoleEnum
    from datetime import datetime, timezone
    from sqlalchemy import or_

    existing_agreement = db.query(Agreement).filter(
        Agreement.company_id == company_id,
        Agreement.status == AgreementStatus.PENDING
    ).first()

    if existing_agreement:
        existing_agreement.proposed_settings = proposed_settings
        existing_agreement.proposed_shares = proposed_shares
        existing_agreement.proposed_by_id = current_user.id
        existing_agreement.created_at = datetime.now(timezone.utc)
        db.query(AgreementSignoff).filter(AgreementSignoff.agreement_id == existing_agreement.id).delete()
        agreement = existing_agreement
    else:
        agreement = Agreement(
            company_id=company_id,
            proposed_by_id=current_user.id,
            proposed_settings=proposed_settings,
            proposed_shares=proposed_shares,
            status=AgreementStatus.PENDING,
            change_summary=f"Update shares for {target_user.full_name or target_user.username}"
        )
        db.add(agreement)
        db.commit()
        db.refresh(agreement)

    # Create signoffs
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

    # Return the current (un-updated) share for this user
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

@router.post("/shares/new_partner", response_model=PartnerShareResponse)
def create_new_partner(partner_data: PartnerCreate, db: Session = Depends(get_db), company_id: Optional[int] = Depends(get_current_company_id)):
    # Check if a user with this username already exists
    query = db.query(User).filter(User.username == partner_data.name)
    if company_id:
        query = query.filter(User.company_id == company_id)
    existing_user = query.first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this name already exists")
    
    # Create the user associated with this partner
    new_user = User(
        username=partner_data.name,
        company_id=company_id,
        hashed_password=get_password_hash("password"), # Default password, they can change it later
        role=RoleEnum.PARTNER
    )
    
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID required to create a partner")

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Now create the partner share
    new_share = PartnerShare(
        user_id=new_user.id,
        company_id=company_id,
        capital_share_fixed=partner_data.capital_share_fixed,
        labor_share_variable=0.0, # Will be calculated dynamically
        voluntary_charity_percentage=0.0
    )
    db.add(new_share)
    db.commit()
    db.refresh(new_share)
    
    new_share.partner_name = new_user.full_name if new_user.full_name else new_user.username
    return new_share

@router.put("/shares/{user_id}/rename")
def rename_partner(user_id: int, rename_data: PartnerRename, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    query = db.query(User).filter(User.id == user_id)
    if company_id:
        query = query.filter(User.company_id == company_id)
    user = query.first()
    if not user:
        raise HTTPException(status_code=404, detail="Partner not found")
        
    # Check for username collision within the company
    query_existing = db.query(User).filter(User.username == rename_data.name, User.id != user_id)
    if company_id:
        query_existing = query_existing.filter(User.company_id == company_id)
    existing_user = query_existing.first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this name already exists")
        
    user.username = rename_data.name
    db.commit()
    return {"message": "Partner renamed successfully", "new_name": user.username}

@router.delete("/shares/{user_id}")
def delete_partner(user_id: int, db: Session = Depends(get_db), company_id: Optional[int] = Depends(get_current_company_id)):
    query = db.query(PartnerShare).filter(PartnerShare.user_id == user_id)
    if company_id:
        query = query.filter(PartnerShare.company_id == company_id)
    share = query.first()
    
    if not share:
        raise HTTPException(status_code=404, detail="Partner share not found")
        
    # Instead of fully deleting the User (which might break foreign keys for previous transactions),
    # we'll just delete the PartnerShare to remove them from the active distribution pool.
    db.delete(share)
    db.commit()
    
    # Optional: Deactivate user so they can't login
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.is_active = False
        db.commit()
        
    return {"message": "Partner removed successfully"}



from app.core.security import get_current_active_user

@router.get("/my-share", response_model=PartnerShareResponse)
def get_my_share(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    share = db.query(PartnerShare).filter(PartnerShare.user_id == current_user.id).first()
    if not share:
        # Return a virtual share object instead of 404
        share = PartnerShare(
            user_id=current_user.id,
            company_id=current_user.company_id,
            capital_share_fixed=0.0,
            labor_share_variable=0.0,
            voluntary_charity_percentage=0.0
        )
    share.partner_name = current_user.full_name if current_user.full_name else current_user.username
    return share

@router.put("/my-share", response_model=PartnerShareResponse)
def update_my_share(share_update: PartnerShareUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    share = db.query(PartnerShare).filter(PartnerShare.user_id == current_user.id).first()
    if not share:
        # Create it if it doesn't exist
        share = PartnerShare(
            user_id=current_user.id,
            company_id=current_user.company_id,
            capital_share_fixed=0.0,
            labor_share_variable=0.0,
            voluntary_charity_percentage=round(share_update.voluntary_charity_percentage, 4)
        )
        db.add(share)
    else:
        # Only allow updating charity part for self
        share.voluntary_charity_percentage = round(share_update.voluntary_charity_percentage, 4)
    
    db.commit()
    db.refresh(share)
    share.partner_name = current_user.full_name if current_user.full_name else current_user.username
    return share
