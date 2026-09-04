import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from .config import settings
from .database import engine, Base
from .routers import (
    auth_router, employees_router, devices_router, calls_router, analytics_router,
    organization_router, leads_router, opportunities_router, excluded_numbers_router,
    billing_router, transcripts_router, superadmin_router,
)

# ---- Logging ----
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("callnexa")

# ---- App ----
app = FastAPI(
    title="CallNexa API",
    description="Sales call monitoring & intelligence platform API.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Request logging middleware ----
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    ms = int((time.time() - start) * 1000)
    logger.info(f"{request.method} {request.url.path} → {response.status_code} ({ms}ms)")
    return response


# ---- Global error handlers ----
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    from fastapi.middleware.cors import CORSMiddleware
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=409,
        content={"error_code": "CONFLICT", "message": "A record with this data already exists."},
        headers={"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"},
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error: {exc}")
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"error_code": "SERVER_ERROR", "message": str(exc)},
        headers={"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"},
    )


# ---- Startup ----
@app.on_event("startup")
async def startup():
    logger.info("CallNexa API starting up...")
    import webbrowser, threading
    threading.Timer(1.5, lambda: webbrowser.open("http://localhost:8000/docs")).start()
    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready.")

    # Auto-seed demo data if enabled
    if settings.SEED_DEMO_DATA:
        from .seed import seed_demo_data
        from .database import SessionLocal
        db = SessionLocal()
        try:
            seed_demo_data(db)
        finally:
            db.close()
    logger.info("CallNexa API ready.")


# ---- Health endpoints ----
@app.get("/health", tags=["health"])
def health():
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/health/db", tags=["health"])
def health_db():
    try:
        from .database import SessionLocal
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "unhealthy", "database": str(e)})


# ---- Routers ----
prefix = "/api/v1"
app.include_router(auth_router, prefix=prefix)
app.include_router(employees_router, prefix=prefix)
app.include_router(devices_router, prefix=prefix)
app.include_router(calls_router, prefix=prefix)
app.include_router(analytics_router, prefix=prefix)
app.include_router(organization_router, prefix=prefix)
app.include_router(leads_router, prefix=prefix)
app.include_router(opportunities_router, prefix=prefix)
app.include_router(excluded_numbers_router, prefix=prefix)
app.include_router(billing_router, prefix=prefix)
app.include_router(transcripts_router, prefix=prefix)
app.include_router(superadmin_router, prefix=prefix)


@app.get("/", tags=["root"])
def root():
    return {"message": "CallNexa API", "docs": "/docs", "version": "1.0.0"}
