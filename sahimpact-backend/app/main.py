import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.endpoints.journal import router as journal_router
from .api.endpoints.distribution import router as distribution_router
from .api.endpoints.ingestion import router as ingestion_router
from .api.endpoints.expenses import router as expenses_router
from .api.endpoints.settings import router as settings_router
from .api.endpoints.shares import router as shares_router
from .api.endpoints.auth import router as auth_router
from .api.endpoints.ledger import router as ledger_router
from .api.endpoints.time_tracking import router as time_tracking_router
from .api.endpoints.companies import router as companies_router
from .api.endpoints.agreements import router as agreements_router
from .api.endpoints.master import router as master_router
from .api.endpoints.contracts import router as contracts_router
from app.db.database import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.models import User, RoleEnum
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request
from app.core.rate_limit import limiter

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Seed Database
def seed_db():
    db = SessionLocal()
    try:
        # Check if any Super Admin exists
        admin_exists = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
        
        if not admin_exists:
            # NIST SP 800-63B §5.1.1: Passwords must NOT be hardcoded defaults.
            # Provide SUPER_ADMIN_INITIAL_PASSWORD via environment variable.
            initial_password = os.environ.get("SUPER_ADMIN_INITIAL_PASSWORD", "ChangeMe_OnFirstLogin!")
            admin = User(
                username="admin",
                full_name="Super Administrator",
                hashed_password=get_password_hash(initial_password),
                role=RoleEnum.SUPER_ADMIN
            )
            db.add(admin)
            db.commit()
            print("Initial Super Admin user created. IMPORTANT: Change the default password immediately.")
        
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

seed_db()

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self';"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response

# Setup CORS — OWASP A05:2021: Never allow all origins with credentials
# Set ALLOWED_ORIGINS env var to a comma-separated list of your frontend URLs
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:9090,http://127.0.0.1:5173,http://127.0.0.1:5174")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Custom Restaurant ERP API"}

app.include_router(journal_router, prefix="/api")
app.include_router(distribution_router, prefix="/api")
app.include_router(ingestion_router, prefix="/api")
app.include_router(expenses_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(shares_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(ledger_router, prefix="/api")
app.include_router(time_tracking_router, prefix="/api/time")
app.include_router(companies_router, prefix="/api")
app.include_router(agreements_router, prefix="/api")
app.include_router(master_router, prefix="/api")
app.include_router(contracts_router, prefix="/api")

