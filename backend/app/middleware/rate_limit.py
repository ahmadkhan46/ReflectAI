"""Rate limiting for the ReflectAI API.

Uses SlowAPI (a thin Starlette/FastAPI wrapper around limits/slowapi).
The limiter is backed by Redis in all environments so limits are shared
across multiple uvicorn workers in production.

Usage in a router:

    from fastapi import Request
    from app.middleware.rate_limit import limiter

    @router.post("/login")
    @limiter.limit("10/minute")
    async def login(request: Request, body: LoginRequest, ...):
        ...

The `request: Request` positional arg is required by SlowAPI — it is
used purely to extract the client IP; nothing else changes.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

_settings = get_settings()

limiter = Limiter(
    key_func=get_remote_address,
    # Redis-backed storage so limits are consistent across workers
    storage_uri=_settings.redis_url,
    # Conservative global defaults — tighter limits applied per-endpoint
    default_limits=["500/day", "60/minute"],
)
