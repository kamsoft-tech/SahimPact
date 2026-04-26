from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import journal, distribution, ingestion, expenses, settings, shares, auth, ledger, time_tracking, companies
from app.db.database import engine, Base, SessionLocal
from app.models.models import User, RoleEnum, PartnerShare, GlobalSettings, Company
from app.core.security import get_password_hash

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Seed Database
def seed_db():
    db = SessionLocal()
    try:
        # Ensure Default Company exists
        default_company = db.query(Company).filter(Company.name == "Default Company").first()
        if not default_company:
            default_company = Company(name="Default Company")
            db.add(default_company)
            db.commit()
            db.refresh(default_company)
            print("Default Company created.")

        company_id = default_company.id

        # Check if admin exists
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                company_id=company_id, # Can be null for Super admin, but good to have a default
                hashed_password=get_password_hash("admin"),
                role=RoleEnum.SUPER_ADMIN # First user is super admin
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print("Super Admin user created.")

        # Ensure Global Settings exist for company
        if not db.query(GlobalSettings).filter(GlobalSettings.company_id == company_id).first():
            db.add(GlobalSettings(company_id=company_id, charity_percentage=0.06))
            db.commit()
            print("Global settings initialized.")

        # Seed Partners
        partners = [
            ("Partner 1", 40, 20000),
            ("Partner 2", 30, 10000),
            ("Partner 3", 30, 10000)
        ]
        for username, labor, capital in partners:
            user = db.query(User).filter(User.username == username, User.company_id == company_id).first()
            if not user:
                user = User(
                    username=username,
                    company_id=company_id,
                    hashed_password=get_password_hash("password"),
                    role=RoleEnum.PARTNER
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                
                # Link to PartnerShare
                share = PartnerShare(
                    user_id=user.id,
                    company_id=company_id,
                    labor_share_variable=labor,
                    capital_share_fixed=capital,
                    voluntary_charity_percentage=0.01 # 1% voluntary default
                )
                db.add(share)
                db.commit()
                print(f"Partner {username} created with shares.")
    finally:
        db.close()

seed_db()

app = FastAPI()

# Setup CORS for the Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Custom Restaurant ERP API"}

app.include_router(journal.router, prefix="/api")
app.include_router(distribution.router, prefix="/api")
app.include_router(ingestion.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(shares.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(ledger.router, prefix="/api")
app.include_router(time_tracking.router, prefix="/api/time")
app.include_router(companies.router, prefix="/api")

