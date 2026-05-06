import httpx
import sys

def test_workflow():
    base_url = "http://localhost:8001/api"
    login_url = f"{base_url}/token"
    
    print("--- Starting Full Workflow Verification ---")
    
    # 1. Login
    print("Step 1: Logging in...")
    data = {"username": "admin", "password": "ChangeMe_OnFirstLogin!"}
    client = httpx.Client()
    response = client.post(login_url, data=data)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        return
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get Companies
    print("Step 2: Listing companies...")
    response = client.get(f"{base_url}/companies", headers=headers)
    companies = response.json()
    if not companies:
        print("No companies found. Cannot proceed with adoption test.")
        return
    company_id = companies[0]["id"]
    print(f"Using company: {companies[0]['name']} (ID: {company_id})")
    
    # 3. Get Orphans
    print("Step 3: Listing orphaned partners...")
    response = client.get(f"{base_url}/companies/orphaned-partners", headers=headers)
    orphans = response.json()
    if not orphans:
        print("No orphans found. Test cannot proceed.")
        return
    orphan_id = orphans[0]["id"]
    orphan_name = orphans[0]["username"]
    print(f"Targeting orphan: {orphan_name} (ID: {orphan_id})")
    
    # 4. Adopt Orphan
    print(f"Step 4: Adopting {orphan_name} into company {company_id}...")
    adopt_url = f"{base_url}/companies/{company_id}/adopt-partner/{orphan_id}"
    response = client.post(adopt_url, headers=headers)
    if response.status_code == 200:
        print("SUCCESS: Orphan adopted successfully.")
        updated_user = response.json()
        print(f"Updated user company_id: {updated_user.get('company_id')}")
    else:
        print(f"FAILED: Adoption failed with status {response.status_code}")
        print(f"Response: {response.text}")
        return
    
    # 5. Verify Orphan is gone
    print("Step 5: Verifying orphan list is updated...")
    response = client.get(f"{base_url}/companies/orphaned-partners", headers=headers)
    new_orphans = response.json()
    if any(o["id"] == orphan_id for o in new_orphans):
        print("FAILED: Orphan still appears in the list!")
    else:
        print("SUCCESS: Orphan no longer in the list.")

    # 6. Check Company Users
    print(f"Step 6: Verifying user appears in company {company_id} user list...")
    response = client.get(f"{base_url}/companies/{company_id}/users", headers=headers)
    users = response.json()
    if any(u["id"] == orphan_id for u in users):
        print("SUCCESS: User found in company user list.")
    else:
        print("FAILED: User not found in company user list.")

if __name__ == "__main__":
    test_workflow()
