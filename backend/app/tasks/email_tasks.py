"""Celery tasks for transactional email delivery.

Uses Python's built-in smtplib so no extra dependencies are needed.
Configure SMTP credentials via the settings (SMTP_HOST, SMTP_PORT,
SMTP_USER, SMTP_PASSWORD, EMAILS_FROM).

In development, if SMTP_USER is blank the email body is logged instead of
sent — this keeps the dev experience smooth without requiring a mail server.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)


def _build_verification_email(
    to_email: str,
    verify_url: str,
    from_address: str,
) -> MIMEMultipart:
    """Construct the verification email MIME message."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your ReflectAI account"
    msg["From"] = from_address
    msg["To"] = to_email

    plain = (
        f"Welcome to ReflectAI!\n\n"
        f"Please verify your email address by visiting:\n{verify_url}\n\n"
        f"This link expires in 24 hours.\n\n"
        f"If you didn't create a ReflectAI account you can safely ignore this email."
    )

    html = f"""\
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:40px;">
        <tr><td>
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px;padding:12px 16px;">
              <span style="font-size:24px;line-height:1;">📖</span>
            </div>
            <h1 style="margin:16px 0 4px;font-size:22px;color:#111827;font-weight:700;">ReflectAI</h1>
            <p style="margin:0;color:#6b7280;font-size:14px;">Privacy-first emotional journaling</p>
          </div>

          <h2 style="font-size:18px;color:#111827;margin:0 0 12px;">Verify your email address</h2>
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 28px;">
            Welcome! Click the button below to verify your email address and start your journaling journey.
          </p>

          <div style="text-align:center;margin-bottom:28px;">
            <a href="{verify_url}"
               style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);
                      color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;
                      padding:14px 32px;border-radius:10px;letter-spacing:0.01em;">
              Verify Email Address
            </a>
          </div>

          <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 8px;">
            Or copy this URL into your browser:
          </p>
          <p style="font-size:12px;color:#7c3aed;word-break:break-all;margin:0 0 24px;">
            {verify_url}
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            This link expires in <strong>24 hours</strong>.
            If you didn't create a ReflectAI account, you can safely ignore this email.
          </p>
        </td></tr>
      </table>

      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        ReflectAI is not a therapy or medical service. If you are in crisis, call
        <strong>Samaritans: 116 123</strong> or emergency services.
      </p>
    </td></tr>
  </table>
</body>
</html>"""

    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))
    return msg


def _send_via_smtp(msg: MIMEMultipart, settings) -> None:  # type: ignore[no-untyped-def]
    """Send a MIME message via SMTP with STARTTLS."""
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(
            settings.emails_from,
            msg["To"],
            msg.as_string(),
        )


@celery_app.task(
    name="email_tasks.send_verification_email",
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def send_verification_email(to_email: str, verification_token: str) -> bool:  # type: ignore[misc]
    """Send an email verification link to a newly registered user.

    Args:
        to_email: Recipient email address.
        verification_token: JWT email verification token.

    Returns:
        True on success.

    Raises:
        Retries on SMTP failure (max 3 times, 30 s between attempts).
    """
    settings = get_settings()
    verify_url = f"{settings.frontend_url}/auth/verify-email/{verification_token}"

    if not settings.smtp_user:
        # No SMTP configured — log the link for development use
        logger.info(
            f"[DEV EMAIL] Verification link for {to_email}:\n{verify_url}"
        )
        return True

    try:
        msg = _build_verification_email(to_email, verify_url, str(settings.emails_from))
        _send_via_smtp(msg, settings)
        logger.info(f"Verification email sent to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send verification email to {to_email}: {exc}")
        raise send_verification_email.retry(exc=exc)  # type: ignore[attr-defined]


# ── Daily check-in reminder ──────────────────────────────────────────────────

def _build_reminder_email(
    to_email: str,
    first_name: str,
    frontend_url: str,
    from_address: str,
) -> MIMEMultipart:
    """Construct the daily check-in reminder MIME message."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your daily check-in — how are you feeling today?"
    msg["From"] = from_address
    msg["To"] = to_email

    plain = (
        f"Hi {first_name},\n\n"
        f"Just a gentle nudge — you haven't logged a check-in today.\n\n"
        f"Even a 10-second mood check-in helps build your emotional self-awareness over time.\n\n"
        f"Log your check-in: {frontend_url}/dashboard\n\n"
        f"Take care,\nThe ReflectAI Team\n\n"
        f"---\nThis reminder is sent once per day when no check-in is recorded.\n"
        f"ReflectAI is not a therapy or medical service."
    )

    html = f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:40px;">
        <tr><td>
          <div style="text-align:center;margin-bottom:28px;">
            <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:12px;padding:12px 16px;">
              <span style="font-size:24px;">📖</span>
            </div>
            <h1 style="margin:12px 0 4px;font-size:20px;color:#111827;font-weight:700;">ReflectAI</h1>
          </div>

          <h2 style="font-size:18px;color:#111827;margin:0 0 10px;">Hi {first_name} 👋</h2>
          <p style="color:#374151;font-size:15px;line-height:1.65;margin:0 0 20px;">
            You haven't logged a check-in today yet. A quick 30-second mood
            check-in helps you understand your emotional patterns over time.
          </p>

          <div style="text-align:center;margin-bottom:28px;">
            <a href="{frontend_url}/dashboard"
               style="display:inline-block;background:linear-gradient(135deg,#6366f1,#4f46e5);
                      color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;
                      padding:14px 32px;border-radius:10px;">
              Log Today's Check-in
            </a>
          </div>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            You receive this once per day when no check-in has been recorded.
            ReflectAI is not a therapy or medical service. If you are in crisis,
            call <strong>Samaritans: 116 123</strong> or emergency services.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))
    return msg


async def _send_reminders_async() -> dict:
    """Find users who haven't checked in today and send them a reminder."""
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.user import User
    from app.models.journal import MoodCheckin

    settings = get_settings()
    today = date.today()
    sent = skipped = failed = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User)
            .where(User.is_active == True)  # noqa: E712
            .where(User.is_verified == True)  # noqa: E712
        )
        users = list(result.scalars().all())

        for user in users:
            # Check if user has a check-in today
            checkin_result = await db.execute(
                select(MoodCheckin)
                .where(MoodCheckin.user_id == user.id)
                .where(MoodCheckin.checkin_date == today)
                .limit(1)
            )
            has_checkin_today = checkin_result.scalar_one_or_none() is not None

            if has_checkin_today:
                skipped += 1
                continue

            first_name = user.full_name.split()[0] if user.full_name else "there"

            if not settings.smtp_user:
                logger.info(
                    f"[DEV REMINDER] Would send check-in reminder to {user.email}"
                )
                sent += 1
                continue

            try:
                msg = _build_reminder_email(
                    to_email=user.email,
                    first_name=first_name,
                    frontend_url=settings.frontend_url,
                    from_address=str(settings.emails_from),
                )
                _send_via_smtp(msg, settings)
                sent += 1
                logger.info(f"Check-in reminder sent to {user.email}")
            except Exception as exc:
                logger.error(f"Failed to send reminder to {user.email}: {exc}")
                failed += 1

    logger.info(f"Check-in reminders: sent={sent}, skipped={skipped}, failed={failed}")
    return {"sent": sent, "skipped": skipped, "failed": failed}


@celery_app.task(
    name="email_tasks.send_checkin_reminders",
    bind=True,
)
def send_checkin_reminders(self) -> dict:  # type: ignore[misc]
    """Send daily check-in reminder to users who haven't checked in today.

    Runs every day at 20:00 UTC via Celery Beat.
    Users who already have a check-in today are skipped.
    In dev mode (no SMTP_USER), emails are logged instead of sent.
    """
    return asyncio.get_event_loop().run_until_complete(_send_reminders_async())
