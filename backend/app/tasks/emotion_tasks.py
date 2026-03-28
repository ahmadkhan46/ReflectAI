"""Celery tasks for emotion analysis.

These tasks run in the Celery worker process, which has access to the
HuggingFace models (loaded once per worker via lazy initialisation).
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select

from app.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.journal import EmotionAnalysis, JournalEntry
from app.models.user import User
from app.services.emotion_service import EmotionServiceError, analyze_emotion
from app.core.encryption import decrypt_content

logger = logging.getLogger(__name__)


@celery_app.task(
    name="emotion_tasks.analyze_journal_entry",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def analyze_journal_entry(self, entry_id: str) -> dict:  # type: ignore[misc]
    """Analyse the emotion content of a journal entry.

    Fetches the entry, decrypts it, runs the ML pipeline, and stores
    results back in the EmotionAnalysis record.

    Args:
        entry_id: UUID string of the JournalEntry to analyse.

    Returns:
        Dict with status and primary_emotion on success.
    """
    return asyncio.run(_analyze_journal_entry_async(entry_id))


async def _analyze_journal_entry_async(entry_id: str) -> dict:
    """Async implementation of emotion analysis task."""
    async with AsyncSessionLocal() as db:
        try:
            uid = uuid.UUID(entry_id)
        except ValueError:
            logger.error(f"Invalid entry_id: {entry_id}")
            return {"status": "failed", "error": "Invalid UUID"}

        # Fetch entry + user (need encryption salt)
        result = await db.execute(
            select(JournalEntry).where(JournalEntry.id == uid)
        )
        entry = result.scalar_one_or_none()
        if not entry:
            logger.error(f"Entry {entry_id} not found")
            return {"status": "failed", "error": "Entry not found"}

        user_result = await db.execute(
            select(User).where(User.id == entry.user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            logger.error(f"User not found for entry {entry_id}")
            return {"status": "failed", "error": "User not found"}

        # Fetch analysis record
        analysis_result = await db.execute(
            select(EmotionAnalysis).where(EmotionAnalysis.entry_id == uid)
        )
        analysis = analysis_result.scalar_one_or_none()
        if not analysis:
            logger.error(f"No EmotionAnalysis record for entry {entry_id}")
            return {"status": "failed", "error": "Analysis record missing"}

        try:
            # Decrypt and analyse
            plaintext = decrypt_content(entry.encrypted_content, user.encryption_salt)
            emotion_result = analyze_emotion(plaintext)

            # Persist results
            analysis.primary_emotion = emotion_result.primary_emotion
            analysis.primary_confidence = emotion_result.primary_confidence
            analysis.emotion_scores = emotion_result.emotion_scores
            analysis.sentiment_label = emotion_result.sentiment_label
            analysis.sentiment_score = emotion_result.sentiment_score
            analysis.themes = emotion_result.themes
            analysis.analysis_status = "completed"
            analysis.analyzed_at = datetime.now(timezone.utc)

            await db.commit()
            logger.info(f"Emotion analysis complete for entry {entry_id}: {emotion_result.primary_emotion}")
            return {"status": "completed", "primary_emotion": emotion_result.primary_emotion}

        except EmotionServiceError as exc:
            # ML models unavailable (e.g. transformers not installed) — use neutral defaults
            # so entries still count toward insights rather than blocking generation
            logger.warning(f"ML model unavailable for entry {entry_id}, falling back to neutral: {exc}")
            analysis.primary_emotion = "neutral"
            analysis.primary_confidence = 0.5
            analysis.emotion_scores = {}
            analysis.sentiment_label = "neutral"
            analysis.sentiment_score = 0.5
            analysis.themes = []
            analysis.analysis_status = "completed"
            analysis.analyzed_at = datetime.now(timezone.utc)
            await db.commit()
            return {"status": "completed", "primary_emotion": "neutral", "fallback": True}
        except Exception as exc:
            analysis.analysis_status = "failed"
            await db.commit()
            logger.error(f"Unexpected error analysing entry {entry_id}: {exc}", exc_info=True)
            return {"status": "failed", "error": "Unexpected error"}
