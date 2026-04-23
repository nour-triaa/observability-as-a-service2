from collector import _now_unix
"""
Loki Collector — extrait des features numériques des logs
(à coller à la suite de collector.py)
"""

import re
from collections import Counter


class LokiCollector:

    def _query_range(self, logql, start_ns, end_ns, limit=1000):
        resp = requests.get(
            f"{LOKI_URL}/query_range",
            params={
                "query": logql,
                "start": start_ns,
                "end":   end_ns,
                "limit": limit,
            },
            auth=LOKI_AUTH,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    def fetch_log_features(self, vm_name: str, window_min: int = 30) -> dict:
        end_ns   = int(_now_unix() * 1e9)
        start_ns = int(((_now_unix()) - window_min * 60) * 1e9)

        # Requêtes Loki — adapte les labels à ton environnement
        labels = f'{{vm_name="{vm_name}"}}'

        try:
            all_logs = self._query_range(labels, start_ns, end_ns)
        except Exception:
            # Loki pas disponible → features à zéro
            return self._empty_features()

        lines = []
        for stream in all_logs.get("data", {}).get("result", []):
            for _, line in stream.get("values", []):
                lines.append(line.lower())

        if not lines:
            return self._empty_features()

        total = len(lines)

        # ── Comptage par niveau de log
        errors    = sum(1 for l in lines if re.search(r'\berror\b|\bexception\b|\bfailed\b', l))
        warnings  = sum(1 for l in lines if re.search(r'\bwarn\b|\bwarning\b', l))
        criticals = sum(1 for l in lines if re.search(r'\bcritical\b|\bfatal\b|\bpanic\b', l))
        timeouts  = sum(1 for l in lines if re.search(r'\btimeout\b|\btimed.?out\b', l))
        oom       = sum(1 for l in lines if re.search(r'\bout.of.memory\b|\boom\b|\bkilled\b', l))
        restarts  = sum(1 for l in lines if re.search(r'\brestart\b|\brestarting\b|\bcrash\b', l))
        http5xx   = sum(1 for l in lines if re.search(r'\b5[0-9]{2}\b', l))

        return {
            "log_total":       total,
            "log_error_count": errors,
            "log_warn_count":  warnings,
            "log_critical":    criticals,
            "log_timeout":     timeouts,
            "log_oom":         oom,
            "log_restarts":    restarts,
            "log_http5xx":     http5xx,
            "log_error_rate":  round(errors / total, 4) if total else 0,
        }

    def _empty_features(self):
        return {
            "log_total": 0, "log_error_count": 0, "log_warn_count": 0,
            "log_critical": 0, "log_timeout": 0, "log_oom": 0,
            "log_restarts": 0, "log_http5xx": 0, "log_error_rate": 0,
        }
