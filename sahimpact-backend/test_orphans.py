import httpx
import sys

def test_endpoint():
    print("--- Starting Orphaned Partners Endpoint Test ---")
    
    # Configuration
    base_url = "http://localhost:8000/api"
    login_url = f"{base_url}/token"
    target_url = f"{base_url}/companies/orphaned-partners"
    
    # 1. Login as admin
    print(f"Step 1: Logging in to {login_url}...")
    data = {
        "username": "admin",
        "password": "ChangeMe_OnFirstLogin!"
    }
    
    try:
        with httpx.Client() as client:
            response = client.post(login_url, data=data)
            
            if response.status_code != 200:
                print(f"FAILED: Login failed with status {response.status_code}")
                print(f"Response: {response.text}")
                sys.exit(1)
            
            token = response.json().get("access_token")
            if not token:
                print("FAILED: No access token in login response")
                sys.exit(1)
            
            print("SUCCESS: Login successful")
            headers = {"Authorization": f"Bearer {token}"}
            
            # 2. Test orphaned-partners endpoint
            print(f"Step 2: Accessing {target_url}...")
            response = client.get(target_url, headers=headers)
            
            print(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                print("SUCCESS: Endpoint returned 200 OK")
                data = response.json()
                print(f"Orphaned partners found: {len(data)}")
                for partner in data:
                    print(f" - {partner.get('username')} (ID: {partner.get('id')})")
            elif response.status_code == 422:
                print("FAILED: Received 422 Unprocessable Entity. Route ordering issue persists!")
                print(f"Error Details: {response.text}")
            else:
                print(f"FAILED: Unexpected status code {response.status_code}")
                print(f"Response: {response.text}")
                sys.exit(1)

    except httpx.ConnectError:
        print("FAILED: Could not connect to the backend server. Is it running?")
        sys.exit(1)
    except Exception as e:
        print(f"FAILED: An unexpected error occurred: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_endpoint()
