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

    if net_profit <= 0:
        # If no profit (or a loss), we still close the month but distribute nothing.
        # Ensure pool sizes are 0 to avoid negative payouts (we don't deduct losses from partners directly here)
        pool_capital = 0.0
        pool_labor = 0.0
    else:
        # 2. The 50/50 Split logic
        pool_capital = net_profit * 0.50
        pool_labor = net_profit * 0.50
    # Fetch global settings for dynamic charity percentage
    settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
    charity_percentage = settings.charity_percentage if settings else 0.06

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
    
    # 5. Distribute the Pools
    total_voluntary_charity = 0.0
    distribution_report = {
        "net_profit": net_profit,
        "global_charity_allocation": total_charity,
        "total_charity_pool": total_charity, # Will be updated below
        "total_hours_logged": total_hours,
        "partner_payouts": []
    }

    # Helper to map user_id to username for reports
    from app.models.models import User
    user_names = {u.id: u.username for u in db.query(User).filter(User.role == 'PARTNER', User.company_id == company_id).all()}

    for partner in partners:
        # Prevent division/zero or incorrect floats
        cap_pct = partner.capital_share_fixed / 100.0 if partner.capital_share_fixed else 0
        
        # Dynamic Labor Share Calculation
        partner_logged_hours = partner_hours_map.get(partner.user_id, 0.0)
        lab_pct = partner_logged_hours / total_hours if total_hours > 0 else 0.0
        
        vol_charity_pct = partner.voluntary_charity_percentage if partner.voluntary_charity_percentage else 0

        payout_cap = distributable_capital * cap_pct
        payout_lab = distributable_labor * lab_pct
        gross_payout = payout_cap + payout_lab
        
        # Voluntary personal deduction
        vol_charity_deduction = gross_payout * vol_charity_pct
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
        net_profit=round(net_profit, 2),
        global_charity=round(total_charity, 2),
        voluntary_charity=round(total_voluntary_charity, 2),
        report_data=distribution_report # models.py uses JSON column
    )
    db.add(new_report)

    # Lock all current transactions and time entries
    db.query(Transaction).filter(Transaction.is_closed == False, Transaction.company_id == company_id).update({"is_closed": True})
    db.query(TimeEntry).filter(TimeEntry.is_closed == False, TimeEntry.company_id == company_id).update({"is_closed": True})
    
    db.commit()
    db.refresh(new_report)

    return distribution_report
