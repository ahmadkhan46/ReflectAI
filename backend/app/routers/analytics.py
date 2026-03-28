"""Analytics router — local, free, zero API calls."""

from __future__ import annotations

import logging

from fastapi import APIRouter
from sqlalchemy import select

from app.dependencies import CurrentUser, DB
from app.models.journal import JournalEntry, MoodCheckin
from app.services.analytics_service import build_analytics
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", summary="Full analytics snapshot for the current user")
async def get_analytics(current_user: CurrentUser, db: DB) -> dict:
    """Return wellness score, day-of-week patterns, correlations, and emotion trend.

    All computation is local — no external API calls.
    """
    checkin_result = await db.execute(
        select(MoodCheckin)
        .where(MoodCheckin.user_id == current_user.id)
        .order_by(MoodCheckin.checkin_date.desc())
        .limit(365)
    )
    checkins = list(checkin_result.scalars().all())

    entry_result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.emotion))
        .where(
            JournalEntry.user_id == current_user.id,
            JournalEntry.is_deleted == False,  # noqa: E712
        )
        .order_by(JournalEntry.entry_date.desc())
        .limit(365)
    )
    entries = list(entry_result.scalars().all())

    return build_analytics(checkins, entries)
