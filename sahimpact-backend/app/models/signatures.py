import enum
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, LargeBinary, JSON
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.models.models import TimestampMixin, AuditMixin

class ProviderType(str, enum.Enum):
    MANUAL = "MANUAL"
    DOCUMENSO = "DOCUMENSO"
    DOCUSIGN = "DOCUSIGN"

class EnvelopeStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    PARTIALLY_SIGNED = "PARTIALLY_SIGNED"
    COMPLETED = "COMPLETED"
    DECLINED = "DECLINED"
    VOIDED = "VOIDED"

class SigningConfig(Base, TimestampMixin, AuditMixin):
    __tablename__ = "signing_configs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, unique=True)
    provider = Column(Enum(ProviderType), default=ProviderType.MANUAL)
    
    # Fernet symmetrically encrypted JSON string containing provider credentials
    encrypted_credentials = Column(LargeBinary, nullable=True)

    company = relationship("Company")


class SigningEnvelope(Base, TimestampMixin, AuditMixin):
    __tablename__ = "signing_envelopes"

    id = Column(Integer, primary_key=True, index=True)
    agreement_id = Column(Integer, ForeignKey("agreements.id"), nullable=False, unique=True)
    provider = Column(Enum(ProviderType), nullable=False)
    
    # External ID returned by the provider (e.g. Documenso document ID)
    provider_ref = Column(String, nullable=True)
    
    status = Column(Enum(EnvelopeStatus), default=EnvelopeStatus.DRAFT)
    
    # Reference to the signed document (path or URI). Encrypted at rest.
    signed_document_ref = Column(String, nullable=True)
    
    # Immutable append-only audit log (e.g. webhooks received, statuses changed)
    audit_log = Column(JSON, default=list)
    
    template_version = Column(String, nullable=True)
    shariah_certification_ref = Column(String, nullable=True)

    agreement = relationship("Agreement", back_populates="envelope")
