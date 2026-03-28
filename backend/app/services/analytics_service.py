"""Local analytics service — zero external API calls.

Computes wellness score, day-of-week mood patterns, cross-metric correlations,
and emotional trends entirely from the user's own check-in and journal data.
"""

from __future__ import annotations

import logging
import math
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Any

from app.models.journal import JournalEntry, MoodCheckin

logger = logging.getLogger(__name__)

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _safe_avg(values: list[float | int]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


def _corrcoef(x: list[float], y: list[float]) -> float | None:
    """Pearson r. Falls back to a pure-Python implementation if numpy is absent."""
    if len(x) < 5:
        return None
    try:
        import numpy as np  # numpy is a transitive dep of torch / transformers

        r = float(np.corrcoef(x, y)[0, 1])
        return None if math.isnan(r) else round(r, 3)
    except Exception:
        n = len(x)
        mx, my = sum(x) / n, sum(y) / n
        num = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
        dx = math.sqrt(sum((xi - mx) ** 2 for xi in x))
        dy = math.sqrt(sum((yi - my) ** 2 for yi in y))
        if dx == 0 or dy == 0:
            return None
        return round(num / (dx * dy), 3)


def _strength_label(r: float) -> str:
    a = abs(r)
    if a >= 0.7:
        return "strong"
    if a >= 0.4:
        return "moderate"
    return "weak"


def _correlation_description(factor: str, r: float) -> str:
    direction = "higher" if r > 0 else "lower"
    strength = _strength_label(r)
    opposite = "lower" if r > 0 else "higher"
    labels = {
        "sleep": ("Better sleep quality", "poorer sleep"),
        "energy": ("Higher energy levels", "lower energy"),
        "stress": ("Lower stress", "higher stress"),
    }
    good, bad = labels.get(factor, (factor.title(), f"low {factor}"))
    if factor == "stress":
        direction = "lower" if r < 0 else "higher"
        return f"{good} is {strength}ly linked to better mood ({bad} → worse mood)"
    return (
        f"{good} {strength}ly predicts better mood "
        f"({bad} → {opposite} mood scores)"
    )


# ── Wellness score ────────────────────────────────────────────────────────────

def wellness_score(checkins: list[MoodCheckin], days: int = 7) -> tuple[int, str]:
    """Return (score 0-100, trend 'improving'|'stable'|'declining').

    Weights: mood 40%, energy 25%, sleep 25%, stress 10% (inverted).
    Trend compares the last `days` against the prior `days` period.
    """
    def _score_batch(batch: list[MoodCheckin]) -> float | None:
        if not batch:
            return None
        mood = _safe_avg([c.mood_score for c in batch]) or 3
        energy_vals = [c.energy_level for c in batch if c.energy_level is not None]
        sleep_vals = [c.sleep_quality for c in batch if c.sleep_quality is not None]
        stress_vals = [c.stress_level for c in batch if c.stress_level is not None]
        energy = _safe_avg(energy_vals) or 3
        sleep = _safe_avg(sleep_vals) or 3
        stress = _safe_avg(stress_vals) or 3

        score = (
            (mood / 5) * 40
            + (energy / 5) * 25
            + (sleep / 5) * 25
            + ((5 - stress) / 4) * 10
        )
        return score

    today = date.today()
    recent_cutoff = today - timedelta(days=days - 1)
    prior_cutoff = today - timedelta(days=days * 2 - 1)

    recent = [c for c in checkins if c.checkin_date >= recent_cutoff]
    prior = [c for c in checkins if prior_cutoff <= c.checkin_date < recent_cutoff]

    recent_score = _score_batch(recent)
    prior_score = _score_batch(prior)

    if recent_score is None:
        return 0, "stable"

    score = min(100, max(0, round(recent_score)))

    if prior_score is None or abs(recent_score - prior_score) < 3:
        trend = "stable"
    elif recent_score > prior_score:
        trend = "improving"
    else:
        trend = "declining"

    return score, trend


def wellness_label(score: int) -> str:
    if score >= 80:
        return "Excellent"
    if score >= 65:
        return "Good"
    if score >= 45:
        return "Fair"
    return "Needs attention"


# ── Day-of-week patterns ──────────────────────────────────────────────────────

def day_of_week_patterns(checkins: list[MoodCheckin]) -> dict[str, dict[str, Any]]:
    """Return average mood (and count) grouped by day of week."""
    buckets: dict[str, list[int]] = defaultdict(list)
    for c in checkins:
        day_name = c.checkin_date.strftime("%A")
        buckets[day_name].append(c.mood_score)

    return {
        day: {
            "avg_mood": round(sum(scores) / len(scores), 2),
            "count": len(scores),
        }
        for day, scores in buckets.items()
        if scores
    }


# ── Correlations ─────────────────────────────────────────────────────────────

def compute_correlations(checkins: list[MoodCheckin]) -> list[dict[str, Any]]:
    """Compute Pearson correlation between mood and each other metric."""
    moods = [float(c.mood_score) for c in checkins]

    results = []
    for factor, getter in [
        ("sleep", lambda c: c.sleep_quality),
        ("energy", lambda c: c.energy_level),
        ("stress", lambda c: c.stress_level),
    ]:
        pairs = [(float(getter(c)), m) for c, m in zip(checkins, moods) if getter(c) is not None]
        if len(pairs) < 5:
            continue
        xs, ys = zip(*pairs)
        r = _corrcoef(list(xs), list(ys))
        if r is None:
            continue
        results.append({
            "factor": factor,
            "coefficient": r,
            "strength": _strength_label(r),
            "direction": "positive" if r > 0 else "negative",
            "description": _correlation_description(factor, r),
        })

    # Sort by absolute correlation strength
    results.sort(key=lambda x: abs(x["coefficient"]), reverse=True)
    return results


# ── Emotion trend ─────────────────────────────────────────────────────────────

def emotion_trend_by_month(
    entries: list[JournalEntry],
    checkins: list[MoodCheckin],
) -> list[dict[str, Any]]:
    """Return month-by-month dominant emotion and avg mood."""
    mood_by_month: dict[str, list[float]] = defaultdict(list)
    emotion_by_month: dict[str, list[str]] = defaultdict(list)

    for c in checkins:
        key = c.checkin_date.strftime("%Y-%m")
        mood_by_month[key].append(float(c.mood_score))

    for e in entries:
        if e.emotion and e.emotion.analysis_status == "completed" and e.emotion.primary_emotion:
            key = e.entry_date.strftime("%Y-%m")
            emotion_by_month[key].append(e.emotion.primary_emotion)

    all_months = sorted(set(mood_by_month) | set(emotion_by_month))
    result = []
    for month in all_months:
        moods = mood_by_month.get(month, [])
        emotions = emotion_by_month.get(month, [])
        dominant = Counter(emotions).most_common(1)[0][0] if emotions else None
        result.append({
            "month": month,
            "avg_mood": round(sum(moods) / len(moods), 2) if moods else None,
            "dominant_emotion": dominant,
            "entry_count": len(emotions),
            "checkin_count": len(moods),
        })
    return result


# ── Full analytics snapshot ────────────────────────────────────────────────────

def build_analytics(
    checkins: list[MoodCheckin],
    entries: list[JournalEntry],
) -> dict[str, Any]:
    """Assemble the complete analytics payload for one user."""
    score, trend = wellness_score(checkins)
    label = wellness_label(score)

    # Recent averages
    today = date.today()
    last_7 = [c for c in checkins if c.checkin_date >= today - timedelta(days=6)]
    last_30 = [c for c in checkins if c.checkin_date >= today - timedelta(days=29)]

    avg_mood_7d = _safe_avg([c.mood_score for c in last_7])
    avg_mood_30d = _safe_avg([c.mood_score for c in last_30])

    patterns = day_of_week_patterns(checkins)
    best_day = max(patterns, key=lambda d: patterns[d]["avg_mood"], default=None)
    worst_day = min(patterns, key=lambda d: patterns[d]["avg_mood"], default=None)
    if best_day == worst_day:
        best_day = worst_day = None

    correlations = compute_correlations(checkins)
    emotion_trend = emotion_trend_by_month(entries, checkins)

    return {
        "wellness_score": score,
        "wellness_trend": trend,
        "wellness_label": label,
        "avg_mood_7d": avg_mood_7d,
        "avg_mood_30d": avg_mood_30d,
        "total_checkins": len(checkins),
        "total_entries": len(entries),
        "day_patterns": patterns,
        "correlations": correlations,
        "best_day": best_day,
        "worst_day": worst_day,
        "emotion_trend": emotion_trend,
    }
