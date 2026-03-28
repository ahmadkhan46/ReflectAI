"""Authentication business logic.

Handles user registration, credential verification, and account retrieval.
All database mutations go through this service — routers stay thin.
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import generate_user_salt
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import RegisterRequest

logger = logging.getLogger(__name__)


class UserAlreadyExistsError(Exception):
    """Raised when a registration email is already in use."""


class InvalidCredentialsError(Exception):
    """Raised when login credentials cannot be verified."""


class AuthService:
    """Stateless authentication service scoped to a single DB session."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def register_user(self, request: RegisterRequest) -> User:
        """Create a new user account.

        Args:
            request: Validated registration payload.

        Returns:
            The newly created (unflushed) User instance.

        Raises:
            UserAlreadyExistsError: If the email address is already registered.
        """
        existing = await self._db.execute(
            select(User).where(User.email == request.email)
        )
        if existing.scalar_one_or_none():
            raise UserAlreadyExistsError(f"Email already registered: {request.email}")

        user = User(
            id=uuid.uuid4(),
            email=request.email,
            hashed_password=hash_password(request.password),
            full_name=request.full_name,
            age_verified=request.age_verified,
            consent_given=request.consent_given,
            consent_date=datetime.now(UTC) if request.consent_given else None,
            encryption_salt=generate_user_salt(),
            is_active=True,
            is_verified=False,
        )
        self._db.add(user)
        await self._db.flush()  # Assigns DB-generated defaults without committing

        logger.info(f"New user registered: {user.id} ({user.email})")
        return user

    async def authenticate_user(self, email: str, password: str) -> User:
        """Verify login credentials and return the authenticated user.

        Uses constant-time password comparison to prevent timing attacks.

        Args:
            email: Candidate email address.
            password: Plaintext candidate password.

        Returns:
            Authenticated User instance.

        Raises:
            InvalidCredentialsError: If credentials are wrong or account inactive.
        """
        result = await self._db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        # Always run verify_password even when user is None to prevent
        # timing-based user-enumeration attacks.
        dummy_hash = "$2b$12$notarealhashjustfortimingnormalization"
        candidate_hash = user.hashed_password if user else dummy_hash

        if not verify_password(password, candidate_hash) or not user:
            raise InvalidCredentialsError("Invalid email or password.")

        if not user.is_active:
            raise InvalidCredentialsError("Account is deactivated.")

        logger.info(f"User authenticated: {user.id}")
        return user

    async def get_user_by_id(self, user_id: str) -> User | None:
        """Fetch a user by UUID string.

        Args:
            user_id: UUID string to look up.

        Returns:
            User instance or None if not found / invalid UUID.
        """
        try:
            uid = uuid.UUID(user_id)
        except ValueError:
            return None

        result = await self._db.execute(select(User).where(User.id == uid))
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> User | None:
        """Fetch a user by email address.

        Args:
            email: Email address to look up.

        Returns:
            User instance or None if not found.
        """
        result = await self._db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def mark_email_verified(self, email: str) -> bool:
        """Mark the user's email as verified.

        Args:
            email: Email address of the user to verify.

        Returns:
            True if the user was found and updated; False otherwise.
        """
        user = await self.get_user_by_email(email)
        if not user:
            return False
        user.is_verified = True
        await self._db.flush()
        logger.info(f"Email verified for user: {user.id}")
        return True
