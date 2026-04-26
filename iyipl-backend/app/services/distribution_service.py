from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import Transaction, JournalEntry, EntryTypeEnum, Account, AccountTypeEnum, PartnerShare, GlobalSettings, MonthlyReport, TimeEntry
from datetime import datetime, timezone
import json
from fastapi import HTTPException

def calculate_month_end_close(db: Session, admin_user_id: int, company_id: int):
    # 1. Calculate Net Profit (Gross Revenue - COGS - OpEx)
    # Fetch all revenue sum
    revenue_credits = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.REVENUE, JournalEntry.type == EntryTypeEnum.CREDIT, Transaction.is_closed == False, Transaction.company_id == company_id).scalar() or 0
    revenue_debits = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.REVENUE, JournalEntry.type == EntryTypeEnum.DEBIT, Transaction.is_closed == False, Transaction.company_id == company_id).scalar() or 0
    net_revenue = revenue_credits - revenue_debits

    # Fetch all expense sum
    expense_debits = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.EXPENSE, JournalEntry.type == EntryTypeEnum.DEBIT, Transaction.is_closed == False, Transaction.company_id == company_id).scalar() or 0
    expense_credits = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.EXPENSE, JournalEntry.type == EntryTypeEnum.CREDIT, Transaction.is_closed == False, Transaction.company_id == company_id).scalar() or 0
    net_expenses = expense_debits - expense_credits

    net_profit = net_revenue - net_expenses

    settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
    cap_pool_pct = settings.capital_pool_percentage if settings and settings.capital_pool_percentage is not None else 0.50
    lab_pool_pct = settings.labour_pool_percentage if settings and settings.labour_pool_percentage is not None else 0.50
    charity_percentage = settings.charity_percentage if settings and settings.charity_percentage is not None else 0.06
    labour_share_mode = settings.labour_share_mode if settings and settings.labour_share_mode else "time"

    contingency_pot_min = getattr(settings, 'contingency_pot_minimum', 10000.0)
    contingency_allocation = 0.0
    contingency_account = None

    if net_profit > 0:
        contingency_account = db.query(Account).filter(Account.company_id == company_id, Account.name == "Contingency Reserve", Account.type == AccountTypeEnum.EQUITY).first()
        if not contingency_account:
            contingency_account = Account(company_id=company_id, name="Contingency Reserve", type=AccountTypeEnum.EQUITY)
            db.add(contingency_account)
            db.flush()
        
        contingency_credits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
            JournalEntry.account_id == contingency_account.id, 
            JournalEntry.type == EntryTypeEnum.CREDIT,
            Transaction.is_closed == True
        ).scalar() or 0.0
        
        contingency_debits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
            JournalEntry.account_id == contingency_account.id, 
            JournalEntry.type == EntryTypeEnum.DEBIT,
            Transaction.is_closed == True
        ).scalar() or 0.0
        
        current_pot_balance = contingency_credits - contingency_debits
        pot_shortfall = max(0.0, contingency_pot_min - current_pot_balance)
        
        contingency_allocation = min(net_profit, pot_shortfall)
        net_profit -= contingency_allocation

    if net_profit < 0:
        # Losses are distributed 100% based on capital pool
        pool_capital = net_profit
        pool_labor = 0.0
        charity_capital = 0.0
        charity_labor = 0.0
    elif net_profit == 0:
        pool_capital = 0.0
        pool_labor = 0.0
        charity_capital = 0.0
        charity_labor = 0.0
    else:
        # 2. Dynamic Pool logic
        pool_capital = net_profit * cap_pool_pct
        pool_labor = net_profit * lab_pool_pct
        
        # 3. The dynamic Charity Deduction logic per pool
        charity_capital = pool_capital * charity_percentage
        charity_labor = pool_labor * charity_percentage

    total_charity = charity_capital + charity_labor

    distributable_capital = pool_capital - charity_capital
    distributable_labor = pool_labor - charity_labor

    # 4. Fetch Partners and Time Entries
    partners = db.query(PartnerShare).filter(PartnerShare.company_id == company_id).all()
    open_time_entries = db.query(TimeEntry).filter(TimeEntry.is_closed == False, TimeEntry.company_id == company_id).all()
    
    total_hours = sum(entry.hours for entry in open_time_entries)
    partner_hours_map = {}
    for entry in open_time_entries:
        partner_hours_map[entry.user_id] = partner_hours_map.get(entry.user_id, 0.0) + entry.hours
        
    total_capital = sum(p.capital_share_fixed for p in partners if p.capital_share_fixed)
    
    # 5. Distribute the Pools
    total_voluntary_charity = 0.0
    gross_profit = net_profit + contingency_allocation
    distribution_report = {
        "net_profit": gross_profit,
        "distributable_net_profit": net_profit,
        "contingency_pot_allocation": round(contingency_allocation, 2),
        "global_charity_allocation": total_charity,
        "total_charity_pool": total_charity, # Will be updated below
        "total_hours_logged": total_hours,
        "capital_pool_percentage": cap_pool_pct,
        "labour_pool_percentage": lab_pool_pct,
        "partner_payouts": []
    }

    # Helper to map user_id to username for reports
    from app.models.models import User
    user_names = {u.id: u.username for u in db.query(User).filter(User.role == 'PARTNER', User.company_id == company_id).all()}

    for partner in partners:
        # Proper capital percentage from sum (since capital_share_fixed is typically a monetary amount)
        cap_pct = partner.capital_share_fixed / total_capital if total_capital > 0 and partner.capital_share_fixed else 0.0
        
        # Dynamic Labor Share Calculation
        partner_logged_hours = partner_hours_map.get(partner.user_id, 0.0)
        
        if labour_share_mode == "percentage":
            lab_pct = partner.labor_share_variable / 100.0 if partner.labor_share_variable else 0.0
        else:
            lab_pct = partner_logged_hours / total_hours if total_hours > 0 else 0.0
        
        vol_charity_pct = partner.voluntary_charity_percentage if partner.voluntary_charity_percentage else 0

        payout_cap = distributable_capital * cap_pct
        payout_lab = distributable_labor * lab_pct
        gross_payout = payout_cap + payout_lab
        
        # Voluntary personal deduction (skip if loss)
        if gross_payout > 0:
            vol_charity_deduction = gross_payout * vol_charity_pct
        else:
            vol_charity_deduction = 0.0
        
        net_payout = gross_payout - vol_charity_deduction
        total_voluntary_charity += vol_charity_deduction

        distribution_report["partner_payouts"].append({
            "partner_user_id": partner.user_id,
            "partner_name": user_names.get(partner.user_id, f"Partner {partner.user_id}"),
            "hours_logged": partner_logged_hours,
            "labor_share_percentage": lab_pct,
            "capital_payout": round(payout_cap, 2),
            "labor_payout": round(payout_lab, 2),
            "gross_payout": round(gross_payout, 2),
            "voluntary_charity_percentage": vol_charity_pct,
            "voluntary_charity_deduction": round(vol_charity_deduction, 2),
            "net_payout": round(net_payout, 2)
        })

    distribution_report["total_voluntary_charity"] = round(total_voluntary_charity, 2)
    distribution_report["total_charity_pool"] = round(total_charity + total_voluntary_charity, 2)

    # 6. Persist Report and Lock Transactions
    period_name = datetime.now(timezone.utc).strftime("%B %d, %Y - %H:%M:%S UTC")
    
    # Create MonthlyReport record
    new_report = MonthlyReport(
        company_id=company_id,
        period_name=period_name,
        net_profit=round(gross_profit, 2),
        global_charity=round(total_charity, 2),
        voluntary_charity=round(total_voluntary_charity, 2),
        report_data=distribution_report # models.py uses JSON column
    )
    db.add(new_report)

    # Lock all current transactions and time entries
    db.query(Transaction).filter(Transaction.is_closed == False, Transaction.company_id == company_id).update({"is_closed": True})
    db.query(TimeEntry).filter(TimeEntry.is_closed == False, TimeEntry.company_id == company_id).update({"is_closed": True})
    db.flush() # Ensure the locks are applied before inserting carry over transaction
    
    # Log Contingency Pot Transfer
    if contingency_allocation > 0 and contingency_account:
        retained_earnings_account = db.query(Account).filter(Account.company_id == company_id, Account.name == "Retained Earnings", Account.type == AccountTypeEnum.EQUITY).first()
        if not retained_earnings_account:
            retained_earnings_account = Account(company_id=company_id, name="Retained Earnings", type=AccountTypeEnum.EQUITY)
            db.add(retained_earnings_account)
            db.flush()
            
        contingency_transaction = Transaction(
            company_id=company_id,
            description=f"Contingency Pot Allocation from period: {period_name}",
            created_by_id=admin_user_id,
            is_closed=True
        )
        db.add(contingency_transaction)
        db.flush()

        db.add(JournalEntry(
            transaction_id=contingency_transaction.id,
            account_id=retained_earnings_account.id,
            amount=contingency_allocation,
            type=EntryTypeEnum.DEBIT
        ))
        db.add(JournalEntry(
            transaction_id=contingency_transaction.id,
            account_id=contingency_account.id,
            amount=contingency_allocation,
            type=EntryTypeEnum.CREDIT
        ))

    # Process Loss Carry Forward
    if net_profit < 0:
        loss_amount = abs(net_profit)
        loss_account = db.query(Account).filter(Account.company_id == company_id, Account.name == "Loss Carried Forward", Account.type == AccountTypeEnum.EXPENSE).first()
        if not loss_account:
            loss_account = Account(company_id=company_id, name="Loss Carried Forward", type=AccountTypeEnum.EXPENSE)
            db.add(loss_account)
            db.flush()

        cf_transaction = Transaction(
            company_id=company_id,
            description=f"Loss Carried Forward from period: {period_name}",
            created_by_id=admin_user_id,
            is_closed=False  # Leave open for the next calculation period
        )
        db.add(cf_transaction)
        db.flush()

        cf_entry = JournalEntry(
            transaction_id=cf_transaction.id,
            account_id=loss_account.id,
            amount=loss_amount,
            type=EntryTypeEnum.DEBIT
        )
        db.add(cf_entry)
        
    db.commit()
    db.refresh(new_report)

    return distribution_report
