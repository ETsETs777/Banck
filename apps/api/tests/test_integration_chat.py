"""
Интеграция с реальной PostgreSQL (опционально).

Запуск: SPEKTORS_INTEGRATION=1 и доступный DATABASE_URL
(например docker compose up -d postgres), затем из apps/api:

  pip install pytest-asyncio
  pip install ".[dev]"   # или только pytest
  pytest tests/test_integration_chat.py -v
"""
from __future__ import annotations

import os

import pytest


def _integration_on() -> bool:
    return os.environ.get("SPEKTORS_INTEGRATION", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


@pytest.mark.asyncio
async def test_ensure_session_add_message():
    if not _integration_on():
        pytest.skip("set SPEKTORS_INTEGRATION=1 and DATABASE_URL for DB tests")
    from spektors_api.database import chat_repository
    from spektors_api.database.pool import close_db, init_db

    try:
        await init_db()
    except Exception as e:
        pytest.skip(f"database unavailable: {e}")

    try:
        sid = await chat_repository.ensure_session("web_client", None)
        tid = await chat_repository.ensure_thread(sid, None)
        mid = await chat_repository.add_message(
            tid, "user", "pytest-integration", msg_source="user"
        )
        assert isinstance(mid, int) and mid > 0
        msgs = await chat_repository.list_messages_public(tid)
        assert len(msgs) >= 1
        assert msgs[-1]["content"] == "pytest-integration"
    finally:
        await close_db()
