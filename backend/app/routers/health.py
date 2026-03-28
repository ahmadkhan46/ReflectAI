"""Health check endpoints for load balancer and monitoring integration."""

import logging
from typing import Any

from fastapi import APIRouter
from sqlalchemy import text

from app.config import get_settings
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["health"])


@router.get("/health", summary="Service liveness and readiness check")
async def health_check() -> dict[str, Any]:
    """Return service health including database connectivity.

    This endpoint is intentionally unauthenticated so load balancers and
    uptime monitors can call it without credentials.

    Returns:
        Dict with overall status, environment, and per-component health.
    """
    db_status = "healthy"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error(f"Database health check failed: {exc}")
        db_status = "unhealthy"

    overall = "healthy" if db_status == "healthy" else "degraded"

    return {
        "service": settings.app_name,
        "version": "0.1.0",
        "status": overall,
        "environment": settings.app_env,
        "components": {
            "database": db_status,
        },
    }
