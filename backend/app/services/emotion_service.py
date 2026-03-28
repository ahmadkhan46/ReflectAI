"""Local HuggingFace emotion and sentiment analysis service.

Models used (all run locally — no external API calls for user content):
- Primary emotion: j-hartmann/emotion-english-distilroberta-base (7 classes, ~500 MB)
- Sentiment:       cardiffnlp/twitter-roberta-base-sentiment-latest (~500 MB)
- Themes:          MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli (~450 MB)
                   Replaces facebook/bart-large-mnli (1.6 GB) — same API, 3× smaller, more accurate

Models are lazy-loaded on first use and cached in module-level variables
to avoid reloading on every request.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

# Predefined theme candidates for zero-shot classification
THEME_CANDIDATES = [
    "work and career",
    "relationships and social life",
    "health and wellbeing",
    "anxiety and stress",
    "family",
    "personal growth",
    "finances",
    "loneliness",
    "sleep and fatigue",
    "grief and loss",
    "motivation and goals",
    "happiness and gratitude",
]

# Confidence threshold for including a theme
THEME_THRESHOLD = 0.40

# Module-level model cache
_emotion_pipeline: Any = None
_sentiment_pipeline: Any = None
_zero_shot_pipeline: Any = None


class EmotionServiceError(Exception):
    """Raised when an ML model call fails."""


@dataclass
class EmotionResult:
    """Structured result from the full emotion analysis pipeline."""

    primary_emotion: str
    primary_confidence: float
    emotion_scores: dict[str, float]
    sentiment_label: str
    sentiment_score: float
    themes: list[str]


def _get_emotion_pipeline() -> Any:
    """Lazy-load and cache the emotion classification pipeline."""
    global _emotion_pipeline
    if _emotion_pipeline is None:
        try:
            from transformers import pipeline  # type: ignore[import]
            logger.info("Loading emotion model: j-hartmann/emotion-english-distilroberta-base")
            _emotion_pipeline = pipeline(
                "text-classification",
                model="j-hartmann/emotion-english-distilroberta-base",
                top_k=None,  # Return all labels
                device=-1,   # CPU
            )
            logger.info("Emotion model loaded successfully")
        except Exception as exc:
            logger.error(f"Failed to load emotion model: {exc}")
            raise EmotionServiceError("Emotion model unavailable.") from exc
    return _emotion_pipeline


def _get_sentiment_pipeline() -> Any:
    """Lazy-load and cache the sentiment classification pipeline."""
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        try:
            from transformers import pipeline  # type: ignore[import]
            logger.info("Loading sentiment model: cardiffnlp/twitter-roberta-base-sentiment-latest")
            _sentiment_pipeline = pipeline(
                "text-classification",
                model="cardiffnlp/twitter-roberta-base-sentiment-latest",
                device=-1,
            )
            logger.info("Sentiment model loaded successfully")
        except Exception as exc:
            logger.error(f"Failed to load sentiment model: {exc}")
            raise EmotionServiceError("Sentiment model unavailable.") from exc
    return _sentiment_pipeline


def _get_zero_shot_pipeline() -> Any:
    """Lazy-load and cache the zero-shot classification pipeline.

    Uses DeBERTa-v3-base-mnli (~450 MB) instead of bart-large-mnli (1.6 GB).
    Same zero-shot API, 3× smaller, more accurate on NLI benchmarks.
    Falls back to bart-large-mnli if DeBERTa is not yet downloaded.
    """
    global _zero_shot_pipeline
    if _zero_shot_pipeline is None:
        try:
            from transformers import pipeline  # type: ignore[import]
            model_id = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"
            logger.info(f"Loading zero-shot model: {model_id}")
            _zero_shot_pipeline = pipeline(
                "zero-shot-classification",
                model=model_id,
                device=-1,
            )
            logger.info("Zero-shot model loaded successfully")
        except Exception as exc:
            logger.error(f"Failed to load zero-shot model: {exc}")
            raise EmotionServiceError("Theme model unavailable.") from exc
    return _zero_shot_pipeline


def _truncate_text(text: str, max_tokens: int = 500) -> str:
    """Truncate text by word count to stay within model token limits.

    Args:
        text: Input text.
        max_tokens: Approximate word limit.

    Returns:
        Truncated text string.
    """
    words = text.split()
    if len(words) > max_tokens:
        return " ".join(words[:max_tokens])
    return text


def analyze_emotion(text: str) -> EmotionResult:
    """Run the full emotion analysis pipeline on a journal entry.

    Executes three models synchronously (intended for Celery worker context):
    1. Emotion classification (7 classes)
    2. Sentiment analysis (positive / neutral / negative)
    3. Zero-shot theme extraction

    Args:
        text: Decrypted journal entry plaintext.

    Returns:
        EmotionResult with all analysis fields populated.

    Raises:
        EmotionServiceError: If any model call fails critically.
    """
    truncated = _truncate_text(text)

    # ── 1. Emotion classification ────────────────────────────────────────────
    try:
        emotion_pipe = _get_emotion_pipeline()
        raw_emotions: list[list[dict[str, Any]]] = emotion_pipe(truncated)
        # top_k=None returns [[{label, score}, ...]]
        emotion_list: list[dict[str, Any]] = raw_emotions[0] if raw_emotions else []
        emotion_scores = {item["label"].lower(): round(item["score"], 4) for item in emotion_list}
        primary = max(emotion_list, key=lambda x: x["score"])
        primary_emotion = primary["label"].lower()
        primary_confidence = round(primary["score"], 4)
    except EmotionServiceError:
        raise
    except Exception as exc:
        logger.error(f"Emotion classification failed: {exc}")
        raise EmotionServiceError("Emotion classification failed.") from exc

    # ── 2. Sentiment analysis ────────────────────────────────────────────────
    try:
        sentiment_pipe = _get_sentiment_pipeline()
        sentiment_result = sentiment_pipe(truncated)[0]
        raw_label: str = sentiment_result["label"].lower()
        # Normalise labels: "positive" / "neutral" / "negative"
        sentiment_map = {"positive": "positive", "neutral": "neutral", "negative": "negative",
                         "label_0": "negative", "label_1": "neutral", "label_2": "positive"}
        sentiment_label = sentiment_map.get(raw_label, raw_label)
        sentiment_score = round(sentiment_result["score"], 4)
    except EmotionServiceError:
        raise
    except Exception as exc:
        logger.error(f"Sentiment analysis failed: {exc}")
        raise EmotionServiceError("Sentiment analysis failed.") from exc

    # ── 3. Theme extraction (zero-shot) ──────────────────────────────────────
    themes: list[str] = []
    try:
        zs_pipe = _get_zero_shot_pipeline()
        zs_result = zs_pipe(truncated, candidate_labels=THEME_CANDIDATES, multi_label=True)
        themes = [
            label
            for label, score in zip(zs_result["labels"], zs_result["scores"])
            if score >= THEME_THRESHOLD
        ]
    except Exception as exc:
        # Theme extraction failure is non-fatal
        logger.warning(f"Theme extraction failed (non-fatal): {exc}")

    return EmotionResult(
        primary_emotion=primary_emotion,
        primary_confidence=primary_confidence,
        emotion_scores=emotion_scores,
        sentiment_label=sentiment_label,
        sentiment_score=sentiment_score,
        themes=themes,
    )
