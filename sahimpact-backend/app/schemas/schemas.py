from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional
from datetime import datetime
from app.models.models import RoleEnum, AccountTypeEnum, EntryTypeEnum

class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: RoleEnum = RoleEnum.PARTNER

class UserCreateRequest(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: RoleEnum = RoleEnum.PARTNER

class UserResponse(UserBase):
    id: int
    company_id: Optional[int] = None
    is_active: bool
    full_name: Optional[str] = None
    role: RoleEnum

    model_config = ConfigDict(from_attributes=True)

class UserRoleUpdate(BaseModel):
    role: RoleEnum


class CompanyResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: Optional[datetime] = None
    admin_id: Optional[int] = None
    admin_username: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    company_id: Optional[int] = None
    companies: Optional[List[CompanyResponse]] = None

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

    model_config = ConfigDict(from_attributes=True)

class JournalEntryBase(BaseModel):
    account_id: int
    amount: float = Field(gt=0, description="Amount must be positive")
    type: EntryTypeEnum

class JournalEntryCreate(JournalEntryBase):
    pass

class JournalEntryResponse(JournalEntryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class TransactionCreate(BaseModel):
    description: str
    entries: List[JournalEntryCreate]

class TransactionResponse(BaseModel):
    id: int
    date: datetime
    description: str
    created_by_id: int
    is_reversing: bool
    is_pending: bool
    is_closed: bool
    entries: List[JournalEntryResponse]

    model_config = ConfigDict(from_attributes=True)

class MonthlyReportResponse(BaseModel):
    id: int
    period_name: str
    net_profit: float
    global_charity: float
    voluntary_charity: float
    report_data: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PartnerShareUpdate(BaseModel):
    user_id: Optional[int] = None
    capital_share_fixed: float = Field(default=0.0, ge=0)
    labor_share_variable: float = Field(default=0.0, ge=0, le=100)
    voluntary_charity_percentage: float = Field(default=0.0, ge=0, le=1)
    summary: Optional[str] = None

class PartnerShareResponse(PartnerShareUpdate):
    id: Optional[int] = None
    company_id: Optional[int] = None
    partner_name: Optional[str] = None
    capital_share_percentage: Optional[float] = 0.0

    model_config = ConfigDict(from_attributes=True)

class PartnerCreate(BaseModel):
    name: str = Field(..., description="The name of the new partner")
    capital_share_fixed: float = Field(default=0.0, ge=0, description="Initial capital investment")
    
class PartnerRename(BaseModel):
    name: str = Field(..., description="The new name for the partner")

class TimeEntryBase(BaseModel):
    start_time: datetime = Field(description="Start time of the shift")
    end_time: datetime = Field(description="End time of the shift")
    description: Optional[str] = Field(None, description="Description of the work performed")

class TimeEntryCreate(TimeEntryBase):
    description: str = Field(..., min_length=1, description="Description is required for new entries")

class TimeEntryUpdate(TimeEntryBase):
    description: str = Field(..., min_length=1, description="Description is required for updates")

class TimeEntryResponse(TimeEntryBase):
    id: int
    user_id: int
    partner_name: Optional[str] = None
    date: datetime
    hours: float
    is_closed: bool

    model_config = ConfigDict(from_attributes=True)

class GlobalSettingsBase(BaseModel):
    charity_percentage: float = 0.06
    partnership_mode: str = "both"
    labour_share_mode: str = "time"
    currency_symbol: str = "£"
    is_setup_complete: bool = False
    capital_pool_percentage: float = 0.50
    labour_pool_percentage: float = 0.50
    contingency_pot_minimum: float = 10000.0
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = "#94d4ad"
    secondary_color: Optional[str] = "#bfc1ff"

class GlobalSettingsUpdate(GlobalSettingsBase):
    summary: Optional[str] = None

class GlobalSettingsResponse(GlobalSettingsBase):
    id: Optional[int] = None
    company_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class CompanyBase(BaseModel):
    name: str

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    name: Optional[str] = None



class CompanyAdminCreate(BaseModel):
    username: str
    password: str

class GlobalStatsResponse(BaseModel):
    total_companies: int
    total_users: int
    total_transactions: int
    active_partners: int

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[RoleEnum] = None

class AdminPasswordResetRequest(BaseModel):
    user_id: int
    new_password: str

# Agreements & Sign-offs
class AgreementSignoffResponse(BaseModel):
    id: int
    user_id: int
    username: Optional[str] = None
    full_name: Optional[str] = None
    signed_at: Optional[datetime] = None
    status: str

    model_config = ConfigDict(from_attributes=True)

class AgreementResponse(BaseModel):
    id: int
    company_id: int
    proposed_by_id: int
    proposed_by_name: Optional[str] = None
    agreement_type: str
    proposed_settings: Optional[dict] = None
    proposed_shares: Optional[List[dict]] = None
    negligent_user_id: Optional[int] = None
    period_name: Optional[str] = None
    change_summary: Optional[str] = None
    status: str
    created_at: datetime
    effective_at: Optional[datetime] = None
    signoffs: List[AgreementSignoffResponse] = []

    model_config = ConfigDict(from_attributes=True)

class SignoffActionRequest(BaseModel):
    action: str # "APPROVE" or "REJECT"
