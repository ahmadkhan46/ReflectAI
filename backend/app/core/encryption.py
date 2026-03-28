"""Per-user authenticated encryption for journal entry content.

Design:
- Algorithm: Fernet (AES-128-CBC + HMAC-SHA256) — authenticated encryption.
- Key derivation: PBKDF2-HMAC-SHA256 with 480,000 iterations (NIST-recommended).
- Per-user isolation: each user has a random 32-byte salt stored in the DB.
  The actual encryption key is derived from (master_key XOR user_salt) and
  is NEVER stored — it is re-derived on every encrypt/decrypt call.
- This ensures that compromising one user's data does not expose others.

Usage:
    salt = generate_user_salt()          # at registration
    ciphertext = encrypt_content(text, salt)
    plaintext  = decrypt_content(ciphertext, salt)
"""

import base64
import logging
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# PBKDF2 iteration count — intentionally high to slow brute-force
_PBKDF2_ITERATIONS = 480_000


class EncryptionError(Exception):
    """Raised when encryption or decryption fails for any reason."""


def generate_user_salt() -> bytes:
    """Generate a cryptographically random 32-byte salt for a new user.

    Returns:
        32 random bytes from the OS CSPRNG.
    """
    return os.urandom(32)


def _derive_key(user_salt: bytes) -> bytes:
    """Derive a per-user Fernet key via PBKDF2.

    The master key (from settings) and user-specific salt are combined so
    that each user's journal entries are encrypted with a unique key.

    Args:
        user_salt: The 32-byte salt stored with the user record.

    Returns:
        URL-safe base64-encoded 32-byte Fernet key.
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=user_salt,
        iterations=_PBKDF2_ITERATIONS,
    )
    raw_key = kdf.derive(settings.encryption_key.encode("utf-8"))
    return base64.urlsafe_b64encode(raw_key)


def encrypt_content(plaintext: str, user_salt: bytes) -> bytes:
    """Encrypt plaintext journal content for a specific user.

    Args:
        plaintext: The raw journal entry text.
        user_salt: The user's stored 32-byte salt.

    Returns:
        Fernet-encrypted bytes (includes IV and HMAC).

    Raises:
        EncryptionError: If encryption fails for any reason.
    """
    try:
        fernet = Fernet(_derive_key(user_salt))
        return fernet.encrypt(plaintext.encode("utf-8"))
    except Exception as exc:
        logger.error(f"Content encryption failed: {exc}")
        raise EncryptionError("Failed to encrypt content.") from exc


def decrypt_content(ciphertext: bytes, user_salt: bytes) -> str:
    """Decrypt encrypted journal content for a specific user.

    Args:
        ciphertext: Fernet-encrypted bytes.
        user_salt: The user's stored 32-byte salt.

    Returns:
        Decrypted plaintext string.

    Raises:
        EncryptionError: If the ciphertext is invalid, tampered, or the
            key does not match (wrong salt).
    """
    try:
        fernet = Fernet(_derive_key(user_salt))
        return fernet.decrypt(ciphertext).decode("utf-8")
    except InvalidToken as exc:
        logger.error("Decryption failed: invalid token or mismatched key")
        raise EncryptionError("Failed to decrypt content — invalid or corrupted data.") from exc
    except Exception as exc:
        logger.error(f"Decryption failed: {exc}")
        raise EncryptionError("Failed to decrypt content.") from exc
