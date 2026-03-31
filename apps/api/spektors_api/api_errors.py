"""Локализованные пояснения к стабильным кодам ошибок (заголовок Accept-Language)."""
from __future__ import annotations

# Код в поле detail остаётся машиночитаемым; message — для людей и UI.
_MESSAGES: dict[str, dict[str, str]] = {
    "unknown_app": {
        "en": "Unknown application id (check X-App-Id and config/apps.yaml).",
        "ru": "Неизвестный идентификатор приложения (проверьте X-App-Id и config/apps.yaml).",
        "nl": "Onbekende applicatie-id (controleer X-App-Id en config/apps.yaml).",
    },
    "thread_not_found": {
        "en": "Thread or session not found.",
        "ru": "Тред или сессия не найдены.",
        "nl": "Thread of sessie niet gevonden.",
    },
    "x_app_id_required": {
        "en": "The X-App-Id header is required.",
        "ru": "Требуется заголовок X-App-Id.",
        "nl": "De header X-App-Id is verplicht.",
    },
    "invalid_token": {
        "en": "Invalid Bearer token.",
        "ru": "Неверный Bearer-токен.",
        "nl": "Ongeldig Bearer-token.",
    },
    "internal_auth_not_configured": {
        "en": "Internal API auth is not configured on the server (INTERNAL_AUTH_STRICT).",
        "ru": "Авторизация internal API на сервере не настроена (INTERNAL_AUTH_STRICT).",
        "nl": "Internal API-authenticatie is niet geconfigureerd op de server (INTERNAL_AUTH_STRICT).",
    },
    "bearer_required": {
        "en": "Bearer token required for this internal route.",
        "ru": "Для этого internal-маршрута нужен Bearer-токен.",
        "nl": "Bearer-token vereist voor deze internal-route.",
    },
    "rag_disabled": {
        "en": "RAG is disabled for this application.",
        "ru": "RAG отключён для этого приложения.",
        "nl": "RAG is uitgeschakeld voor deze applicatie.",
    },
    "chroma_collection_not_configured": {
        "en": "Chroma collection is not configured for this application.",
        "ru": "Коллекция Chroma не настроена для этого приложения.",
        "nl": "Chroma-collectie is niet geconfigureerd voor deze applicatie.",
    },
    "chroma_unavailable": {
        "en": "Chroma service is unavailable.",
        "ru": "Сервис Chroma недоступен.",
        "nl": "Chroma-service is niet beschikbaar.",
    },
    "session_app_mismatch": {
        "en": "Session belongs to another application.",
        "ru": "Сессия принадлежит другому приложению.",
        "nl": "Sessie hoort bij een andere applicatie.",
    },
    "thread_session_mismatch": {
        "en": "Thread does not belong to this session.",
        "ru": "Тред не принадлежит этой сессии.",
        "nl": "Thread hoort niet bij deze sessie.",
    },
    "invalid_json": {
        "en": "Request body is not valid JSON.",
        "ru": "Тело запроса — невалидный JSON.",
        "nl": "Requestbody is geen geldige JSON.",
    },
    "messages_required": {
        "en": "The messages field is required.",
        "ru": "Поле messages обязательно.",
        "nl": "Het veld messages is verplicht.",
    },
}


def pick_locale(accept_language: str | None) -> str:
    if not accept_language:
        return "en"
    for part in accept_language.split(","):
        tag = part.split(";")[0].strip().lower()
        if tag.startswith("ru"):
            return "ru"
        if tag.startswith("nl"):
            return "nl"
        if tag.startswith("en"):
            return "en"
    return "en"


def localized_message(detail: str, accept_language: str | None) -> str | None:
    lang = pick_locale(accept_language)
    if detail.startswith("bearer_required_for_"):
        row = _MESSAGES["bearer_required"]
        return row.get(lang) or row["en"]
    row = _MESSAGES.get(detail)
    if not row:
        return None
    return row.get(lang) or row["en"]
