import httpx
import logging
from datetime import datetime
from app.config import settings

logger = logging.getLogger(__name__)


class VeeamCollector:
    def __init__(self):
        self.url = settings.VEEAM_URL
        self.timeout = 15.0

    async def fetch(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.url)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error(f"[Veeam] fetch error: {e}")
            return {}

    def _classify_job(self, job: dict) -> str:
        """Classification améliorée des jobs (inclut les jobs en cours)"""
        is_running = job.get("is_running") is True or job.get("state") == "Working" or job.get("session_state") == "Working"
        
        if is_running:
            return "running"

        result = str(job.get("last_result", "")).lower()
        session_result = str(job.get("session_result", "")).lower()

        if result == "success" or session_result == "success":
            return "success"
        elif result == "failed" or session_result == "failed":
            return "failed"
        elif result == "warning" or session_result == "warning":
            return "warning"
        
        return "unknown"

    def _get_progress_info(self, job: dict) -> dict:
        """Extrait les informations de progression pour les jobs en cours"""
        progress = job.get("progress") or {}
        if isinstance(progress, dict):
            return {
                "pct": progress.get("pct") or job.get("progress_pct") or 0,
                "eta": progress.get("eta") or "",
                "processed_gb": progress.get("processed_gb") or job.get("processed_gb") or 0,
                "total_gb": progress.get("total_gb") or job.get("total_gb") or 0,
                "speed_mbs": progress.get("speed_mbs") or job.get("speed_mbs") or 0,
            }
        return {"pct": 0, "eta": "", "processed_gb": 0, "total_gb": 0, "speed_mbs": 0}

    def _minutes_to_human(self, minutes) -> str:
        if minutes is None or minutes == 0:
            return "N/A"
        try:
            minutes = int(minutes)
            days = minutes // 1440
            hours = (minutes % 1440) // 60
            mins = minutes % 60
            parts = []
            if days > 0:
                parts.append(f"{days}j")
            if hours > 0:
                parts.append(f"{hours}h")
            if mins > 0 or not parts:
                parts.append(f"{mins}m")
            return " ".join(parts)
        except:
            return "N/A"

    async def collect_all(self) -> dict:
        logger.info("[Veeam] Collecting backup data...")

        raw = await self.fetch()
        if not raw:
            return {"error": "No data from Veeam collector"}

        # Gestion des deux formats de payload possibles
        if isinstance(raw.get("payload"), dict) and "veeam" in raw["payload"]:
            veeam_data = raw["payload"]["veeam"]
        else:
            veeam_data = raw

        jobs = veeam_data.get("jobs", [])
        global_stats = veeam_data.get("global", {})

        # Enrichissement des jobs
        enriched_jobs = []
        for job in jobs:
            enriched = dict(job)
            
            enriched["status"] = self._classify_job(job)
            enriched["progress_info"] = self._get_progress_info(job)
            
            # RPO / RTO
            rpo_min = job.get("rpo_minutes") or job.get("rpo", {}).get("minutes")
            rto_min = job.get("rto_minutes") or job.get("rto", {}).get("minutes")
            
            enriched["rpo_human"] = self._minutes_to_human(rpo_min)
            enriched["rto_human"] = self._minutes_to_human(rto_min)
            
            # SLA
            sla = job.get("sla_30d", {}) or {}
            enriched["sla_pct"] = (
                job.get("sla_30d_pct") 
                or sla.get("pct") 
                or job.get("sla_pct") 
                or 0
            )
            
            enriched_jobs.append(enriched)

        # Comptage global
        jobs_running = [j for j in enriched_jobs if j["status"] == "running"]
        jobs_ok = [j for j in enriched_jobs if j["status"] == "success"]
        jobs_failed = [j for j in enriched_jobs if j["status"] == "failed"]
        jobs_warning = [j for j in enriched_jobs if j["status"] == "warning"]

        # Risk jobs
        risk_jobs = []
        for job in enriched_jobs:
            rpo_min = job.get("rpo_minutes") or 0
            if rpo_min > 20160:  # > 14 jours
                risk_jobs.append({
                    "job": job["job_name"],
                    "rpo": job.get("rpo_human", "N/A"),
                    "reason": "RPO très élevé (> 14 jours)"
                })
            if job["status"] == "failed":
                risk_jobs.append({
                    "job": job["job_name"],
                    "rpo": job.get("rpo_human", "N/A"),
                    "reason": "Dernier backup en échec"
                })

        return {
            "global": {
                "sla_pct": global_stats.get("sla_pct", 0),
                "total_sessions_30d": global_stats.get("total_sessions_30d", 0),
                "total_failed_30d": global_stats.get("total_failed_30d", 0),
                "total_success_30d": global_stats.get("total_success_30d", 0),
                "rpo_worst_human": self._minutes_to_human(global_stats.get("rpo_worst_minutes")),
                "rpo_worst_minutes": global_stats.get("rpo_worst_minutes", 0),
                "rto_avg_human": self._minutes_to_human(global_stats.get("rto_avg_minutes")),
                "rto_avg_minutes": global_stats.get("rto_avg_minutes", 0),
                "jobs_count": len(enriched_jobs),
                "jobs_ok_count": len(jobs_ok),
                "jobs_failed_count": len(jobs_failed),
                "jobs_warning_count": len(jobs_warning),
                "jobs_running_count": len(jobs_running),
            },
            "jobs": enriched_jobs,
            "jobs_running": [j["job_name"] for j in jobs_running],
            "jobs_ok": [j["job_name"] for j in jobs_ok],
            "jobs_failed": [j["job_name"] for j in jobs_failed],
            "jobs_warning": [j["job_name"] for j in jobs_warning],
            "risk_jobs": risk_jobs,
            "collected_at": veeam_data.get("collected_at", datetime.utcnow().isoformat())
        }
