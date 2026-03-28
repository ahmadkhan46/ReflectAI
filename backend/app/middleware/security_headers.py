"""Security response-headers middleware.

Adds a set of defence-in-depth HTTP response headers to every API response.
These complement the security headers already set by the Next.js frontend.

Headers applied
---------------
* X-Content-Type-Options: nosniff          — prevents MIME sniffing
* X-Frame-Options: DENY                   — stops clickjacking
* Referrer-Policy: strict-origin…         — limits Referer leakage
* Permissions-Policy                       — restricts browser features
* Strict-Transport-Security (HTTPS only)   — enforces HTTPS for 2 years
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_HSTS = "max-age=63072000; includeSubDomains; preload"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security response headers to every API response."""

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = _HSTS
        return response
