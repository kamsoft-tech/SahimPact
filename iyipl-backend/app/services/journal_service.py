from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import List
from app.models.models import Transaction, JournalEntry, EntryTypeEnum
from app.schemas.schemas import TransactionCreate

def create_journal_transaction(db: Session, transaction_data: TransactionCreate, user_id: int, company_id: int) -> Transaction:
    # 1. Validate Double-Entry Math (Debits == Credits)
    total_debits = sum(entry.amount for entry in transaction_data.entries if entry.type == EntryTypeEnum.DEBIT)
    total_credits = sum(entry.amount for entry in transaction_data.entries if entry.type == EntryTypeEnum.CREDIT)

    # Allow exact match or handle float precision strictly
    if round(total_debits, 2) != round(total_credits, 2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transaction unbalanced: Debits ({total_debits}) must equal Credits ({total_credits})."
        )

    # 2. Immutable Audit Trail: Create Transaction
    db_transaction = Transaction(
        description=transaction_data.description,
        created_by_id=user_id,
        company_id=company_id,
        is_reversing=False
    )
    db.add(db_transaction)
    db.flush() # Flushes to get the transaction ID

    # 3. Create Entries
    for entry_data in transaction_data.entries:
        db_entry = JournalEntry(
            transaction_id=db_transaction.id,
            account_id=entry_data.account_id,
            amount=entry_data.amount,
            type=entry_data.type
        )
        db.add(db_entry)

    db.commit()
    db.refresh(db_transaction)
    return db_transaction

def reverse_transaction(db: Session, original_transaction_id: int, user_id: int, company_id: int, reason: str) -> Transaction:
    original = db.query(Transaction).filter(Transaction.id == original_transaction_id, Transaction.company_id == company_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Original transaction not found.")
    
    if original.is_reversing:
        raise HTTPException(status_code=400, detail="Cannot reverse a reversing transaction.")

    # Create Reversing Transaction
    rev_transaction = Transaction(
        description=f"REVERSAL of TR-{original.id}: {reason}",
        created_by_id=user_id,
        company_id=company_id,
        is_reversing=True,
        original_transaction_id=original.id
    )
    db.add(rev_transaction)
    db.flush()

    # Create Opposite Entries
    for entry in original.entries:
        opposite_type = EntryTypeEnum.CREDIT if entry.type == EntryTypeEnum.DEBIT else EntryTypeEnum.DEBIT
        rev_entry = JournalEntry(
            transaction_id=rev_transaction.id,
            account_id=entry.account_id,
            amount=entry.amount,
            type=opposite_type
        )
        db.add(rev_entry)

    db.commit()
    db.refresh(rev_transaction)
    return rev_transaction

def get_account_balances(db: Session):
    # Sums all credits & debits grouping by account to return balances
    # Assets/Expenses: Balance = Debits - Credits
    # Liabilities/Equity/Revenue: Balance = Credits - Debits
    # (Implementation simplified for initial module)
    pass
