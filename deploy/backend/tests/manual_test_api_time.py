import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def get_token(username, password):
    res = requests.post(f"{BASE_URL}/token", data={"username": username, "password": password})
    if res.status_code == 200:
        return res.json()["access_token"]
    else:
        print(f"Failed to get token for {username}: {res.text}")
        return None

def test_time_logging():
    # Admin token (assuming Partner 1 is admin or we have an admin user)
    # Let's try Partner 1
    token = get_token("Partner 1", "password123")
    if not token: return
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # 1. Log a new time entry
    start_time = datetime.now().isoformat()
    end_time = (datetime.now() + timedelta(hours=8)).isoformat()
    
    payload = {
        "start_time": start_time,
        "end_time": end_time,
        "description": "API Test Shift"
    }
    
    print("Logging time...")
    res = requests.post(f"{BASE_URL}/api/time/", headers=headers, json=payload)
    print(f"POST /api/time/: {res.status_code}")
    if res.status_code != 200:
        print(res.text)
        return
    
    entry = res.json()
    entry_id = entry["id"]
    print(f"Logged entry ID: {entry_id}, Hours: {entry['hours']}")
    
    # 2. Get all time entries
    print("Fetching all time entries...")
    res = requests.get(f"{BASE_URL}/api/time/all", headers=headers)
    print(f"GET /api/time/all: {res.status_code}")
    entries = res.json()
    print(f"Total entries: {len(entries)}")
    
    # 3. Admin edit the entry
    print(f"Editing entry {entry_id}...")
    new_start = (datetime.now() - timedelta(hours=1)).isoformat()
    new_end = (datetime.now() + timedelta(hours=9)).isoformat() # 10 hours total
    
    update_payload = {
        "start_time": new_start,
        "end_time": new_end,
        "description": "Updated via API test"
    }
    
    res = requests.put(f"{BASE_URL}/api/time/{entry_id}", headers=headers, json=update_payload)
    print(f"PUT /api/time/{entry_id}: {res.status_code}")
    if res.status_code == 200:
        updated_entry = res.json()
        print(f"Updated Hours: {updated_entry['hours']} (Expected 10.0)")
    else:
        print(res.text)

if __name__ == "__main__":
    test_time_logging()
