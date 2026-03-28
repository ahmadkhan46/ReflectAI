"""Authentication request and response schemas with strict validation."""

import re
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    """Registration request — enforces age gate, consent, and password strength."""

    email: EmailStr = Field(..., description="Valid email address")
    password: Annotated[str, Field(min_length=8, max_length=128)] = Field(
        ...,
        description="Password: min 8 chars, must include upper, lower, and digit",
    )
    full_name: Annotated[str, Field(min_length=1, max_length=255)] = Field(
        ..., description="User display name"
    )
    age_verified: bool = Field(..., description="User confirms they are 18 or older")
    consent_given: bool = Field(
        ..., description="User consents to data processing and ethical terms"
    )

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Enforce minimum complexity: upper, lower, and digit required."""
        errors: list[str] = []
        if not re.search(r"[A-Z]", v):
            errors.append("at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            errors.append("at least one lowercase letter")
        if not re.search(r"\d", v):
            errors.append("at least one digit")
        if errors:
            raise ValueError(f"Password must contain {', '.join(errors)}.")
        return v

    @field_validator("age_verified")
    @classmethod
    def validate_age_gate(cls, v: bool) -> bool:
        """Block registration for users who do not confirm they are 18+."""
        if not v:
            raise ValueError("You must be 18 or older to use ReflectAI.")
        return v

    @field_validator("consent_given")
    @classmethod
    def validate_consent(cls, v: bool) -> bool:
        """Block registration without explicit informed consent."""
        if not v:
            raise ValueError(
                "You must accept the data processing terms to create an account."
            )
        return v


class LoginRequest(BaseModel):
    """Login credentials."""

    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")


class TokenResponse(BaseModel):
    """Issued JWT token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token lifetime in seconds")


class RefreshRequest(BaseModel):
    """Refresh token body for token rotation.

    `refresh_token` is optional so browser clients (which store the token in an
    httpOnly cookie that JavaScript cannot read) can POST an empty body and the
    server will fall back to the cookie automatically.
    """

    refresh_token: str | None = None


class MessageResponse(BaseModel):
    """Generic operation result message."""

    message: str
