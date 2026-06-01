import os
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, Integer, Float, Text, select, delete
from app.config import settings


class Base(DeclarativeBase):
    pass


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    filepath: Mapped[str] = mapped_column(String(500), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    period_start: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    period_end: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=True)

    # Summary stats
    sla_pct: Mapped[float] = mapped_column(Float, nullable=True)
    total_alerts: Mapped[int] = mapped_column(Integer, nullable=True)
    backup_failed: Mapped[int] = mapped_column(Integer, nullable=True)
    backup_ok: Mapped[int] = mapped_column(Integer, nullable=True)
    host_cpu_usage: Mapped[float] = mapped_column(Float, nullable=True)
    host_mem_usage: Mapped[float] = mapped_column(Float, nullable=True)
    datastore_free_pct: Mapped[float] = mapped_column(Float, nullable=True)

    # Analysis
    health_score: Mapped[float] = mapped_column(Float, nullable=True)  # 0-100
    health_label: Mapped[str] = mapped_column(String(20), nullable=True)  # GOOD/WARNING/CRITICAL
    summary: Mapped[str] = mapped_column(Text, nullable=True)


engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def save_report(report_data: dict) -> Report:
    async with AsyncSessionLocal() as session:
        report = Report(**report_data)
        session.add(report)
        await session.commit()
        await session.refresh(report)
        return report


async def list_reports(limit: int = 100, offset: int = 0):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Report).order_by(Report.generated_at.desc()).limit(limit).offset(offset)
        )
        return result.scalars().all()


async def get_report_by_id(report_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Report).where(Report.id == report_id))
        return result.scalar_one_or_none()


async def purge_old_reports(retention_days: int = 30):
    """Supprime les rapports plus vieux que retention_days jours"""
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Report).where(Report.generated_at < cutoff)
        )
        old_reports = result.scalars().all()
        deleted_count = 0
        for report in old_reports:
            # Supprimer le fichier PDF
            if os.path.exists(report.filepath):
                os.remove(report.filepath)
            await session.delete(report)
            deleted_count += 1
        await session.commit()
        return deleted_count
