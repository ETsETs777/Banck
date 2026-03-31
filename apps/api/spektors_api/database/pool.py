"""Пул PostgreSQL (asyncpg): сессии чата и сообщения."""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Optional

import asyncpg

_pool: Optional[asyncpg.Pool] = None


def _alembic_upgrade_to_head() -> None:
    """Синхронный upgrade (psycopg2); вызывать из async через to_thread."""
    from alembic import command
    from alembic.config import Config

    api_root = Path(__file__).resolve().parents[2]
    ini = api_root / "alembic.ini"
    cfg = Config(str(ini))
    cfg.set_main_option("sqlalchemy.url", database_url())
    command.upgrade(cfg, "head")


def database_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        "postgresql://spektors:spektors@127.0.0.1:5432/spektors",
    )


def _pool_bounds() -> tuple[int, int]:
    try:
        mn = max(1, int(os.environ.get("DB_POOL_MIN", "1")))
        mx = max(mn, int(os.environ.get("DB_POOL_MAX", "10")))
    except ValueError:
        return 1, 10
    return mn, mx


async def init_db() -> None:
    global _pool
    if _pool is not None:
        return
    mn, mx = _pool_bounds()
    _pool = await asyncpg.create_pool(
        database_url(),
        min_size=mn,
        max_size=mx,
        command_timeout=60,
    )
    await asyncio.to_thread(_alembic_upgrade_to_head)


async def close_db() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("БД не инициализирована (вызовите init_db при старте)")
    return _pool


async def ping_db() -> bool:
    if _pool is None:
        return False
    try:
        async with _pool.acquire() as conn:
            v = await conn.fetchval("SELECT 1")
            return v == 1
    except Exception:
        return False
