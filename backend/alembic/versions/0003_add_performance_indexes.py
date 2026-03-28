"""Add composite performance indexes.

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-25

These indexes target the most common query patterns:
- Listing a user's non-deleted entries ordered by date (dashboard load)
- Finding pending emotion analyses (Celery worker polling)
- Fetching recent weekly insights per user
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    # Dashboard query: WHERE user_id = ? AND is_deleted = false ORDER BY entry_date DESC
    op.create_index(
        "ix_journal_entries_user_active_date",
        "journal_entries",
        ["user_id", "is_deleted", sa.text("entry_date DESC")],
        postgresql_where=sa.text("is_deleted = false"),
    )

    # Celery worker: WHERE analysis_status = 'pending'
    op.create_index(
        "ix_emotion_analyses_status",
        "emotion_analyses",
        ["analysis_status"],
        postgresql_where=sa.text("analysis_status = 'pending'"),
    )

    # Insight fetch: WHERE user_id = ? ORDER BY week_start DESC
    op.create_index(
        "ix_weekly_insights_user_week",
        "weekly_insights",
        ["user_id", sa.text("week_start DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_weekly_insights_user_week", table_name="weekly_insights")
    op.drop_index("ix_emotion_analyses_status", table_name="emotion_analyses")
    op.drop_index("ix_journal_entries_user_active_date", table_name="journal_entries")
