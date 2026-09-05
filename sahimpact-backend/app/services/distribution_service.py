from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from app.models.models import Transaction, JournalEntry, EntryTypeEnum, Account, AccountTypeEnum, PartnerShare, GlobalSettings, MonthlyReport, TimeEntry, User, RoleEnum
from datetime import datetime, timezone
import json
from fastapi import HTTPException

def ensure_system_accounts(db: Session, company_id: int):
    """Ensure essential system accounts exist for the company."""
    # 1. Retained Earnings (Equity) - The source of profit for distribution
    retained = db.query(Account).filter(Account.company_id == company_id, Account.name == "Retained Earnings").first()
    if not retained:
        retained = Account(company_id=company_id, name="Retained Earnings", type=AccountTypeEnum.EQUITY)
        db.add(retained)
        
    # 2. Contingency Reserve (Equity) - The pot for rainy days
    contingency = db.query(Account).filter(Account.company_id == company_id, Account.name == "Contingency Reserve").first()
    if not contingency:
        contingency = Account(company_id=company_id, name="Contingency Reserve", type=AccountTypeEnum.EQUITY)
        db.add(contingency)
        
    # 3. Global Charity Reserve (Liability) - Owed to the community
    charity = db.query(Account).filter(Account.company_id == company_id, Account.name == "Global Charity Reserve").first()
    if not charity:
        charity = Account(company_id=company_id, name="Global Charity Reserve", type=AccountTypeEnum.LIABILITY)
        db.add(charity)
        
    db.flush()
    return retained, contingency, charity

def calculate_month_end_close(db: Session, admin_user_id: int, company_id: int, negligent_user_id: Optional[int] = None):
    # 1. Calculate Net Profit (Gross Revenue - COGS - OpEx)
    # Fetch all revenue sum
    revenue_credits = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.REVENUE, JournalEntry.type == EntryTypeEnum.CREDIT, or_(Transaction.is_closed == False, Transaction.is_closed == None), Transaction.company_id == company_id).scalar() or 0
    revenue_debits = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.REVENUE, JournalEntry.type == EntryTypeEnum.DEBIT, or_(Transaction.is_closed == False, Transaction.is_closed == None), Transaction.company_id == company_id).scalar() or 0
    net_revenue = revenue_credits - revenue_debits

    # Fetch all expense sum
    expense_debits = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.EXPENSE, JournalEntry.type == EntryTypeEnum.DEBIT, or_(Transaction.is_closed == False, Transaction.is_closed == None), Transaction.company_id == company_id).scalar() or 0
    expense_credits = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.EXPENSE, JournalEntry.type == EntryTypeEnum.CREDIT, or_(Transaction.is_closed == False, Transaction.is_closed == None), Transaction.company_id == company_id).scalar() or 0
    net_expenses = expense_debits - expense_credits

    gross_profit = net_revenue - net_expenses
    net_profit = gross_profit

    settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
    cap_pool_pct = settings.capital_pool_percentage if settings and settings.capital_pool_percentage is not None else 0.50
    lab_pool_pct = settings.labour_pool_percentage if settings and settings.labour_pool_percentage is not None else 0.50
    charity_percentage = settings.charity_percentage if settings and settings.charity_percentage is not None else 0.06

    contingency_pot_min = getattr(settings, 'contingency_pot_minimum', 10000.0) if settings else 10000.0
    contingency_allocation = 0.0
    
    # Ensure system accounts exist and get them
    retained_acc, contingency_acc, charity_acc = ensure_system_accounts(db, company_id)

    if net_profit > 0:
        contingency_credits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
            JournalEntry.account_id == contingency_acc.id, 
            JournalEntry.type == EntryTypeEnum.CREDIT,
            Transaction.is_closed == True
        ).scalar() or 0.0
        
        contingency_debits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
            JournalEntry.account_id == contingency_acc.id, 
            JournalEntry.type == EntryTypeEnum.DEBIT,
            Transaction.is_closed == True
        ).scalar() or 0.0
        
        current_pot_balance = contingency_credits - contingency_debits
        pot_shortfall = max(0.0, contingency_pot_min - current_pot_balance)
        
        contingency_allocation = min(net_profit, pot_shortfall)
        net_profit -= contingency_allocation

    if net_profit < 0:
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
        pool_capital = net_profit * cap_pool_pct
        pool_labor = net_profit * lab_pool_pct
        
        charity_capital = pool_capital * charity_percentage
        charity_labor = pool_labor * charity_percentage

    total_charity = charity_capital + charity_labor

    distributable_capital = pool_capital - charity_capital
    distributable_labor = pool_labor - charity_labor

    partners = db.query(PartnerShare).filter(PartnerShare.company_id == company_id).all()
    open_time_entries = db.query(TimeEntry).filter(or_(TimeEntry.is_closed == False, TimeEntry.is_closed == None), TimeEntry.company_id == company_id).all()
    
    total_hours = sum(entry.hours for entry in open_time_entries)
    partner_hours_map = {}
    for entry in open_time_entries:
        partner_hours_map[entry.user_id] = partner_hours_map.get(entry.user_id, 0.0) + entry.hours
        
    total_capital = sum(p.capital_share_fixed for p in partners if p.capital_share_fixed)
    
    total_voluntary_charity = 0.0
    gross_profit = net_profit + contingency_allocation
    
    reimbursement_accounts = db.query(Account).filter(
        Account.company_id == company_id, 
        Account.name.like("Partner % Reimbursement"), 
        Account.type == AccountTypeEnum.LIABILITY
    ).all()
    
    reimbursement_balances = {}
    for acc in reimbursement_accounts:
        try:
            p_id = int(acc.name.split(" ")[1])
            credits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
                JournalEntry.account_id == acc.id, 
                JournalEntry.type == EntryTypeEnum.CREDIT,
                or_(Transaction.is_closed == False, Transaction.is_closed == None)
            ).scalar() or 0.0
            debits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
                JournalEntry.account_id == acc.id, 
                JournalEntry.type == EntryTypeEnum.DEBIT,
                or_(Transaction.is_closed == False, Transaction.is_closed == None)
            ).scalar() or 0.0
            
            reimbursement_balances[p_id] = credits - debits
        except (IndexError, ValueError):
            continue

    distribution_report = {
        "net_profit": gross_profit,
        "distributable_net_profit": net_profit,
        "contingency_pot_allocation": round(contingency_allocation, 2),
        "global_charity_allocation": total_charity,
        "total_charity_pool": total_charity,
        "total_hours_logged": total_hours,
        "capital_pool_percentage": cap_pool_pct,
        "labour_pool_percentage": lab_pool_pct,
        "distributions": []
    }

    from app.models.models import UserCompanyLink
    user_names = {u.id: (u.full_name if u.full_name else u.username) for u in db.query(User).join(UserCompanyLink).filter(UserCompanyLink.company_id == company_id).all()}
    for partner in partners:
        cap_pct = partner.capital_share_fixed / total_capital if total_capital > 0 and partner.capital_share_fixed else 0.0
        
        partner_logged_hours = partner_hours_map.get(partner.user_id, 0.0)
        
        lab_pct = partner.labor_share_variable / 100.0 if partner.labor_share_variable else 0.0
        
        vol_charity_pct = partner.voluntary_charity_percentage if partner.voluntary_charity_percentage else 0

        if net_profit < 0:
            # Loss Rule: Proportional to Capital Share ONLY. Labor share ignored for loss.
            if negligent_user_id:
                # Negligence Clause: If a partner is negligent, they alone carry the loss.
                payout_cap = net_profit if partner.user_id == negligent_user_id else 0.0
            else:
                payout_cap = net_profit * cap_pct
            payout_lab = 0.0
        else:
            payout_cap = distributable_capital * cap_pct
            payout_lab = distributable_labor * lab_pct
            
        gross_equity_payout = payout_cap + payout_lab
        
        if gross_equity_payout > 0:
            vol_charity_deduction = gross_equity_payout * vol_charity_pct
        else:
            vol_charity_deduction = 0.0
        
        net_equity_payout = gross_equity_payout - vol_charity_deduction
        total_voluntary_charity += vol_charity_deduction

        reimbursement_amount = reimbursement_balances.get(partner.user_id, 0.0)
        final_total_payout = net_equity_payout + reimbursement_amount

        # Master Fund Return Sweep
        partner_user = db.query(User).filter(User.id == partner.user_id).first()
        if partner_user and partner_user.role == RoleEnum.MASTER_ADMIN:
            from app.services.master_service import roll_returns_back
            from app.models.models import Company, CapitalPool
            comp = db.query(Company).filter(Company.id == company_id).first()
            if comp and comp.master_entity_id:
                pool = db.query(CapitalPool).filter(CapitalPool.master_entity_id == comp.master_entity_id).first()
                if pool:
                    roll_returns_back(db, pool.id, company_id, final_total_payout)

        distribution_report["distributions"].append({
            "partner_user_id": partner.user_id,
            "partner_name": user_names.get(partner.user_id, f"Partner {partner.user_id}"),
            "hours_logged": partner_logged_hours,
            "labor_share_percentage": lab_pct,
            "capital_payout": round(payout_cap, 2),
            "labor_payout": round(payout_lab, 2),
            "gross_equity_payout": round(gross_equity_payout, 2),
            "voluntary_charity_percentage": vol_charity_pct,
            "voluntary_charity_amount": round(vol_charity_deduction, 2),
            "net_equity_payout": round(net_equity_payout, 2),
            "reimbursements": round(reimbursement_amount, 2),
            "total_payout": round(final_total_payout, 2)
        })

    distribution_report["total_voluntary_charity"] = round(total_voluntary_charity, 2)
    distribution_report["total_charity_pool"] = round(total_charity + total_voluntary_charity, 2)

    period_name = datetime.now(timezone.utc).strftime("%B %d, %Y - %H:%M:%S UTC")
    
    new_report = MonthlyReport(
        company_id=company_id,
        period_name=period_name,
        net_profit=round(gross_profit, 2),
        global_charity=round(total_charity, 2),
        voluntary_charity=round(total_voluntary_charity, 2),
        report_data=distribution_report
    )
    db.add(new_report)

    db.query(Transaction).filter(or_(Transaction.is_closed == False, Transaction.is_closed == None), Transaction.company_id == company_id).update({"is_closed": True}, synchronize_session=False)
    db.query(TimeEntry).filter(or_(TimeEntry.is_closed == False, TimeEntry.is_closed == None), TimeEntry.company_id == company_id).update({"is_closed": True}, synchronize_session=False)
    db.flush() 
    
    if contingency_allocation > 0:
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
            account_id=retained_acc.id,
            amount=contingency_allocation,
            type=EntryTypeEnum.DEBIT
        ))
        db.add(JournalEntry(
            transaction_id=contingency_transaction.id,
            account_id=contingency_acc.id,
            amount=contingency_allocation,
            type=EntryTypeEnum.CREDIT
        ))

    if total_charity > 0:
        charity_transaction = Transaction(
            company_id=company_id,
            description=f"Global Charity Allocation from period: {period_name}",
            created_by_id=admin_user_id,
            is_closed=True
        )
        db.add(charity_transaction)
        db.flush()

        db.add(JournalEntry(
            transaction_id=charity_transaction.id,
            account_id=retained_acc.id,
            amount=total_charity,
            type=EntryTypeEnum.DEBIT
        ))
        db.add(JournalEntry(
            transaction_id=charity_transaction.id,
            account_id=charity_acc.id,
            amount=total_charity,
            type=EntryTypeEnum.CREDIT
        ))

    if net_profit < 0:
        loss_amount = abs(net_profit)
        
        if negligent_user_id:
            # Negligence Case: The identified partner owes the full loss amount to the company
            # We record this as an Asset (Partner Debt) and Credit Retained Earnings to offset the loss
            neg_acc_name = f"Partner {negligent_user_id} Negligence Debt"
            neg_account = db.query(Account).filter(Account.company_id == company_id, Account.name == neg_acc_name).first()
            if not neg_account:
                neg_account = Account(company_id=company_id, name=neg_acc_name, type=AccountTypeEnum.ASSET)
                db.add(neg_account)
                db.flush()

            neg_transaction = Transaction(
                company_id=company_id,
                description=f"Negligence Loss Allocation - Partner {negligent_user_id} for period: {period_name}",
                created_by_id=admin_user_id,
                is_closed=True
            )
            db.add(neg_transaction)
            db.flush()

            db.add(JournalEntry(
                transaction_id=neg_transaction.id,
                account_id=neg_account.id,
                amount=loss_amount,
                type=EntryTypeEnum.DEBIT
            ))
            db.add(JournalEntry(
                transaction_id=neg_transaction.id,
                account_id=retained_acc.id,
                amount=loss_amount,
                type=EntryTypeEnum.CREDIT
            ))
        else:
            # Standard Case: Loss is carried forward by the company
            loss_account = db.query(Account).filter(Account.company_id == company_id, Account.name == "Loss Carried Forward", Account.type == AccountTypeEnum.EXPENSE).first()
            if not loss_account:
                loss_account = Account(company_id=company_id, name="Loss Carried Forward", type=AccountTypeEnum.EXPENSE)
                db.add(loss_account)
                db.flush()

            cf_transaction = Transaction(
                company_id=company_id,
                description=f"Loss Carried Forward from period: {period_name}",
                created_by_id=admin_user_id,
                is_closed=False
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

def get_forecasted_shares(db: Session, company_id: Optional[int]):
    rev_credits_query = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.REVENUE, JournalEntry.type == EntryTypeEnum.CREDIT, or_(Transaction.is_closed == False, Transaction.is_closed == None))
    
    rev_debits_query = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.REVENUE, JournalEntry.type == EntryTypeEnum.DEBIT, or_(Transaction.is_closed == False, Transaction.is_closed == None))
    
    exp_debits_query = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.EXPENSE, JournalEntry.type == EntryTypeEnum.DEBIT, or_(Transaction.is_closed == False, Transaction.is_closed == None))
    
    exp_credits_query = db.query(func.sum(JournalEntry.amount)).join(Account)\
        .join(Transaction, JournalEntry.transaction_id == Transaction.id)\
        .filter(Account.type == AccountTypeEnum.EXPENSE, JournalEntry.type == EntryTypeEnum.CREDIT, or_(Transaction.is_closed == False, Transaction.is_closed == None))

    if company_id:
        rev_credits_query = rev_credits_query.filter(Transaction.company_id == company_id)
        rev_debits_query = rev_debits_query.filter(Transaction.company_id == company_id)
        exp_debits_query = exp_debits_query.filter(Transaction.company_id == company_id)
        exp_credits_query = exp_credits_query.filter(Transaction.company_id == company_id)

    revenue_credits = rev_credits_query.scalar() or 0
    revenue_debits = rev_debits_query.scalar() or 0
    net_revenue = revenue_credits - revenue_debits

    expense_debits = exp_debits_query.scalar() or 0
    expense_credits = exp_credits_query.scalar() or 0
    net_expenses = expense_debits - expense_credits

    net_profit = net_revenue - net_expenses

    cap_pool_pct = 0.50
    lab_pool_pct = 0.50
    charity_percentage = 0.06
    contingency_pot_min = 10000.0

    if company_id:
        settings = db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first()
        if settings:
            cap_pool_pct = settings.capital_pool_percentage if settings.capital_pool_percentage is not None else 0.50
            lab_pool_pct = settings.labour_pool_percentage if settings.labour_pool_percentage is not None else 0.50
            charity_percentage = settings.charity_percentage if settings.charity_percentage is not None else 0.06
            contingency_pot_min = getattr(settings, 'contingency_pot_minimum', 10000.0)

    contingency_allocation = 0.0

    if net_profit > 0:
        acc_query = db.query(Account).filter(Account.name == "Contingency Reserve", Account.type == AccountTypeEnum.EQUITY)
        if company_id:
            acc_query = acc_query.filter(Account.company_id == company_id)
        
        contingency_accounts = acc_query.all()
        if contingency_accounts:
            acc_ids = [a.id for a in contingency_accounts]
            contingency_credits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
                JournalEntry.account_id.in_(acc_ids), 
                JournalEntry.type == EntryTypeEnum.CREDIT,
                Transaction.is_closed == True
            ).scalar() or 0.0
            contingency_debits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(
                JournalEntry.account_id.in_(acc_ids), 
                JournalEntry.type == EntryTypeEnum.DEBIT,
                Transaction.is_closed == True
            ).scalar() or 0.0
            current_pot_balance = contingency_credits - contingency_debits
            pot_shortfall = max(0.0, contingency_pot_min - current_pot_balance)
            contingency_allocation = min(net_profit, pot_shortfall)
            net_profit -= contingency_allocation

    if net_profit < 0:
        pool_capital, pool_labor = net_profit, 0.0
        charity_capital, charity_labor = 0.0, 0.0
    elif net_profit == 0:
        pool_capital, pool_labor = 0.0, 0.0
        charity_capital, charity_labor = 0.0, 0.0
    else:
        pool_capital, pool_labor = net_profit * cap_pool_pct, net_profit * lab_pool_pct
        charity_capital, charity_labor = pool_capital * charity_percentage, pool_labor * charity_percentage

    total_charity = charity_capital + charity_labor
    distributable_capital = pool_capital - charity_capital
    distributable_labor = pool_labor - charity_labor

    user_query = db.query(User).filter(
        or_(User.role == RoleEnum.PARTNER, User.role == RoleEnum.COMPANY_ADMIN)
    )
    if company_id:
        user_query = user_query.filter(User.company_id == company_id)
        
    users = user_query.all()
    user_ids = [u.id for u in users]
    user_names = {u.id: (u.full_name if u.full_name else u.username) for u in users}

    existing_shares = {s.user_id: s for s in db.query(PartnerShare).filter(PartnerShare.user_id.in_(user_ids)).all()}
    
    partners = []
    for user in users:
        share = existing_shares.get(user.id)
        if not share:
            share = PartnerShare(
                user_id=user.id,
                company_id=user.company_id,
                capital_share_fixed=0.0,
                labor_share_variable=0.0,
                voluntary_charity_percentage=0.0
            )
        partners.append(share)

    # Ensure accounts exist
    if company_id:
        ensure_system_accounts(db, company_id)
    
    # Calculate Profit
    time_query = db.query(TimeEntry).filter(or_(TimeEntry.is_closed == False, TimeEntry.is_closed == None))
    if company_id:
        time_query = time_query.filter(TimeEntry.company_id == company_id)
    
    open_time_entries = time_query.all()
    total_hours = sum(entry.hours for entry in open_time_entries)
    partner_hours_map = {}
    for entry in open_time_entries:
        partner_hours_map[entry.user_id] = partner_hours_map.get(entry.user_id, 0.0) + entry.hours
        
    total_capital = sum(p.capital_share_fixed for p in partners if p.capital_share_fixed)
    
    reimb_acc_query = db.query(Account).filter(Account.name.like("Partner % Reimbursement"), Account.type == AccountTypeEnum.LIABILITY)
    if company_id:
        reimb_acc_query = reimb_acc_query.filter(Account.company_id == company_id)
    
    reimbursement_accounts = reimb_acc_query.all()
    reimbursement_balances = {}
    for acc in reimbursement_accounts:
        try:
            parts = acc.name.split(" ")
            if len(parts) >= 2 and parts[1].isdigit():
                p_id = int(parts[1])
                credits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(JournalEntry.account_id == acc.id, JournalEntry.type == EntryTypeEnum.CREDIT, or_(Transaction.is_closed == False, Transaction.is_closed == None)).scalar() or 0.0
                debits = db.query(func.sum(JournalEntry.amount)).join(Transaction).filter(JournalEntry.account_id == acc.id, JournalEntry.type == EntryTypeEnum.DEBIT, or_(Transaction.is_closed == False, Transaction.is_closed == None)).scalar() or 0.0
                reimbursement_balances[p_id] = credits - debits
        except: continue

    results = []
    for partner in partners:
        cap_pct = partner.capital_share_fixed / total_capital if total_capital > 0 and partner.capital_share_fixed else 0.0
        partner_logged_hours = partner_hours_map.get(partner.user_id, 0.0)
        
        lab_pct = partner.labor_share_variable / 100.0 if partner.labor_share_variable else 0.0
        
        vol_charity_pct = partner.voluntary_charity_percentage or 0
        
        if net_profit < 0:
            # Forecast should show the capital-only loss rule
            payout_cap = net_profit * cap_pct
            payout_lab = 0.0
        else:
            payout_cap = distributable_capital * cap_pct
            payout_lab = distributable_labor * lab_pct

        gross_payout = payout_cap + payout_lab
        vol_charity = max(0.0, gross_payout * vol_charity_pct)
        net_payout = gross_payout - vol_charity
        reimbursement = reimbursement_balances.get(partner.user_id, 0.0)

        results.append({
            "partner_name": user_names.get(partner.user_id, f"Partner {partner.user_id}"),
            "hours": partner_logged_hours,
            "gross_payout": round(gross_payout, 2),
            "voluntary_charity": round(vol_charity, 2),
            "forecasted_share": round(net_payout, 2),
            "reimbursements": round(reimbursement, 2),
            "total_estimated": round(net_payout + reimbursement, 2)
        })

    return {
        "net_profit": round(net_revenue - net_expenses, 2),
        "contingency_allocation": round(contingency_allocation, 2),
        "global_charity": round(total_charity, 2),
        "distributable_profit": round(net_profit, 2),
        "total_hours_logged": total_hours,
        "partners": results
    }
