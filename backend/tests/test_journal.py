"""Tests for /api/journal/* endpoints.

Covers: create, list, get, update, delete, emotion correction.
Auth is bootstrapped via helpers that register + login before each test.
Celery task dispatch is swallowed by the try/except in the router, so no
mocking is required — the task simply won't run without a worker.
"""

import pytest
from httpx import AsyncClient

# ── Auth helpers (mirrors test_auth.py pattern) ───────────────────────────────

_USER = {
    "email": "journal_user@example.com",
    "password": "JournalPass1",
    "full_name": "Journal User",
    "age_verified": True,
    "consent_given": True,
}

_CONTENT_SHORT = "Feeling great today. The sun is shining and I am happy."
_CONTENT_LONG = " ".join(["word"] * 200)  # > 10 chars, well within limit


async def _setup(client: AsyncClient) -> str:
    """Register and login; return the Bearer token."""
    await client.post("/api/auth/register", json=_USER)
    resp = await client.post(
        "/api/auth/login",
        json={"email": _USER["email"], "password": _USER["password"]},
    )
    return resp.json().get("access_token", "")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Create entry ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestCreateEntry:
    async def test_returns_201_with_content(self, client: AsyncClient) -> None:
        token = await _setup(client)
        resp = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["content"] == _CONTENT_SHORT
        assert data["word_count"] > 0
        assert "id" in data

    async def test_emotion_starts_as_pending(self, client: AsyncClient) -> None:
        token = await _setup(client)
        resp = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        assert resp.status_code == 201
        emotion = resp.json()["emotion"]
        assert emotion is not None
        assert emotion["analysis_status"] == "pending"

    async def test_rejects_content_too_short(self, client: AsyncClient) -> None:
        token = await _setup(client)
        resp = await client.post(
            "/api/journal/entries",
            json={"content": "Too short"},
            headers=_auth(token),
        )
        assert resp.status_code == 422

    async def test_requires_authentication(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
        )
        assert resp.status_code == 401

    async def test_custom_entry_date(self, client: AsyncClient) -> None:
        token = await _setup(client)
        resp = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT, "entry_date": "2025-01-15"},
            headers=_auth(token),
        )
        assert resp.status_code == 201
        assert resp.json()["entry_date"] == "2025-01-15"


# ── List entries ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestListEntries:
    async def test_empty_for_new_user(self, client: AsyncClient) -> None:
        token = await _setup(client)
        resp = await client.get("/api/journal/entries", headers=_auth(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["entries"] == []
        assert data["total"] == 0

    async def test_lists_created_entries(self, client: AsyncClient) -> None:
        token = await _setup(client)
        for i in range(3):
            await client.post(
                "/api/journal/entries",
                json={"content": f"Entry number {i} with enough words here."},
                headers=_auth(token),
            )
        resp = await client.get("/api/journal/entries", headers=_auth(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["entries"]) == 3

    async def test_list_does_not_include_content(self, client: AsyncClient) -> None:
        """List endpoint returns lightweight items — no decrypted content."""
        token = await _setup(client)
        await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        resp = await client.get("/api/journal/entries", headers=_auth(token))
        item = resp.json()["entries"][0]
        assert "content" not in item

    async def test_pagination(self, client: AsyncClient) -> None:
        token = await _setup(client)
        for i in range(5):
            await client.post(
                "/api/journal/entries",
                json={"content": f"Paginated entry {i} with enough characters here."},
                headers=_auth(token),
            )
        resp = await client.get(
            "/api/journal/entries?page=1&page_size=2", headers=_auth(token)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["entries"]) == 2
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 2

    async def test_requires_authentication(self, client: AsyncClient) -> None:
        resp = await client.get("/api/journal/entries")
        assert resp.status_code == 401


# ── Get single entry ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestGetEntry:
    async def test_returns_decrypted_content(self, client: AsyncClient) -> None:
        token = await _setup(client)
        create = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        entry_id = create.json()["id"]

        resp = await client.get(f"/api/journal/entries/{entry_id}", headers=_auth(token))
        assert resp.status_code == 200
        assert resp.json()["content"] == _CONTENT_SHORT

    async def test_returns_404_for_unknown_id(self, client: AsyncClient) -> None:
        token = await _setup(client)
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = await client.get(f"/api/journal/entries/{fake_id}", headers=_auth(token))
        assert resp.status_code == 404

    async def test_ownership_enforced(self, client: AsyncClient) -> None:
        """User B cannot read User A's entry."""
        token_a = await _setup(client)
        create = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token_a),
        )
        entry_id = create.json()["id"]

        # Register second user
        user_b = {**_USER, "email": "userb_get@example.com"}
        await client.post("/api/auth/register", json=user_b)
        login_b = await client.post(
            "/api/auth/login",
            json={"email": user_b["email"], "password": _USER["password"]},
        )
        token_b = login_b.json().get("access_token", "")

        resp = await client.get(
            f"/api/journal/entries/{entry_id}", headers=_auth(token_b)
        )
        assert resp.status_code == 404


# ── Update entry ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestUpdateEntry:
    async def test_updates_content(self, client: AsyncClient) -> None:
        token = await _setup(client)
        create = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        entry_id = create.json()["id"]

        updated = "Updated content with plenty of new words here for the test case."
        resp = await client.put(
            f"/api/journal/entries/{entry_id}",
            json={"content": updated},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == updated

    async def test_returns_404_for_unknown(self, client: AsyncClient) -> None:
        token = await _setup(client)
        fake_id = "00000000-0000-0000-0000-000000000001"
        resp = await client.put(
            f"/api/journal/entries/{fake_id}",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        assert resp.status_code == 404


# ── Delete entry ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestDeleteEntry:
    async def test_soft_delete_returns_204(self, client: AsyncClient) -> None:
        token = await _setup(client)
        create = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        entry_id = create.json()["id"]

        resp = await client.delete(
            f"/api/journal/entries/{entry_id}", headers=_auth(token)
        )
        assert resp.status_code == 204

    async def test_deleted_entry_not_returned_in_list(self, client: AsyncClient) -> None:
        token = await _setup(client)
        create = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        entry_id = create.json()["id"]
        await client.delete(f"/api/journal/entries/{entry_id}", headers=_auth(token))

        resp = await client.get("/api/journal/entries", headers=_auth(token))
        assert resp.json()["total"] == 0

    async def test_deleted_entry_returns_404_on_get(self, client: AsyncClient) -> None:
        token = await _setup(client)
        create = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        entry_id = create.json()["id"]
        await client.delete(f"/api/journal/entries/{entry_id}", headers=_auth(token))

        resp = await client.get(f"/api/journal/entries/{entry_id}", headers=_auth(token))
        assert resp.status_code == 404

    async def test_returns_404_for_unknown(self, client: AsyncClient) -> None:
        token = await _setup(client)
        fake_id = "00000000-0000-0000-0000-000000000002"
        resp = await client.delete(
            f"/api/journal/entries/{fake_id}", headers=_auth(token)
        )
        assert resp.status_code == 404


# ── Emotion correction ────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestEmotionCorrection:
    async def test_correct_emotion_succeeds(self, client: AsyncClient) -> None:
        token = await _setup(client)
        create = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        entry_id = create.json()["id"]

        resp = await client.patch(
            f"/api/journal/entries/{entry_id}/emotion",
            json={"corrected_emotion": "joy"},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["corrected_emotion"] == "joy"

    async def test_invalid_emotion_rejected(self, client: AsyncClient) -> None:
        token = await _setup(client)
        create = await client.post(
            "/api/journal/entries",
            json={"content": _CONTENT_SHORT},
            headers=_auth(token),
        )
        entry_id = create.json()["id"]

        resp = await client.patch(
            f"/api/journal/entries/{entry_id}/emotion",
            json={"corrected_emotion": "not_an_emotion"},
            headers=_auth(token),
        )
        assert resp.status_code == 422

    async def test_returns_404_for_unknown_entry(self, client: AsyncClient) -> None:
        token = await _setup(client)
        fake_id = "00000000-0000-0000-0000-000000000003"
        resp = await client.patch(
            f"/api/journal/entries/{fake_id}/emotion",
            json={"corrected_emotion": "joy"},
            headers=_auth(token),
        )
        assert resp.status_code == 404


# ── Insights ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestInsights:
    async def test_empty_insights_for_new_user(self, client: AsyncClient) -> None:
        token = await _setup(client)
        resp = await client.get("/api/journal/insights", headers=_auth(token))
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_requires_authentication(self, client: AsyncClient) -> None:
        resp = await client.get("/api/journal/insights")
        assert resp.status_code == 401
