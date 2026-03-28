"""Celery tasks for AI insight generation.

Scheduled via Celery Beat (all times UTC):
  - Daily insights   — every day at 22:00 (captures the full day)
  - Weekly insights  — every Sunday at 22:00 (end of week)
  - Monthly insights — days 28-31 at 22:00; task guards run to last day only
  - Yearly insights  — December 31 at 23:00 (full year data)

Only active, verified users are processed. Failures per user are logged
and skipped so one bad account never blocks the rest.
"""

from __future__ import annotations

import asyncio
import calendar
import logging
from datetime import date

from sqlalchemy import select

from app.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.insight_service import InsightGenerationError, generate_insight_with_backfill

logger = logging.getLogger(__name__)


# ── Shared async core ────────────────────────────────────────────────────────

async def _generate_for_all_users(insight_type: str) -> dict:
    """Generate insights of a given type for every active, verified user."""
    generated = skipped = failed = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User)
            .where(User.is_active == True)  # noqa: E712
            .where(User.is_verified == True)  # noqa: E712
        )
        users = list(result.scalars().all())
        logger.info(f"Generating {insight_type} insights for {len(users)} users")

        for user in users:
            try:
                insight = await generate_insight_with_backfill(db, user, insight_type)  # type: ignore[arg-type]
                if insight:
                    generated += 1
                else:
                    skipped += 1
            except InsightGenerationError as exc:
                logger.warning(f"{insight_type} insight skipped for user {user.id}: {exc}")
                skipped += 1
            except Exception as exc:
                logger.error(
                    f"Unexpected error generating {insight_type} insight for user {user.id}: {exc}",
                    exc_info=True,
                )
                failed += 1

        await db.commit()

    logger.info(
        f"{insight_type.title()} insights: generated={generated}, skipped={skipped}, failed={failed}"
    )
    return {"type": insight_type, "generated": generated, "skipped": skipped, "failed": failed}


# ── Celery tasks ─────────────────────────────────────────────────────────────

@celery_app.task(name="insight_tasks.generate_daily_insights_for_all", bind=True)
def generate_daily_insights_for_all(self) -> dict:  # type: ignore[misc]
    """Generate daily insights for all users. Runs every day at 22:00 UTC."""
    return asyncio.get_event_loop().run_until_complete(_generate_for_all_users("daily"))


@celery_app.task(name="insight_tasks.generate_weekly_insights_for_all", bind=True)
def generate_weekly_insights_for_all(self) -> dict:  # type: ignore[misc]
    """Generate weekly insights for all users. Runs every Sunday at 22:00 UTC (end of week)."""
    return asyncio.get_event_loop().run_until_complete(_generate_for_all_users("weekly"))


@celery_app.task(name="insight_tasks.generate_monthly_insights_for_all", bind=True)
def generate_monthly_insights_for_all(self) -> dict:  # type: ignore[misc]
    """Generate monthly insights for all users.

    Scheduled on days 28-31 at 22:00 UTC. Guards to only run on the actual
    last day of the month so short months (Feb) are handled correctly.
    """
    today = date.today()
    last_day = calendar.monthrange(today.year, today.month)[1]
    if today.day != last_day:
        logger.info(
            f"Monthly insight skipped — today is the {today.day}th, "
            f"last day of {today.strftime('%B')} is the {last_day}th"
        )
        return {"type": "monthly", "skipped": True, "reason": "not last day of month"}
    return asyncio.get_event_loop().run_until_complete(_generate_for_all_users("monthly"))


@celery_app.task(name="insight_tasks.generate_yearly_insights_for_all", bind=True)
def generate_yearly_insights_for_all(self) -> dict:  # type: ignore[misc]
    """Generate yearly insights for all users. Runs on December 31 at 23:00 UTC."""
    return asyncio.get_event_loop().run_until_complete(_generate_for_all_users("yearly"))
