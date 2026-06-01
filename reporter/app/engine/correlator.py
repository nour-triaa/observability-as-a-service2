import logging
from datetime import datetime
from typing import Optional
 
logger = logging.getLogger(__name__)
 
 
class CorrelationEngine:
    """
    Moteur de corrélation intelligent.
    Analyse les données cross-sources pour détecter des patterns,
    anomalies et corrélations entre métriques, logs, alertes et backups.
    """
 
    def __init__(self):
        self.insights = []
        self.correlations = []
        self.risk_level = "LOW"  # LOW / MEDIUM / HIGH / CRITICAL
 
    def analyze(self, prometheus: dict, loki: dict, signoz: dict, veeam: dict) -> dict:
        self.insights = []
        self.correlations = []
        score = 100.0
 
        score = self._analyze_host(prometheus, score)
        score = self._analyze_datastore(prometheus, score)
        score = self._analyze_vms(prometheus, score)
        score = self._analyze_backups(veeam, score)
        score = self._analyze_logs(loki, score)
        score = self._analyze_alerts(prometheus, signoz, score)
        self._cross_correlate(prometheus, loki, veeam, signoz)
 
        score = max(0.0, min(100.0, score))
        self.risk_level = self._score_to_risk(score)
 
        return {
            "health_score": round(score, 1),
            "health_label": self.risk_level,
            "insights": self.insights,
            "correlations": self.correlations,
            "executive_summary": self._build_summary(prometheus, veeam, loki, signoz, score)
        }
 
    def _analyze_host(self, prom: dict, score: float) -> float:
        host = prom.get("host", {})
        cpu_pct = host.get("cpu_pct", 0)
        mem_pct = host.get("mem_pct", 0)
        power = host.get("power_state", 1)
        maintenance = host.get("maintenance_mode", False)
 
        if power != 1:
            self.insights.append({
                "level": "CRITICAL",
                "category": "Host",
                "message": f"Hôte ESXi hors tension ou état inconnu (power_state={power})"
            })
            score -= 30
 
        if maintenance:
            self.insights.append({
                "level": "WARNING",
                "category": "Host",
                "message": "Hôte ESXi en mode maintenance"
            })
            score -= 10
 
        if cpu_pct > 90:
            self.insights.append({
                "level": "CRITICAL",
                "category": "CPU",
                "message": f"CPU hôte critique : {cpu_pct:.1f}% d'utilisation"
            })
            score -= 20
        elif cpu_pct > 70:
            self.insights.append({
                "level": "WARNING",
                "category": "CPU",
                "message": f"CPU hôte élevé : {cpu_pct:.1f}% d'utilisation"
            })
            score -= 10
        else:
            self.insights.append({
                "level": "OK",
                "category": "CPU",
                "message": f"CPU hôte nominal : {cpu_pct:.1f}%"
            })
 
        if mem_pct > 90:
            self.insights.append({
                "level": "CRITICAL",
                "category": "Mémoire",
                "message": f"Mémoire hôte critique : {mem_pct:.1f}% utilisée"
            })
            score -= 20
        elif mem_pct > 75:
            self.insights.append({
                "level": "WARNING",
                "category": "Mémoire",
                "message": f"Mémoire hôte élevée : {mem_pct:.1f}% utilisée"
            })
            score -= 8
        else:
            self.insights.append({
                "level": "OK",
                "category": "Mémoire",
                "message": f"Mémoire hôte nominale : {mem_pct:.1f}%"
            })
 
        return score
 
    def _analyze_datastore(self, prom: dict, score: float) -> float:
        ds = prom.get("datastore", {})
        free_pct = ds.get("free_pct", 100)
        accessible = ds.get("accessible", True)
 
        if not accessible:
            self.insights.append({
                "level": "CRITICAL",
                "category": "Datastore",
                "message": f"Datastore '{ds.get('name')}' inaccessible !"
            })
            score -= 35
 
        if free_pct < 10:
            self.insights.append({
                "level": "CRITICAL",
                "category": "Datastore",
                "message": f"Espace libre critique : seulement {free_pct:.1f}% disponible ({ds.get('free_gb', 0):.1f} GB)"
            })
            score -= 25
        elif free_pct < 20:
            self.insights.append({
                "level": "WARNING",
                "category": "Datastore",
                "message": f"Espace libre faible : {free_pct:.1f}% ({ds.get('free_gb', 0):.1f} GB libres)"
            })
            score -= 10
        else:
            self.insights.append({
                "level": "OK",
                "category": "Datastore",
                "message": f"Espace disque OK : {free_pct:.1f}% libre ({ds.get('free_gb', 0):.1f} GB)"
            })
 
        return score
 
    def _analyze_vms(self, prom: dict, score: float) -> float:
        vms = prom.get("vms", {})
        total = len(vms)
        powered_on = sum(1 for v in vms.values() if v.get("power_state", 0) == 1)
        powered_off = total - powered_on
 
        self.insights.append({
            "level": "INFO",
            "category": "VMs",
            "message": f"{total} VMs inventoriées : {powered_on} allumées, {powered_off} éteintes"
        })
 
        if total > 0 and powered_on == 0:
            self.insights.append({
                "level": "WARNING",
                "category": "VMs",
                "message": "Aucune VM en cours d'exécution sur cet hôte"
            })
            score -= 5
 
        return score
 
    def _analyze_backups(self, veeam: dict, score: float) -> float:
        global_stats = veeam.get("global", {})
        sla_pct = global_stats.get("sla_pct", 100)
        failed_count = global_stats.get("jobs_failed_count", 0)
        warning_count = global_stats.get("jobs_warning_count", 0)
        jobs = veeam.get("jobs", [])
        risk_jobs = veeam.get("risk_jobs", [])
 
        if sla_pct < 50:
            self.insights.append({
                "level": "CRITICAL",
                "category": "Backup",
                "message": f"SLA Backup critique : {sla_pct:.1f}% (objectif 90%+)"
            })
            score -= 20
        elif sla_pct < 80:
            self.insights.append({
                "level": "WARNING",
                "category": "Backup",
                "message": f"SLA Backup insuffisant : {sla_pct:.1f}%"
            })
            score -= 10
        else:
            self.insights.append({
                "level": "OK",
                "category": "Backup",
                "message": f"SLA Backup satisfaisant : {sla_pct:.1f}%"
            })
 
        if failed_count > 0:
            failed_names = veeam.get("jobs_failed", [])
            self.insights.append({
                "level": "CRITICAL",
                "category": "Backup",
                "message": f"{failed_count} job(s) en échec : {', '.join(failed_names)}"
            })
            score -= (failed_count * 5)
 
        if warning_count > 0:
            warn_names = veeam.get("jobs_warning", [])
            self.insights.append({
                "level": "WARNING",
                "category": "Backup",
                "message": f"{warning_count} job(s) en avertissement : {', '.join(warn_names)}"
            })
            score -= (warning_count * 3)
 
        # Check jobs with never succeeded
        for job in jobs:
            if not job.get("last_success_time") and job.get("status") in ["failed", "warning"]:
                self.insights.append({
                    "level": "CRITICAL",
                    "category": "Backup",
                    "message": f"Job '{job['job_name']}' n'a jamais eu de backup réussi !"
                })
                score -= 8
 
        return score
 
    def _analyze_logs(self, loki: dict, score: float) -> float:
        total_errors = loki.get("total_errors", 0)
        total_critical = loki.get("total_critical", 0)
        top_errors = loki.get("top_errors", [])
 
        if total_critical > 50:
            self.insights.append({
                "level": "CRITICAL",
                "category": "Logs",
                "message": f"{total_critical} messages critiques détectés dans les logs (12h)"
            })
            score -= 15
        elif total_critical > 10:
            self.insights.append({
                "level": "WARNING",
                "category": "Logs",
                "message": f"{total_critical} messages critiques détectés"
            })
            score -= 8
 
        if total_errors > 200:
            self.insights.append({
                "level": "WARNING",
                "category": "Logs",
                "message": f"Volume d'erreurs élevé : {total_errors} erreurs en 12h"
            })
            score -= 5
 
        if top_errors:
            most_frequent = top_errors[0]
            self.insights.append({
                "level": "INFO",
                "category": "Logs",
                "message": f"Erreur la plus fréquente ({most_frequent['count']}x) : {most_frequent['message'][:80]}..."
            })
 
        return score
 
    def _analyze_alerts(self, prom: dict, signoz: dict, score: float) -> float:
        prom_alerts = prom.get("alerts", [])
        signoz_data = signoz if signoz else {}
        firing = signoz_data.get("firing", 0)
 
        firing_prom = [a for a in prom_alerts if a.get("state") == "firing"]
        critical_prom = [a for a in firing_prom if a.get("labels", {}).get("severity") == "critical"]
 
        if critical_prom:
            names = [a.get("labels", {}).get("alertname", "?") for a in critical_prom]
            self.insights.append({
                "level": "CRITICAL",
                "category": "Alertes",
                "message": f"{len(critical_prom)} alerte(s) critique(s) active(s) : {', '.join(names)}"
            })
            score -= len(critical_prom) * 10
 
        if firing > 0:
            self.insights.append({
                "level": "WARNING",
                "category": "Alertes",
                "message": f"{firing} alerte(s) Signoz en cours de déclenchement"
            })
            score -= firing * 3
 
        return score
 
    def _cross_correlate(self, prom: dict, loki: dict, veeam: dict, signoz: dict):
        """Corrélations cross-sources intelligentes"""
        host = prom.get("host", {})
        cpu_pct = host.get("cpu_pct", 0)
        mem_pct = host.get("mem_pct", 0)
        ds = prom.get("datastore", {})
        free_pct = ds.get("free_pct", 100)
        jobs = veeam.get("jobs", [])
        total_errors = loki.get("total_errors", 0)
        error_timeline = loki.get("error_timeline", {})
        prom_alerts = prom.get("alerts", [])
 
        # Corrélation CPU élevé + erreurs logs
        if cpu_pct > 70 and total_errors > 100:
            self.correlations.append({
                "type": "CPU_LOGS",
                "severity": "WARNING",
                "message": f"Corrélation détectée : CPU élevé ({cpu_pct:.1f}%) coïncide avec un volume élevé d'erreurs ({total_errors} erreurs). Possible surcharge applicative."
            })
 
        # Corrélation backup en échec + espace disque
        failed_jobs = [j for j in jobs if j.get("status") == "failed"]
        if failed_jobs and free_pct < 20:
            self.correlations.append({
                "type": "BACKUP_DISK",
                "severity": "CRITICAL",
                "message": f"Corrélation critique : {len(failed_jobs)} backup(s) en échec ET espace disque faible ({free_pct:.1f}% libre). Les backups peuvent échouer par manque d'espace."
            })
 
        # Corrélation mémoire + nombre de VMs allumées
        vms = prom.get("vms", {})
        powered_on = sum(1 for v in vms.values() if v.get("power_state", 0) == 1)
        total_vm_mem = sum(v.get("mem_mb", 0) or 0 for v in vms.values() if v.get("power_state", 0) == 1)
        host_mem = host.get("mem_max_mb", 1)
        if total_vm_mem > 0 and host_mem > 0:
            vm_mem_ratio = (total_vm_mem / host_mem) * 100
            if vm_mem_ratio > 85 and mem_pct > 75:
                self.correlations.append({
                    "type": "MEMORY_VMS",
                    "severity": "WARNING",
                    "message": f"Corrélation mémoire : {powered_on} VMs allouent {vm_mem_ratio:.1f}% de la RAM hôte, utilisation réelle à {mem_pct:.1f}%. Risque de contention mémoire."
                })
 
        # Corrélation alerte VMwareExporterDown + données partielles
        vmware_down_alerts = [a for a in prom_alerts
                              if a.get("labels", {}).get("alertname") == "VMwareExporterDown"]
        if vmware_down_alerts:
            self.correlations.append({
                "type": "EXPORTER_DOWN",
                "severity": "CRITICAL",
                "message": "Alerte VMwareExporterDown active : les métriques VMware peuvent être incomplètes ou obsolètes dans ce rapport."
            })
 
        # Corrélation jobs en avertissement + RPO > 7 jours
        for job in jobs:
            rpo_min = job.get("rpo_minutes") or 0
            if job.get("status") in ["warning", "failed"] and rpo_min > 10080:
                rpo_h = rpo_min // 60
                self.correlations.append({
                    "type": "BACKUP_RPO",
                    "severity": "HIGH",
                    "message": f"Job '{job['job_name']}' : état {job['status'].upper()} avec RPO de {rpo_h}h. Objectif de récupération compromis."
                })
 
        # Si tout va bien
        if not self.correlations:
            self.correlations.append({
                "type": "OK",
                "severity": "OK",
                "message": "Aucune corrélation anormale détectée entre les sources de données."
            })
 
    def _score_to_risk(self, score: float) -> str:
        if score >= 85:
            return "HEALTHY"
        elif score >= 65:
            return "WARNING"
        elif score >= 40:
            return "DEGRADED"
        else:
            return "CRITICAL"
 
    def _build_summary(self, prom: dict, veeam: dict, loki: dict, signoz: dict, score: float) -> str:
        host = prom.get("host", {})
        veeam_global = veeam.get("global", {})
        label = self._score_to_risk(score)
 
        vm_count = len(prom.get("vms", {}))
        powered_on = sum(1 for v in prom.get("vms", {}).values() if v.get("power_state", 0) == 1)
        sla = veeam_global.get("sla_pct", 0)
        failed_jobs = veeam_global.get("jobs_failed_count", 0)
        total_errors = loki.get("total_errors", 0)
        alerts_count = len(prom.get("alerts", []))
 
        status_emoji = {"HEALTHY": "✅", "WARNING": "⚠️", "DEGRADED": "🔶", "CRITICAL": "🔴"}.get(label, "❓")
 
        return (
            f"État global de l'infrastructure ESXi : {label} {status_emoji} (score {score:.1f}/100). "
            f"Hôte {host.get('name', 'inconnu')} opérationnel, CPU à {host.get('cpu_pct', 0):.1f}%, "
            f"mémoire à {host.get('mem_pct', 0):.1f}%. "
            f"{vm_count} VMs inventoriées dont {powered_on} allumées. "
            f"Espace datastore : {prom.get('datastore', {}).get('free_pct', 0):.1f}% libre. "
            f"Backups : SLA {sla:.1f}%, {failed_jobs} job(s) en échec. "
            f"Logs : {total_errors} erreurs sur 12h. "
            f"Alertes actives : {alerts_count}."
        )
