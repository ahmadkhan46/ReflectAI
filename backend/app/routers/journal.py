"""Journal entry API endpoints.

Endpoints: create, list, get, update, delete, correct emotion, insights, feedback.
All content is encrypted/decrypted transparently — the API always returns plaintext
to the authenticated owner, but stores only ciphertext.
"""

import logging
import uuid
from datetime import date as _date, datetime as _dt, timezone as _tz

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select as _select, desc

from app.core.encryption import encrypt_content
from app.dependencies import CurrentUser, DB
from app.models.journal import MoodCheckin
from app.schemas.journal import (
    EmotionCorrectionRequest,
    InsightFeedbackRequest,
    JournalEntryCreate,
    JournalEntryListResponse,
    JournalEntryResponse,
    JournalEntryUpdate,
    MoodCheckinCreate,
    MoodCheckinResponse,
    WeeklyInsightResponse,
)
from app.services.journal_service import EntryNotFoundError, JournalService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/journal", tags=["journal"])


@router.post(
    "/entries",
    response_model=JournalEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new journal entry",
)
async def create_entry(
    payload: JournalEntryCreate,
    current_user: CurrentUser,
    db: DB,
) -> JournalEntryResponse:
    """Create a new encrypted journal entry and queue emotion analysis.

    Args:
        payload: Journal content (10–10,000 chars) and optional date.
        current_user: Authenticated user.
        db: Database session.

    Returns:
        Created entry with pending emotion analysis.

    Raises:
        HTTPException 422: Validation failure.
        HTTPException 500: Encryption or database failure.
    """
    logger.info(f"User {current_user.id} creating journal entry")
    service = JournalService(db)

    try:
        entry = await service.create_entry(current_user, payload)
    except Exception as exc:
        logger.error(f"Failed to create journal entry: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create journal entry.",
        )

    # Queue async emotion analysis (non-blocking)
    try:
        from app.tasks.emotion_tasks import analyze_journal_entry
        analyze_journal_entry.delay(str(entry.id))
        logger.info(f"Queued emotion analysis for entry {entry.id}")
    except Exception as exc:
        # Analysis failure is non-fatal — entry is saved regardless
        logger.warning(f"Failed to queue emotion analysis: {exc}")

    # Reload with emotion relationship
    entry_with_emotion = await service.get_entry(entry.id, current_user.id)
    decrypted = service.decrypt_entry(entry_with_emotion, current_user)

    return JournalEntryResponse(
        id=entry_with_emotion.id,
        user_id=entry_with_emotion.user_id,
        content=decrypted,
        word_count=entry_with_emotion.word_count,
        entry_date=entry_with_emotion.entry_date,
        created_at=entry_with_emotion.created_at,
        updated_at=entry_with_emotion.updated_at,
        emotion=entry_with_emotion.emotion,  # type: ignore[arg-type]
    )


@router.get(
    "/entries",
    response_model=JournalEntryListResponse,
    summary="List journal entries (paginated)",
)
async def list_entries(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> JournalEntryListResponse:
    """Return a paginated list of journal entries (without content for bandwidth).

    Args:
        current_user: Authenticated user.
        db: Database session.
        page: Page number (1-indexed).
        page_size: Results per page (max 100).

    Returns:
        Paginated list with emotion metadata but without decrypted content.
    """
    service = JournalService(db)
    entries, total = await service.list_entries(current_user.id, page, page_size)

    return JournalEntryListResponse(
        entries=entries,  # type: ignore[arg-type]
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/streak",
    response_model=dict,
    summary="Get current check-in streak",
)
async def get_streak(
    current_user: CurrentUser,
    db: DB,
) -> dict:
    """Return the user's current consecutive-day streak and total active days."""
    service = JournalService(db)
    return await service.get_streak(current_user.id)


@router.get(
    "/entries/{entry_id}/similar",
    response_model=list[dict],
    summary="Find semantically similar journal entries",
)
async def get_similar_entries(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(3, ge=1, le=5),
) -> list[dict]:
    """Return up to `limit` journal entries most similar to the given entry.

    Uses sentence-transformers/all-MiniLM-L6-v2 locally — raw text never
    leaves the server. Returns an empty list if the model is unavailable or
    fewer than 2 entries exist.
    """
    from app.services.similarity_service import find_similar, SimilarityServiceError

    service = JournalService(db)

    # Load the query entry first
    try:
        query_entry = await service.get_entry(entry_id, current_user.id)
    except EntryNotFoundError:
        raise HTTPException(status_code=404, detail="Entry not found.")

    # Load the user's recent entries (up to 30 for performance)
    entries, _ = await service.list_entries(current_user.id, page=1, page_size=30)

    if len(entries) < 2:
        return []

    # Decrypt all entries for similarity computation
    texts_by_id: dict[str, str] = {}
    for e in entries:
        try:
            full = await service.get_entry(e.id, current_user.id)
            texts_by_id[str(e.id)] = service.decrypt_entry(full, current_user)
        except Exception:
            continue  # skip entries that fail to decrypt

    query_text = service.decrypt_entry(query_entry, current_user)
    texts_by_id[str(entry_id)] = query_text

    try:
        similar = find_similar(texts_by_id, str(entry_id), top_n=limit)
    except SimilarityServiceError:
        logger.warning("Similarity model unavailable — returning empty list")
        return []

    # Build list response from the list items we already have
    entry_map = {str(e.id): e for e in entries}
    result = []
    for sid, score in similar:
        e = entry_map.get(sid)
        if e:
            result.append({
                "id": str(e.id),
                "entry_date": str(e.entry_date),
                "word_count": e.word_count,
                "similarity": round(score, 3),
                "primary_emotion": e.emotion.primary_emotion if e.emotion else None,
            })
    return result


@router.get(
    "/entries/{entry_id}",
    response_model=JournalEntryResponse,
    summary="Get a single journal entry with decrypted content",
)
async def get_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> JournalEntryResponse:
    """Fetch and decrypt a single journal entry.

    Args:
        entry_id: UUID of the entry.
        current_user: Authenticated user (ownership enforced).
        db: Database session.

    Returns:
        Decrypted entry with emotion analysis.

    Raises:
        HTTPException 404: Entry not found or not owned by user.
    """
    service = JournalService(db)
    try:
        entry = await service.get_entry(entry_id, current_user.id)
    except EntryNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found.")

    decrypted = service.decrypt_entry(entry, current_user)

    return JournalEntryResponse(
        id=entry.id,
        user_id=entry.user_id,
        content=decrypted,
        word_count=entry.word_count,
        entry_date=entry.entry_date,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        emotion=entry.emotion,  # type: ignore[arg-type]
    )


@router.post(
    "/entries/{entry_id}/reflect",
    response_model=dict,
    summary="Get an instant AI reflection on a single entry",
)
async def reflect_on_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> dict:
    """Generate an immediate 2-3 sentence AI reflection after saving an entry.

    Privacy guarantee: raw text is never sent to the AI — only emotion stats.
    The emotion analysis is run synchronously inline if not yet completed.
    """
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    from app.services.emotion_service import analyze_emotion, EmotionServiceError
    from app.services.insight_service import settings as insight_settings, SYSTEM_PROMPT

    service = JournalService(db)
    try:
        entry = await service.get_entry(entry_id, current_user.id)
    except EntryNotFoundError:
        raise HTTPException(status_code=404, detail="Entry not found.")

    # Decrypt the text (stays on server — never sent to AI)
    text = service.decrypt_entry(entry, current_user)

    # Use existing emotion analysis if complete, otherwise run inline
    emotion = entry.emotion
    if emotion and emotion.analysis_status == "completed":
        primary = emotion.primary_emotion
        confidence = emotion.primary_confidence
        sentiment = emotion.sentiment_label
        themes = emotion.themes or []
    else:
        try:
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as pool:
                result = await loop.run_in_executor(pool, analyze_emotion, text)
            primary = result.primary_emotion
            confidence = result.primary_confidence
            sentiment = result.sentiment_label
            themes = result.themes
        except EmotionServiceError:
            # Fallback: reflect without emotion data
            primary, confidence, sentiment, themes = "neutral", 0.5, "neutral", []

    # Build privacy-safe prompt — NO raw text included
    word_count = entry.word_count
    themes_str = ", ".join(themes[:3]) if themes else "general reflection"
    prompt = (
        f"Someone just wrote a journal entry ({word_count} words).\n"
        f"Detected emotion: {primary} (confidence: {confidence:.0%})\n"
        f"Sentiment: {sentiment}\n"
        f"Themes detected: {themes_str}\n\n"
        f"Write a warm, personal 2-3 sentence reflection — like a thoughtful friend "
        f"acknowledging what they might be feeling. Be gentle and non-prescriptive. "
        f"Do NOT use the words 'detected' or 'analysis'. Speak directly to them."
    )

    reflection = ""
    if insight_settings.openai_api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=insight_settings.openai_api_key)
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=150,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            )
            reflection = resp.choices[0].message.content or ""
        except Exception as exc:
            logger.warning(f"Reflection API call failed: {exc}")
    elif insight_settings.anthropic_api_key:
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=insight_settings.anthropic_api_key)
            msg = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=150,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            reflection = msg.content[0].text
        except Exception as exc:
            logger.warning(f"Reflection API call failed: {exc}")

    return {
        "reflection": reflection,
        "emotion": primary,
        "sentiment": sentiment,
        "themes": themes,
    }


@router.put(
    "/entries/{entry_id}",
    response_model=JournalEntryResponse,
    summary="Update a journal entry",
)
async def update_entry(
    entry_id: uuid.UUID,
    payload: JournalEntryUpdate,
    current_user: CurrentUser,
    db: DB,
) -> JournalEntryResponse:
    """Update the content of an existing journal entry.

    Re-queues emotion analysis with the updated content.

    Args:
        entry_id: UUID of the entry to update.
        payload: New content.
        current_user: Authenticated user (ownership enforced).
        db: Database session.

    Returns:
        Updated decrypted entry.

    Raises:
        HTTPException 404: Entry not found.
    """
    service = JournalService(db)
    try:
        entry = await service.update_entry(entry_id, current_user, payload)
    except EntryNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found.")

    # Re-queue analysis on update
    try:
        from app.tasks.emotion_tasks import analyze_journal_entry
        analyze_journal_entry.delay(str(entry.id))
    except Exception as exc:
        logger.warning(f"Failed to re-queue emotion analysis after update: {exc}")

    entry = await service.get_entry(entry_id, current_user.id)
    decrypted = service.decrypt_entry(entry, current_user)

    return JournalEntryResponse(
        id=entry.id,
        user_id=entry.user_id,
        content=decrypted,
        word_count=entry.word_count,
        entry_date=entry.entry_date,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        emotion=entry.emotion,  # type: ignore[arg-type]
    )


@router.delete(
    "/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a journal entry",
)
async def delete_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> None:
    """Soft-delete a journal entry.

    Args:
        entry_id: UUID of the entry to delete.
        current_user: Authenticated user (ownership enforced).
        db: Database session.

    Raises:
        HTTPException 404: Entry not found.
    """
    service = JournalService(db)
    try:
        await service.delete_entry(entry_id, current_user.id)
    except EntryNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found.")


@router.patch(
    "/entries/{entry_id}/emotion",
    response_model=dict,
    summary="Correct the detected emotion for an entry",
)
async def correct_emotion(
    entry_id: uuid.UUID,
    payload: EmotionCorrectionRequest,
    current_user: CurrentUser,
    db: DB,
) -> dict:
    """Allow the user to override the AI-detected primary emotion.

    This correction is stored for research purposes and displayed in the UI.

    Args:
        entry_id: UUID of the journal entry.
        payload: Corrected emotion label.
        current_user: Authenticated user.
        db: Database session.

    Returns:
        Confirmation dict with updated emotion.

    Raises:
        HTTPException 404: Entry not found.
    """
    service = JournalService(db)
    try:
        analysis = await service.correct_emotion(
            entry_id, current_user.id, payload.corrected_emotion
        )
    except EntryNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found.")

    return {
        "message": "Emotion corrected successfully.",
        "corrected_emotion": analysis.user_corrected_emotion,
    }


@router.post(
    "/checkins",
    response_model=MoodCheckinResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a mood check-in",
)
async def create_checkin(
    payload: MoodCheckinCreate,
    current_user: CurrentUser,
    db: DB,
) -> MoodCheckinResponse:
    """Save a structured mood check-in with optional encrypted note."""
    note_encrypted = None
    if payload.note:
        note_encrypted = encrypt_content(payload.note, current_user.encryption_salt)

    checkin = MoodCheckin(
        id=uuid.uuid4(),
        user_id=current_user.id,
        mood_score=payload.mood_score,
        energy_level=payload.energy_level,
        sleep_quality=payload.sleep_quality,
        stress_level=payload.stress_level,
        note_encrypted=note_encrypted,
        checkin_date=_date.today(),
        created_at=_dt.now(_tz.utc),
    )
    db.add(checkin)
    await db.flush()
    await db.refresh(checkin)
    return checkin  # type: ignore[return-value]


@router.get(
    "/checkins",
    response_model=list[MoodCheckinResponse],
    summary="List recent mood check-ins",
)
async def list_checkins(
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(30, ge=1, le=366),
    month: str | None = Query(None, description="Filter by month YYYY-MM"),
) -> list[MoodCheckinResponse]:
    """Return the user's mood check-ins, optionally filtered to a specific calendar month."""
    import calendar as _calendar
    from datetime import date as _date_t

    stmt = _select(MoodCheckin).where(MoodCheckin.user_id == current_user.id)

    if month:
        try:
            year, m = map(int, month.split("-", 1))
            _, last_day = _calendar.monthrange(year, m)
            stmt = stmt.where(MoodCheckin.checkin_date >= _date_t(year, m, 1))
            stmt = stmt.where(MoodCheckin.checkin_date <= _date_t(year, m, last_day))
        except (ValueError, AttributeError):
            pass  # ignore malformed month param

    result = await db.execute(
        stmt.order_by(desc(MoodCheckin.created_at)).limit(limit)
    )
    return list(result.scalars().all())  # type: ignore[return-value]


@router.get(
    "/insights",
    response_model=list[WeeklyInsightResponse],
    summary="Get AI insights filtered by type",
)
async def get_insights(
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(10, ge=1, le=200),
    insight_type_param: str = Query("weekly", alias="type", description="daily | weekly | monthly | yearly | all"),
) -> list[WeeklyInsightResponse]:
    """Return the user's most recent AI-generated insights for the given type.

    Pass type=all to return every type sorted by date (for the history page).
    """
    service = JournalService(db)
    try:
        insights = await service.get_insights(current_user.id, limit, insight_type=insight_type_param)
        return insights  # type: ignore[return-value]
    except Exception as exc:
        logger.error(f"Unexpected error fetching insights: {exc}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not fetch insights. Please try again.")


@router.post(
    "/insights/generate",
    response_model=WeeklyInsightResponse,
    summary="Generate an insight on demand",
)
async def generate_insight_now(
    current_user: CurrentUser,
    db: DB,
    insight_type_param: str = Query("weekly", alias="type", description="daily | weekly | monthly | yearly"),
) -> WeeklyInsightResponse:
    """Trigger insight generation for the given type.

    Requires at least 1 journal entry OR mood check-in in the period.
    """
    from app.services.insight_service import InsightGenerationError, generate_insight_with_backfill

    valid = {"daily", "weekly", "monthly", "yearly"}
    if insight_type_param not in valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"type must be one of: {', '.join(sorted(valid))}",
        )

    try:
        # Backfills missed past periods automatically, then generates current period
        insight = await generate_insight_with_backfill(db, current_user, insight_type=insight_type_param)  # type: ignore[arg-type]
    except InsightGenerationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error(f"Unexpected error generating insight: {exc}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate insight. Please try again.")

    if insight is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No data for this {insight_type_param}. Complete a check-in or write an entry first.",
        )

    return insight  # type: ignore[return-value]


@router.post(
    "/insights/{insight_id}/feedback",
    response_model=dict,
    summary="Submit feedback on a weekly insight",
)
async def submit_insight_feedback(
    insight_id: uuid.UUID,
    payload: InsightFeedbackRequest,
    current_user: CurrentUser,
    db: DB,
) -> dict:
    """Record user feedback (thumbs up / down) on a weekly insight.

    Args:
        insight_id: UUID of the insight.
        payload: Feedback value (1 or -1).
        current_user: Authenticated user.
        db: Database session.

    Returns:
        Confirmation message.

    Raises:
        HTTPException 404: Insight not found.
    """
    service = JournalService(db)
    try:
        await service.submit_insight_feedback(insight_id, current_user.id, payload.feedback)
    except EntryNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insight not found.")

    return {"message": "Feedback recorded. Thank you!"}
