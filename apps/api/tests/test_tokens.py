"""Unit-тесты сравнения токенов (без БД)."""
from __future__ import annotations

from spektors_api.security.tokens import constant_time_api_token_eq


def test_equal_tokens():
    assert constant_time_api_token_eq("secret-a", "secret-a") is True


def test_unequal_tokens():
    assert constant_time_api_token_eq("secret-a", "secret-b") is False


def test_empty_received():
    assert constant_time_api_token_eq("", "x") is False


def test_empty_expected():
    assert constant_time_api_token_eq("x", "") is False
