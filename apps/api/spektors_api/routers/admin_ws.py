"""WebSocket для админки: heartbeat до появления push-событий по тредам."""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["internal"])


@router.websocket("/ws")
async def admin_inbox_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    expected = os.environ.get("INTERNAL_ADMIN_TOKEN", "").strip()
    token = (websocket.query_params.get("token") or "").strip()
    if expected and token != expected:
        await websocket.close(code=4401)
        return
    try:
        while True:
            await websocket.send_json(
                {
                    "type": "heartbeat",
                    "ts": datetime.now(timezone.utc).isoformat(),
                }
            )
            await asyncio.sleep(25)
    except WebSocketDisconnect:
        return
