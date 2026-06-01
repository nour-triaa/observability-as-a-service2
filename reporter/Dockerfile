FROM python:3.11-slim

# ── System deps ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libfreetype6-dev \
    libpng-dev \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Working dir ───────────────────────────────────────────────────────────────
WORKDIR /app

# ── Python deps ───────────────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── App code ──────────────────────────────────────────────────────────────────
COPY app/ ./app/

# ── Reports storage dir ───────────────────────────────────────────────────────
RUN mkdir -p /data/reports

# ── Non-root user ─────────────────────────────────────────────────────────────
RUN addgroup --system reporter && adduser --system --ingroup reporter reporter
RUN chown -R reporter:reporter /app /data
USER reporter

# ── Expose ────────────────────────────────────────────────────────────────────
EXPOSE 8080

# ── Healthcheck ───────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# ── Start ─────────────────────────────────────────────────────────────────────
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", \
     "--workers", "1", "--log-level", "info"]
