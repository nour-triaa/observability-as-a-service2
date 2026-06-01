from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # API Sources
    PROMETHEUS_URL: str = "http://prometheus.local/api/v1/query"
    PROMETHEUS_RANGE_URL: str = "http://prometheus.local/api/v1/query_range"
    PROMETHEUS_ALERTS_URL: str = "http://prometheus.local/api/v1/alerts"
    LOKI_URL: str = "http://loki.local/loki/api/v1"
    SIGNOZ_ALERTS_URL: str = "http://alerts.local/api/alerts"
    VEEAM_URL: str = "http://veeam-collector.local/data"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://reporter:reporter123@reporter-postgres:5432/reporter_db"

    # Storage
    REPORTS_DIR: str = "/data/reports"
    RETENTION_DAYS: int = 30

    # Scheduler
    REPORT_INTERVAL_HOURS: int = 12

    # App
    APP_NAME: str = "ESXi Reporter"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
