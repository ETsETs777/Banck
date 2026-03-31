"""Загрузка `config/apps.yaml` и поиск приложения по `app_id`."""
from __future__ import annotations

import logging
from pathlib import Path

import yaml

logger = logging.getLogger("spektors.apps_config")

# spektors_api/config/apps.py → parents[4] = корень монорепозитория (где лежит config/apps.yaml)
REPO_ROOT = Path(__file__).resolve().parents[4]
APPS_CONFIG_PATH = REPO_ROOT / "config" / "apps.yaml"


def load_apps_config() -> dict:
    if not APPS_CONFIG_PATH.is_file():
        return {"apps": {}}
    with APPS_CONFIG_PATH.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {"apps": {}}


def collect_cors_origins(cfg: dict) -> list[str]:
    origins: set[str] = set()
    for _key, app in (cfg.get("apps") or {}).items():
        for o in app.get("cors_origins") or []:
            origins.add(o)
    return sorted(origins)


def find_app(cfg: dict, app_id: str) -> dict | None:
    for _key, app in (cfg.get("apps") or {}).items():
        if app.get("app_id") == app_id:
            return app
    return None


def log_config_issues(cfg: dict) -> None:
    """Предупреждения при старте: целостность apps.yaml без жёсткого падения."""
    apps = cfg.get("apps") or {}
    if not apps:
        logger.warning("config/apps.yaml: секция apps пуста или отсутствует")
        return
    for key, app in apps.items():
        if not isinstance(app, dict):
            logger.error("config/apps.yaml: запись %r не является объектом", key)
            continue
        aid = app.get("app_id")
        if not aid or not isinstance(aid, str):
            logger.error(
                "config/apps.yaml: у ключа %r нет непустого строкового app_id",
                key,
            )
            continue
        if app.get("rag_enabled") and not (str(app.get("chroma_collection") or "").strip()):
            logger.warning(
                "config/apps.yaml: app_id=%s с rag_enabled=true, но chroma_collection пуста",
                aid,
            )


CONFIG = load_apps_config()
