from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.models import User, RoleEnum, PartnerShare, Company, Transaction, JournalEntry, EntryTypeEnum, Account, AccountTypeEnum
from app.models.models import MasterEntity, CapitalPool, AllocationRule, Allocation, AllocationBasisEnum
from datetime import datetime, timezone

def get_or_create_master_user(db: Session, company_id: int) -> User:
    """Gets or creates the MASTER_ADMIN user representation in a venture company."""
    user = db.query(User).join(User.company_links).filter(
        User.company_links.any(company_id=company_id), 
        User.role == RoleEnum.MASTER_ADMIN
    ).first()
    
    if not user:
        # Create a proxy user for the master fund
        user = User(
            username=f"master_fund_{company_id}",
            full_name="Master Fund",
            hashed_password="N/A", # Cannot login directly
            role=RoleEnum.MASTER_ADMIN,
            requires_password_change=False
        )
        db.add(user)
        db.flush()
        
        # Link to company
        from app.models.models import UserCompanyLink
        link = UserCompanyLink(user_id=user.id, company_id=company_id)
        db.add(link)
        db.flush()
    return user

def allocate_capital(db: Session, rule_id: int, admin_user_id: int):
    rule = db.query(AllocationRule).filter(AllocationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Allocation rule not found")

    pool = db.query(CapitalPool).filter(CapitalPool.id == rule.pool_id).first()
    if not pool:
        raise HTTPException(status_code=404, detail="Master capital pool not found")

    # Determine allocation amount based on rule basis
    allocation_amount = 0.0
    if rule.basis == AllocationBasisEnum.FIXED_AMOUNT:
        allocation_amount = rule.value
    elif rule.basis == AllocationBasisEnum.PERCENTAGE_OF_POOL:
        allocation_amount = pool.total_balance * (rule.value / 100.0)
    elif rule.basis == AllocationBasisEnum.CAPITAL_RATIO:
        # E.g. value is 1.5 -> Allocate 1.5x of the venture's current capital
        venture_capital = get_venture_capital(db, rule.company_id)
        allocation_amount = venture_capital * rule.value
    elif rule.basis == AllocationBasisEnum.PERFORMANCE:
        # E.g. allocate based on last period's profit margin
        allocation_amount = rule.value # Placeholder logic
    elif rule.basis == AllocationBasisEnum.NEEDS_BASED:
        allocation_amount = rule.value # Placeholder logic
    elif rule.basis == AllocationBasisEnum.MANUAL:
        allocation_amount = rule.value

    # Apply caps
    if rule.cap_amount and allocation_amount > rule.cap_amount:
        allocation_amount = rule.cap_amount
    
    # Check if pool has enough balance
    if allocation_amount > pool.total_balance:
        raise HTTPException(status_code=400, detail="Insufficient balance in Master Pool")

    # 1. Deduct from Master Pool
    pool.total_balance -= allocation_amount

    # 2. Record Allocation
    allocation = Allocation(
        pool_id=rule.pool_id,
        company_id=rule.company_id,
        rule_id=rule.id,
        amount=allocation_amount,
        status="COMPLETED"
    )
    db.add(allocation)
    
    # 3. Update Venture Ledger & PartnerShare
    master_user = get_or_create_master_user(db, rule.company_id)
    partner_share = db.query(PartnerShare).filter(PartnerShare.user_id == master_user.id, PartnerShare.company_id == rule.company_id).first()
    if not partner_share:
        partner_share = PartnerShare(
            user_id=master_user.id,
            company_id=rule.company_id,
            capital_share_fixed=0.0,
            labor_share_variable=0.0,
            voluntary_charity_percentage=0.0
        )
        db.add(partner_share)

    partner_share.capital_share_fixed += allocation_amount
    
    # Ledger update in venture
    capital_acc = db.query(Account).filter(Account.company_id == rule.company_id, Account.name == "Master Fund Capital").first()
    if not capital_acc:
        capital_acc = Account(company_id=rule.company_id, name="Master Fund Capital", type=AccountTypeEnum.EQUITY)
        db.add(capital_acc)
        db.flush()

    asset_acc = db.query(Account).filter(Account.company_id == rule.company_id, Account.name == "Cash/Bank").first()
    if not asset_acc:
        asset_acc = Account(company_id=rule.company_id, name="Cash/Bank", type=AccountTypeEnum.ASSET)
        db.add(asset_acc)
        db.flush()

    transaction = Transaction(
        company_id=rule.company_id,
        description=f"Master Fund Allocation (Rule {rule.id})",
        created_by_id=admin_user_id,
        is_closed=True
    )
    db.add(transaction)
    db.flush()

    # Credit Equity, Debit Asset
    db.add(JournalEntry(transaction_id=transaction.id, account_id=capital_acc.id, amount=allocation_amount, type=EntryTypeEnum.CREDIT))
    db.add(JournalEntry(transaction_id=transaction.id, account_id=asset_acc.id, amount=allocation_amount, type=EntryTypeEnum.DEBIT))

    db.commit()
    return allocation

def get_venture_capital(db: Session, company_id: int) -> float:
    """Helper to calculate total partner capital in a venture"""
    shares = db.query(PartnerShare).filter(PartnerShare.company_id == company_id).all()
    return sum(s.capital_share_fixed for s in shares)

def roll_returns_back(db: Session, pool_id: int, venture_company_id: int, profit_share_amount: float):
    """
    Called after a venture closes a period, to roll returns up to the master pool.
    """
    pool = db.query(CapitalPool).filter(CapitalPool.id == pool_id).first()
    if not pool:
        return
        
    zakat_rate = 0.025 
    
    if profit_share_amount > 0:
        zakat_amount = profit_share_amount * zakat_rate
        net_profit = profit_share_amount - zakat_amount
        pool.total_balance += net_profit
    elif profit_share_amount < 0:
        loss_amount = abs(profit_share_amount)
        pool.total_balance -= loss_amount
        if pool.total_balance < 0:
            pool.total_balance = 0.0
            
    db.commit()
