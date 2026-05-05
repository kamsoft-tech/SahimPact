from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum, JSON
from sqlalchemy.orm import relationship, validates
import enum
from datetime import datetime, timezone

from app.db.database import Base

class RoleEnum(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COMPANY_ADMIN = "COMPANY_ADMIN"
    PARTNER = "PARTNER"

class AccountTypeEnum(enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"

class EntryTypeEnum(enum.Enum):
    DEBIT = "debit"
    CREDIT = "credit"

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)

    users = relationship("User", back_populates="company", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="company", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="company", cascade="all, delete-orphan")
    settings = relationship("GlobalSettings", back_populates="company", uselist=False, cascade="all, delete-orphan")
    monthly_reports = relationship("MonthlyReport", back_populates="company", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True) # Nullable for super admin initially
    username = Column(String, unique=True, index=True, nullable=False) 
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.PARTNER)
    is_active = Column(Boolean, default=True)
    mfa_secret = Column(String, nullable=True)
    email = Column(String, nullable=True) # Added for password recovery

    company = relationship("Company", back_populates="users")
    partner_share = relationship("PartnerShare", back_populates="user", uselist=False, cascade="all, delete-orphan")
    transactions_created = relationship("Transaction", back_populates="created_by_user")
    time_entries = relationship("TimeEntry", back_populates="user", cascade="all, delete-orphan")

    @classmethod
    def validate_username(cls, username: str):
        import re
        if not re.match(r"^[a-zA-Z0-9._-]+$", username):
            raise ValueError("Username contains invalid characters. Only alphanumeric, dots, underscores, and hyphens are allowed.")
        return username

    @validates('company_id', 'role')
    def validate_role_company(self, key, value):
        if key == 'role' and value == RoleEnum.SUPER_ADMIN:
            self.company_id = None
        if key == 'company_id' and value is not None:
            if self.role == RoleEnum.SUPER_ADMIN:
                 return None # Super admin cannot have a company_id
        return value

class PartnerShare(Base):
    __tablename__ = "partner_shares"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    capital_share_fixed = Column(Float, default=0.0) # Amount
    labor_share_variable = Column(Float, default=0.0) # Percentage or Hours Placeholder
    voluntary_charity_percentage = Column(Float, default=0.0)

    user = relationship("User", back_populates="partner_share")

class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    hours = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    is_closed = Column(Boolean, default=False)

    user = relationship("User", back_populates="time_entries")

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    name = Column(String, index=True, nullable=False)
    type = Column(Enum(AccountTypeEnum), nullable=False)

    company = relationship("Company", back_populates="accounts")
    entries = relationship("JournalEntry", back_populates="account", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    description = Column(String, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_reversing = Column(Boolean, default=False)
    original_transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    is_pending = Column(Boolean, default=False)
    is_closed = Column(Boolean, default=False) # Locking mechanism

    company = relationship("Company", back_populates="transactions")
    created_by_user = relationship("User", back_populates="transactions_created")
    entries = relationship("JournalEntry", back_populates="transaction", cascade="all, delete-orphan")
    expense_receipt = relationship("ExpenseReceipt", back_populates="transaction", uselist=False, cascade="all, delete-orphan")

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    amount = Column(Float, nullable=False) # Always absolute value
    type = Column(Enum(EntryTypeEnum), nullable=False)

    transaction = relationship("Transaction", back_populates="entries")
    account = relationship("Account", back_populates="entries")

class ExpenseReceipt(Base):
    __tablename__ = "expense_receipts"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False, unique=True)
    receipt_url = Column(String, nullable=False)

    transaction = relationship("Transaction", back_populates="expense_receipt")

class GlobalSettings(Base):
    __tablename__ = "global_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, unique=True)
    charity_percentage = Column(Float, default=0.06) # Default 6%
    partnership_mode = Column(String, default="both") # "capital", "labour", "both"
    labour_share_mode = Column(String, default="time") # "time", "percentage"
    currency_symbol = Column(String, default="£")
    is_setup_complete = Column(Boolean, default=False)
    capital_pool_percentage = Column(Float, default=0.50)
    labour_pool_percentage = Column(Float, default=0.50)
    contingency_pot_minimum = Column(Float, default=10000.0)

    # White-labeling fields
    logo_url = Column(String, nullable=True)
    favicon_url = Column(String, nullable=True)
    primary_color = Column(String, default="#94d4ad")
    secondary_color = Column(String, default="#bfc1ff")

    company = relationship("Company", back_populates="settings")

class MonthlyReport(Base):
    __tablename__ = "monthly_reports"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    period_name = Column(String, nullable=False) # e.g. "March 2026"
    net_profit = Column(Float, nullable=False)
    global_charity = Column(Float, nullable=False)
    voluntary_charity = Column(Float, nullable=False)
    report_data = Column(JSON, nullable=False) # Full report snapshot
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    company = relationship("Company", back_populates="monthly_reports")

class AgreementStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUPERSEDED = "SUPERSEDED"

class AgreementType(str, enum.Enum):
    PARAMETER_CHANGE = "PARAMETER_CHANGE"
    PERIOD_CLOSE = "PERIOD_CLOSE"

class Agreement(Base):
    __tablename__ = "agreements"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    proposed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Snapshots of the proposed changes
    proposed_settings = Column(JSON, nullable=True) # { charity_percentage, etc. }
    proposed_shares = Column(JSON, nullable=True) # List of { user_id, capital_share_fixed, etc. }
    
    # Fields for PERIOD_CLOSE type
    negligent_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    period_name = Column(String, nullable=True)

    agreement_type = Column(Enum(AgreementType), default=AgreementType.PARAMETER_CHANGE)
    change_summary = Column(String, nullable=True)
    status = Column(Enum(AgreementStatus), default=AgreementStatus.PENDING)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    effective_at = Column(DateTime, nullable=True)

    company = relationship("Company")
    proposed_by = relationship("User", foreign_keys=[proposed_by_id])
    negligent_user = relationship("User", foreign_keys=[negligent_user_id])
    signoffs = relationship("AgreementSignoff", back_populates="agreement", cascade="all, delete-orphan")

class AgreementSignoff(Base):
    __tablename__ = "agreement_signoffs"

    id = Column(Integer, primary_key=True, index=True)
    agreement_id = Column(Integer, ForeignKey("agreements.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    signed_at = Column(DateTime, nullable=True)
    status = Column(Enum(AgreementStatus), default=AgreementStatus.PENDING) # PENDING, APPROVED, REJECTED

    agreement = relationship("Agreement", back_populates="signoffs")
    user = relationship("User")
