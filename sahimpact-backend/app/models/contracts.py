from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base

class ContractClause(Base):
    __tablename__ = "contract_clauses"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False) # e.g., 'loss_rule_hanafi'
    category = Column(String, nullable=False) # e.g., 'Loss Allocation', 'Dispute Resolution'
    title = Column(String, nullable=False)
    body = Column(String, nullable=False) # The certified wording
    mandatory = Column(Boolean, default=False)
    locked = Column(Boolean, default=True) # Cannot be edited freely
    contract_type = Column(String, nullable=False) # e.g., 'Mudarabah', 'Musharakah'
    madhhab = Column(String, nullable=True) # e.g., 'Hanafi'
    version = Column(Integer, default=1)
    certification_ref = Column(String, nullable=True)
    scholar = Column(String, nullable=True)
    certified_on = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ContractTemplate(Base):
    __tablename__ = "contract_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    contract_type = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Store ordered list of clause keys or IDs
    clause_order = Column(JSON, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
