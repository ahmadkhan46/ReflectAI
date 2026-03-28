"""Journal entry and emotion analysis schemas."""

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


# ── Emotion schemas ─────────────────────────────────────────────────────────

class EmotionScores(BaseModel):
    """All 7 emotion probability scores from the j-hartmann model."""
    anger: float = 0.0
    disgust: float = 0.0
    fear: float = 0.0
    joy: float = 0.0
    neutral: float = 0.0
    sadness: float = 0.0
    surprise: float = 0.0


class EmotionAnalysisResponse(BaseModel):
    """Emotion analysis result returned with a journal entry."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    primary_emotion: str
    primary_confidence: float
    emotion_scores: dict[str, Any]
    sentiment_label: str
    sentiment_score: float
    themes: list[str]
    is_user_corrected: bool
    user_corrected_emotion: str | None
    analysis_status: str
    analyzed_at: datetime | None


class EmotionCorrectionRequest(BaseModel):
    """User override for detected primary emotion."""

    corrected_emotion: str = Field(
        ...,
        description="One of: anger, disgust, fear, joy, neutral, sadness, surprise",
    )

    @field_validator("corrected_emotion")
    @classmethod
    def validate_emotion(cls, v: str) -> str:
        valid = {"anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise"}
        if v.lower() not in valid:
            raise ValueError(f"Must be one of: {', '.join(sorted(valid))}")
        return v.lower()


# ── Journal entry schemas ────────────────────────────────────────────────────

class JournalEntryCreate(BaseModel):
    """Create a new journal entry."""

    content: str = Field(
        ...,
        min_length=1,
        max_length=10_000,
        description="Journal entry text (1–10,000 characters)",
    )
    entry_date: date | None = Field(
        None,
        description="Date for the entry (defaults to today if omitted)",
    )


class JournalEntryUpdate(BaseModel):
    """Update the content of an existing draft entry."""

    content: str = Field(..., min_length=1, max_length=10_000)


class JournalEntryResponse(BaseModel):
    """Full journal entry response — content is decrypted for the owner only."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    content: str  # Decrypted plaintext — never stored
    word_count: int
    entry_date: date
    created_at: datetime
    updated_at: datetime
    emotion: EmotionAnalysisResponse | None = None


class JournalEntryListItem(BaseModel):
    """Lightweight list item — omits content for bandwidth efficiency."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    word_count: int
    entry_date: date
    created_at: datetime
    emotion: EmotionAnalysisResponse | None = None


class JournalEntryListResponse(BaseModel):
    """Paginated journal entry list."""

    entries: list[JournalEntryListItem]
    total: int
    page: int
    page_size: int


# ── Mood check-in schemas ────────────────────────────────────────────────────

class MoodCheckinCreate(BaseModel):
    """Create a structured mood check-in."""

    mood_score: int = Field(..., ge=1, le=5, description="Overall mood 1 (rough) – 5 (great)")
    energy_level: int | None = Field(None, ge=1, le=5)
    sleep_quality: int | None = Field(None, ge=1, le=5)
    stress_level: int | None = Field(None, ge=1, le=5)
    note: str | None = Field(None, max_length=500)


class MoodCheckinResponse(BaseModel):
    """Mood check-in as returned by the API."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    mood_score: int
    energy_level: int | None
    sleep_quality: int | None
    stress_level: int | None
    checkin_date: date
    created_at: datetime


# ── Insight schemas ──────────────────────────────────────────────────────────

class WeeklyInsightResponse(BaseModel):
    """AI-generated insight (daily / weekly / monthly / yearly)."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    insight_type: str
    week_start: date
    week_end: date
    period_label: str | None
    insight_content: str
    emotion_summary: dict[str, Any]
    patterns_detected: list[Any]
    generated_at: datetime
    user_feedback: int | None


class InsightFeedbackRequest(BaseModel):
    """User thumbs up / down feedback on an insight."""

    feedback: int = Field(..., description="1 for thumbs up, -1 for thumbs down")

    @field_validator("feedback")
    @classmethod
    def validate_feedback(cls, v: int) -> int:
        if v not in (1, -1):
            raise ValueError("feedback must be 1 (thumbs up) or -1 (thumbs down)")
        return v
