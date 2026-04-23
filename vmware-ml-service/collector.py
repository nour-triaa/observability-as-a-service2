"""
================================================
  Collecteurs de données
  - PrometheusCollector : métriques VMware
  - LokiCollector       : features extraites des logs
================================================
"""

import os
import requests
import numpy as np
from datetime import datetime, timedelta, timezone

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://prometheus.local/api/v1")
LOKI_URL       = os.getenv("LOKI_URL",       "http://loki.local/loki/api/v1")

PROM_AUTH = None
_u = os.getenv("PROMETHEUS_USER")
_p = os.getenv("PROMETHEUS_PASS")
if _u and _p:
    PROM_AUTH = (_u, _p)

LOKI_AUTH = None
_lu = os.getenv("LOKI_USER")
_lp = os.getenv("LOKI_PASS")
if _lu and _lp:
    LOKI_AUTH = (_lu, _lp)


def _now_unix():
    return datetime.now(timezone.utc).timestamp()

def _first_val(series, default=0.0):
    """Extrait la dernière valeur d'une série Prometheus."""
    try:
        vals = series.get("data", {}).get("result", [])
        if vals:
            return float(vals[0]["values"][-1][1])
    except Exception:
        pass
    return default

def _series_vals(series, default=0.0):
    """Retourne toutes les valeurs d'une série comme liste de floats."""
    try:
        vals = series.get("data", {}).get("result", [])
        if vals:
            return [float(v[1]) for v in vals[0]["values"]]
    except Exception:
        pass
    return [default]


# ─────────────────────────────────────────────
#  PROMETHEUS COLLECTOR
# ─────────────────────────────────────────────

class PrometheusCollector:

    def _query_range(self, query, start, end, step):
        resp = requests.get(
            f"{PROMETHEUS_URL}/query_range",
            params={"query": query, "start": start, "end": end, "step": step},
            auth=PROM_AUTH,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    def fetch_vm_metrics(self, vm_name: str, window_min: int = 30, step_sec: int = 60) -> dict:
        end   = _now_unix()
        start = end - window_min * 60

        def pq(metric):
            return self._query_range(
                f'{metric}{{vm_name="{vm_name}"}}', start, end, step_sec
            )

        # ── Toutes les métriques (identiques à ton frontend)
        (cpu_usage, cpu_mhz, cpu_max, cpu_demand, cpu_idle, cpu_ready,
         mem_consumed, mem_max, mem_active, mem_swapped,
         disk_read, disk_write, disk_latency,
         disk_free, disk_capacity,
         net_rx, net_tx, net_drop_rx, net_drop_tx,
         power_state, boot_ts) = [
            pq(m) for m in [
                "vmware_vm_cpu_usage_average",
                "vmware_vm_cpu_usagemhz_average",
                "vmware_vm_max_cpu_usage",
                "vmware_vm_cpu_demand_average",
                "vmware_vm_cpu_idle_summation",
                "vmware_vm_cpu_ready_summation",
                "vmware_vm_mem_consumed_average",
                "vmware_vm_memory_max",
                "vmware_vm_mem_active_average",
                "vmware_vm_mem_swapped_average",
                "vmware_vm_disk_read_average",
                "vmware_vm_disk_write_average",
                "vmware_vm_disk_maxTotalLatency_latest",
                "vmware_vm_guest_disk_free",
                "vmware_vm_guest_disk_capacity",
                "vmware_vm_net_received_average",
                "vmware_vm_net_transmitted_average",
                "vmware_vm_net_droppedRx_summation",
                "vmware_vm_net_droppedTx_summation",
                "vmware_vm_power_state",
                "vmware_vm_boot_timestamp_seconds",
            ]
        ]

        # tools_status : query directe avec label supplémentaire
        tools_status = self._query_range(
            f'vmware_vm_guest_tools_running_status{{vm_name="{vm_name}",tools_status="toolsOk"}}',
            start, end, step_sec
        )

        # ── Calculs CPU (identique à ton frontend)
        cpu_max_mhz  = _first_val(cpu_max, 5836)
        cpu_mhz_val  = _first_val(cpu_mhz, 0)
        cpu_pct      = min((cpu_mhz_val / cpu_max_mhz) * 100, 100) if cpu_max_mhz else 0
        cpu_demand_v = _first_val(cpu_demand, 0)
        cpu_ready_v  = _first_val(cpu_ready, 0)
        cpu_idle_v   = _first_val(cpu_idle, 0)

        # ── Calculs RAM
        mem_max_kb  = _first_val(mem_max, 1)
        mem_used_kb = _first_val(mem_consumed, 0)
        mem_pct     = min((mem_used_kb / mem_max_kb) * 100, 100) if mem_max_kb else 0
        mem_swap_v  = _first_val(mem_swapped, 0)

        # ── Disk
        disk_free_gb = _first_val(disk_free, 0) / 1024 / 1024 / 1024
        disk_cap_gb  = _first_val(disk_capacity, 1) / 1024 / 1024 / 1024
        disk_used_pct = (1 - disk_free_gb / disk_cap_gb) * 100 if disk_cap_gb else 0
        disk_lat_v   = _first_val(disk_latency, 0)
        disk_rd_v    = _first_val(disk_read, 0)
        disk_wr_v    = _first_val(disk_write, 0)

        # ── Network
        net_rx_v     = _first_val(net_rx, 0)
        net_tx_v     = _first_val(net_tx, 0)
        net_drop_r   = _first_val(net_drop_rx, 0)
        net_drop_t   = _first_val(net_drop_tx, 0)
        net_drops    = net_drop_r + net_drop_t

        # ── Séries temporelles pour le ML (std, max sur la fenêtre)
        cpu_series   = _series_vals(cpu_usage)
        mem_series   = _series_vals(mem_consumed)
        lat_series   = _series_vals(disk_latency)

        return {
            # Valeurs instantanées
            "cpu_pct":        round(cpu_pct, 2),
            "cpu_demand":     round(cpu_demand_v, 2),
            "cpu_ready":      round(cpu_ready_v, 2),
            "cpu_idle":       round(cpu_idle_v, 2),
            "mem_pct":        round(mem_pct, 2),
            "mem_swap_kb":    round(mem_swap_v, 2),
            "disk_used_pct":  round(disk_used_pct, 2),
            "disk_latency_ms": round(disk_lat_v, 2),
            "disk_read_kbps": round(disk_rd_v, 2),
            "disk_write_kbps": round(disk_wr_v, 2),
            "net_rx_kbps":    round(net_rx_v, 2),
            "net_tx_kbps":    round(net_tx_v, 2),
            "net_drops":      round(net_drops, 2),
            "power_state":    _first_val(power_state, 0),
            # Statistiques sur la fenêtre (pour Isolation Forest)
            "cpu_std":        round(float(np.std(cpu_series)), 2),
            "cpu_max":        round(float(np.max(cpu_series)), 2),
            "mem_std":        round(float(np.std(mem_series)), 2),
            "disk_lat_max":   round(float(np.max(lat_series)), 2),
        }
