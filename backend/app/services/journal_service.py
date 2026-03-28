"""Journal entry business logic.

Handles creation, retrieval, update, and deletion of journal entries.
All content is encrypted/decrypted transparently using the user's salt.
"""

import logging
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.encryption import decrypt_content, encrypt_content
from app.models.journal import EmotionAnalysis, JournalEntry, WeeklyInsight
from app.models.user import User
from app.schemas.journal import JournalEntryCreate, JournalEntryUpdate

logger = logging.getLogger(__name__)


class EntryNotFoundError(Exception):
    """Raised when an entry does not exist or does not belong to the user."""


class JournalService:
    """Journal CRUD service scoped to a single DB session."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create_entry(self, user: User, payload: JournalEntryCreate) -> JournalEntry:
        """Encrypt and persist a new journal entry.

        A pending EmotionAnalysis record is created alongside the entry so
        the Celery worker can pick it up without a second DB query.

        Args:
            user: Authenticated user creating the entry.
            payload: Validated entry content and optional date.

        Returns:
            Newly created JournalEntry with a pending EmotionAnalysis.
        """
        entry_date = payload.entry_date or date.today()
        encrypted = encrypt_content(payload.content, user.encryption_salt)
        word_count = len(payload.content.split())

        entry = JournalEntry(
            id=uuid.uuid4(),
            user_id=user.id,
            encrypted_content=encrypted,
            word_count=word_count,
            entry_date=entry_date,
        )
        self._db.add(entry)
        await self._db.flush()  # Get entry.id

        # Create placeholder analysis record (worker fills it in)
        analysis = EmotionAnalysis(
            id=uuid.uuid4(),
            entry_id=entry.id,
            primary_emotion="pending",
            primary_confidence=0.0,
            emotion_scores={},
            sentiment_label="pending",
            sentiment_score=0.0,
            themes=[],
            analysis_status="pending",
        )
        self._db.add(analysis)
        await self._db.flush()

        logger.info(f"Created journal entry {entry.id} for user {user.id}")
        return entry

    async def get_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> JournalEntry:
        """Fetch a single entry belonging to the user.

        Args:
            entry_id: UUID of the entry.
            user_id: Requesting user's UUID (ownership check).

        Returns:
            JournalEntry with emotion relationship loaded.

        Raises:
            EntryNotFoundError: If entry doesn't exist or isn't owned by user.
        """
        result = await self._db.execute(
            select(JournalEntry)
            .options(selectinload(JournalEntry.emotion))
            .where(JournalEntry.id == entry_id)
            .where(JournalEntry.user_id == user_id)
            .where(JournalEntry.is_deleted == False)  # noqa: E712
        )
        entry = result.scalar_one_or_none()
        if not entry:
            raise EntryNotFoundError(f"Entry {entry_id} not found.")
        return entry

    async def list_entries(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[JournalEntry], int]:
        """List entries for a user, newest first, with pagination.

        Args:
            user_id: User whose entries to list.
            page: 1-indexed page number.
            page_size: Entries per page (max 100).

        Returns:
            Tuple of (entries, total_count).
        """
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        count_result = await self._db.execute(
            select(func.count(JournalEntry.id))
            .where(JournalEntry.user_id == user_id)
            .where(JournalEntry.is_deleted == False)  # noqa: E712
        )
        total = count_result.scalar_one()

        entries_result = await self._db.execute(
            select(JournalEntry)
            .options(selectinload(JournalEntry.emotion))
            .where(JournalEntry.user_id == user_id)
            .where(JournalEntry.is_deleted == False)  # noqa: E712
            .order_by(desc(JournalEntry.entry_date), desc(JournalEntry.created_at))
            .offset(offset)
            .limit(page_size)
        )
        return list(entries_result.scalars().all()), total

    async def update_entry(
        self,
        entry_id: uuid.UUID,
        user: User,
        payload: JournalEntryUpdate,
    ) -> JournalEntry:
        """Update the encrypted content of an existing entry.

        Re-running analysis is triggered by resetting the emotion status to pending.

        Args:
            entry_id: UUID of the entry to update.
            user: Authenticated user (ownership check).
            payload: Updated content.

        Returns:
            Updated JournalEntry.

        Raises:
            EntryNotFoundError: If entry not found or not owned.
        """
        entry = await self.get_entry(entry_id, user.id)
        entry.encrypted_content = encrypt_content(payload.content, user.encryption_salt)
        entry.word_count = len(payload.content.split())

        if entry.emotion:
            entry.emotion.analysis_status = "pending"
            entry.emotion.primary_emotion = "pending"

        await self._db.flush()
        logger.info(f"Updated journal entry {entry_id}")
        return entry

    async def delete_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Soft-delete a journal entry.

        Args:
            entry_id: UUID of the entry to delete.
            user_id: Requesting user (ownership check).

        Raises:
            EntryNotFoundError: If entry not found or not owned.
        """
        entry = await self.get_entry(entry_id, user_id)
        entry.is_deleted = True
        await self._db.flush()
        logger.info(f"Soft-deleted journal entry {entry_id}")

    def decrypt_entry(self, entry: JournalEntry, user: User) -> str:
        """Decrypt a journal entry's content for the owning user.

        Args:
            entry: The encrypted JournalEntry.
            user: Owning user (provides the encryption salt).

        Returns:
            Plaintext journal content.
        """
        return decrypt_content(entry.encrypted_content, user.encryption_salt)

    async def correct_emotion(
        self,
        entry_id: uuid.UUID,
        user_id: uuid.UUID,
        corrected_emotion: str,
    ) -> EmotionAnalysis:
        """Apply a user's manual emotion correction.

        Args:
            entry_id: UUID of the journal entry.
            user_id: Requesting user (ownership check).
            corrected_emotion: Validated emotion label.

        Returns:
            Updated EmotionAnalysis.

        Raises:
            EntryNotFoundError: If entry not found.
        """
        entry = await self.get_entry(entry_id, user_id)
        if not entry.emotion:
            raise EntryNotFoundError("No emotion analysis exists for this entry.")

        entry.emotion.is_user_corrected = True
        entry.emotion.user_corrected_emotion = corrected_emotion
        await self._db.flush()
        logger.info(f"User {user_id} corrected emotion for entry {entry_id}: {corrected_emotion}")
        return entry.emotion

    async def get_streak(self, user_id: uuid.UUID) -> dict:
        """Count consecutive days with at least one entry, ending today."""
        from datetime import timedelta
        result = await self._db.execute(
            select(JournalEntry.entry_date)
            .where(JournalEntry.user_id == user_id)
            .where(JournalEntry.is_deleted == False)  # noqa: E712
            .distinct()
            .order_by(desc(JournalEntry.entry_date))
        )
        days = {row[0] for row in result.all()}

        streak = 0
        check = date.today()
        while check in days:
            streak += 1
            check -= timedelta(days=1)

        # If today has no entry yet, check if yesterday starts a streak
        if streak == 0:
            check = date.today() - timedelta(days=1)
            while check in days:
                streak += 1
                check -= timedelta(days=1)

        return {"streak": streak, "total_days": len(days)}

    async def get_insights(
        self, user_id: uuid.UUID, limit: int = 10, insight_type: str = "weekly"
    ) -> list[WeeklyInsight]:
        """Fetch the most recent insights for a user.

        Pass insight_type="all" to return every type sorted by date.
        """
        q = select(WeeklyInsight).where(WeeklyInsight.user_id == user_id)
        if insight_type != "all":
            q = q.where(WeeklyInsight.insight_type == insight_type)
        q = q.order_by(desc(WeeklyInsight.generated_at)).limit(limit)
        result = await self._db.execute(q)
        return list(result.scalars().all())

    async def submit_insight_feedback(
        self, insight_id: uuid.UUID, user_id: uuid.UUID, feedback: int
    ) -> WeeklyInsight:
        """Record user feedback (thumbs up/down) on a weekly insight.

        Args:
            insight_id: UUID of the insight.
            user_id: Requesting user (ownership check).
            feedback: 1 or -1.

        Returns:
            Updated WeeklyInsight.

        Raises:
            EntryNotFoundError: If insight not found.
        """
        result = await self._db.execute(
            select(WeeklyInsight)
            .where(WeeklyInsight.id == insight_id)
            .where(WeeklyInsight.user_id == user_id)
        )
        insight = result.scalar_one_or_none()
        if not insight:
            raise EntryNotFoundError("Insight not found.")
        insight.user_feedback = feedback
        await self._db.flush()
        return insight
