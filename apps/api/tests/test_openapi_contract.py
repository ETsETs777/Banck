"""Минимальный контракт: критичные пути присутствуют в OpenAPI."""
from __future__ import annotations

import pytest

from spektors_api.main import app

REQUIRED_PATHS = frozenset(
    {
        "/api/v1/health",
        "/api/v1/health/live",
        "/api/v1/health/ready",
        "/api/v1/chat",
        "/api/v1/rag/query",
        "/internal/admin/v1/threads",
        "/internal/admin/v1/sessions/{session_id}/threads/{thread_id}/reply",
    }
)


@pytest.fixture(scope="module")
def openapi_schema():
    return app.openapi()


def test_openapi_version(openapi_schema):
    assert openapi_schema.get("openapi") in ("3.0.2", "3.1.0", "3.1.1")


def test_required_paths_exist(openapi_schema):
    paths = set(openapi_schema.get("paths") or {})
    missing = REQUIRED_PATHS - paths
    assert not missing, f"missing paths: {sorted(missing)}"


def test_internal_threads_get_method(openapi_schema):
    threads = openapi_schema["paths"]["/internal/admin/v1/threads"]
    assert "get" in threads
