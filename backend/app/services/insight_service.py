"""AI insight generation — daily, weekly, monthly, and yearly.

Privacy guarantee: raw journal text is NEVER sent to the AI.
Only aggregated, anonymised emotion statistics and check-in scores are included.
"""

from __future__ import annotations

import calendar
import logging
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.journal import JournalEntry, MoodCheckin, WeeklyInsight
from app.models.user import User

logger = logging.getLogger(__name__)
settings = get_settings()

InsightType = Literal["daily", "weekly", "monthly", "yearly"]

SYSTEM_PROMPT = """You are a compassionate emotional wellness assistant helping users understand their emotional patterns.

STRICT RULES:
1. You are NOT a therapist, psychologist, or medical professional.
2. NEVER diagnose, prescribe, or give medical advice.
3. NEVER tell users how they should feel.
4. Keep suggestions gentle, curious, and exploratory (e.g., "You might consider..." not "You must...").
5. If patterns suggest severe distress, ALWAYS include crisis resources.
6. Be warm, non-judgmental, and encouraging.
7. Focus on patterns and awareness, not prescriptions.
8. Keep insights concise: 150-250 words maximum.

CRISIS RESOURCES TO INCLUDE when appropriate:
- Samaritans (IE/UK): 116 123
- Crisis Text Line: Text HOME to 741741
- Emergency: 999 / 112"""

_MOOD_LABELS = {1: "rough", 2: "low", 3: "okay", 4: "good", 5: "great"}
_ENERGY_LABELS = {1: "drained", 2: "tired", 3: "moderate", 4: "good", 5: "energised"}
_SLEEP_LABELS = {1: "poor", 2: "restless", 3: "okay", 4: "good", 5: "great"}
_STRESS_LABELS = {1: "calm", 2: "mild", 3: "moderate", 4: "high", 5: "very stressed"}


class InsightGenerationError(Exception):
    """Raised when insight generation fails."""


def _period_bounds(insight_type: InsightType, ref: date) -> tuple[date, date, str]:
    """Return (period_start, period_end, human_label) for the given type."""
    if insight_type == "daily":
        return ref, ref, ref.strftime("%B %d, %Y")
    if insight_type == "weekly":
        start = ref - timedelta(days=ref.weekday())
        end = start + timedelta(days=6)
        return start, end, f"Week of {start.strftime('%b %d, %Y')}"
    if insight_type == "monthly":
        start = ref.replace(day=1)
        last_day = calendar.monthrange(ref.year, ref.month)[1]
        end = ref.replace(day=last_day)
        return start, end, ref.strftime("%B %Y")
    # yearly
    start = date(ref.year, 1, 1)
    end = date(ref.year, 12, 31)
    return start, end, str(ref.year)


async def generate_insight(
    db: AsyncSession,
    user: User,
    insight_type: InsightType = "weekly",
    ref_date: date | None = None,
) -> WeeklyInsight | None:
    """Generate an insight for the given type and period.

    Requires at least 1 journal entry OR mood check-in in the period.
    """
    if ref_date is None:
        ref_date = date.today()

    period_start, period_end, period_label = _period_bounds(insight_type, ref_date)

    # Fetch journal entries
    entry_result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.emotion))
        .where(
            and_(
                JournalEntry.user_id == user.id,
                JournalEntry.entry_date >= period_start,
                JournalEntry.entry_date <= period_end,
                JournalEntry.is_deleted == False,  # noqa: E712
            )
        )
    )
    entries = list(entry_result.scalars().all())
    completed_entries = [
        e for e in entries if e.emotion and e.emotion.analysis_status == "completed"
    ]

    # Fetch mood check-ins
    checkin_result = await db.execute(
        select(MoodCheckin).where(
            and_(
                MoodCheckin.user_id == user.id,
                MoodCheckin.checkin_date >= period_start,
                MoodCheckin.checkin_date <= period_end,
            )
        )
    )
    checkins = list(checkin_result.scalars().all())

    if not completed_entries and not checkins:
        logger.info(
            f"No data for {insight_type} insight for user {user.id} ({period_start})"
        )
        return None

    # Build anonymised summary
    summary_parts: list[str] = []
    emotion_summary: dict[str, Any] = {}
    patterns_detected: list[Any] = []

    if completed_entries:
        emotions = [e.emotion.primary_emotion for e in completed_entries if e.emotion]
        sentiments = [e.emotion.sentiment_label for e in completed_entries if e.emotion]
        all_themes: list[str] = []
        for e in completed_entries:
            if e.emotion:
                all_themes.extend(e.emotion.themes)
        word_counts = [e.word_count for e in completed_entries]

        emotion_counts = Counter(emotions)
        total_entries = len(emotions)
        dominant_emotion = emotion_counts.most_common(1)[0][0]
        dominant_pct = (emotion_counts[dominant_emotion] / total_entries) * 100

        emotion_dist = "\n".join(
            f"  - {em}: {cnt} entries ({cnt / total_entries * 100:.0f}%)"
            for em, cnt in emotion_counts.most_common()
        )
        sentiment_summary = ", ".join(
            f"{label}: {cnt}" for label, cnt in Counter(sentiments).most_common()
        )
        top_themes = [t for t, _ in Counter(all_themes).most_common(5)]
        themes_str = ", ".join(top_themes) if top_themes else "none detected"

        summary_parts.append(
            f"JOURNAL ENTRIES: {total_entries}\n"
            f"WORD COUNT RANGE: {min(word_counts)}-{max(word_counts)} words per entry\n"
            f"EMOTION DISTRIBUTION:\n{emotion_dist}\n"
            f"DOMINANT EMOTION: {dominant_emotion} ({dominant_pct:.0f}% of entries)\n"
            f"SENTIMENT TREND: {sentiment_summary}\n"
            f"THEMES DETECTED: {themes_str}"
        )
        emotion_summary = {
            "distribution": dict(emotion_counts),
            "dominant": dominant_emotion,
            "dominant_pct": round(dominant_pct, 1),
            "total_entries": total_entries,
        }
        patterns_detected = [{"type": "theme", "value": t} for t in top_themes]
    else:
        summary_parts.append("JOURNAL ENTRIES: 0 (no written entries this period)")

    if checkins:
        avg_mood = sum(c.mood_score for c in checkins) / len(checkins)
        energy_vals = [c.energy_level for c in checkins if c.energy_level is not None]
        sleep_vals = [c.sleep_quality for c in checkins if c.sleep_quality is not None]
        stress_vals = [c.stress_level for c in checkins if c.stress_level is not None]

        checkin_lines = [
            f"MOOD CHECK-INS: {len(checkins)}",
            f"AVERAGE MOOD: {avg_mood:.1f}/5 ({_MOOD_LABELS.get(round(avg_mood), 'okay')})",
        ]
        if energy_vals:
            avg_e = sum(energy_vals) / len(energy_vals)
            checkin_lines.append(
                f"AVERAGE ENERGY: {avg_e:.1f}/5 "
                f"({_ENERGY_LABELS.get(round(avg_e), 'moderate')})"
            )
        if sleep_vals:
            avg_s = sum(sleep_vals) / len(sleep_vals)
            checkin_lines.append(
                f"AVERAGE SLEEP QUALITY: {avg_s:.1f}/5 "
                f"({_SLEEP_LABELS.get(round(avg_s), 'okay')})"
            )
        if stress_vals:
            avg_st = sum(stress_vals) / len(stress_vals)
            checkin_lines.append(
                f"AVERAGE STRESS: {avg_st:.1f}/5 "
                f"({_STRESS_LABELS.get(round(avg_st), 'moderate')})"
            )

        summary_parts.append("\n".join(checkin_lines))
        emotion_summary["checkins"] = {
            "count": len(checkins),
            "avg_mood": round(avg_mood, 1),
        }
    else:
        summary_parts.append("MOOD CHECK-INS: 0 (no check-ins this period)")

    data_block = "\n\n".join(summary_parts)
    period_desc = {
        "daily": "today",
        "weekly": "this week",
        "monthly": "this month",
        "yearly": "this year",
    }[insight_type]

    prompt = (
        f"Based on the following anonymised emotional data from {period_desc}, "
        f"provide a gentle, insightful summary.\n\n"
        f"PERIOD: {period_label} ({period_start} to {period_end})\n\n"
        f"{data_block}\n\n"
        f"Please provide:\n"
        f"1. A warm summary of the emotional {insight_type}\n"
        f"2. One or two gentle pattern observations\n"
        f"3. A single soft suggestion for reflection (NOT prescriptive)\n"
        f"4. If dominant emotion is fear, sadness, or anger >60%, include crisis resources.\n\n"
        f"Remember: raw journal content was NOT provided. "
        f"Base insights only on the statistics above."
    )

    insight_text = await _call_ai(prompt)

    # ── Upsert: update same-period insight, create otherwise ─────────────────
    # Rule: one insight per (user, type, period_start).
    #   - Re-running within the same period refreshes the insight with latest data.
    #   - Running in a new period creates a new record, preserving all past ones.
    # This means daily insights accumulate (one per day), while monthly/yearly
    # insights are updated in-place when regenerated within the same period.
    existing_result = await db.execute(
        select(WeeklyInsight).where(
            and_(
                WeeklyInsight.user_id == user.id,
                WeeklyInsight.insight_type == insight_type,
                WeeklyInsight.week_start == period_start,
            )
        )
    )
    existing = existing_result.scalars().first()

    if existing:
        existing.insight_content = insight_text
        existing.week_end = period_end
        existing.period_label = period_label
        existing.emotion_summary = emotion_summary
        existing.patterns_detected = patterns_detected
        existing.generated_at = datetime.now(timezone.utc)
        await db.flush()
        logger.info(f"Updated {insight_type} insight {existing.id} for user {user.id}")
        return existing

    insight = WeeklyInsight(
        user_id=user.id,
        insight_type=insight_type,
        week_start=period_start,
        week_end=period_end,
        period_label=period_label,
        insight_content=insight_text,
        emotion_summary=emotion_summary,
        patterns_detected=patterns_detected,
    )
    db.add(insight)
    await db.flush()

    logger.info(f"Generated {insight_type} insight {insight.id} for user {user.id}")
    return insight


async def generate_weekly_insight(
    db: AsyncSession,
    user: User,
    week_start: date | None = None,
) -> WeeklyInsight | None:
    """Backward-compatible alias for weekly insight generation."""
    return await generate_insight(db, user, "weekly", week_start)


# ── How far back to look when backfilling missed periods ──────────────────────
_BACKFILL_LIMIT: dict[str, int] = {
    "daily": 30,    # up to 30 missed days
    "weekly": 8,    # up to 8 missed weeks
    "monthly": 6,   # up to 6 missed months
    "yearly": 3,    # up to 3 missed years
}


def _past_ref_dates(insight_type: InsightType, max_periods: int) -> list[date]:
    """Return reference dates for past periods, oldest-first, for backfill checks."""
    today = date.today()
    refs: list[date] = []
    for i in range(max_periods, 0, -1):  # oldest first so insights appear in order
        if insight_type == "daily":
            refs.append(today - timedelta(days=i))
        elif insight_type == "weekly":
            refs.append(today - timedelta(weeks=i))
        elif insight_type == "monthly":
            # Subtract i months using integer arithmetic
            total = today.year * 12 + (today.month - 1) - i
            yr, mo = divmod(total, 12)
            refs.append(date(yr, mo + 1, 1))
        else:  # yearly
            yr = today.year - i
            if yr >= 2000:
                refs.append(date(yr, 1, 1))
    return refs


async def generate_insight_with_backfill(
    db: AsyncSession,
    user: User,
    insight_type: InsightType,
) -> WeeklyInsight | None:
    """Generate insight for current period AND backfill any past periods with data but no insight.

    Example: user wrote journal entries Mon–Wed but never hit "Generate".
    On Thursday they click Generate → insights are silently created for Mon,
    Tue, Wed, then Thu (current day) is generated and returned.

    Already-generated periods are skipped (upsert only on current period).
    Backfill failures are logged and skipped individually so one bad period
    never blocks the rest.
    """
    max_periods = _BACKFILL_LIMIT.get(insight_type, 7)
    backfilled = 0

    for ref in _past_ref_dates(insight_type, max_periods):
        period_start, _, _ = _period_bounds(insight_type, ref)

        # Skip if an insight already exists for this period
        already = (
            await db.execute(
                select(WeeklyInsight).where(
                    and_(
                        WeeklyInsight.user_id == user.id,
                        WeeklyInsight.insight_type == insight_type,
                        WeeklyInsight.week_start == period_start,
                    )
                )
            )
        ).scalars().first()
        if already:
            continue

        # Try to generate; silently skip if no data for that period
        try:
            result = await generate_insight(db, user, insight_type, ref)
            if result:
                backfilled += 1
                logger.info(
                    f"Backfilled {insight_type} insight for {period_start} (user {user.id})"
                )
        except Exception as exc:
            logger.debug(f"Backfill skipped {insight_type} {period_start}: {exc}")

    if backfilled:
        logger.info(f"Backfilled {backfilled} {insight_type} insight(s) for user {user.id}")

    # Generate (or refresh) the current period and return it
    return await generate_insight(db, user, insight_type)


async def _call_ai(prompt: str) -> str:
    """Try Ollama first (free, local), then fall back to cloud APIs."""
    if settings.ollama_base_url:
        try:
            return await _call_ollama(prompt)
        except Exception as exc:
            logger.warning(f"Ollama unavailable, falling back to cloud API: {exc}")
    if settings.openai_api_key:
        return await _call_openai(prompt)
    if settings.anthropic_api_key:
        return await _call_anthropic(prompt)
    raise InsightGenerationError(
        "No AI backend configured. "
        "Set OLLAMA_BASE_URL (free) or OPENAI_API_KEY / ANTHROPIC_API_KEY in .env."
    )


async def _call_ollama(prompt: str) -> str:
    """Call a local Ollama instance — 100% free, runs on your machine."""
    try:
        import httpx  # already a transitive dep

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{settings.ollama_base_url.rstrip('/')}/api/chat",
                json={
                    "model": settings.ollama_model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                    "options": {"temperature": 0.7, "num_predict": 512},
                },
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]
    except Exception as exc:
        logger.error(f"Ollama call failed: {exc}")
        raise InsightGenerationError(f"Ollama unavailable: {exc}") from exc


async def _call_openai(prompt: str) -> str:
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=512,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        logger.error(f"OpenAI API call failed: {exc}")
        raise InsightGenerationError(f"Insight generation failed: {exc}") from exc


async def _call_anthropic(prompt: str) -> str:
    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
    except Exception as exc:
        logger.error(f"Anthropic API call failed: {exc}")
        raise InsightGenerationError(f"Insight generation failed: {exc}") from exc
