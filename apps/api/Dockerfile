FROM python:3.12-slim

WORKDIR /repo/apps/api

COPY apps/api/pyproject.toml ./
COPY apps/api/alembic.ini ./
COPY apps/api/alembic ./alembic
RUN pip install --no-cache-dir fastapi "uvicorn[standard]" pyyaml httpx asyncpg chromadb alembic sqlalchemy psycopg2-binary

COPY apps/api/spektors_api ./spektors_api
COPY config /repo/config

EXPOSE 8000

CMD ["uvicorn", "spektors_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
