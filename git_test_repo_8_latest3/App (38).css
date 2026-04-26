from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.models import PartnerShare, User
from app.schemas.schemas import PartnerShareResponse, PartnerShareUpdate, PartnerCreate, PartnerRename
from app.core.security import get_password_hash, get_current_company_id

router = APIRouter()

@router.get("/shares", response_model=List[PartnerShareResponse])
def get_partner_shares(db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    shares = db.query(PartnerShare).filter(PartnerShare.company_id == company_id).all()
    # If no shares exist, we don't seed defaults anymore as the user will add them via UI
    # We will just return an empty list or whatever exists.
    # We'll attach the user's name to the response.
    # However we need to build the response explicitly since PartnerShareResponse now expects partner_name.
    
    # We will query both to get the names
    shares_with_users = db.query(PartnerShare, User).join(User, PartnerShare.user_id == User.id).filter(User.role == "partner", PartnerShare.company_id == company_id).all()
    
    # Let's map them
    shares_data = []
    total_capital = sum((s.capital_share_fixed or 0) for s, u in shares_with_users)
    
    for share, user in shares_with_users:
        share.partner_name = user.username
        if total_capital > 0:
            share.capital_share_percentage = (share.capital_share_fixed / total_capital) * 100
        else:
            share.capital_share_percentage = 0.0
        shares_data.append(share)
    
    shares = shares_data

    # Fetch global settings to determine how to calculate labor share
    from app.models.models import GlobalSettings
    settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
    labour_mode = settings.labour_share_mode if settings else "time"

    if labour_mode == "time":
        # Calculate labor shares dynamically based on logged time
        from app.models.models import TimeEntry
        open_entries = db.query(TimeEntry).filter(TimeEntry.is_closed == False, TimeEntry.company_id == company_id).all()
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

@router.put("/shares/{user_id}", response_model=PartnerShareResponse)
def update_partner_share(user_id: int, share_update: PartnerShareUpdate, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    share = db.query(PartnerShare).filter(PartnerShare.user_id == user_id, PartnerShare.company_id == company_id).first()
    if not share:
        raise HTTPException(status_code=404, detail="Partner share not found")
    
    share.capital_share_fixed = share_update.capital_share_fixed
    share.labor_share_variable = share_update.labor_share_variable
    share.voluntary_charity_percentage = share_update.voluntary_charity_percentage
    
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        share.partner_name = user.username
        
    db.commit()
    db.refresh(share)
    return share

@router.post("/shares/new_partner", response_model=PartnerShareResponse)
def create_new_partner(partner_data: PartnerCreate, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    # Check if a user with this username already exists
    existing_user = db.query(User).filter(User.username == partner_data.name, User.company_id == company_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this name already exists")
    
    # Create the user associated with this partner
    new_user = User(
        username=partner_data.name,
        company_id=company_id,
        hashed_password=get_password_hash("password"), # Default password, they can change it later
        role="partner"
    )
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
    
    new_share.partner_name = new_user.username
    return new_share

@router.put("/shares/{user_id}/rename")
def rename_partner(user_id: int, rename_data: PartnerRename, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    user = db.query(User).filter(User.id == user_id, User.company_id == company_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Partner not found")
        
    # Check for username collision within the company
    existing_user = db.query(User).filter(User.username == rename_data.name, User.company_id == company_id, User.id != user_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this name already exists")
        
    user.username = rename_data.name
    db.commit()
    return {"message": "Partner renamed successfully", "new_name": user.username}

@router.delete("/shares/{user_id}")
def delete_partner(user_id: int, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id)):
    share = db.query(PartnerShare).filter(PartnerShare.user_id == user_id, PartnerShare.company_id == company_id).first()
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
