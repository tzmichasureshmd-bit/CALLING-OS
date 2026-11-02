import logging
import re
import time
import uuid
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from .config import settings
from .database import engine, Base
from .routers import (
    auth_router, employees_router, devices_router, calls_router, analytics_router,
    organization_router, leads_router, opportunities_router, excluded_numbers_router,
    billing_router, transcripts_router, superadmin_router, audit_router, call_notes_router,
)

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("callnexa")

# ── Rate limiting ──────────────────────────────────────────────────────────────
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.middleware import SlowAPIMiddleware
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])
    _rate_limiting_available = True
except ImportError:
    limiter = None
    _rate_limiting_available = False
    logger.warning("slowapi not installed — rate limiting disabled. Run: pip install slowapi")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CallNexa API",
    description="Sales call monitoring & intelligence platform API.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

if _rate_limiting_available:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Security headers ───────────────────────────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── Request logging ────────────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    supplied = request.headers.get("x-correlation-id", "")
    correlation_id = supplied if re.fullmatch(r"[A-Za-z0-9._:-]{1,64}", supplied) else uuid.uuid4().hex
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    ms = int((time.time() - start) * 1000)
    response.headers["X-Correlation-ID"] = correlation_id
    logger.info(
        "request_id=%s method=%s path=%s status=%s duration_ms=%d",
        correlation_id, request.method, request.url.path, response.status_code, ms,
    )
    return response


# ── Global error handlers ──────────────────────────────────────────────────────
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={"error_code": "CONFLICT", "message": "A record with this data already exists."},
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"error_code": "SERVER_ERROR", "message": "An internal error occurred."},
    )


# ── Startup ────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logger.info("CallNexa API starting up...")
    if settings.APP_ENV == "development":
        Base.metadata.create_all(bind=engine)
        logger.info("Development database tables checked.")
    else:
        logger.info("Production schema is managed by migration_runner.py.")

    from .routers.devices import start_offline_watcher
    start_offline_watcher()
    logger.info("Device offline watcher started.")

    # ── Stuck-transcription recovery ────────────────────────────────────────────────────────────────
    # Calls stuck in transcript_status='processing' with transcription_started_at
    # older than 10 minutes were interrupted by a previous crash or restart.
    # Reset them to 'failed' so they can be retried. Recent active jobs are untouched.
    # This block must never raise — a DB error here must not prevent startup.
    try:
        from datetime import timedelta
        from .database import SessionLocal as _SL
        from .models import Call as _Call
        _db = _SL()
        try:
            # FastAPI BackgroundTasks do not survive a process restart. Every
            # processing row observed during startup is therefore orphaned,
            # regardless of its timestamp.
            _stuck = (
                _db.query(_Call)
                .filter(_Call.transcript_status == "processing")
                .all()
            )
            _stuck_summaries = (
                _db.query(_Call)
                .filter(_Call.summary_status == "processing")
                .all()
            )
            for _c in _stuck:
                _c.transcript_status = "failed"
                _c.transcript_error = "Transcription interrupted by a server restart. Please retry."
            for _c in _stuck_summaries:
                _c.summary_status = "failed"
                _c.summary_error = "Summary interrupted by a server restart. Please retry."
            if _stuck or _stuck_summaries:
                _db.commit()
                logger.warning(
                    "Startup recovery: reset %d transcription(s) and %d summary job(s).",
                    len(_stuck), len(_stuck_summaries),
                )
            else:
                logger.info("Startup recovery: no interrupted AI jobs found.")
        finally:
            _db.close()
    except Exception as _exc:
        logger.error("Startup recovery error (non-fatal): %s", _exc)

    if settings.SEED_DEMO_DATA:
        from .seed import seed_demo_data
        from .database import SessionLocal
        db = SessionLocal()
        try:
            seed_demo_data(db)
        finally:
            db.close()

    logger.info("CallNexa API ready.")


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health():
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/health/db", tags=["health"])
def health_db():
    db = None
    try:
        from .database import SessionLocal
        import sqlalchemy
        db = SessionLocal()
        db.execute(sqlalchemy.text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "connection failed"},
        )
    finally:
        if db is not None:
            db.close()


@app.get("/health/storage", tags=["health"])
def health_storage():
    configured = bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)
    return {
        "status": "configured" if configured else "not_configured",
    }


# ── Routers ────────────────────────────────────────────────────────────────────
prefix = "/api/v1"
app.include_router(auth_router,             prefix=prefix)
app.include_router(employees_router,        prefix=prefix)
app.include_router(devices_router,          prefix=prefix)
app.include_router(calls_router,            prefix=prefix)
app.include_router(analytics_router,        prefix=prefix)
app.include_router(organization_router,     prefix=prefix)
app.include_router(leads_router,            prefix=prefix)
app.include_router(opportunities_router,    prefix=prefix)
app.include_router(excluded_numbers_router, prefix=prefix)
app.include_router(billing_router,          prefix=prefix)
app.include_router(transcripts_router,      prefix=prefix)
app.include_router(superadmin_router,       prefix=prefix)
app.include_router(audit_router,            prefix=prefix)
app.include_router(call_notes_router,       prefix=prefix)


@app.get("/", tags=["root"])
def root():
    return {"message": "CallNexa API", "docs": "/docs", "version": "1.0.0"}
