"""Celery application configuration."""

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "reflectai",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.emotion_tasks",   # Phase 3: ML inference
        "app.tasks.insight_tasks",   # Phase 6: Claude API insights
        "app.tasks.email_tasks",     # Phase 8: transactional email
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,           # Only ack after successful completion
    worker_prefetch_multiplier=1,  # Fair distribution for long ML tasks
    beat_schedule={
        # ── AI insight generation (end-of-period, Ollama — free) ─────────────
        # All run late in the day (22:00+ UTC) to capture the full period's data.
        # Upsert logic: re-running within the same period refreshes, not duplicates.

        # Daily — runs every night; each day stays as its own separate record
        "generate-daily-insights": {
            "task": "insight_tasks.generate_daily_insights_for_all",
            "schedule": crontab(hour=22, minute=0),
        },
        # Weekly — runs every Sunday night (end of week)
        "generate-weekly-insights": {
            "task": "insight_tasks.generate_weekly_insights_for_all",
            "schedule": crontab(hour=22, minute=0, day_of_week=0),  # 0 = Sunday
        },
        # Monthly — runs on days 28-31; task itself guards to last day only
        # (handles February correctly — Feb 28/29 is detected in the task)
        "generate-monthly-insights": {
            "task": "insight_tasks.generate_monthly_insights_for_all",
            "schedule": crontab(hour=22, minute=30, day_of_month="28-31"),
        },
        # Yearly — runs on December 31 at 23:00 UTC
        "generate-yearly-insights": {
            "task": "insight_tasks.generate_yearly_insights_for_all",
            "schedule": crontab(hour=23, minute=0, month_of_year=12, day_of_month=31),
        },

        # Daily check-in reminder email — every day at 20:00 UTC (8 PM)
        # Users who already checked in today are automatically skipped.
        # Requires SMTP_USER to be configured in .env to actually send emails.
        "send-checkin-reminders": {
            "task": "email_tasks.send_checkin_reminders",
            "schedule": crontab(hour=20, minute=0),
        },
    },
)
