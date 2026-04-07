"""
Кастомные страницы Swagger UI и ReDoc: тёмная тема и типографика в духе Spektors.
"""
from __future__ import annotations

import json
from html import escape
from pathlib import Path

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html, get_swagger_ui_oauth2_redirect_html
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

_ASSETS_DIR = Path(__file__).resolve().parent / "static" / "docs_assets"

_REDOC_THEME = {
    "colors": {
        "primary": {
            "main": "#2dd4bf",
            "light": "#5eead4",
            "dark": "#0d9488",
            "contrastText": "#042f2e",
        },
        "text": {"primary": "#e8eaef", "secondary": "#9aa3b2"},
        "responses": {
            "success": {"color": "#34d399"},
            "error": {"color": "#f87171"},
            "redirect": {"color": "#a78bfa"},
            "info": {"color": "#38bdf8"},
        },
        "http": {
            "get": "#34d399",
            "post": "#38bdf8",
            "put": "#fbbf24",
            "delete": "#f87171",
            "patch": "#c084fc",
        },
    },
    "sidebar": {
        "backgroundColor": "#12171f",
        "textColor": "#e8eaef",
        "activeTextColor": "#2dd4bf",
        "arrow": {"color": "#9aa3b2"},
    },
    "rightPanel": {"backgroundColor": "#0f1419"},
    "typography": {
        "fontSize": "14px",
        "lineHeight": "1.6",
        "fontFamily": "system-ui, 'Segoe UI', sans-serif",
        "code": {"fontFamily": "ui-monospace, monospace", "fontSize": "13px"},
        "headings": {
            "fontFamily": "system-ui, 'Segoe UI', sans-serif",
            "fontWeight": "600",
        },
    },
    "schema": {
        "linesColor": "rgba(255,255,255,0.08)",
        "typeNameColor": "#a5f3fc",
        "requireLabelColor": "#f87171",
    },
}


def register_openapi_docs_ui(app: FastAPI) -> None:
    """
    Подключает /docs и /redoc без дефолтных хендлеров FastAPI
    (нужно создать приложение с docs_url=None, redoc_url=None).
    """
    openapi_url = app.openapi_url
    if not openapi_url:
        raise ValueError("app.openapi_url must be set")

    if not _ASSETS_DIR.is_dir():
        raise FileNotFoundError(f"Docs UI assets missing: {_ASSETS_DIR}")

    app.mount(
        "/openapi-docs-assets",
        StaticFiles(directory=str(_ASSETS_DIR)),
        name="openapi_docs_assets",
    )

    @app.get("/docs/oauth2-redirect", include_in_schema=False)
    async def swagger_oauth2_redirect():
        return get_swagger_ui_oauth2_redirect_html()

    @app.get("/docs", include_in_schema=False)
    async def swagger_docs():
        resp = get_swagger_ui_html(
            openapi_url=openapi_url,
            title=f"{app.title} · Swagger",
            oauth2_redirect_url="/docs/oauth2-redirect",
            swagger_ui_parameters={
                "deepLinking": True,
                "displayRequestDuration": True,
                "filter": True,
                "persistAuthorization": True,
                "syntaxHighlight.theme": "agate",
            },
        )
        html = resp.body.decode("utf-8")
        inject = (
            '<link rel="preconnect" href="https://fonts.googleapis.com" />\n'
            '  <link rel="stylesheet" '
            'href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" />\n'
            '  <link rel="stylesheet" href="/openapi-docs-assets/swagger-theme.css" />\n'
            "</head>"
        )
        html = html.replace("</head>", inject, 1)
        return HTMLResponse(content=html)

    @app.get("/redoc", include_in_schema=False)
    async def redoc_docs():
        theme_attr = json.dumps(_REDOC_THEME, separators=(",", ":"))
        title = escape(f"{app.title} · ReDoc")
        spec = escape(openapi_url, quote=True)
        html = f"""<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>{title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&display=swap"/>
    <link rel="stylesheet" href="/openapi-docs-assets/redoc-wrap.css"/>
  </head>
  <body>
    <redoc spec-url="{spec}" theme='{theme_attr}'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js"></script>
  </body>
</html>
"""
        return HTMLResponse(content=html)
