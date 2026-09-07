from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from app.models.signatures import EnvelopeStatus

class SigningProvider(ABC):
    @abstractmethod
    def create_envelope(self, agreement_id: int, document_content: bytes, signers: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Create a signing envelope.
        signers should be a list of dicts with 'name', 'email', 'role'.
        Returns a dict containing at least {'provider_ref': str, 'status': EnvelopeStatus}
        """
        pass

    @abstractmethod
    def get_status(self, provider_ref: str) -> EnvelopeStatus:
        """
        Check the current status of the envelope.
        """
        pass

    @abstractmethod
    def download_signed(self, provider_ref: str) -> Optional[bytes]:
        """
        Download the signed document as bytes.
        Returns None if not completed.
        """
        pass

    @abstractmethod
    def handle_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle an incoming webhook from the provider.
        Returns a parsed event with at least {'provider_ref': str, 'status': EnvelopeStatus}
        """
        pass

    @abstractmethod
    def cancel_envelope(self, provider_ref: str) -> bool:
        """
        Cancel an envelope.
        """
        pass
