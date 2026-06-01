import logging
import os
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from app.collectors.prometheus import PrometheusCollector
from app.collectors.loki import LokiCollector, SignozCollector
from app.collectors.veeam import VeeamCollector
from app.engine.correlator import CorrelationEngine
from app.generator.pdf_builder import PDFReportBuilder
from app.storage.db import save_report, purge_old_reports
from app.config import settings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")


async def generate_report():
    """Pipeline complet : collecte → corrélation → PDF → stockage"""
    logger.info("=" * 60)
    logger.info("[Scheduler] Démarrage génération rapport...")
    period_end = datetime.utcnow()
    period_start = period_end - timedelta(hours=settings.REPORT_INTERVAL_HOURS)

    try:
        # ── 1. Collect ──────────────────────────────────────────────
        logger.info("[Step 1/4] Collecte des données...")
        prom_collector = PrometheusCollector()
        loki_collector = LokiCollector()
        signoz_collector = SignozCollector()
        veeam_collector = VeeamCollector()

        prometheus_data = await prom_collector.collect_all()
        loki_data = await loki_collector.collect_all()
        signoz_data = await signoz_collector.collect_all()
        veeam_data = await veeam_collector.collect_all()

        # ── 2. Correlate & Analyze ───────────────────────────────────
        logger.info("[Step 2/4] Analyse et corrélation...")
        engine = CorrelationEngine()
        analysis = engine.analyze(prometheus_data, loki_data, signoz_data, veeam_data)

        # ── 3. Generate PDF ──────────────────────────────────────────
        logger.info("[Step 3/4] Génération PDF...")
        builder = PDFReportBuilder()
        filepath, filename = builder.build(
            prometheus=prometheus_data,
            loki=loki_data,
            signoz=signoz_data,
            veeam=veeam_data,
            analysis=analysis,
            period_start=period_start,
            period_end=period_end
        )

        # ── 4. Save to DB ────────────────────────────────────────────
        logger.info("[Step 4/4] Sauvegarde en base...")
        file_size = os.path.getsize(filepath) if os.path.exists(filepath) else 0
        host = prometheus_data.get("host", {})
        vg = veeam_data.get("global", {})
        ds = prometheus_data.get("datastore", {})

        await save_report({
            "filename": filename,
            "filepath": filepath,
            "generated_at": period_end,
            "period_start": period_start,
            "period_end": period_end,
            "size_bytes": file_size,
            "sla_pct": vg.get("sla_pct"),
            "total_alerts": len(prometheus_data.get("alerts", [])),
            "backup_failed": vg.get("jobs_failed_count", 0),
            "backup_ok": vg.get("jobs_ok_count", 0),
            "host_cpu_usage": host.get("cpu_pct"),
            "host_mem_usage": host.get("mem_pct"),
            "datastore_free_pct": ds.get("free_pct"),
            "health_score": analysis.get("health_score"),
            "health_label": analysis.get("health_label"),
            "summary": analysis.get("executive_summary", "")[:1000]
        })

        logger.info(f"[Scheduler] ✅ Rapport généré : {filename} ({file_size // 1024} KB)")
        return filename

    except Exception as e:
        logger.error(f"[Scheduler] ❌ Erreur génération rapport : {e}", exc_info=True)
        raise


async def purge_reports():
    """Purge automatique des rapports > 30 jours"""
    logger.info("[Scheduler] Purge des rapports anciens...")
    try:
        deleted = await purge_old_reports(settings.RETENTION_DAYS)
        logger.info(f"[Scheduler] Purge : {deleted} rapport(s) supprimé(s)")
    except Exception as e:
        logger.error(f"[Scheduler] Erreur purge : {e}", exc_info=True)


def start_scheduler():
    # Rapport toutes les 12h
    scheduler.add_job(
        generate_report,
        trigger=IntervalTrigger(hours=settings.REPORT_INTERVAL_HOURS),
        id="generate_report",
        name="Génération rapport 12h",
        replace_existing=True,
        misfire_grace_time=300
    )

    # Purge chaque jour à 03:00 UTC
    scheduler.add_job(
        purge_reports,
        trigger=CronTrigger(hour=3, minute=0),
        id="purge_reports",
        name="Purge rapports > 30j",
        replace_existing=True
    )

    scheduler.start()
    logger.info("[Scheduler] Démarré — rapport toutes les 12h, purge quotidienne à 03:00 UTC")
