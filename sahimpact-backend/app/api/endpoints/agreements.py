from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, timezone

from app.db.database import get_db
from app.models.models import (
    Agreement, AgreementSignoff, AgreementStatus, AgreementType,
    User, RoleEnum, GlobalSettings, PartnerShare
)
from app.schemas.schemas import AgreementResponse, SignoffActionRequest
from app.core.security import get_current_company_id, get_current_active_user, log_audit_event
from app.services.distribution_service import calculate_month_end_close
from app.models.signatures import SigningEnvelope, EnvelopeStatus
from app.services.signing.manager import get_signing_provider
from app.models.templates import DocumentSection, CompanyDocumentSection, CompanySectionSelection
import io
from xhtml2pdf import pisa

router = APIRouter()

@router.get("/agreements/pending", response_model=Optional[AgreementResponse])
def get_pending_agreement(
    db: Session = Depends(get_db), 
    company_id: int = Depends(get_current_company_id)
):
    agreement = db.query(Agreement).filter(
        Agreement.company_id == company_id,
        Agreement.status == AgreementStatus.PENDING
    ).first()
    
    if not agreement:
        return None
        
    # Enrich with names
    res = enrich_agreement(db, agreement)
    return res

@router.get("/agreements/history", response_model=List[AgreementResponse])
def get_agreement_history(
    db: Session = Depends(get_db), 
    company_id: int = Depends(get_current_company_id)
):
    agreements = db.query(Agreement).filter(
        Agreement.company_id == company_id
    ).order_by(Agreement.updated_at.desc()).all()
    
    return [enrich_agreement(db, a) for a in agreements]

@router.post("/agreements/{agreement_id}/sign")
def sign_agreement(
    agreement_id: int, 
    action_req: SignoffActionRequest,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user),
    company_id: int = Depends(get_current_company_id)
):
    agreement = db.query(Agreement).filter(
        Agreement.id == agreement_id,
        Agreement.company_id == company_id
    ).first()
    
    if not agreement or agreement.status != AgreementStatus.PENDING:
        raise HTTPException(status_code=404, detail="Pending agreement not found")

    signoff = db.query(AgreementSignoff).filter(
        AgreementSignoff.agreement_id == agreement_id,
        AgreementSignoff.user_id == current_user.id
    ).first()
    
    if not signoff:
        # Should not happen if the agreement was created correctly, but let's handle it
        signoff = AgreementSignoff(
            agreement_id=agreement_id,
            user_id=current_user.id,
            status=AgreementStatus.PENDING
        )
        db.add(signoff)

    if action_req.action == "APPROVE":
        signoff.status = AgreementStatus.APPROVED
        signoff.signed_at = datetime.now(timezone.utc)
    else:
        # Rejection cancels the agreement
        signoff.status = AgreementStatus.REJECTED
        signoff.signed_at = datetime.now(timezone.utc)
        agreement.status = AgreementStatus.REJECTED
        db.commit()
        log_audit_event(
            db, action="AGREEMENT_REJECTED", user_id=current_user.id, company_id=company_id,
            target_id=str(agreement.id)
        )
        return {"message": "Agreement rejected"}

    db.commit()
    log_audit_event(
        db, action="AGREEMENT_APPROVED", user_id=current_user.id, company_id=company_id,
        target_id=str(agreement.id)
    )
    
    # Check if all signatures are in
    check_and_apply_agreement(db, agreement)
    
    return {"message": "Signature recorded"}

def enrich_agreement(db: Session, agreement: Agreement):
    # Convert to response dict
    res = {
        "id": agreement.id,
        "company_id": agreement.company_id,
        "proposed_by_id": agreement.proposed_by_id,
        "proposed_by_name": agreement.proposed_by.full_name or agreement.proposed_by.username,
        "agreement_type": agreement.agreement_type.value if agreement.agreement_type else "PARAMETER_CHANGE",
        "proposed_settings": agreement.proposed_settings,
        "proposed_shares": agreement.proposed_shares,
        "negligent_user_id": agreement.negligent_user_id,
        "period_name": agreement.period_name,
        "change_summary": agreement.change_summary,
        "status": agreement.status,
        "effective_at": agreement.effective_at,
        "signoffs": [],
        "envelope_id": agreement.envelope.id if agreement.envelope else None,
        "envelope_status": agreement.envelope.status if agreement.envelope else None,
        "envelope_provider": agreement.envelope.provider if agreement.envelope else None,
        "envelope_provider_ref": agreement.envelope.provider_ref if agreement.envelope else None
    }
    
    for s in agreement.signoffs:
        user = db.query(User).filter(User.id == s.user_id).first()
        res["signoffs"].append({
            "id": s.id,
            "user_id": s.user_id,
            "username": user.username if user else "Unknown",
            "full_name": user.full_name if user else None,
            "signed_at": s.signed_at,
            "status": s.status
        })
    return res

def check_and_apply_agreement(db: Session, agreement: Agreement):
    # Total active users (Admins + Partners) in this company
    active_users = db.query(User).filter(
        User.company_id == agreement.company_id,
        User.is_active == True,
        or_(User.role == RoleEnum.COMPANY_ADMIN, User.role == RoleEnum.PARTNER)
    ).all()
    
    active_user_ids = [u.id for u in active_users]
    
    # Get all approvals for this agreement
    approvals = db.query(AgreementSignoff).filter(
        AgreementSignoff.agreement_id == agreement.id,
        AgreementSignoff.status == AgreementStatus.APPROVED
    ).all()
    
    approved_user_ids = [a.user_id for a in approvals]
    
    # If every active user has approved
    if all(uid in approved_user_ids for uid in active_user_ids):
        # Mark Agreement as Approved
        agreement.status = AgreementStatus.APPROVED
        db.commit()
        
        # Trigger E-Signature flow
        provider_service = get_signing_provider(db, agreement.company_id)
        
        # Real PDF generation
        contract_pdf_bytes = generate_agreement_pdf_bytes(db, agreement)
                
        # Prepare signers list
        signers = []
        for user in active_users:
            signers.append({"name": user.full_name or user.username, "email": user.email or f"{user.username}@example.com", "role": "signer"})
            
        result = provider_service.create_envelope(agreement.id, contract_pdf_bytes, signers)
        
        envelope = SigningEnvelope(
            agreement_id=agreement.id,
            provider=result.get("provider", "MANUAL").upper(),
            provider_ref=result.get("provider_ref"),
            status=result.get("status", EnvelopeStatus.SENT),
            audit_log=[{"event": "ENVELOPE_CREATED", "provider_ref": result.get("provider_ref")}]
        )
        db.add(envelope)
        db.commit()
        
        log_audit_event(
            db, action="AGREEMENT_APPROVED_SIGNING_STARTED", user_id=agreement.proposed_by_id, company_id=agreement.company_id,
            target_id=str(agreement.id)
        )

def apply_agreement_changes(db: Session, agreement: Agreement):
    if agreement.agreement_type == AgreementType.PERIOD_CLOSE:
        # 0. Execute Month-End Close Logic
        calculate_month_end_close(
            db, 
            admin_user_id=agreement.proposed_by_id, 
            company_id=agreement.company_id,
            negligent_user_id=agreement.negligent_user_id
        )
    else:
        # 1. Apply Settings
        settings = db.query(GlobalSettings).filter(
            GlobalSettings.company_id == agreement.company_id
        ).first()
        
        if not settings:
            settings = GlobalSettings(company_id=agreement.company_id)
            db.add(settings)
            
        p_set = agreement.proposed_settings or {}
        settings.charity_percentage = p_set.get('charity_percentage', settings.charity_percentage)
        settings.partnership_mode = p_set.get('partnership_mode', settings.partnership_mode)
        settings.labour_share_mode = p_set.get('labour_share_mode', settings.labour_share_mode)
        settings.currency_symbol = p_set.get('currency_symbol', settings.currency_symbol)
        settings.capital_pool_percentage = p_set.get('capital_pool_percentage', settings.capital_pool_percentage)
        settings.labour_pool_percentage = p_set.get('labour_pool_percentage', settings.labour_pool_percentage)
        settings.contingency_pot_minimum = p_set.get('contingency_pot_minimum', settings.contingency_pot_minimum)
        
        # 2. Apply Shares
        proposed_shares = agreement.proposed_shares or []
        for p_share in proposed_shares:
            u_id = p_share.get('user_id')
            share = db.query(PartnerShare).filter(
                PartnerShare.user_id == u_id,
                PartnerShare.company_id == agreement.company_id
            ).first()
            
            if not share:
                share = PartnerShare(user_id=u_id, company_id=agreement.company_id)
                db.add(share)
                
            share.capital_share_fixed = p_share.get('capital_share_fixed', share.capital_share_fixed)
            share.labor_share_variable = p_share.get('labor_share_variable', share.labor_share_variable)
            share.voluntary_charity_percentage = p_share.get('voluntary_charity_percentage', share.voluntary_charity_percentage)
        
    # 3. Mark Agreement as Executed
    agreement.status = AgreementStatus.EXECUTED
    agreement.effective_at = datetime.now(timezone.utc)
    
    db.commit()
    log_audit_event(
        db, action="AGREEMENT_EXECUTED", user_id=agreement.proposed_by_id, company_id=agreement.company_id,
        target_id=str(agreement.id), details={"type": agreement.agreement_type.value if agreement.agreement_type else "PARAMETER_CHANGE"}
    )

def generate_agreement_pdf_bytes(db: Session, agreement: Agreement) -> bytes:
    """Generate a PDF document based on selected templates and agreement parameters."""
    
    # 1. Fetch parameters
    params_html = "<h2>Agreement Parameters</h2><ul>"
    if agreement.proposed_settings:
        for k, v in agreement.proposed_settings.items():
            params_html += f"<li><b>{k}:</b> {v}</li>"
    if agreement.proposed_shares:
        params_html += "</ul><h3>Proposed Partner Shares</h3><ul>"
        for share in agreement.proposed_shares:
            user = db.query(User).filter(User.id == share.get('user_id')).first()
            uname = user.full_name or user.username if user else "Unknown User"
            params_html += f"<li><b>{uname}:</b> Capital: {share.get('capital_share_fixed')}%, Labor: {share.get('labor_share_variable')}%, Charity: {share.get('voluntary_charity_percentage')}%</li>"
    params_html += "</ul>"
    
    # 2. Fetch sections
    global_sections = db.query(DocumentSection).order_by(DocumentSection.order_index).all()
    company_sections = db.query(CompanyDocumentSection).filter(CompanyDocumentSection.company_id == agreement.company_id).order_by(CompanyDocumentSection.order_index).all()
    selections = db.query(CompanySectionSelection).filter(CompanySectionSelection.company_id == agreement.company_id).all()
    
    # helper for selections
    def is_included(g_id=None, c_id=None, is_mandatory=False):
        if is_mandatory:
            return True
        sel = next((s for s in selections if s.global_section_id == g_id and s.company_section_id == c_id), None)
        return sel.is_included if sel else False

    sections_html = ""
    
    # Append included global sections
    for sec in global_sections:
        if is_included(g_id=sec.id, is_mandatory=sec.is_mandatory):
            sections_html += f"<h2>{sec.title}</h2>"
            sections_html += f"<div>{sec.content}</div><br/>"
            
    # Append included company sections
    for sec in company_sections:
        if is_included(c_id=sec.id, is_mandatory=False): # or True if we assume all company sections are active
            sections_html += f"<h2>{sec.title} <span style='color:red; font-size:12px;'>(NOT REVIEWED BY SCHOLARS)</span></h2>"
            sections_html += f"<div>{sec.content}</div><br/>"
            
    html_content = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Helvetica, sans-serif; font-size: 12pt; color: #333; }}
            h1 {{ color: #111; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }}
            h2 {{ color: #444; margin-top: 20px; }}
            .footer {{ text-align: center; font-size: 10pt; color: #777; margin-top: 50px; border-top: 1px solid #ddd; padding-top: 10px; }}
        </style>
    </head>
    <body>
        <h1>SahimPact Partnership Agreement</h1>
        <p><b>Agreement ID:</b> {agreement.id}</p>
        <p><b>Date:</b> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
        <p><b>Summary:</b> {agreement.change_summary or 'Standard terms update'}</p>
        <hr/>
        {params_html}
        <hr/>
        {sections_html}
        <div class="footer">
            Generated by SahimPact Platform
        </div>
    </body>
    </html>
    """
    
    pdf_buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(io.StringIO(html_content), dest=pdf_buffer)
    
    if pisa_status.err:
        raise Exception("Failed to generate PDF")
        
    return pdf_buffer.getvalue()

@router.post("/agreements/propose-close")
def propose_period_close(
    negligent_user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    company_id: int = Depends(get_current_company_id)
):
    # Check for existing pending agreement
    existing = db.query(Agreement).filter(
        Agreement.company_id == company_id,
        Agreement.status == AgreementStatus.PENDING
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="There is already a pending agreement. Please resolve it first.")

    period_name = datetime.now(timezone.utc).strftime("%B %Y")
    
    new_agreement = Agreement(
        company_id=company_id,
        proposed_by_id=current_user.id,
        agreement_type=AgreementType.PERIOD_CLOSE,
        negligent_user_id=negligent_user_id,
        period_name=period_name,
        change_summary=f"Lock Period Distribution for {period_name}" + (f" (Negligence Claim against Partner ID {negligent_user_id})" if negligent_user_id else ""),
        status=AgreementStatus.PENDING
    )
    db.add(new_agreement)
    db.commit()
    db.refresh(new_agreement)

    # Create signoffs
    active_users = db.query(User).filter(
        User.company_id == company_id,
        User.is_active == True,
        or_(User.role == RoleEnum.COMPANY_ADMIN, User.role == RoleEnum.PARTNER)
    ).all()

    for u in active_users:
        signoff = AgreementSignoff(
            agreement_id=new_agreement.id,
            user_id=u.id,
            status=AgreementStatus.PENDING
        )
        if u.id == current_user.id:
            signoff.status = AgreementStatus.APPROVED
            signoff.signed_at = datetime.now(timezone.utc)
        db.add(signoff)

    db.commit()
    log_audit_event(
        db, action="PROPOSE_PERIOD_CLOSE", user_id=current_user.id, company_id=company_id,
        target_id=str(new_agreement.id), details={"period_name": period_name, "negligent_user_id": negligent_user_id}
    )
    return {"message": "Period close proposed successfully", "agreement_id": new_agreement.id}

from pydantic import BaseModel

class ProposeParametersRequest(BaseModel):
    proposed_settings: Optional[dict] = None
    proposed_shares: Optional[List[dict]] = None
    change_summary: Optional[str] = None

@router.post("/agreements/propose-parameters")
def propose_parameters(
    req: ProposeParametersRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    company_id: int = Depends(get_current_company_id)
):
    existing = db.query(Agreement).filter(
        Agreement.company_id == company_id,
        Agreement.status == AgreementStatus.PENDING
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="There is already a pending agreement. Please resolve it first.")
        
    new_agreement = Agreement(
        company_id=company_id,
        proposed_by_id=current_user.id,
        agreement_type=AgreementType.PARAMETER_CHANGE,
        proposed_settings=req.proposed_settings,
        proposed_shares=req.proposed_shares,
        change_summary=req.change_summary or "Parameter Change",
        status=AgreementStatus.PENDING
    )
    db.add(new_agreement)
    db.commit()
    db.refresh(new_agreement)
    
    active_users = db.query(User).filter(
        User.company_id == company_id,
        User.is_active == True,
        or_(User.role == RoleEnum.COMPANY_ADMIN, User.role == RoleEnum.PARTNER)
    ).all()

    for u in active_users:
        signoff = AgreementSignoff(
            agreement_id=new_agreement.id,
            user_id=u.id,
            status=AgreementStatus.PENDING
        )
        if u.id == current_user.id:
            signoff.status = AgreementStatus.APPROVED
            signoff.signed_at = datetime.now(timezone.utc)
        db.add(signoff)
        
    db.commit()
    log_audit_event(
        db, action="PROPOSE_PARAMETERS", user_id=current_user.id, company_id=company_id,
        target_id=str(new_agreement.id), details={"summary": req.change_summary}
    )
    return {"message": "Parameter change proposed", "agreement_id": new_agreement.id}
