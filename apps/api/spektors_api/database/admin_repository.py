"""Операторские метаданные тредов и аудит (PostgreSQL)."""
from __future__ import annotations

import json
from typing import Any

from spektors_api.database.pool import pool


async def get_thread_meta_row(thread_id: str) -> dict[str, Any] | None:
    async with pool().acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT thread_id, workflow_status, assignee_label, tags, internal_note, updated_at
            FROM admin_thread_meta WHERE thread_id = $1
            """,
            thread_id,
        )
    if row is None:
        return None
    tags = row["tags"]
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except json.JSONDecodeError:
            tags = []
    if not isinstance(tags, list):
        tags = []
    ts = row["updated_at"]
    return {
        "thread_id": str(row["thread_id"]),
        "workflow_status": str(row["workflow_status"] or "queued"),
        "assignee_label": row["assignee_label"],
        "tags": [str(x) for x in tags],
        "internal_note": row["internal_note"],
        "updated_at": ts.isoformat() if ts else None,
    }


async def merge_thread_meta(
    thread_id: str,
    patch: dict[str, Any],
) -> dict[str, Any]:
    """Частичное обновление: в patch только поля из тела запроса (в т.ч. null для сброса)."""
    prev = await get_thread_meta_row(thread_id)
    ws = (
        patch["workflow_status"]
        if "workflow_status" in patch
        else (prev["workflow_status"] if prev else "queued")
    )
    if "assignee_label" in patch:
        al = patch["assignee_label"]
    else:
        al = prev["assignee_label"] if prev else None
    if "tags" in patch:
        tg = list(patch["tags"]) if patch["tags"] is not None else []
    else:
        tg = prev["tags"] if prev else []
    if "internal_note" in patch:
        note = patch["internal_note"]
    else:
        note = prev["internal_note"] if prev else None

    async with pool().acquire() as conn:
        await conn.execute(
            """
            INSERT INTO admin_thread_meta (thread_id, workflow_status, assignee_label, tags, internal_note)
            VALUES ($1, $2, $3, $4::jsonb, $5)
            ON CONFLICT (thread_id) DO UPDATE SET
              workflow_status = EXCLUDED.workflow_status,
              assignee_label = EXCLUDED.assignee_label,
              tags = EXCLUDED.tags,
              internal_note = EXCLUDED.internal_note,
              updated_at = NOW()
            """,
            thread_id,
            ws,
            al,
            json.dumps(tg),
            note,
        )
    out = await get_thread_meta_row(thread_id)
    assert out is not None
    return out


async def append_audit(
    *,
    actor_label: str | None,
    action: str,
    thread_id: str | None,
    payload: dict[str, Any] | None = None,
) -> None:
    async with pool().acquire() as conn:
        await conn.execute(
            """
            INSERT INTO admin_audit_log (actor_label, action, thread_id, payload)
            VALUES ($1, $2, $3, $4::jsonb)
            """,
            actor_label,
            action,
            thread_id,
            json.dumps(payload or {}),
        )


async def list_audit(limit: int, offset: int) -> list[dict[str, Any]]:
    lim = min(max(limit, 1), 500)
    off = max(offset, 0)
    async with pool().acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, actor_label, action, thread_id, payload, created_at
            FROM admin_audit_log
            ORDER BY id DESC
            LIMIT $1 OFFSET $2
            """,
            lim,
            off,
        )
    out: list[dict[str, Any]] = []
    for r in rows:
        ts = r["created_at"]
        pl = r["payload"]
        if isinstance(pl, str):
            try:
                pl = json.loads(pl)
            except json.JSONDecodeError:
                pl = {}
        out.append(
            {
                "id": int(r["id"]),
                "actor_label": r["actor_label"],
                "action": str(r["action"]),
                "thread_id": r["thread_id"],
                "payload": pl if isinstance(pl, dict) else {},
                "created_at": ts.isoformat() if ts else None,
            }
        )
    return out
