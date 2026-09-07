from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from app.db.database import get_db
from app.models.signatures import SigningConfig, SigningEnvelope, ProviderType, EnvelopeStatus
from app.core.security import require_master_admin_role, require_partner_role, log_audit_event, get_current_company_id
from app.services.signing.manager import encrypt_credentials, decrypt_credentials, get_signing_provider

from pydantic import BaseModel

router = APIRouter()

class SigningConfigUpdate(BaseModel):
    provider: ProviderType
    credentials: Dict[str, str] = {}

@router.get("/config")
def get_signing_config(
    db: Session = Depends(get_db),
    claims: dict = Depends(require_master_admin_role),
    company_id: int = Depends(get_current_company_id)
):
    """Get the current signing configuration for the company."""
    config = db.query(SigningConfig).filter(SigningConfig.company_id == company_id).first()
    if not config:
        return {"provider": ProviderType.MANUAL, "has_credentials": False}
    
    return {
        "provider": config.provider,
        "has_credentials": bool(config.encrypted_credentials)
    }

@router.put("/config")
def update_signing_config(
    payload: SigningConfigUpdate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_master_admin_role),
    company_id: int = Depends(get_current_company_id)
):
    """Update signing configuration and credentials."""
    config = db.query(SigningConfig).filter(SigningConfig.company_id == company_id).first()
    
    if not config:
        config = SigningConfig(company_id=company_id)
        db.add(config)
        
    config.provider = payload.provider
    if payload.credentials:
        config.encrypted_credentials = encrypt_credentials(payload.credentials)
    elif payload.provider == ProviderType.MANUAL:
        config.encrypted_credentials = None
        
    db.commit()
    log_audit_event(db, action="UPDATE_SIGNING_CONFIG", user_id=claims.get("user_id"), company_id=company_id)
    return {"message": "Signing config updated successfully"}

@router.post("/webhook/{provider_name}")
def handle_webhook(
    provider_name: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Handle webhooks from signing providers.
    In a real implementation, we would verify the webhook signature here.
    """
    # Find the envelope by provider_ref
    # This is simplified; usually you extract provider_ref from the payload based on the provider.
    if provider_name == ProviderType.DOCUMENSO.value.lower():
        provider_ref = payload.get("documentId")
    elif provider_name == ProviderType.DOCUSIGN.value.lower():
        provider_ref = payload.get("data", {}).get("envelopeId")
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider webhook")
        
    if not provider_ref:
        raise HTTPException(status_code=400, detail="Missing document reference in webhook")

    envelope = db.query(SigningEnvelope).filter(
        SigningEnvelope.provider_ref == provider_ref,
        SigningEnvelope.provider == provider_name.upper()
    ).first()
    
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
        
    provider_service = get_signing_provider(db, envelope.agreement.company_id)
    result = provider_service.handle_webhook(payload)
    
    new_status = result.get("status")
    if new_status and new_status != envelope.status:
        envelope.status = new_status
        audit_entry = {"event": "WEBHOOK_STATUS_UPDATE", "new_status": new_status, "payload": payload}
        # Assuming audit_log is a list
        log = list(envelope.audit_log) if envelope.audit_log else []
        log.append(audit_entry)
        envelope.audit_log = log
        
        # If COMPLETED, we must apply the agreement changes.
        # This requires importing and calling the apply_agreement logic from agreements.py
        if new_status == EnvelopeStatus.COMPLETED:
            from app.api.endpoints.agreements import apply_agreement_changes
            apply_agreement_changes(db, envelope.agreement)
            
        db.commit()
        
    return {"status": "ok"}


# Manual provider endpoints

@router.get("/{envelope_id}/download")
def download_manual_document(
    envelope_id: int,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    """Download the generated PDF for manual signing."""
    envelope = db.query(SigningEnvelope).filter(
        SigningEnvelope.id == envelope_id,
        SigningEnvelope.agreement.has(company_id=company_id)
    ).first()
    
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
        
    # In a real system, we'd serve the file from storage.
    # For now, return a mock response.
    return {"message": "Download link generated", "url": "/mock-download-url"}

@router.post("/{envelope_id}/upload")
def upload_signed_document(
    envelope_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    claims: dict = Depends(require_partner_role),
    company_id: int = Depends(get_current_company_id)
):
    """Upload the manually signed document and mark envelope COMPLETED."""
    envelope = db.query(SigningEnvelope).filter(
        SigningEnvelope.id == envelope_id,
        SigningEnvelope.agreement.has(company_id=company_id)
    ).first()
    
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")
        
    if envelope.provider != ProviderType.MANUAL:
        raise HTTPException(status_code=400, detail="Envelope does not use manual signing")
        
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
        
    # In a real system, save the file to secure encrypted storage and store the reference.
    envelope.signed_document_ref = f"/secure_storage/signed_{envelope_id}.pdf"
    envelope.status = EnvelopeStatus.COMPLETED
    
    audit_entry = {"event": "MANUAL_UPLOAD", "user_id": claims.get("user_id"), "filename": file.filename}
    log = list(envelope.audit_log) if envelope.audit_log else []
    log.append(audit_entry)
    envelope.audit_log = log
    
    log_audit_event(db, action="UPLOAD_SIGNED_AGREEMENT", user_id=claims.get("user_id"), company_id=company_id, target_id=str(envelope.id))
    
    # Apply the agreement changes
    from app.api.endpoints.agreements import apply_agreement_changes
    apply_agreement_changes(db, envelope.agreement)
    
    db.commit()
    return {"message": "Document uploaded successfully", "status": envelope.status}
