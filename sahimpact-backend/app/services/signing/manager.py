import os
import json
from cryptography.fernet import Fernet
from typing import Optional

from sqlalchemy.orm import Session
from app.models.signatures import SigningConfig, ProviderType
from app.services.signing.provider import SigningProvider
from app.services.signing.manual import ManualProvider
from app.services.signing.documenso import DocumensoProvider
from app.services.signing.docusign import DocuSignProvider

# Use the existing SECRET_KEY to derive a Fernet key, or a specific SIGNING_SECRET_KEY
import base64
import hashlib

def get_fernet_key() -> bytes:
    secret = os.environ.get("SIGNING_SECRET_KEY", os.environ.get("SECRET_KEY", "SUPER_SECRET_KEY_FOR_LOCAL_DEV_ONLY"))
    # Fernet requires a 32-url-safe-base64-encoded bytes key. 
    # Hash the secret to ensure it's 32 bytes.
    hasher = hashlib.sha256()
    hasher.update(secret.encode('utf-8'))
    return base64.urlsafe_b64encode(hasher.digest())

def encrypt_credentials(creds: dict) -> bytes:
    f = Fernet(get_fernet_key())
    return f.encrypt(json.dumps(creds).encode('utf-8'))

def decrypt_credentials(encrypted_data: bytes) -> dict:
    if not encrypted_data:
        return {}
    f = Fernet(get_fernet_key())
    decrypted = f.decrypt(encrypted_data)
    return json.loads(decrypted.decode('utf-8'))

def get_signing_provider(db: Session, company_id: int) -> SigningProvider:
    config = db.query(SigningConfig).filter(SigningConfig.company_id == company_id).first()
    
    if not config or config.provider == ProviderType.MANUAL:
        return ManualProvider()
        
    creds = decrypt_credentials(config.encrypted_credentials)
    
    if config.provider == ProviderType.DOCUMENSO:
        return DocumensoProvider(creds)
    elif config.provider == ProviderType.DOCUSIGN:
        return DocuSignProvider(creds)
        
    return ManualProvider()
