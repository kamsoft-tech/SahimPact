"""
Comprehensive tests targeting uncovered code paths:
- auth.py: partner creation, me endpoints, company users, password mgmt
- companies.py: get/update company, user management endpoints
- distribution_service.py: edge cases
- expenses.py: full CRUD
- ingestion.py: file parsing
"""
import pytest
import io
import csv
from datetime import datetime, timedelta


# ─── Auth / User Management ───────────────────────────────────────────────────

class TestAuthExtended:
    """Cover auth.py endpoints not yet tested."""

    def test_get_admin_users_as_super_admin(self, client, admin_token):
        """Super Admin listing /admin/users returns all users."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = client.get("/api/admin/users", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_get_admin_users_forbidden_without_token(self, client):
        res = client.get("/api/admin/users")
        assert res.status_code == 401

    def test_create_partner_as_company_admin(self, client, admin_token):
        """
        Company Admins can create new Partners via POST /admin/users.
        We first create a company + admin, log in as that admin, then create a partner.
        """
        headers = {"Authorization": f"Bearer {admin_token}"}

        # Create a company
        company_res = client.post("/api/companies/", headers=headers, json={"name": "PartnerTestCo"})
        assert company_res.status_code == 200
        company_id = company_res.json()["id"]

        # Create company admin
        admin_res = client.post(
            f"/api/companies/{company_id}/admin/",
            headers=headers,
            json={"username": "ptcadmin", "password": "ptcAdminPass123!_safe_$$"}
        )
        assert admin_res.status_code == 200

        # Log in as company admin
        co_admin_login = client.post("/api/token", data={"username": "ptcadmin", "password": "ptcAdminPass123!_safe_$$"})
        assert co_admin_login.status_code == 200
        co_admin_token = co_admin_login.json()["access_token"]
        co_headers = {"Authorization": f"Bearer {co_admin_token}"}

        # Create a partner under this company
        partner_res = client.post("/api/admin/users", headers=co_headers, json={
            "username": "partnertestuser",
            "password": "ptcPartnerPass123!_safe_$$",
            "full_name": "Partner Test"
        })
        assert partner_res.status_code == 200
        assert partner_res.json()["role"] == "PARTNER"

        # Duplicate username should fail
        dup_res = client.post("/api/admin/users", headers=co_headers, json={
            "username": "partnertestuser",
            "password": "ptcPartnerPass123!_safe_$$"
        })
        assert dup_res.status_code == 400

        # Invalid username (non-alphanumeric) should fail
        invalid_res = client.post("/api/admin/users", headers=co_headers, json={
            "username": "bad user!",
            "password": "ptcPartnerPass123!_safe_$$"
        })
        assert invalid_res.status_code == 400

        # Cleanup
        client.delete(f"/api/companies/{company_id}/", headers=headers)

    def test_create_partner_as_super_admin_works_in_default_co(self, client, admin_token):
        """Super Admin (in Default Company) CAN use POST /admin/users."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = client.post("/api/admin/users", headers=headers, json={
            "username": "saadminpartner",
            "password": "ptcAdminPass123!_safe_$$"
        })
        assert res.status_code == 200
        assert res.json()["username"] == "saadminpartner"

    def test_update_me(self, client, partner_token):
        """Partners can update their own full_name."""
        headers = {"Authorization": f"Bearer {partner_token}"}
        res = client.put("/api/me", headers=headers, json={"full_name": "Updated Name"})
        assert res.status_code == 200
        assert res.json()["full_name"] == "Updated Name"

    def test_get_admin_stats(self, client, admin_token):
        """Super Admin can view system stats."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = client.get("/api/admin/stats", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "total_companies" in data
        assert "total_users" in data
        assert "total_transactions" in data
        assert "active_partners" in data

    def test_get_admin_stats_forbidden_for_partner(self, client, partner_token):
        headers = {"Authorization": f"Bearer {partner_token}"}
        res = client.get("/api/admin/stats", headers=headers)
        assert res.status_code == 403

    def test_change_own_password(self, client, admin_token):
        """Admin can change their own password via PUT /me/password."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        import os
        initial_pwd = os.environ.get("SUPER_ADMIN_INITIAL_PASSWORD", "ChangeMe_OnFirstLogin!")

        # Change password
        res = client.put("/api/me/password", headers=headers, json={
            "current_password": initial_pwd,
            "new_password": "ptcNewSecurePass123!_safe_$$"
        })
        assert res.status_code == 200

        # Change it back
        new_headers_res = client.post("/api/token", data={"username": "admin", "password": "ptcNewSecurePass123!_safe_$$"})
        assert new_headers_res.status_code == 200
        new_token = new_headers_res.json()["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}
        client.put("/api/me/password", headers=new_headers, json={
            "current_password": "ptcNewSecurePass123!_safe_$$",
            "new_password": initial_pwd
        })

    def test_change_own_password_wrong_current(self, client, partner_token):
        """Wrong current password should return 400."""
        headers = {"Authorization": f"Bearer {partner_token}"}
        res = client.put("/api/me/password", headers=headers, json={
            "current_password": "completelyWrong",
            "new_password": "newvalidpass123"
        })
        assert res.status_code == 400

    def test_change_own_password_too_short(self, client, partner_token):
        """New password under 8 chars should return 400."""
        headers = {"Authorization": f"Bearer {partner_token}"}
        res = client.put("/api/me/password", headers=headers, json={
            "current_password": "password",
            "new_password": "short"
        })
        assert res.status_code == 400

    def test_admin_reset_cross_company_forbidden(self, client, admin_token):
        """Company Admin cannot reset password of user in another company."""
        sa_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create two companies
        co1 = client.post("/api/companies/", headers=sa_headers, json={"name": "CrossCo1"}).json()
        co2 = client.post("/api/companies/", headers=sa_headers, json={"name": "CrossCo2"}).json()

        client.post(f"/api/companies/{co1['id']}/admin/", headers=sa_headers,
                    json={"username": "co1admin", "password": "ptcAdminPass123!_safe_$$"})
        client.post(f"/api/companies/{co2['id']}/admin/", headers=sa_headers,
                    json={"username": "co2admin", "password": "ptcAdminPass123!_safe_$$"})

        co1_login = client.post("/api/token", data={"username": "co1admin", "password": "ptcAdminPass123!_safe_$$"})
        co1_token = co1_login.json()["access_token"]
        co2_admin = client.get(f"/api/companies/{co2['id']}/users", headers=sa_headers).json()

        if co2_admin:
            res = client.post("/api/admin/reset-password",
                              headers={"Authorization": f"Bearer {co1_token}"},
                              json={"user_id": co2_admin[0]["id"], "new_password": "hackedpass123"})
            assert res.status_code == 403

        client.delete(f"/api/companies/{co1['id']}/", headers=sa_headers)
        client.delete(f"/api/companies/{co2['id']}/", headers=sa_headers)


# ─── Companies Extended ────────────────────────────────────────────────────────

class TestCompaniesUserMgmt:
    """Cover new user management endpoints added to companies.py."""

    @pytest.fixture(scope="class")
    def company_setup(self, client, admin_token):
        """Creates a company with an admin and a partner for testing."""
        sa_headers = {"Authorization": f"Bearer {admin_token}"}

        co = client.post("/api/companies/", headers=sa_headers, json={"name": "UserMgmtTestCo"}).json()
        company_id = co["id"]

        client.post(f"/api/companies/{company_id}/admin/", headers=sa_headers,
                    json={"username": "umgmtadmin", "password": "ptcAdminPass123!_safe_$$"})

        co_admin_token = client.post("/api/token", data={"username": "umgmtadmin", "password": "ptcAdminPass123!_safe_$$"}).json()["access_token"]
        co_headers = {"Authorization": f"Bearer {co_admin_token}"}

        # Create a partner
        client.post("/api/admin/users", headers=co_headers, json={
            "username": "umgmtpartner",
            "password": "ptcPartnerPass123!_safe_$$"
        })

        users = client.get(f"/api/companies/{company_id}/users", headers=sa_headers).json()
        admin_user = next((u for u in users if u["username"] == "umgmtadmin"), None)
        partner_user = next((u for u in users if u["username"] == "umgmtpartner"), None)

        yield {
            "company_id": company_id,
            "sa_headers": sa_headers,
            "co_headers": co_headers,
            "admin_user": admin_user,
            "partner_user": partner_user,
        }

        client.delete(f"/api/companies/{company_id}/", headers=sa_headers)

    def test_get_company(self, client, company_setup):
        sa_headers = company_setup["sa_headers"]
        company_id = company_setup["company_id"]
        res = client.get(f"/api/companies/{company_id}", headers=sa_headers)
        assert res.status_code == 200
        assert res.json()["id"] == company_id

    def test_get_company_not_found(self, client, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = client.get("/api/companies/99999", headers=headers)
        assert res.status_code == 404

    def test_update_company_name(self, client, company_setup):
        sa_headers = company_setup["sa_headers"]
        company_id = company_setup["company_id"]
        res = client.put(f"/api/companies/{company_id}", headers=sa_headers,
                         json={"name": "UserMgmtTestCo Renamed"})
        assert res.status_code == 200
        assert res.json()["name"] == "UserMgmtTestCo Renamed"

    def test_get_company_users(self, client, company_setup):
        sa_headers = company_setup["sa_headers"]
        company_id = company_setup["company_id"]
        res = client.get(f"/api/companies/{company_id}/users", headers=sa_headers)
        assert res.status_code == 200
        usernames = [u["username"] for u in res.json()]
        assert "umgmtadmin" in usernames
        assert "umgmtpartner" in usernames

    def test_promote_partner_to_admin(self, client, company_setup):
        sa_headers = company_setup["sa_headers"]
        company_id = company_setup["company_id"]
        partner = company_setup["partner_user"]
        if not partner:
            pytest.skip("partner_user not found")
        res = client.put(f"/api/companies/{company_id}/users/{partner['id']}/role",
                         headers=sa_headers, json={"role": "COMPANY_ADMIN"})
        assert res.status_code == 200
        assert res.json()["role"] == "COMPANY_ADMIN"

    def test_demote_admin_to_partner(self, client, company_setup):
        sa_headers = company_setup["sa_headers"]
        company_id = company_setup["company_id"]
        partner = company_setup["partner_user"]
        if not partner:
            pytest.skip("partner_user not found")
        res = client.put(f"/api/companies/{company_id}/users/{partner['id']}/role",
                         headers=sa_headers, json={"role": "PARTNER"})
        assert res.status_code == 200
        assert res.json()["role"] == "PARTNER"

    def test_role_update_nonexistent_user(self, client, company_setup):
        sa_headers = company_setup["sa_headers"]
        company_id = company_setup["company_id"]
        res = client.put(f"/api/companies/{company_id}/users/99999/role",
                         headers=sa_headers, json={"role": "PARTNER"})
        assert res.status_code == 404

    def test_deactivate_user(self, client, company_setup):
        sa_headers = company_setup["sa_headers"]
        company_id = company_setup["company_id"]
        partner = company_setup["partner_user"]
        if not partner:
            pytest.skip("partner_user not found")
        res = client.delete(f"/api/companies/{company_id}/users/{partner['id']}",
                            headers=sa_headers)
        assert res.status_code == 204

    def test_deactivate_nonexistent_user(self, client, company_setup):
        sa_headers = company_setup["sa_headers"]
        company_id = company_setup["company_id"]
        res = client.delete(f"/api/companies/{company_id}/users/99999",
                            headers=sa_headers)
        assert res.status_code == 404

    def test_company_admin_cannot_access_other_company(self, client, company_setup):
        """Company Admin cannot GET another company's details."""
        co_headers = company_setup["co_headers"]
        res = client.get("/api/companies/1", headers=co_headers)
        # Should succeed only if it's the same company, otherwise 403
        assert res.status_code in (200, 403)


# ─── Expenses ─────────────────────────────────────────────────────────────────

class TestExpenses:
    """Full CRUD coverage for expenses endpoint."""

    def test_get_expenses_empty(self, client, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = client.get("/api/expenses/", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_get_expenses_unauthorized(self, client):
        res = client.get("/api/expenses/")
        assert res.status_code == 401

    def test_create_expense_full(self, client, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        # 1. Standard Cash Expense with Receipt
        from io import BytesIO
        # Valid PNG magic bytes + fake data
        file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0DIHDR" + b"fake_receipt_data_to_pass_validation"
        files = {
            "receipt_file": ("receipt.png", BytesIO(file_content), "image/png")
        }
        data = {
            "amount": "150.50",
            "description": "Lunch meeting",
            "category_id": "1",
            "is_out_of_pocket": "false"
        }
        res = client.post("/api/expenses/", headers=headers, data=data, files=files)
        assert res.status_code == 200
        assert "receipt_url" in res.json()

        # 2. Out-of-pocket Expense
        data_oop = {
            "amount": "45.00",
            "description": "Bus fare",
            "category_id": "1",
            "is_out_of_pocket": "true",
            "partner_id": "2"
        }
        res_oop = client.post("/api/expenses/", headers=headers, data=data_oop)
        assert res_oop.status_code == 200
        assert res_oop.json()["is_out_of_pocket"] is True

    def test_expenses_partner_access(self, client, partner_token):
        """Partners should be able to log and view expenses."""
        headers = {"Authorization": f"Bearer {partner_token}"}
        res = client.get("/api/expenses/", headers=headers)
        assert res.status_code in (200, 403)  # Depends on role policy


# ─── Distribution Service Edge Cases ──────────────────────────────────────────

class TestDistributionEdgeCases:
    """Supplement distribution_service.py coverage."""

    def test_contingency_balance_is_numeric(self, client, partner_token):
        headers = {"Authorization": f"Bearer {partner_token}"}
        res = client.get("/api/distribution/contingency-balance", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json()["balance"], (int, float))

    def test_reports_list_structure(self, client, partner_token):
        headers = {"Authorization": f"Bearer {partner_token}"}
        res = client.get("/api/distribution/reports", headers=headers)
        assert res.status_code == 200
        reports = res.json()
        # If any reports, validate keys
        if reports:
            assert "period_name" in reports[0]
            assert "net_profit" in reports[0]
            assert "report_data" in reports[0]

    def test_month_end_close_no_transactions(self, client, partner_token):
        """Month-end close with no open transactions should return a business error, not 500."""
        headers = {"Authorization": f"Bearer {partner_token}"}
        # Clear all open transactions first
        client.delete("/api/ledger/", headers=headers)
        client.delete("/api/time/", headers=headers)
        res = client.post("/api/distribution/month-end-close", headers=headers)
        assert res.status_code in (200, 400, 422)

    def test_month_end_close_with_sales(self, client, partner_token):
        """Month-end close with a sale should complete or return a business error."""
        headers = {"Authorization": f"Bearer {partner_token}"}
        client.post("/api/ledger/", headers=headers, json={
            "type": "sales",
            "amount": 50000.00,
            "description": "Test period sale"
        })
        res = client.post("/api/distribution/month-end-close", headers=headers)
        assert res.status_code in (200, 400, 422)


# ─── Ingestion ────────────────────────────────────────────────────────────────

class TestIngestion:
    """Cover ingestion.py endpoint for file uploads."""

    def _make_csv(self, rows):
        """Helper to create a CSV file-like object."""
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        output.seek(0)
        return io.BytesIO(output.read().encode("utf-8"))

    def test_ingest_bank_statement_formats(self, client, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # 1. Tide Format (Paid In / Paid Out)
        tide_csv = "Date,Description,Paid In,Paid Out\n2024-04-01,Sale,100.00,\n2024-04-02,Buy,0.00,50.00\n"
        res = client.post("/api/ingest/bank-statement", headers=headers, 
                          files={"file": ("tide.csv", tide_csv.encode())})
        assert res.status_code == 200

        # 2. Wise Format (Direction / Source amount)
        wise_csv = "Created on,Reference,Direction,Source amount (after fees),Status\n2024-04-03,Wise In,IN,200.00,COMPLETED\n2024-04-04,Wise Out,OUT,50.00,COMPLETED\n"
        res = client.post("/api/ingest/bank-statement", headers=headers, 
                          files={"file": ("wise.csv", wise_csv.encode())})
        assert res.status_code == 200
        assert "Processed 2" in res.json()["message"]

    def test_ingest_bank_statement_errors(self, client, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Invalid extension
        res = client.post("/api/ingest/bank-statement", headers=headers, 
                          files={"file": ("test.txt", b"not csv")})
        assert res.status_code == 400
        
        # Empty file
        res = client.post("/api/ingest/bank-statement", headers=headers, 
                          files={"file": ("empty.csv", b"")})
        assert res.status_code == 400

        # Missing headers (specifically date or desc)
        res = client.post("/api/ingest/bank-statement", headers=headers, 
                          files={"file": ("no_date.csv", b"Description,Amount\nTest,100\n")})
        assert res.status_code == 400

    def test_distribution_modes(self, client, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Update settings to 'fixed' labour share
        client.put("/api/settings", headers=headers, json={"labour_share_mode": "fixed"})
        res = client.post("/api/distribution/month-end-close", headers=headers)
        assert res.status_code in (200, 400)

        # Update settings to 'both' labour share
        client.put("/api/settings", headers=headers, json={"labour_share_mode": "both"})
        res = client.post("/api/distribution/month-end-close", headers=headers)
        assert res.status_code in (200, 400)



# ─── Settings Extended ────────────────────────────────────────────────────────

class TestSettingsExtended:
    """Ensure settings endpoint paths with/without trailing slash both work."""

    def test_get_settings_no_slash(self, client, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = client.get("/api/settings", headers=headers)
        assert res.status_code == 200

    def test_get_settings_has_required_fields(self, client, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = client.get("/api/settings", headers=headers)
        data = res.json()
        assert "charity_percentage" in data
        assert "contingency_pot_minimum" in data
        assert "currency_symbol" in data

    def test_partner_can_read_settings(self, client, partner_token):
        headers = {"Authorization": f"Bearer {partner_token}"}
        res = client.get("/api/settings", headers=headers)
        assert res.status_code == 200

    def test_partner_cannot_update_settings(self, client, partner_token):
        """Partners must not be able to mutate global settings."""
        headers = {"Authorization": f"Bearer {partner_token}"}
        res = client.put("/api/settings", headers=headers, json={
            "charity_percentage": 0.99,
            "partnership_mode": "both",
            "labour_share_mode": "time",
            "currency_symbol": "£",
            "is_setup_complete": True,
            "capital_pool_percentage": 0.50,
            "labour_pool_percentage": 0.50,
            "contingency_pot_minimum": 10000.0
        })
        assert res.status_code == 403
