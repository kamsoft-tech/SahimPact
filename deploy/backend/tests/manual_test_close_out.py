import requests
from app.api.endpoints.auth import create_access_token

# We need a token for a partner or admin
# Since we changed it to require_partner_role, a partner should work.
token = requests.post("http://localhost:8000/api/token", data={"username": "Partner 1", "password": "password"}).json().get("access_token")
print("Token:", token)

# Now try to close out
res = requests.post("http://localhost:8000/api/distribution/month-end-close", headers={"Authorization": f"Bearer {token}"})
print("Close out status:", res.status_code)
print("Close out response:", res.text)
