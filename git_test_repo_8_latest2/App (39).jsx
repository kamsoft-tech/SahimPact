from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import TimeEntry, User
from app.schemas.schemas import TimeEntryCreate, TimeEntryResponse, TimeEntryUpdate
from app.core.security import get_current_user_claims, require_admin_role, get_current_company_id

router = APIRouter()

@router.post("/", response_model=TimeEntryResponse)
def log_time(
    entry: TimeEntryCreate,
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(get_current_user_claims),
    company_id: int = Depends(get_current_company_id)
):
    """Log hours worked for the current user."""
    user_id = current_user_claims.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    
    if entry.end_time <= entry.start_time:
         raise HTTPException(status_code=400, detail="End time must be after start time")
         
    duration = entry.end_time - entry.start_time
    hours_worked = round(duration.total_seconds() / 3600.0, 2)
        
    new_entry = TimeEntry(
        user_id=user_id,
        company_id=company_id,
        start_time=entry.start_time,
        end_time=entry.end_time,
        hours=hours_worked,
        description=entry.description
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    
    # Attach username for response
    user = db.query(User).filter(User.id == user_id).first()
    new_entry.partner_name = user.username if user else None
    
    return new_entry

@router.get("/", response_model=List[TimeEntryResponse])
def get_my_open_time(
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(get_current_user_claims),
    company_id: int = Depends(get_current_company_id)
):
    """Get all open time entries for the current user (MTD)."""
    user_id = current_user_claims.get("user_id")
    entries = db.query(TimeEntry).filter(
        TimeEntry.user_id == user_id,
        TimeEntry.company_id == company_id,
        TimeEntry.is_closed == False
    ).all()
    
    for entry in entries:
        entry.partner_name = entry.user.username if entry.user else None
        
    return entries

@router.get("/all", response_model=List[TimeEntryResponse])
def get_all_open_time(
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(get_current_user_claims),
    company_id: int = Depends(get_current_company_id)
):
    """Get all open time entries for ALL partners (to calculate dynamic shares in frontend)."""
    entries = db.query(TimeEntry).filter(
        TimeEntry.company_id == company_id,
        TimeEntry.is_closed == False
    ).all()
    
    for entry in entries:
        entry.partner_name = entry.user.username if entry.user else None
        
    return entries

@router.put("/{entry_id}", response_model=TimeEntryResponse)
def update_time_entry(
    entry_id: int,
    entry_update: TimeEntryUpdate,
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(require_admin_role),
    company_id: int = Depends(get_current_company_id)
):
    """Admin endpoint to edit a time entry."""
    entry = db.query(TimeEntry).filter(
        TimeEntry.id == entry_id,
        TimeEntry.company_id == company_id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
        
    if entry.is_closed:
        raise HTTPException(status_code=400, detail="Cannot edit a closed time entry")
        
    if entry_update.end_time <= entry_update.start_time:
         raise HTTPException(status_code=400, detail="End time must be after start time")
         
    duration = entry_update.end_time - entry_update.start_time
    hours_worked = round(duration.total_seconds() / 3600.0, 2)
    
    entry.start_time = entry_update.start_time
    entry.end_time = entry_update.end_time
    entry.hours = hours_worked
    if entry_update.description is not None:
        entry.description = entry_update.description
        
    db.commit()
    db.refresh(entry)
    
    entry.partner_name = entry.user.username if entry.user else None
    
    return entry

@router.delete("/{entry_id}")
def delete_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(require_admin_role),
    company_id: int = Depends(get_current_company_id)
):
    """Admin endpoint to delete a specific time entry."""
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id, TimeEntry.company_id == company_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    db.delete(entry)
    db.commit()
    return {"message": "Time entry deleted successfully"}

@router.delete("/")
def delete_all_open_time(
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(require_admin_role),
    company_id: int = Depends(get_current_company_id)
):
    """Admin endpoint to delete ALL open (unclosed) time entries."""
    # Handle both is_closed=False and is_closed=None (NULL)
    db.query(TimeEntry).filter(
        TimeEntry.company_id == company_id,
        or_(TimeEntry.is_closed == False, TimeEntry.is_closed == None)
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "All open time entries deleted successfully"}
