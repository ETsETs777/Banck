"""Общие настройки подключения к Ollama."""
from __future__ import annotations

import os
from typing import Any


def llm_base() -> str:
    return os.environ.get("LLM_BASE_URL", "http://127.0.0.1:11434").rstrip("/")


def default_ollama_model() -> str:
    return os.environ.get("DEFAULT_OLLAMA_MODEL", "qwen2.5:7b")


def model_for_app(app: dict[str, Any]) -> str:
    m = (app.get("ollama_model") or "").strip()
    return m if m else default_ollama_model()
