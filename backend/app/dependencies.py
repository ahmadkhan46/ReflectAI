"""FastAPI dependency injection providers.

Provides typed, reusable dependencies for database sessions and
authenticated user resolution.
"""

import logging
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)] = None,
    access_token: Annotated[str | None, Cookie()] = None,
) -> User:
    """Resolve the authenticated user from a JWT Bearer token or httpOnly cookie.

    Supports both Authorization header (Bearer) and httpOnly cookie so that
    browser clients (cookies) and API clients (header) are both handled.

    Args:
        db: Injected database session.
        credentials: Optional Bearer token from the Authorization header.
        access_token: Optional token from the 'access_token' httpOnly cookie.

    Returns:
        The authenticated and active User model instance.

    Raises:
        HTTPException: 401 if no token is present, invalid, or expired.
        HTTPException: 403 if the user account is deactivated.
    """
    token: str | None = None

    if credentials:
        token = credentials.credentials
    elif access_token:
        token = access_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support.",
        )

    return user


async def get_admin_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """Require the authenticated user to have admin privileges."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


# Typed aliases for use in router signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(get_admin_user)]
DB = Annotated[AsyncSession, Depends(get_db)]
