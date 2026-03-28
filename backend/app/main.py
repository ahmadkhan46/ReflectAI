"""ReflectAI FastAPI application — entry point and middleware configuration."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.middleware.rate_limit import limiter
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import admin, analytics, auth, health, journal, privacy

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup / shutdown lifecycle handler."""
    logger.info(f"Starting {settings.app_name} [{settings.app_env}]")
    yield
    logger.info(f"Shutting down {settings.app_name}")


app = FastAPI(
    title=settings.app_name,
    description=(
        "Privacy-first mental health journaling with AI-powered emotional pattern insights. "
        "This is NOT a medical device or therapy service."
    ),
    version="0.1.0",
    # Hide docs in production
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url="/api/redoc" if not settings.is_production else None,
    openapi_url="/api/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── Rate limiter ─────────────────────────────────────────────────────────────

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

# ── Middleware (applied in reverse order) ────────────────────────────────────

# Security headers on every response
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["reflectai.app", "*.reflectai.app"],
    )


# ── Global exception handler ────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler that prevents internal details from leaking to clients."""
    logger.error(f"Unhandled exception [{request.method} {request.url}]: {exc}", exc_info=True)
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in settings.cors_origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."},
        headers=headers,
    )


# ── Routers ─────────────────────────────────────────────────────────────────

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(journal.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(privacy.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
