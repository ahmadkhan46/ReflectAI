"""Authentication API endpoints.

Endpoints: register, login, logout, refresh, email verification, profile.
Tokens are issued in both response body and httpOnly cookies so that
browser clients (cookie) and API / mobile clients (header) are both served.
"""

import logging

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.config import get_settings
from app.core.security import (
    create_access_token,
    create_email_verification_token,
    create_refresh_token,
    decode_access_token,
    decode_email_verification_token,
)
from app.dependencies import CurrentUser, DB
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse
from app.middleware.rate_limit import limiter
from app.services.auth_service import (
    AuthService,
    InvalidCredentialsError,
    UserAlreadyExistsError,
)

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])

_ACCESS_COOKIE = "access_token"
_REFRESH_COOKIE = "refresh_token"


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Write httpOnly auth cookies to the response."""
    response.set_cookie(
        key=_ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
    )
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 86_400,
    )


def _clear_auth_cookies(response: Response) -> None:
    """Remove auth cookies from the response."""
    response.delete_cookie(_ACCESS_COOKIE)
    response.delete_cookie(_REFRESH_COOKIE)


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new account",
)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest, db: DB) -> MessageResponse:
    """Register a new ReflectAI account.

    Enforces age gate (18+) and informed consent. On success, a verification
    email is dispatched (Celery task — Phase 1 stub: token logged only).

    Args:
        request: Registration data with credentials and compliance flags.
        db: Injected database session.

    Returns:
        Confirmation message prompting email verification.

    Raises:
        HTTPException 409: Email already registered.
        HTTPException 422: Validation failure (weak password, age gate, etc.).
    """
    logger.info(f"Registration attempt: {body.email}")
    service = AuthService(db)

    try:
        user = await service.register_user(body)
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    verification_token = create_email_verification_token(user.email)
    try:
        from app.tasks.email_tasks import send_verification_email
        send_verification_email.delay(user.email, verification_token)
        logger.info(f"Verification email queued for {user.email}")
    except Exception as exc:
        # Non-fatal: email dispatch failure should not block registration
        logger.warning(f"Could not queue verification email for {user.email}: {exc}")
        logger.info(
            f"[DEV] Verify URL: {settings.frontend_url}/auth/verify-email/{verification_token}"
        )

    return MessageResponse(
        message=(
            "Account created successfully. "
            "Please check your email to verify your account before signing in."
        )
    )


@router.post("/login", response_model=TokenResponse, summary="Authenticate and receive tokens")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, response: Response, db: DB) -> TokenResponse:
    """Authenticate with email and password.

    Issues JWT access and refresh tokens in both the response body and
    httpOnly cookies.

    Args:
        request: Login credentials.
        response: FastAPI response object for setting cookies.
        db: Injected database session.

    Returns:
        Access token details.

    Raises:
        HTTPException 401: Invalid credentials.
    """
    logger.info(f"Login attempt: {body.email}")
    service = AuthService(db)

    try:
        user = await service.authenticate_user(body.email, body.password)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    _set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse, summary="Rotate access token")
@limiter.limit("20/minute")
async def refresh_token(request: Request, body: RefreshRequest, response: Response) -> TokenResponse:
    """Issue a new access token using a valid refresh token.

    Accepts the token from the httpOnly cookie (browser clients) or the request
    body (API / mobile clients).  This allows JavaScript in the browser to call
    this endpoint without needing access to the httpOnly cookie value.

    Args:
        request: Starlette request (used to read the cookie fallback).
        body: Optional body containing refresh_token for non-browser clients.
        response: FastAPI response for updating cookies.

    Returns:
        New access token details.

    Raises:
        HTTPException 401: Refresh token is invalid, expired, or not provided.
    """
    # Cookie takes precedence (browser); body fallback for API / mobile clients
    token: str | None = request.cookies.get(_REFRESH_COOKIE) or body.refresh_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided.",
        )

    payload = decode_access_token(token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    subject: str | None = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload.",
        )

    new_access = create_access_token(subject=subject)
    new_refresh = create_refresh_token(subject=subject)
    _set_auth_cookies(response, new_access, new_refresh)

    return TokenResponse(
        access_token=new_access,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout", response_model=MessageResponse, summary="Sign out and clear tokens")
async def logout(response: Response, _: CurrentUser) -> MessageResponse:
    """Invalidate the session by clearing httpOnly auth cookies.

    Requires a valid token so that CSRF-style logout forgery is prevented.

    Args:
        response: FastAPI response for clearing cookies.
        _: Validates the caller is authenticated (unused beyond auth check).

    Returns:
        Logout confirmation.
    """
    _clear_auth_cookies(response)
    return MessageResponse(message="You have been signed out successfully.")


@router.get("/me", response_model=UserResponse, summary="Current user profile")
async def get_me(current_user: CurrentUser) -> UserResponse:
    """Return the authenticated user's profile.

    Sensitive fields (hashed_password, encryption_salt) are excluded by
    the UserResponse schema.

    Args:
        current_user: Resolved from JWT token via dependency.

    Returns:
        Public user profile.
    """
    return UserResponse.model_validate(current_user)


@router.get(
    "/verify-email/{token}",
    response_model=MessageResponse,
    summary="Verify email address via token link",
)
async def verify_email(token: str, db: DB) -> MessageResponse:
    """Verify a user's email using the token embedded in their verification link.

    Args:
        token: Email verification JWT from the link in the verification email.
        db: Injected database session.

    Returns:
        Verification success message.

    Raises:
        HTTPException 400: Token invalid or expired.
        HTTPException 404: No user found for the embedded email.
    """
    email = decode_email_verification_token(token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or has expired. Please request a new one.",
        )

    service = AuthService(db)
    verified = await service.mark_email_verified(email)
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found for this verification link.",
        )

    logger.info(f"Email verified: {email}")
    return MessageResponse(message="Email verified successfully. You can now sign in.")
