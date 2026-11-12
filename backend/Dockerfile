FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 callnexa

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=callnexa:callnexa . .
USER callnexa

EXPOSE 8000

# ConnectionManager and startup watchers are process-local. Keep one worker
# until shared pub/sub and singleton background workers are introduced.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "35"]
