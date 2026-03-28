"""JWT token creation / verification and bcrypt password hashing.

All token-related operations are centralised here to ensure consistent
algorithm, expiry, and signing key usage across the application.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password utilities ──────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt.

    Args:
        password: Raw plaintext password.

    Returns:
        Bcrypt hash string suitable for storage.
    """
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its bcrypt hash.

    Uses constant-time comparison internally to prevent timing attacks.

    Args:
        plain_password: Candidate plaintext password.
        hashed_password: Stored bcrypt hash.

    Returns:
        True if the password matches; False otherwise.
    """
    return _pwd_context.verify(plain_password, hashed_password)


# ── JWT utilities ───────────────────────────────────────────────────────────

def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """Create a short-lived JWT access token.

    Args:
        subject: Unique identifier to embed as 'sub' (typically user UUID).
        extra_claims: Optional additional payload claims.

    Returns:
        Signed JWT string.
    """
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(UTC),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(subject: str) -> str:
    """Create a long-lived JWT refresh token.

    Args:
        subject: Unique identifier (typically user UUID).

    Returns:
        Signed JWT string with extended expiry.
    """
    expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(UTC),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a JWT token (access or refresh).

    Args:
        token: Raw JWT string.

    Returns:
        Decoded payload dict, or None if the token is invalid/expired.
    """
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        logger.debug(f"JWT decode failed: {exc}")
        return None


def create_email_verification_token(email: str) -> str:
    """Create a 24-hour email verification token.

    Args:
        email: The email address to embed in the token.

    Returns:
        Signed JWT string for inclusion in the verification link.
    """
    expire = datetime.now(UTC) + timedelta(hours=24)
    payload: dict[str, Any] = {
        "sub": email,
        "exp": expire,
        "iat": datetime.now(UTC),
        "type": "email_verify",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_email_verification_token(token: str) -> str | None:
    """Decode an email verification token and return the embedded email.

    Args:
        token: Raw JWT string from the verification link.

    Returns:
        Email address string if valid, None if invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "email_verify":
            return None
        return payload.get("sub")
    except JWTError:
        return None
