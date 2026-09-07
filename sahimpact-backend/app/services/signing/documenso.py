import httpx
from typing import Dict, Any, List, Optional
from app.models.signatures import EnvelopeStatus
from app.services.signing.provider import SigningProvider

class DocumensoProvider(SigningProvider):
    def __init__(self, config_credentials: dict):
        self.api_key = config_credentials.get("api_key")
        self.base_url = config_credentials.get("base_url", "https://app.documenso.com/api/v1")
        if not self.api_key:
            raise ValueError("Documenso API key is required")

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def create_envelope(self, agreement_id: int, document_content: bytes, signers: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Creates a document in Documenso, adds signers, and sends it.
        This is a simplified mock-up of the actual Documenso API workflow.
        """
        # In a real integration, you would upload the PDF via multipart/form-data
        # then create recipients, and send the document.
        # Returning a mock structure for now until the real API is fleshed out.
        return {
            'provider_ref': f"documenso_mock_{agreement_id}",
            'status': EnvelopeStatus.SENT
        }

    def get_status(self, provider_ref: str) -> EnvelopeStatus:
        """
        Polls Documenso for the document status.
        """
        # Mocking for now
        return EnvelopeStatus.SENT

    def download_signed(self, provider_ref: str) -> Optional[bytes]:
        """
        Downloads the signed PDF from Documenso.
        """
        # Mocking for now
        return None

    def handle_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parses incoming Documenso webhooks.
        """
        event_type = payload.get("event")
        document_id = payload.get("documentId")
        
        status = EnvelopeStatus.SENT
        if event_type == "document.completed":
            status = EnvelopeStatus.COMPLETED
        elif event_type == "document.declined":
            status = EnvelopeStatus.DECLINED
            
        return {
            'provider_ref': document_id,
            'status': status
        }

    def cancel_envelope(self, provider_ref: str) -> bool:
        # Mocking for now
        return True
