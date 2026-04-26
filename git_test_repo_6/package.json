from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from app.models.models import RoleEnum, AccountTypeEnum, EntryTypeEnum

class UserBase(BaseModel):
    username: str
    role: RoleEnum = RoleEnum.PARTNER

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    role: RoleEnum

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class AccountBase(BaseModel):
    name: str
    type: AccountTypeEnum

class AccountCreate(AccountBase):
    pass

class AccountResponse(AccountBase):
    id: int

    class Config:
        orm_mode = True

class JournalEntryBase(BaseModel):
    account_id: int
    amount: float = Field(gt=0, description="Amount must be positive")
    type: EntryTypeEnum

class JournalEntryCreate(JournalEntryBase):
    pass

class JournalEntryResponse(JournalEntryBase):
    id: int

    class Config:
        orm_mode = True

class TransactionCreate(BaseModel):
    description: str
    entries: List[JournalEntryCreate]

class TransactionResponse(BaseModel):
    id: int
    date: datetime
    description: str
    created_by_id: int
    is_reversing: bool
    is_closed: bool
    entries: List[JournalEntryResponse]

    class Config:
        orm_mode = True

class MonthlyReportResponse(BaseModel):
    id: int
    period_name: str
    net_profit: float
    global_charity: float
    voluntary_charity: float
    report_data: dict
    created_at: datetime

    class Config:
        orm_mode = True

class PartnerShareUpdate(BaseModel):
    user_id: int
    capital_share_fixed: float = Field(ge=0)
    labor_share_variable: float = Field(ge=0, le=100)
    voluntary_charity_percentage: float = Field(default=0.0, ge=0, le=1)

class PartnerShareResponse(PartnerShareUpdate):
    id: int
    partner_name: Optional[str] = None
    capital_share_percentage: Optional[float] = 0.0

    class Config:
        orm_mode = True

class PartnerCreate(BaseModel):
    name: str = Field(..., description="The name of the new partner")
    capital_share_fixed: float = Field(default=0.0, ge=0, description="Initial capital investment")
    
class PartnerRename(BaseModel):
    name: str = Field(..., description="The new name for the partner")

class TimeEntryBase(BaseModel):
    start_time: datetime = Field(description="Start time of the shift")
    end_time: datetime = Field(description="End time of the shift")
    description: Optional[str] = None

class TimeEntryCreate(TimeEntryBase):
    pass

class TimeEntryUpdate(TimeEntryBase):
    pass

class TimeEntryResponse(TimeEntryBase):
    id: int
    user_id: int
    partner_name: Optional[str] = None
    date: datetime
    hours: float
    is_closed: bool

    class Config:
        orm_mode = True

class GlobalSettingsUpdate(BaseModel):
    charity_percentage: float = Field(ge=0, le=1) # E.g., 0.06 is 6%
    partnership_mode: str = Field(pattern="^(capital|labour|both)$", default="both")
    labour_share_mode: str = Field(pattern="^(time|percentage)$", default="time")
    currency_symbol: str = Field(default="£", max_length=10)
    is_setup_complete: bool = Field(default=False)

class GlobalSettingsResponse(BaseModel):
    id: int
    charity_percentage: float
    partnership_mode: str
    labour_share_mode: str
    currency_symbol: str
    is_setup_complete: bool
    
    class Config:
        from_attributes = True

class CompanyBase(BaseModel):
    name: str

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

class CompanyAdminCreate(BaseModel):
    username: str
    password: str
