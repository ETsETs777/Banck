"""Снимок OpenAPI: набор путей не расходится с закреплённым файлом (без полного diff схем)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from spektors_api.main import app


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def test_openapi_snapshot_paths_match():
    snap_path = _repo_root() / "docs" / "openapi.snapshot.json"
    if not snap_path.is_file():
        pytest.fail(
            "Отсутствует docs/openapi.snapshot.json — выполните: npm run openapi:snapshot"
        )
    snap = json.loads(snap_path.read_text(encoding="utf-8"))
    current = app.openapi()
    snap_paths = set(snap.get("paths") or {})
    cur_paths = set(current.get("paths") or {})
    assert snap_paths == cur_paths, (
        f"Расхождение путей OpenAPI. Обновите снимок: npm run openapi:snapshot\n"
        f"only in snapshot: {sorted(snap_paths - cur_paths)}\n"
        f"only in current: {sorted(cur_paths - snap_paths)}"
    )
