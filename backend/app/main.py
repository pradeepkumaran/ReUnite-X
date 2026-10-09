"""
REUNITE-X Backend Entrypoint
FastAPI application gateway with Swagger OpenAPI documentation, CORS, rate limiting,
structured logging, and role-guarded endpoints.
"""
import time
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging import logger
from app.routers import auth, cases, search, matches, sync, stats, notifications

# OpenAPI Metadata Tags
tags_metadata = [
    {
        "name": "Cases",
        "description": "Create, track, and manage missing and found person disaster records.",
    },
    {
        "name": "Search",
        "description": "Multi-criteria and geospatial radius search with automated minor PII protection.",
    },
    {
        "name": "Matches & Verifications",
        "description": "AI candidate review queue and human authority verification / rejection workflows.",
    },
    {
        "name": "Offline Sync",
        "description": "Idempotent batch synchronization of reports captured during communication outages.",
    },
    {
        "name": "Dashboard & Analytics",
        "description": "High-level situational metrics and reunification status statistics.",
    },
    {
        "name": "Notifications",
        "description": "Multi-channel push (FCM) and email emergency alerts.",
    },
    {
        "name": "Authentication",
        "description": "User profile verification and role validation.",
    },
]

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
# REUNITE-X Disaster Response Platform API 🆘🌐

REUNITE-X connects families separated during catastrophic disasters (floods, cyclones, earthquakes).
Key architectural capabilities:
* **Zero-Connectivity Resilient**: Offline intake and batch sync via idempotent client UUIDs.
* **AI-Assisted Matching**: Facial vector embeddings + demographic and spatial fusion.
* **Strict Human-in-the-Loop**: Zero auto-confirmations. Official verification required before notifications.
* **Child & Minor Shielding**: Automatic redaction of sensitive contact details for individuals under 18.
    """,
    version=settings.VERSION,
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Attach SlowAPI Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request Timing and Structured Logging Middleware
@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms:.2f}ms)"
    )
    return response


# Include API Routers under /api/v1
api_v1_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1_prefix)
app.include_router(cases.router, prefix=api_v1_prefix)
app.include_router(search.router, prefix=api_v1_prefix)
app.include_router(matches.router, prefix=api_v1_prefix)
app.include_router(sync.router, prefix=api_v1_prefix)
app.include_router(stats.router, prefix=api_v1_prefix)
app.include_router(notifications.router, prefix=api_v1_prefix)


@app.get("/api/v1/database/status", tags=["System"], summary="Database & Supabase Connection Status")
@app.get("/database/status", tags=["System"], summary="Database & Supabase Connection Status")
async def database_status():
    """Returns whether live Supabase is connected or operating on SQLite local durability."""
    from app.core.database import db
    return db.get_connection_status()


@app.post("/api/v1/database/sync", tags=["System"], summary="Trigger Manual Supabase Synchronization")
async def trigger_supabase_sync():
    """Synchronizes all locally stored records to Supabase."""
    from app.core.database import db
    return db.sync_all_to_supabase()


@app.get("/health", tags=["System"], summary="Service Health Check")
async def health_check():
    """Returns application health, version, and operational mode."""
    return {
        "status": "healthy",
        "service": "reunite-x-backend",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["System"], include_in_schema=False)
async def root():
    return {
        "message": "Welcome to REUNITE-X Disaster Response API Gateway.",
        "documentation": "/docs",
        "health": "/health",
        "database": "/database/status",
    }

