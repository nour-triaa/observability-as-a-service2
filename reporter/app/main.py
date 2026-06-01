import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.storage.db import init_db, list_reports, get_report_by_id, purge_old_reports
from app.scheduler import start_scheduler, generate_report, scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 ESXi Reporter starting up...")
    await init_db()
    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    start_scheduler()
    yield
    logger.info("🛑 ESXi Reporter shutting down...")
    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="ESXi Reporter API",
    version=settings.APP_VERSION,
    description="Microservice de génération de rapports PDF pour infrastructure ESXi",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "service": "esxi-reporter",
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/ready", tags=["System"])
async def ready():
    """Kubernetes readiness probe"""
    try:
        reports = await list_reports(limit=1)
        return {"status": "ready", "db": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Not ready: {str(e)}")


# ─── Reports ─────────────────────────────────────────────────────────────────

@app.get("/api/reports", tags=["Reports"])
async def get_reports(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    """Liste tous les rapports disponibles"""
    try:
        reports = await list_reports(limit=limit, offset=offset)
        result = []
        for r in reports:
            result.append({
                "id": r.id,
                "filename": r.filename,
                "generated_at": r.generated_at.isoformat() if r.generated_at else None,
                "period_start": r.period_start.isoformat() if r.period_start else None,
                "period_end": r.period_end.isoformat() if r.period_end else None,
                "size_bytes": r.size_bytes,
                "size_human": _human_size(r.size_bytes),
                "health_score": r.health_score,
                "health_label": r.health_label,
                "sla_pct": r.sla_pct,
                "total_alerts": r.total_alerts,
                "backup_failed": r.backup_failed,
                "backup_ok": r.backup_ok,
                "host_cpu_usage": r.host_cpu_usage,
                "host_mem_usage": r.host_mem_usage,
                "datastore_free_pct": r.datastore_free_pct,
                "summary": r.summary,
                "download_url": f"/api/reports/{r.id}/download"
            })
        return {"total": len(result), "offset": offset, "limit": limit, "reports": result}
    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/{report_id}", tags=["Reports"])
async def get_report(report_id: int):
    """Détail d'un rapport par ID"""
    report = await get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé")
    return {
        "id": report.id,
        "filename": report.filename,
        "generated_at": report.generated_at.isoformat() if report.generated_at else None,
        "period_start": report.period_start.isoformat() if report.period_start else None,
        "period_end": report.period_end.isoformat() if report.period_end else None,
        "size_bytes": report.size_bytes,
        "size_human": _human_size(report.size_bytes),
        "health_score": report.health_score,
        "health_label": report.health_label,
        "sla_pct": report.sla_pct,
        "total_alerts": report.total_alerts,
        "backup_failed": report.backup_failed,
        "backup_ok": report.backup_ok,
        "host_cpu_usage": report.host_cpu_usage,
        "host_mem_usage": report.host_mem_usage,
        "datastore_free_pct": report.datastore_free_pct,
        "summary": report.summary,
        "download_url": f"/api/reports/{report.id}/download"
    }


@app.get("/api/reports/{report_id}/download", tags=["Reports"])
async def download_report(report_id: int):
    """Télécharger un rapport PDF"""
    report = await get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé")
    if not os.path.exists(report.filepath):
        raise HTTPException(status_code=404, detail="Fichier PDF introuvable sur le disque")
    return FileResponse(
        path=report.filepath,
        filename=report.filename,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{report.filename}"'}
    )


# ─── Admin / Trigger ─────────────────────────────────────────────────────────

@app.post("/api/reports/generate", tags=["Admin"])
async def trigger_report(background_tasks: BackgroundTasks):
    """Déclenche la génération immédiate d'un rapport (hors planning)"""
    background_tasks.add_task(_run_generation)
    return {
        "status": "accepted",
        "message": "Génération du rapport démarrée en arrière-plan",
        "timestamp": datetime.utcnow().isoformat()
    }


async def _run_generation():
    try:
        filename = await generate_report()
        logger.info(f"[Manual] Rapport généré : {filename}")
    except Exception as e:
        logger.error(f"[Manual] Erreur : {e}", exc_info=True)


@app.post("/api/reports/purge", tags=["Admin"])
async def trigger_purge():
    """Déclenche manuellement la purge des rapports anciens"""
    deleted = await purge_old_reports(settings.RETENTION_DAYS)
    return {
        "status": "ok",
        "deleted_count": deleted,
        "retention_days": settings.RETENTION_DAYS
    }


@app.get("/api/scheduler/status", tags=["Admin"])
async def scheduler_status():
    """Statut du scheduler APScheduler"""
    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": next_run.isoformat() if next_run else None
        })
    return {
        "running": scheduler.running,
        "jobs": jobs
    }


def _human_size(size_bytes: Optional[int]) -> str:
    if not size_bytes:
        return "N/A"
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 ** 2:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / 1024**2:.1f} MB"
