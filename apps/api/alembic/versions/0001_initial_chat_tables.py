"""Начальные таблицы чата (сессии, треды, сообщения).

Revision ID: 0001
Revises:
Create Date: 2026-03-31

"""

from __future__ import annotations

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_session (
            id TEXT PRIMARY KEY,
            app_id TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_thread (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
            title TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_message (
            id BIGSERIAL PRIMARY KEY,
            thread_id TEXT NOT NULL REFERENCES chat_thread(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            msg_source TEXT NOT NULL DEFAULT 'model',
            author_label TEXT
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chat_message_thread
        ON chat_message (thread_id, id);
        """
    )
    # БД из старых версий pool.py: таблица уже есть, колонки добавлялись ALTER-ами.
    op.execute(
        "ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS "
        "msg_source TEXT NOT NULL DEFAULT 'model';"
    )
    op.execute(
        "ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS author_label TEXT;"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chat_message CASCADE;")
    op.execute("DROP TABLE IF EXISTS chat_thread CASCADE;")
    op.execute("DROP TABLE IF EXISTS chat_session CASCADE;")
