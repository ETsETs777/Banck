"""Типы путей FastAPI: hex id без дефисов (как uuid.uuid4().hex)."""
from __future__ import annotations

from typing import Annotated

from fastapi import Path

HexIdPath = Annotated[
    str,
    Path(
        ...,
        min_length=8,
        max_length=64,
        pattern=r"^[a-fA-F0-9]+$",
        description=(
            "Идентификатор сессии или треда: hex 8–64 символов (как `uuid.uuid4().hex`), без дефисов"
        ),
        examples=["a1b2c3d4e5f6789012345678abcdef01"],
    ),
]
