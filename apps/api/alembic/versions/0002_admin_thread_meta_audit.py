"""Метаданные тредов для операторов и журнал аудита.

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-01

"""

from __future__ import annotations

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS admin_thread_meta (
            thread_id TEXT PRIMARY KEY REFERENCES chat_thread(id) ON DELETE CASCADE,
            workflow_status TEXT NOT NULL DEFAULT 'queued',
            assignee_label TEXT,
            tags JSONB NOT NULL DEFAULT '[]'::jsonb,
            internal_note TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS admin_audit_log (
            id BIGSERIAL PRIMARY KEY,
            actor_label TEXT,
            action TEXT NOT NULL,
            thread_id TEXT,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_admin_audit_created
        ON admin_audit_log (created_at DESC);
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS admin_audit_log CASCADE;")
    op.execute("DROP TABLE IF EXISTS admin_thread_meta CASCADE;")
