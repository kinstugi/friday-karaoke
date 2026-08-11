"""Unit tests for the security helpers (password hashing, auth tokens)."""

from app.core.security import (
    generate_auth_token,
    hash_auth_token,
    hash_password,
    verify_password,
)


def test_hash_password_is_not_plaintext() -> None:
    password_hash = hash_password("super-secret")
    assert password_hash != "super-secret"
    assert password_hash.startswith("$2")


def test_verify_password_accepts_correct_password() -> None:
    password_hash = hash_password("super-secret")
    assert verify_password("super-secret", password_hash) is True


def test_verify_password_rejects_wrong_password() -> None:
    password_hash = hash_password("super-secret")
    assert verify_password("wrong-password", password_hash) is False


def test_verify_password_rejects_malformed_hash() -> None:
    assert verify_password("super-secret", "not-a-bcrypt-hash") is False


def test_hash_password_is_unique_per_call() -> None:
    # bcrypt salts every hash, so two hashes of the same password differ.
    assert hash_password("same-password") != hash_password("same-password")


def test_generate_auth_token_is_opaque_and_unique() -> None:
    token_a = generate_auth_token()
    token_b = generate_auth_token()
    assert token_a
    assert token_a != token_b
    # URL-safe base64 tokens contain neither an empty value nor separator chars.
    assert "/" not in token_a and "+" not in token_a


def test_hash_auth_token_is_deterministic_sha256_hex() -> None:
    token = generate_auth_token()
    assert hash_auth_token(token) == hash_auth_token(token)
    assert len(hash_auth_token(token)) == 64
    assert hash_auth_token(token) != token
