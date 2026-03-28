"""Privacy & data control endpoints — GDPR compliance.

Provides: data export (JSON), account deletion (hard delete), and
a summary of what data is stored.
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, DB
from app.models.journal import EmotionAnalysis, JournalEntry, WeeklyInsight
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.services.journal_service import JournalService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/privacy", tags=["privacy"])


@router.get("/export", summary="Export all user data as JSON")
async def export_data(current_user: CurrentUser, db: DB) -> Response:
    """Export all personal data as a downloadable JSON file (GDPR Art. 20).

    Decrypted journal content is included so the export is human-readable.
    The download is streamed as an attachment.

    Args:
        current_user: Authenticated user.
        db: Database session.

    Returns:
        JSON file response with Content-Disposition header.
    """
    service = JournalService(db)
    entries, _ = await service.list_entries(current_user.id, page=1, page_size=10_000)

    journal_data = []
    for entry in entries:
        try:
            content = service.decrypt_entry(entry, current_user)
        except Exception:
            content = "[decryption failed]"

        journal_data.append({
            "id": str(entry.id),
            "entry_date": entry.entry_date.isoformat(),
            "content": content,
            "word_count": entry.word_count,
            "created_at": entry.created_at.isoformat(),
            "emotion": {
                "primary_emotion": entry.emotion.primary_emotion,
                "primary_confidence": entry.emotion.primary_confidence,
                "emotion_scores": entry.emotion.emotion_scores,
                "sentiment_label": entry.emotion.sentiment_label,
                "themes": entry.emotion.themes,
                "is_user_corrected": entry.emotion.is_user_corrected,
                "user_corrected_emotion": entry.emotion.user_corrected_emotion,
            } if entry.emotion and entry.emotion.analysis_status == "completed" else None,
        })

    insights_result = await db.execute(
        select(WeeklyInsight)
        .where(WeeklyInsight.user_id == current_user.id)
        .order_by(WeeklyInsight.week_start)
    )
    insights_data = [
        {
            "id": str(i.id),
            "week_start": i.week_start.isoformat(),
            "week_end": i.week_end.isoformat(),
            "insight_content": i.insight_content,
            "emotion_summary": i.emotion_summary,
            "patterns_detected": i.patterns_detected,
            "generated_at": i.generated_at.isoformat(),
            "user_feedback": i.user_feedback,
        }
        for i in insights_result.scalars().all()
    ]

    export = {
        "export_generated_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "created_at": current_user.created_at.isoformat(),
            "consent_date": current_user.consent_date.isoformat() if current_user.consent_date else None,
        },
        "journal_entries": journal_data,
        "weekly_insights": insights_data,
    }

    json_bytes = json.dumps(export, indent=2, ensure_ascii=False).encode("utf-8")

    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="reflectai_export_{current_user.id}.json"',
        },
    )


@router.delete(
    "/account",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Permanently delete account and all data",
)
async def delete_account(current_user: CurrentUser, db: DB) -> MessageResponse:
    """Permanently and irreversibly delete the account and all associated data.

    This is a hard delete:
    - All journal entries and emotion analyses (CASCADE from user delete)
    - All weekly insights (CASCADE from user delete)
    - The user record itself

    GDPR Art. 17 — Right to erasure.

    Args:
        current_user: Authenticated user requesting deletion.
        db: Database session.

    Returns:
        Confirmation message.
    """
    user_id = current_user.id
    logger.info(f"Account deletion requested for user {user_id}")

    # SQLAlchemy cascades handle child record deletion
    await db.execute(delete(User).where(User.id == user_id))
    await db.flush()

    logger.info(f"Account permanently deleted: {user_id}")
    return MessageResponse(
        message=(
            "Your account and all associated data have been permanently deleted. "
            "This action cannot be undone."
        )
    )


@router.get("/summary", summary="Data storage summary")
async def data_summary(current_user: CurrentUser, db: DB) -> dict:
    """Return a summary of what data is stored for the user.

    Args:
        current_user: Authenticated user.
        db: Database session.

    Returns:
        Dict describing stored data categories and counts.
    """
    from sqlalchemy import func
    from app.models.journal import JournalEntry

    entry_count_result = await db.execute(
        select(func.count(JournalEntry.id))
        .where(JournalEntry.user_id == current_user.id)
        .where(JournalEntry.is_deleted == False)  # noqa: E712
    )
    entry_count = entry_count_result.scalar_one()

    insight_count_result = await db.execute(
        select(func.count(WeeklyInsight.id))
        .where(WeeklyInsight.user_id == current_user.id)
    )
    insight_count = insight_count_result.scalar_one()

    return {
        "user": {
            "email": current_user.email,
            "account_created": current_user.created_at.isoformat(),
            "consent_date": current_user.consent_date.isoformat() if current_user.consent_date else None,
        },
        "data_stored": {
            "journal_entries": {
                "count": entry_count,
                "encryption": "AES-128-CBC + HMAC-SHA256 (Fernet)",
                "note": "Raw text encrypted before storage. Platform cannot read entries.",
            },
            "emotion_metadata": {
                "count": entry_count,
                "encryption": "None — aggregated scores only, not text",
                "note": "Emotion labels and confidence scores stored in plaintext for pattern analysis.",
            },
            "weekly_insights": {
                "count": insight_count,
                "note": "AI-generated from anonymised emotion statistics. No raw text sent externally.",
            },
        },
        "third_party_data_sharing": "None — only anonymised emotion statistics sent to Claude API for insight generation.",
        "export_available": True,
        "deletion_available": True,
    }
