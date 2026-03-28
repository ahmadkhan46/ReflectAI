"""Add journal_entries, emotion_analyses, and weekly_insights tables.

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-25
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    # ── journal_entries ──────────────────────────────────────────────────────
    op.create_table(
        "journal_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("encrypted_content", sa.LargeBinary(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_journal_entries_id"), "journal_entries", ["id"])
    op.create_index(op.f("ix_journal_entries_user_id"), "journal_entries", ["user_id"])
    op.create_index(op.f("ix_journal_entries_entry_date"), "journal_entries", ["entry_date"])

    # ── emotion_analyses ─────────────────────────────────────────────────────
    op.create_table(
        "emotion_analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entry_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("primary_emotion", sa.String(50), nullable=False),
        sa.Column("primary_confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("emotion_scores", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("sentiment_label", sa.String(20), nullable=False),
        sa.Column("sentiment_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("themes", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("is_user_corrected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("user_corrected_emotion", sa.String(50), nullable=True),
        sa.Column("analysis_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["entry_id"], ["journal_entries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entry_id"),
    )
    op.create_index(op.f("ix_emotion_analyses_entry_id"), "emotion_analyses", ["entry_id"])

    # ── weekly_insights ──────────────────────────────────────────────────────
    op.create_table(
        "weekly_insights",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("insight_content", sa.Text(), nullable=False),
        sa.Column("emotion_summary", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("patterns_detected", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_feedback", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_weekly_insights_id"), "weekly_insights", ["id"])
    op.create_index(op.f("ix_weekly_insights_user_id"), "weekly_insights", ["user_id"])


def downgrade() -> None:
    op.drop_table("weekly_insights")
    op.drop_table("emotion_analyses")
    op.drop_table("journal_entries")
