"""User profile response schema.

Explicitly excludes sensitive fields: hashed_password, encryption_salt.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    """Public user profile — safe to return to the authenticated user."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    email: EmailStr
    full_name: str
    is_active: bool
    is_verified: bool
    is_admin: bool
    age_verified: bool
    consent_given: bool
    consent_date: datetime | None
    created_at: datetime
