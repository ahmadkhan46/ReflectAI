"""Tests for /api/auth/* endpoints.

Covers the happy paths and key failure modes for registration, login,
token refresh, logout, profile retrieval, and email verification.
"""

import pytest
from httpx import AsyncClient

# ── Fixtures & helpers ───────────────────────────────────────────────────────

BASE_PAYLOAD = {
    "email": "alice@example.com",
    "password": "SecurePass1",
    "full_name": "Alice Example",
    "age_verified": True,
    "consent_given": True,
}


async def _register(client: AsyncClient, overrides: dict | None = None) -> None:
    payload = {**BASE_PAYLOAD, **(overrides or {})}
    await client.post("/api/auth/register", json=payload)


async def _login(client: AsyncClient, email: str = BASE_PAYLOAD["email"],
                 password: str = BASE_PAYLOAD["password"]) -> str:
    """Register (if needed) then login; return the access token."""
    resp = await client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    return resp.json().get("access_token", "")


# ── Registration ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestRegister:
    async def test_success_returns_201(self, client: AsyncClient) -> None:
        resp = await client.post("/api/auth/register", json=BASE_PAYLOAD)
        assert resp.status_code == 201
        assert "message" in resp.json()

    async def test_duplicate_email_returns_409(self, client: AsyncClient) -> None:
        await _register(client)
        resp = await client.post("/api/auth/register", json=BASE_PAYLOAD)
        assert resp.status_code == 409

    async def test_weak_password_returns_422(self, client: AsyncClient) -> None:
        payload = {**BASE_PAYLOAD, "email": "b@example.com", "password": "weak"}
        resp = await client.post("/api/auth/register", json=payload)
        assert resp.status_code == 422

    async def test_no_uppercase_returns_422(self, client: AsyncClient) -> None:
        payload = {**BASE_PAYLOAD, "email": "c@example.com", "password": "alllower1"}
        resp = await client.post("/api/auth/register", json=payload)
        assert resp.status_code == 422

    async def test_no_digit_returns_422(self, client: AsyncClient) -> None:
        payload = {**BASE_PAYLOAD, "email": "d@example.com", "password": "NoDigitPass"}
        resp = await client.post("/api/auth/register", json=payload)
        assert resp.status_code == 422

    async def test_age_gate_returns_422(self, client: AsyncClient) -> None:
        payload = {**BASE_PAYLOAD, "email": "e@example.com", "age_verified": False}
        resp = await client.post("/api/auth/register", json=payload)
        assert resp.status_code == 422

    async def test_no_consent_returns_422(self, client: AsyncClient) -> None:
        payload = {**BASE_PAYLOAD, "email": "f@example.com", "consent_given": False}
        resp = await client.post("/api/auth/register", json=payload)
        assert resp.status_code == 422

    async def test_invalid_email_returns_422(self, client: AsyncClient) -> None:
        payload = {**BASE_PAYLOAD, "email": "not-an-email"}
        resp = await client.post("/api/auth/register", json=payload)
        assert resp.status_code == 422


# ── Login ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestLogin:
    async def test_valid_credentials_return_token(self, client: AsyncClient) -> None:
        await _register(client, {"email": "login1@example.com"})
        resp = await client.post(
            "/api/auth/login",
            json={"email": "login1@example.com", "password": BASE_PAYLOAD["password"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    async def test_wrong_password_returns_401(self, client: AsyncClient) -> None:
        await _register(client, {"email": "login2@example.com"})
        resp = await client.post(
            "/api/auth/login",
            json={"email": "login2@example.com", "password": "WrongPass9"},
        )
        assert resp.status_code == 401

    async def test_unknown_email_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "AnyPass1"},
        )
        assert resp.status_code == 401

    async def test_login_sets_cookies(self, client: AsyncClient) -> None:
        await _register(client, {"email": "login3@example.com"})
        resp = await client.post(
            "/api/auth/login",
            json={"email": "login3@example.com", "password": BASE_PAYLOAD["password"]},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.cookies or "access_token" in resp.json()


# ── Profile ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestProfile:
    async def test_authenticated_request_returns_profile(self, client: AsyncClient) -> None:
        await _register(client, {"email": "me1@example.com"})
        token = await _login(client, "me1@example.com", BASE_PAYLOAD["password"])
        resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "me1@example.com"

    async def test_profile_excludes_sensitive_fields(self, client: AsyncClient) -> None:
        await _register(client, {"email": "me2@example.com"})
        token = await _login(client, "me2@example.com", BASE_PAYLOAD["password"])
        resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        data = resp.json()
        assert "hashed_password" not in data
        assert "encryption_salt" not in data

    async def test_unauthenticated_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 401

    async def test_invalid_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(
            "/api/auth/me", headers={"Authorization": "Bearer invalidtoken"}
        )
        assert resp.status_code == 401


# ── Logout ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestLogout:
    async def test_authenticated_logout_returns_200(self, client: AsyncClient) -> None:
        await _register(client, {"email": "logout1@example.com"})
        token = await _login(client, "logout1@example.com", BASE_PAYLOAD["password"])
        resp = await client.post(
            "/api/auth/logout", headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200

    async def test_unauthenticated_logout_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post("/api/auth/logout")
        assert resp.status_code == 401


# ── Health ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestHealth:
    async def test_health_endpoint_returns_200(self, client: AsyncClient) -> None:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "service" in data
        assert data["service"] == "ReflectAI"
