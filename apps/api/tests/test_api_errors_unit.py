"""Локализация кодов ошибок без запуска HTTP."""
from __future__ import annotations

from spektors_api.api_errors import localized_message, pick_locale


def test_pick_locale_ru():
    assert pick_locale("ru-RU,en;q=0.9") == "ru"


def test_pick_locale_nl():
    assert pick_locale("nl,en;q=0.8") == "nl"


def test_localized_unknown_app_ru():
    msg = localized_message("unknown_app", "ru")
    assert msg and "Неизвестный" in msg


def test_localized_bearer_required():
    msg = localized_message("bearer_required_for_admin", "en")
    assert msg and "Bearer" in msg
