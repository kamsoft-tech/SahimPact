import uuid
from typing import Dict, Any, List, Optional
from app.models.signatures import EnvelopeStatus
from app.services.signing.provider import SigningProvider

class ManualProvider(SigningProvider):
    def __init__(self, config_credentials: Optional[dict] = None):
        pass

    def create_envelope(self, agreement_id: int, document_content: bytes, signers: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        For a manual provider, creating an envelope just returns a unique reference 
        and sets status to SENT, since the user must download it manually.
        """
        provider_ref = str(uuid.uuid4())
        return {
            'provider_ref': provider_ref,
            'status': EnvelopeStatus.SENT
        }

    def get_status(self, provider_ref: str) -> EnvelopeStatus:
        """
        Status for manual provider is managed by the application itself when the user uploads.
        This method shouldn't be relied upon to fetch updates.
        """
        raise NotImplementedError("Manual provider status is updated via direct upload endpoints.")

    def download_signed(self, provider_ref: str) -> Optional[bytes]:
        """
        Signed documents are uploaded directly to the local storage by the user.
        """
        raise NotImplementedError("Manual provider documents are stored locally.")

    def handle_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        No webhooks for manual provider.
        """
        raise NotImplementedError("Manual provider does not support webhooks.")

    def cancel_envelope(self, provider_ref: str) -> bool:
        return True
