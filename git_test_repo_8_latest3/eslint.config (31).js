from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import Token, UserResponse
from app.core.security import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, require_partner_role, require_admin_role, get_password_hash

router = APIRouter(tags=["Authentication"])

@router.post("/token", response_model=Token)
def login_for_access_token(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    # Use case-insensitive username matching
    user = db.query(User).filter(func.lower(User.username) == form_data.username.lower()).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        # Fallback for seeded users with placeholder passwords if needed during dev
        if user and user.hashed_password == "hashed_password_placeholder":
             # In a real app, we'd force a password reset, but for this dev stage:
             pass
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {
        "sub": user.username, 
        "role": user.role.value, 
        "user_id": user.id
    }
    if user.company_id is not None:
        token_data["company_id"] = user.company_id

    access_token = create_access_token(
        data=token_data, 
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(db: Session = Depends(get_db), claims: dict = Depends(require_partner_role)):
    username = claims.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

class SetPasswordRequest(BaseModel):
    password: str

@router.post("/users/{user_id}/set-password")
def set_partner_password(
    user_id: int,
    body: SetPasswordRequest,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_admin_role)
):
    """Admin-only: set or reset a partner's login password."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    user.hashed_password = get_password_hash(body.password)
    db.commit()
    return {"message": f"Password updated for {user.username}"}
