"""Application configuration using Pydantic Settings.

All settings are loaded from environment variables (or .env file).
No secrets are hardcoded here.
"""

import json
from functools import lru_cache
from typing import Literal

from pydantic import EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "ReflectAI"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = False

    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Database
    database_url: str

    # Redis & Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # Encryption — Fernet key (32 url-safe base64 bytes)
    encryption_key: str

    # Email
    smtp_host: str = "smtp.mailtrap.io"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    emails_from: EmailStr = "noreply@reflectai.app"  # type: ignore[assignment]

    # AI API — supports OpenAI (preferred), Anthropic Claude, or local Ollama (free)
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Ollama — free, fully local LLM (install from https://ollama.com)
    # Set OLLAMA_BASE_URL=http://localhost:11434 to use instead of cloud APIs
    ollama_base_url: str = ""
    ollama_model: str = "llama3.2"

    # Frontend
    frontend_url: str = "http://localhost:3000"

    # CORS — stored as JSON string in env, parsed here
    cors_origins: list[str] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        """Accept both a JSON string and a plain list."""
        if isinstance(v, str):
            return json.loads(v)
        return v

    @property
    def is_production(self) -> bool:
        """True when running in the production environment."""
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
