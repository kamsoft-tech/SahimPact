from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.database import Base

class DocumentSection(Base):
    __tablename__ = "document_sections"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False) # Rich text / HTML
    is_mandatory = Column(Boolean, default=False, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)


class CompanyDocumentSection(Base):
    __tablename__ = "company_document_sections"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False) # Rich text / HTML
    order_index = Column(Integer, default=0, nullable=False)


class CompanySectionSelection(Base):
    __tablename__ = "company_section_selections"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    global_section_id = Column(Integer, ForeignKey("document_sections.id", ondelete="CASCADE"), nullable=True)
    company_section_id = Column(Integer, ForeignKey("company_document_sections.id", ondelete="CASCADE"), nullable=True)
    is_included = Column(Boolean, default=True, nullable=False)
