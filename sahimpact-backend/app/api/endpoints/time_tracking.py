from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.db.database import get_db
from app.models.models import TimeEntry, User
from app.schemas.schemas import TimeEntryCreate, TimeEntryResponse, TimeEntryUpdate
from app.core.security import get_current_user_claims, require_admin_role, get_current_company_id, require_partner_role, RoleEnum

router = APIRouter()

@router.get("/stats")
def get_time_stats(
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Get total hours logged for the current user and the company in the current unclosed period."""
    user_id = claims.get("user_id")
    
    # My total unclosed hours
    my_hours_query = db.query(func.sum(TimeEntry.hours)).filter(
        TimeEntry.user_id == user_id,
        or_(TimeEntry.is_closed == False, TimeEntry.is_closed == None)
    )
    if company_id:
        my_hours_query = my_hours_query.filter(TimeEntry.company_id == company_id)
    my_hours = my_hours_query.scalar() or 0.0
    
    # Company total unclosed hours
    company_hours_query = db.query(func.sum(TimeEntry.hours)).filter(
        or_(TimeEntry.is_closed == False, TimeEntry.is_closed == None)
    )
    if company_id:
        company_hours_query = company_hours_query.filter(TimeEntry.company_id == company_id)
    company_hours = company_hours_query.scalar() or 0.0
    
    return {
        "my_total_hours": round(my_hours, 2),
        "company_total_hours": round(company_hours, 2)
    }

def check_time_overlap(db: Session, user_id: int, start_time: datetime, end_time: datetime, exclude_id: Optional[int] = None):
    """Checks if a user has any overlapping time entries for a given period."""
    query = db.query(TimeEntry).filter(
        TimeEntry.user_id == user_id,
        TimeEntry.start_time < end_time,
        TimeEntry.end_time > start_time
    )
    if exclude_id:
        query = query.filter(TimeEntry.id != exclude_id)
    return query.first()

@router.post("", response_model=TimeEntryResponse)
def log_time(
    entry: TimeEntryCreate,
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(get_current_user_claims),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Log hours worked for the current user."""
    user_id = current_user_claims.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    
    now = datetime.now(timezone.utc)
    if entry.start_time > now or entry.end_time > now:
        raise HTTPException(status_code=400, detail="Cannot log hours in the future")

    if entry.end_time <= entry.start_time:
         raise HTTPException(status_code=400, detail="End time must be after start time")
         
    # Overlap check
    overlap = check_time_overlap(db, user_id, entry.start_time, entry.end_time)
    if overlap:
        raise HTTPException(status_code=400, detail=f"Overlap detected with existing entry from {overlap.start_time.strftime('%H:%M')} to {overlap.end_time.strftime('%H:%M')}")

    duration = entry.end_time - entry.start_time
    hours_worked = round(duration.total_seconds() / 3600.0, 2)
    
    if hours_worked <= 0:
        raise HTTPException(status_code=400, detail="Duration must be positive")
    
    if hours_worked > 15:
        raise HTTPException(status_code=400, detail="Cannot log more than 15 hours in a single entry")
        
        
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
    
    # Attach partner name for response (Full Name with Username fallback)
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        new_entry.partner_name = user.full_name if user.full_name else user.username
    else:
        new_entry.partner_name = None
    
    return new_entry

@router.get("", response_model=List[TimeEntryResponse])
def list_time_entries(
    user_id: Optional[int] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """List time entries for the current company, optionally filtered by user and month/year."""
    from sqlalchemy import extract
    
    # If no user_id is provided, default to current user
    target_user_id = user_id if user_id else claims.get("user_id")
    
    query = db.query(TimeEntry)
    if company_id:
        query = query.filter(TimeEntry.company_id == company_id)
        
    if target_user_id:
        query = query.filter(TimeEntry.user_id == target_user_id)
    
    if month:
        query = query.filter(extract('month', TimeEntry.start_time) == month)
    if year:
        query = query.filter(extract('year', TimeEntry.start_time) == year)
    
    entries = query.order_by(TimeEntry.start_time.desc()).all()
    
    for entry in entries:
        if entry.user:
            entry.partner_name = entry.user.full_name if entry.user.full_name else entry.user.username
        else:
            entry.partner_name = None
        
    return entries

@router.get("/all", response_model=List[TimeEntryResponse])
def list_company_time_entries(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Get time entries for ALL partners (transparency). Supports month/year filtering."""
    from sqlalchemy import extract
    
    query = db.query(TimeEntry)
    if company_id:
        query = query.filter(TimeEntry.company_id == company_id)
    
    if month:
        query = query.filter(extract('month', TimeEntry.start_time) == month)
    if year:
        query = query.filter(extract('year', TimeEntry.start_time) == year)
    
    entries = query.order_by(TimeEntry.start_time.desc()).all()
    
    for entry in entries:
        if entry.user:
            entry.partner_name = entry.user.full_name if entry.user.full_name else entry.user.username
        else:
            entry.partner_name = None
        
    return entries

@router.put("/{entry_id}", response_model=TimeEntryResponse)
def update_time_entry(
    entry_id: int,
    entry_update: TimeEntryUpdate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Update a time entry. Partners can edit their own if unclosed; Admins can edit any unclosed."""
    user_id = claims.get("user_id")
    role = claims.get("role")
    
    query = db.query(TimeEntry).filter(TimeEntry.id == entry_id)
    if company_id:
        query = query.filter(TimeEntry.company_id == company_id)
    entry = query.first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
        
    if entry.is_closed:
        raise HTTPException(status_code=400, detail="Cannot edit a closed (locked) time entry")
        
    # Permission check: Admin or the user themselves
    if role != RoleEnum.COMPANY_ADMIN.value and role != RoleEnum.SUPER_ADMIN.value:
        if int(entry.user_id) != int(user_id):
            raise HTTPException(status_code=403, detail="You can only edit your own time entries")
            
    now = datetime.now(timezone.utc)
    if entry_update.start_time > now or entry_update.end_time > now:
        raise HTTPException(status_code=400, detail="Cannot log hours in the future")

    if entry_update.end_time <= entry_update.start_time:
         raise HTTPException(status_code=400, detail="End time must be after start time")
         
    # Overlap check
    overlap = check_time_overlap(db, entry.user_id, entry_update.start_time, entry_update.end_time, exclude_id=entry_id)
    if overlap:
        raise HTTPException(status_code=400, detail=f"Overlap detected with existing entry from {overlap.start_time.strftime('%H:%M')} to {overlap.end_time.strftime('%H:%M')}")

    duration = entry_update.end_time - entry_update.start_time
    hours_worked = round(duration.total_seconds() / 3600.0, 2)

    if hours_worked > 15:
        raise HTTPException(status_code=400, detail="Cannot log more than 15 hours in a single entry")
        
    
    entry.start_time = entry_update.start_time
    entry.end_time = entry_update.end_time
    entry.hours = hours_worked
    if entry_update.description is not None:
        entry.description = entry_update.description
        
    db.commit()
    db.refresh(entry)
    
    if entry.user:
        entry.partner_name = entry.user.full_name if entry.user.full_name else entry.user.username
    else:
        entry.partner_name = None
    return entry

@router.delete("/{entry_id}")
def delete_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Delete a specific time entry. Partners can delete their own if unclosed."""
    user_id = claims.get("user_id")
    role = claims.get("role")
    
    query = db.query(TimeEntry).filter(TimeEntry.id == entry_id)
    if company_id:
        query = query.filter(TimeEntry.company_id == company_id)
    entry = query.first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
        
    if entry.is_closed:
        raise HTTPException(status_code=400, detail="Cannot delete a closed (locked) time entry")

    if role != RoleEnum.COMPANY_ADMIN.value and role != RoleEnum.SUPER_ADMIN.value:
        if entry.user_id != user_id:
            raise HTTPException(status_code=403, detail="You can only delete your own time entries")
    
    db.delete(entry)
    db.commit()
    return {"message": "Time entry deleted successfully"}

@router.delete("")
def delete_all_open_time(
    db: Session = Depends(get_db),
    current_user_claims: dict = Depends(require_admin_role),
    company_id: Optional[int] = Depends(get_current_company_id)
):
    """Admin endpoint to delete ALL open (unclosed) time entries."""
    # Handle both is_closed=False and is_closed=None (NULL)
    query = db.query(TimeEntry).filter(
        or_(TimeEntry.is_closed == False, TimeEntry.is_closed == None)
    )
    if company_id:
        query = query.filter(TimeEntry.company_id == company_id)
    query.delete(synchronize_session=False)
    db.commit()
    return {"message": "All open time entries deleted successfully"}
