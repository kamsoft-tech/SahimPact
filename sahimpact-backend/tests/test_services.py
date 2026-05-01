"""
Tests targeting the journal_service layer and journal API endpoint,
which were at 22% coverage. These use the FastAPI test client and
import service functions directly for unit-level verification.
"""
import pytest
from fastapi import HTTPException
from app.db.database import SessionLocal
from app.services.journal_service import create_journal_transaction, reverse_transaction
from app.schemas.schemas import TransactionCreate, JournalEntryCreate
from app.models.models import AccountTypeEnum, EntryTypeEnum, Account


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def test_accounts(db):
    """Create a cash and revenue account for service-level tests."""
    company_id = 1  # Default company seeded on startup

    cash = db.query(Account).filter(Account.name == "SvcTestCash", Account.company_id == company_id).first()
    if not cash:
        cash = Account(name="SvcTestCash", type=AccountTypeEnum.ASSET, company_id=company_id)
        db.add(cash)
        db.commit()
        db.refresh(cash)

    revenue = db.query(Account).filter(Account.name == "SvcTestRevenue", Account.company_id == company_id).first()
    if not revenue:
        revenue = Account(name="SvcTestRevenue", type=AccountTypeEnum.REVENUE, company_id=company_id)
        db.add(revenue)
        db.commit()
        db.refresh(revenue)

    return {"cash": cash, "revenue": revenue}


class TestJournalService:
    def test_create_balanced_transaction(self, db, test_accounts):
        """Happy path: balanced double-entry transaction is persisted."""
        data = TransactionCreate(
            description="Service test sale",
            entries=[
                JournalEntryCreate(
                    account_id=test_accounts["cash"].id,
                    amount=500.0,
                    type=EntryTypeEnum.DEBIT,
                ),
                JournalEntryCreate(
                    account_id=test_accounts["revenue"].id,
                    amount=500.0,
                    type=EntryTypeEnum.CREDIT,
                ),
            ],
        )
        tx = create_journal_transaction(db, data, user_id=1, company_id=1)
        assert tx.id is not None
        assert tx.description == "Service test sale"
        assert len(tx.entries) == 2

    def test_create_unbalanced_transaction_raises(self, db, test_accounts):
        """Unbalanced debits vs credits must raise HTTP 400."""
        data = TransactionCreate(
            description="Bad transaction",
            entries=[
                JournalEntryCreate(
                    account_id=test_accounts["cash"].id,
                    amount=300.0,
                    type=EntryTypeEnum.DEBIT,
                ),
                JournalEntryCreate(
                    account_id=test_accounts["revenue"].id,
                    amount=100.0,  # intentionally wrong
                    type=EntryTypeEnum.CREDIT,
                ),
            ],
        )
        with pytest.raises(HTTPException) as exc_info:
            create_journal_transaction(db, data, user_id=1, company_id=1)
        assert exc_info.value.status_code == 400
        assert "unbalanced" in exc_info.value.detail.lower()

    def test_reverse_transaction(self, db, test_accounts):
        """Reversing a transaction should flip debit/credit entries."""
        data = TransactionCreate(
            description="Transaction to reverse",
            entries=[
                JournalEntryCreate(
                    account_id=test_accounts["cash"].id,
                    amount=200.0,
                    type=EntryTypeEnum.DEBIT,
                ),
                JournalEntryCreate(
                    account_id=test_accounts["revenue"].id,
                    amount=200.0,
                    type=EntryTypeEnum.CREDIT,
                ),
            ],
        )
        original = create_journal_transaction(db, data, user_id=1, company_id=1)

        reversal = reverse_transaction(db, original.id, user_id=1, company_id=1, reason="Correction")
        assert reversal.is_reversing is True
        assert reversal.original_transaction_id == original.id
        # Each entry in the reversal should have the OPPOSITE type of the same account entry in the original
        original_map = {e.account_id: e.type for e in original.entries}
        for rev_entry in reversal.entries:
            orig_type = original_map.get(rev_entry.account_id)
            assert orig_type is not None, f"Account {rev_entry.account_id} not found in original"
            expected = EntryTypeEnum.CREDIT if orig_type == EntryTypeEnum.DEBIT else EntryTypeEnum.DEBIT
            assert rev_entry.type == expected, f"Expected {expected} for account {rev_entry.account_id}, got {rev_entry.type}"

    def test_reverse_nonexistent_transaction_raises(self, db):
        """Reversing a non-existent transaction should raise 404."""
        with pytest.raises(HTTPException) as exc_info:
            reverse_transaction(db, 99999, user_id=1, company_id=1, reason="shouldn't work")
        assert exc_info.value.status_code == 404

    def test_reverse_reversing_transaction_raises(self, db, test_accounts):
        """Cannot reverse a transaction that is itself a reversal."""
        data = TransactionCreate(
            description="Original",
            entries=[
                JournalEntryCreate(account_id=test_accounts["cash"].id, amount=50.0, type=EntryTypeEnum.DEBIT),
                JournalEntryCreate(account_id=test_accounts["revenue"].id, amount=50.0, type=EntryTypeEnum.CREDIT),
            ],
        )
        original = create_journal_transaction(db, data, user_id=1, company_id=1)
        reversal = reverse_transaction(db, original.id, user_id=1, company_id=1, reason="first reversal")

        with pytest.raises(HTTPException) as exc_info:
            reverse_transaction(db, reversal.id, user_id=1, company_id=1, reason="double reversal")
        assert exc_info.value.status_code == 400


class TestJournalEndpoint:
    """Tests for the /api/journal endpoint which wraps journal_service."""

    def test_create_journal_entry_via_api(self, client, admin_token, db, test_accounts):
        headers = {"Authorization": f"Bearer {admin_token}"}

        payload = {
            "description": "API journal test",
            "entries": [
                {"account_id": test_accounts["cash"].id, "amount": 750.0, "type": "debit"},
                {"account_id": test_accounts["revenue"].id, "amount": 750.0, "type": "credit"},
            ],
        }
        res = client.post("/api/journal", headers=headers, json=payload)
        assert res.status_code == 200, res.text
        assert res.json()["description"] == "API journal test"

    def test_create_unbalanced_journal_entry_via_api(self, client, admin_token, db, test_accounts):
        headers = {"Authorization": f"Bearer {admin_token}"}

        payload = {
            "description": "Unbalanced journal",
            "entries": [
                {"account_id": test_accounts["cash"].id, "amount": 999.0, "type": "debit"},
                {"account_id": test_accounts["revenue"].id, "amount": 1.0, "type": "credit"},
            ],
        }
        res = client.post("/api/journal", headers=headers, json=payload)
        assert res.status_code == 400


class TestCompaniesExtended:
    """Extend companies endpoint to hit uncovered branches."""

    def test_create_company(self, client, super_admin_token):
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        res = client.post("/api/companies", headers=headers, json={"name": "TestCompanyUnique123"})
        assert res.status_code == 200
        company_id = res.json()["id"]

        # Duplicate name should fail
        res_dup = client.post("/api/companies", headers=headers, json={"name": "TestCompanyUnique123"})
        assert res_dup.status_code == 400

        # Create admin for company (alphanumeric username only)
        res_admin = client.post(
            f"/api/companies/{company_id}/admin",
            headers=headers,
            json={"username": "newcoadminunique", "password": "testpass123"},
        )
        assert res_admin.status_code == 200

        # Duplicate username should fail
        res_dup_admin = client.post(
            f"/api/companies/{company_id}/admin",
            headers=headers,
            json={"username": "newcoadminunique", "password": "testpass123"},
        )
        assert res_dup_admin.status_code == 400

        # Create admin for non-existent company
        res_404 = client.post(
            "/api/companies/99999/admin",
            headers=headers,
            json={"username": "ghostadmin", "password": "testpass123"},
        )
        assert res_404.status_code == 404

        # Delete company
        res_del = client.delete(f"/api/companies/{company_id}", headers=headers)
        assert res_del.status_code == 204

    def test_delete_nonexistent_company(self, client, super_admin_token):
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        res = client.delete("/api/companies/99999", headers=headers)
        assert res.status_code == 404
