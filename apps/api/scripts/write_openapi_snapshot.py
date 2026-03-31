#!/usr/bin/env python3
"""Запись docs/openapi.snapshot.json в корне монорепо. Запуск из любой директории: py -3 apps/api/scripts/write_openapi_snapshot.py"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

_SCRIPT = Path(__file__).resolve()
_API_ROOT = _SCRIPT.parents[1]
_REPO_ROOT = _SCRIPT.parents[3]
_OUT = _REPO_ROOT / "docs" / "openapi.snapshot.json"


def main() -> None:
    os.chdir(_API_ROOT)
    if str(_API_ROOT) not in sys.path:
        sys.path.insert(0, str(_API_ROOT))

    from spektors_api.main import app  # noqa: E402

    schema = app.openapi()
    _OUT.parent.mkdir(parents=True, exist_ok=True)
    _OUT.write_text(
        json.dumps(schema, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print("wrote", _OUT)


if __name__ == "__main__":
    main()
