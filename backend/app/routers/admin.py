"""Admin-only API endpoints.

All endpoints require is_admin=True. Returns aggregate platform data
without exposing any encrypted journal content.
"""

import logging
import uuid

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select

from app.dependencies import AdminUser, DB
from app.models.journal import EmotionAnalysis, JournalEntry, WeeklyInsight
from app.models.user import User
from app.services.insight_service import InsightGenerationError, generate_weekly_insight
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Response schemas ──────────────────────────────────────────────────────────

class PlatformStats(BaseModel):
    total_users: int
    active_users: int
    total_entries: int
    total_insights: int
    completed_analyses: int


class AdminUserRow(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    email: EmailStr
    full_name: str
    is_active: bool
    is_verified: bool
    is_admin: bool
    entry_count: int
    insight_count: int
    created_at: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=PlatformStats, summary="Platform-level statistics")
async def get_stats(admin: AdminUser, db: DB) -> PlatformStats:
    """Return aggregate counts — no user content is exposed."""
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    active_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_active == True))  # noqa: E712
    ).scalar_one()
    total_entries = (
        await db.execute(
            select(func.count()).select_from(JournalEntry).where(JournalEntry.is_deleted == False)  # noqa: E712
        )
    ).scalar_one()
    total_insights = (await db.execute(select(func.count()).select_from(WeeklyInsight))).scalar_one()
    completed_analyses = (
        await db.execute(
            select(func.count())
            .select_from(EmotionAnalysis)
            .where(EmotionAnalysis.analysis_status == "completed")
        )
    ).scalar_one()

    return PlatformStats(
        total_users=total_users,
        active_users=active_users,
        total_entries=total_entries,
        total_insights=total_insights,
        completed_analyses=completed_analyses,
    )


@router.get("/users", response_model=list[AdminUserRow], summary="List all users")
async def list_users(
    admin: AdminUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> list[AdminUserRow]:
    """Return paginated user list with entry and insight counts."""
    offset = (page - 1) * page_size

    # Subquery for entry counts
    entry_counts = (
        select(JournalEntry.user_id, func.count().label("cnt"))
        .where(JournalEntry.is_deleted == False)  # noqa: E712
        .group_by(JournalEntry.user_id)
        .subquery()
    )
    insight_counts = (
        select(WeeklyInsight.user_id, func.count().label("cnt"))
        .group_by(WeeklyInsight.user_id)
        .subquery()
    )

    result = await db.execute(
        select(
            User,
            func.coalesce(entry_counts.c.cnt, 0).label("entry_count"),
            func.coalesce(insight_counts.c.cnt, 0).label("insight_count"),
        )
        .outerjoin(entry_counts, User.id == entry_counts.c.user_id)
        .outerjoin(insight_counts, User.id == insight_counts.c.user_id)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    rows = []
    for user, entry_count, insight_count in result.all():
        rows.append(
            AdminUserRow(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                is_active=user.is_active,
                is_verified=user.is_verified,
                is_admin=user.is_admin,
                entry_count=entry_count,
                insight_count=insight_count,
                created_at=user.created_at.isoformat(),
            )
        )
    return rows


@router.post("/users/{user_id}/toggle-active", response_model=dict)
async def toggle_user_active(user_id: uuid.UUID, admin: AdminUser, db: DB) -> dict:
    """Activate or deactivate a user account."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = not user.is_active
    await db.flush()
    logger.info(f"Admin {admin.id} set user {user_id} active={user.is_active}")
    return {"user_id": str(user_id), "is_active": user.is_active}


@router.post("/users/{user_id}/toggle-admin", response_model=dict)
async def toggle_user_admin(user_id: uuid.UUID, admin: AdminUser, db: DB) -> dict:
    """Grant or revoke admin privileges for a user."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin status.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_admin = not user.is_admin
    await db.flush()
    logger.info(f"Admin {admin.id} set user {user_id} is_admin={user.is_admin}")
    return {"user_id": str(user_id), "is_admin": user.is_admin}


@router.post("/users/{user_id}/generate-insight", response_model=dict)
async def admin_generate_insight(user_id: uuid.UUID, admin: AdminUser, db: DB) -> dict:
    """Force-generate a weekly insight for any user (bypasses cron schedule)."""
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(str(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    try:
        insight = await generate_weekly_insight(db, user)
    except InsightGenerationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if insight is None:
        raise HTTPException(status_code=422, detail="Not enough entries to generate insight.")

    return {"message": "Insight generated.", "insight_id": str(insight.id)}
