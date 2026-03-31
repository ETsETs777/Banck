"""Репозиторий чата: сессии, треды, сообщения (PostgreSQL)."""
from __future__ import annotations

import uuid
from typing import Any

from spektors_api.database.pool import pool


async def ensure_session(app_id: str, session_id: str | None) -> str:
    sid = session_id or uuid.uuid4().hex
    async with pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT app_id FROM chat_session WHERE id = $1", sid
        )
        if row is None:
            await conn.execute(
                "INSERT INTO chat_session (id, app_id) VALUES ($1, $2)",
                sid,
                app_id,
            )
        elif row["app_id"] != app_id:
            raise PermissionError("session_app_mismatch")
    return sid


async def ensure_thread(session_id: str, thread_id: str | None) -> str:
    tid = thread_id or uuid.uuid4().hex
    async with pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT session_id FROM chat_thread WHERE id = $1", tid
        )
        if row is None:
            await conn.execute(
                "INSERT INTO chat_thread (id, session_id) VALUES ($1, $2)",
                tid,
                session_id,
            )
        elif row["session_id"] != session_id:
            raise PermissionError("thread_session_mismatch")
    return tid


async def add_message(
    thread_id: str,
    role: str,
    content: str,
    *,
    msg_source: str = "model",
    author_label: str | None = None,
) -> int:
    async with pool().acquire() as conn:
        mid = await conn.fetchval(
            """
            INSERT INTO chat_message (thread_id, role, content, msg_source, author_label)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            """,
            thread_id,
            role,
            content,
            msg_source,
            author_label,
        )
    return int(mid)


async def list_messages_for_llm(thread_id: str) -> list[dict[str, str]]:
    async with pool().acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT role, content FROM chat_message
            WHERE thread_id = $1 ORDER BY id ASC
            """,
            thread_id,
        )
    return [{"role": r["role"], "content": r["content"]} for r in rows]


async def list_messages_public(thread_id: str) -> list[dict[str, Any]]:
    async with pool().acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, role, content, msg_source, author_label, created_at
            FROM chat_message WHERE thread_id = $1 ORDER BY id ASC
            """,
            thread_id,
        )
    out: list[dict[str, Any]] = []
    for r in rows:
        ts = r["created_at"]
        out.append(
            {
                "id": r["id"],
                "role": r["role"],
                "content": r["content"],
                "msg_source": r["msg_source"] or "model",
                "author_label": r["author_label"],
                "created_at": ts.isoformat() if ts else None,
            }
        )
    return out


async def thread_app_id(session_id: str, thread_id: str) -> str | None:
    async with pool().acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.app_id FROM chat_thread t
            JOIN chat_session s ON s.id = t.session_id
            WHERE t.id = $1 AND t.session_id = $2
            """,
            thread_id,
            session_id,
        )
    if row is None:
        return None
    return str(row["app_id"])


async def list_threads_inbox(
    app_id: str | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    """Треды с сессией и превью последнего сообщения (для internal admin)."""
    async with pool().acquire() as conn:
        rows = await conn.fetch(
            """
            WITH last_msg AS (
                SELECT DISTINCT ON (thread_id) thread_id, content, created_at
                FROM chat_message
                ORDER BY thread_id, id DESC
            )
            SELECT t.id AS thread_id, t.session_id, s.app_id,
                   lm.content AS last_preview,
                   lm.created_at AS updated_at,
                   (SELECT COUNT(*)::int FROM chat_message cm WHERE cm.thread_id = t.id) AS message_count
            FROM chat_thread t
            JOIN chat_session s ON s.id = t.session_id
            LEFT JOIN last_msg lm ON lm.thread_id = t.id
            WHERE ($1::text IS NULL OR s.app_id = $1)
            ORDER BY lm.created_at DESC NULLS LAST, t.id DESC
            LIMIT $2 OFFSET $3
            """,
            app_id,
            limit,
            offset,
        )
    out: list[dict[str, Any]] = []
    for r in rows:
        ts = r["updated_at"]
        out.append(
            {
                "thread_id": str(r["thread_id"]),
                "session_id": str(r["session_id"]),
                "app_id": str(r["app_id"]),
                "last_preview": r["last_preview"],
                "updated_at": ts.isoformat() if ts else None,
                "message_count": int(r["message_count"] or 0),
            }
        )
    return out


async def verify_thread_in_app_session(
    app_id: str, session_id: str, thread_id: str
) -> bool:
    async with pool().acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT 1 FROM chat_thread t
            JOIN chat_session s ON s.id = t.session_id
            WHERE t.id = $1 AND t.session_id = $2 AND s.app_id = $3
            """,
            thread_id,
            session_id,
            app_id,
        )
    return row is not None
