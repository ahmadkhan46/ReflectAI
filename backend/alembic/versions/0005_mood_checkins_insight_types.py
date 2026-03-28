"""Add mood_checkins table and insight_type / period_label to weekly_insights.

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── mood_checkins ────────────────────────────────────────────────────────
    op.create_table(
        "mood_checkins",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("mood_score", sa.Integer, nullable=False),
        sa.Column("energy_level", sa.Integer, nullable=True),
        sa.Column("sleep_quality", sa.Integer, nullable=True),
        sa.Column("stress_level", sa.Integer, nullable=True),
        sa.Column("note_encrypted", sa.LargeBinary, nullable=True),
        sa.Column("checkin_date", sa.Date, nullable=False, index=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    # ── weekly_insights: add insight_type and period_label ───────────────────
    op.add_column(
        "weekly_insights",
        sa.Column("insight_type", sa.String(20), nullable=False, server_default="weekly"),
    )
    op.add_column(
        "weekly_insights",
        sa.Column("period_label", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("weekly_insights", "period_label")
    op.drop_column("weekly_insights", "insight_type")
    op.drop_table("mood_checkins")
