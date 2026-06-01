import logging
import httpx
from datetime import datetime, timedelta
from time import time

logger = logging.getLogger(__name__)


class PrometheusCollector:
    def __init__(self):
        from app.config import settings
        self.base_url    = settings.PROMETHEUS_URL
        self.range_url   = settings.PROMETHEUS_RANGE_URL
        self.alerts_url  = settings.PROMETHEUS_ALERTS_URL
        self.timeout     = 15.0

    # ------------------------------------------------------------------
    # Requêtes de base
    # ------------------------------------------------------------------

    async def query(self, promql: str) -> list:
        """Requête instantanée (valeur actuelle)."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.base_url, params={"query": promql})
                resp.raise_for_status()
                data = resp.json()
                return data.get("data", {}).get("result", [])
        except Exception as e:
            logger.error(f"[Prometheus] query error '{promql}': {e}")
            return []

    async def query_range(self, promql: str, hours: int = 12) -> list:
        """Requête sur une période pour les graphiques."""
        try:
            end   = datetime.utcnow()
            start = end - timedelta(hours=hours)
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.range_url, params={
                    "query": promql,
                    "start": start.timestamp(),
                    "end":   end.timestamp(),
                    "step":  "5m",
                })
                resp.raise_for_status()
                data = resp.json()
                return data.get("data", {}).get("result", [])
        except Exception as e:
            logger.error(f"[Prometheus] range query error '{promql}': {e}")
            return []

    async def get_alerts(self) -> list:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.alerts_url)
                resp.raise_for_status()
                data = resp.json()
                return data.get("data", {}).get("alerts", [])
        except Exception as e:
            logger.error(f"[Prometheus] alerts error: {e}")
            return []

    # ------------------------------------------------------------------
    # Helpers scalaires / parsing
    # ------------------------------------------------------------------

    def _scalar(self, results: list) -> float:
        if not results:
            return 0.0
        try:
            return float(results[0]["value"][1])
        except Exception:
            return 0.0

    def _parse_range(self, results: list) -> dict:
        if not results:
            return {"timestamps": [], "values": []}
        try:
            values_data = results[0].get("values", [])
            return {
                "timestamps": [
                    datetime.utcfromtimestamp(v[0]).strftime("%H:%M")
                    for v in values_data
                ],
                "values": [round(float(v[1]), 2) for v in values_data],
            }
        except Exception as e:
            logger.warning(f"[Prometheus] Error parsing range data: {e}")
            return {"timestamps": [], "values": []}

    # ------------------------------------------------------------------
    # Helpers d'indexation par vm_name
    # ------------------------------------------------------------------

    def _index_by_vm(self, results: list, label: str = "vm_name") -> dict:
        """Retourne {vm_name: float_value} pour une métrique instantanée."""
        out = {}
        for r in results:
            name = r.get("metric", {}).get(label, "")
            if not name:
                continue
            try:
                out[name] = float(r["value"][1])
            except Exception:
                out[name] = 0.0
        return out

    def _index_meta_by_vm(self, results: list, label: str = "vm_name") -> dict:
        """Retourne {vm_name: metric_dict} pour récupérer des labels arbitraires."""
        out = {}
        for r in results:
            name = r.get("metric", {}).get(label, "")
            if not name:
                continue
            out[name] = r.get("metric", {})
        return out

    def _index_range_by_vm(self, results: list, label: str = "vm_name") -> dict:
        """Retourne {vm_name: {"timestamps": [...], "values": [...]}}."""
        out = {}
        for r in results:
            name = r.get("metric", {}).get(label, "")
            if not name:
                continue
            try:
                values_data = r.get("values", [])
                out[name] = {
                    "timestamps": [
                        datetime.utcfromtimestamp(v[0]).strftime("%H:%M")
                        for v in values_data
                    ],
                    "values": [round(float(v[1]), 2) for v in values_data],
                }
            except Exception as e:
                logger.warning(f"[Prometheus] Error parsing VM range for {name}: {e}")
                out[name] = {"timestamps": [], "values": []}
        return out

    # ------------------------------------------------------------------
    # _safe_uptime — FIX BUG 1 : boot_timestamp parfois dans le futur
    # ------------------------------------------------------------------

    def _safe_uptime(self, vm_name: str, boot_ts: float, now_ts: float) -> int:
        """
        Calcule l'uptime en secondes de façon défensive.

        Le vmware_exporter peut renvoyer un boot_timestamp_seconds supérieur
        à l'epoch courant (décalage NTP entre l'hôte ESXi et le collecteur,
        ou VM récemment démarrée dont le timestamp n'est pas encore stable).
        Dans ce cas on retourne 0 et on log un avertissement.
        """
        if boot_ts <= 0:
            return 0
        if boot_ts > now_ts:
            delta = boot_ts - now_ts
            logger.warning(
                f"[Prometheus] boot_timestamp FUTUR pour '{vm_name}': "
                f"boot={boot_ts:.0f} > now={now_ts:.0f} (diff={delta:.0f}s). "
                f"Vérifier la synchronisation NTP du vmware_exporter / ESXi host."
            )
            return 0
        return int(now_ts - boot_ts)

    # ------------------------------------------------------------------
    # collect_all — point d'entrée principal
    # ------------------------------------------------------------------

    async def collect_all(self) -> dict:
        logger.info("[Prometheus] Collecting metrics...")

        # ==================== HOST ====================
        cpu_mhz_query    = await self.query("vmware_host_cpu_usagemhz_average")
        cpu_max_query     = await self.query("vmware_host_cpu_max")
        cpu_pct_query     = await self.query("vmware_host_cpu_usage_average")
        mem_usage_query   = await self.query("vmware_host_memory_usage")
        mem_max_query     = await self.query("vmware_host_memory_max")
        host_power        = await self.query("vmware_host_power_state")
        host_maintenance  = await self.query("vmware_host_maintenance_mode")
        host_info         = await self.query("vmware_host_product_info")
        host_hw_info      = await self.query("vmware_host_hardware_info")
        host_num_cpu      = await self.query("vmware_host_num_cpu")

        # ==================== DATASTORE ====================
        ds_capacity   = await self.query("vmware_datastore_capacity_size")
        ds_free       = await self.query("vmware_datastore_freespace_size")
        ds_accessible = await self.query("vmware_datastore_accessible")

        # ==================== VMs — métriques instantanées ====================
        #
        # Noms de métriques vmware_exporter (vérifiés sur données Prometheus réelles) :
        #
        #   vmware_vm_power_state                → 1=poweredOn, 0=poweredOff
        #   vmware_vm_cpu_usagemhz_average       → MHz consommés
        #   vmware_vm_cpu_usage_average          → centièmes de % (ex: 119 = 1.19%)
        #   vmware_vm_max_cpu_usage              → MHz limite (vCPUs × fréquence hôte)
        #   vmware_vm_mem_usage_average          → centièmes de % (ex: 3399 = 33.99%)
        #   vmware_vm_memory_max                 → RAM provisionnée (MB)
        #   vmware_vm_mem_consumed_average       → RAM consommée (KB)
        #   vmware_vm_mem_active_average         → RAM active (KB)
        #   vmware_vm_mem_vmmemctl_average       → Balloon (KB)
        #   vmware_vm_mem_swapped_average        → Swap mémoire (KB)
        #   vmware_vm_disk_read_average          → Lecture disque (KB/s)
        #   vmware_vm_disk_write_average         → Écriture disque (KB/s)
        #   vmware_vm_net_received_average       → Réseau RX (KB/s)
        #   vmware_vm_net_transmitted_average    → Réseau TX (KB/s)
        #   vmware_vm_num_cpu                    → Nombre de vCPUs
        #   vmware_vm_boot_timestamp_seconds     → Epoch boot (peut être dans le futur
        #                                          si NTP désynchronisé → voir _safe_uptime)
        #   vmware_vm_snapshots                  → Nombre de snapshots
        #   vmware_vm_guest_disk_free            → Espace libre partition / (bytes)
        #   vmware_vm_guest_disk_capacity        → Capacité partition / (bytes)
        #   vmware_vm_guest_tools_running_status → Statut VMware Tools
        #
        vm_power         = await self.query("vmware_vm_power_state")
        vm_cpu_mhz       = await self.query("vmware_vm_cpu_usagemhz_average")
        vm_cpu_pct_raw   = await self.query("vmware_vm_cpu_usage_average")    # centièmes de %
        vm_cpu_limit     = await self.query("vmware_vm_max_cpu_usage")        # MHz alloués
        vm_mem_pct_raw   = await self.query("vmware_vm_mem_usage_average")    # centièmes de %
        vm_mem_size      = await self.query("vmware_vm_memory_max")           # MB provisionnés
        vm_mem_consumed  = await self.query("vmware_vm_mem_consumed_average") # KB consommés
        vm_mem_active    = await self.query("vmware_vm_mem_active_average")   # KB actifs
        vm_mem_balloon   = await self.query("vmware_vm_mem_vmmemctl_average") # KB balloon
        vm_mem_swapped   = await self.query("vmware_vm_mem_swapped_average")  # KB swap
        vm_disk_read     = await self.query("vmware_vm_disk_read_average")
        vm_disk_write    = await self.query("vmware_vm_disk_write_average")
        vm_net_rx        = await self.query("vmware_vm_net_received_average")
        vm_net_tx        = await self.query("vmware_vm_net_transmitted_average")
        vm_num_cpu       = await self.query("vmware_vm_num_cpu")
        vm_boot_ts       = await self.query("vmware_vm_boot_timestamp_seconds")
        vm_snapshots     = await self.query("vmware_vm_snapshots")
        vm_disk_free     = await self.query("vmware_vm_guest_disk_free")
        vm_disk_cap      = await self.query("vmware_vm_guest_disk_capacity")
        vm_tools_status  = await self.query("vmware_vm_guest_tools_running_status")

        # --- Trends (12 h) ---
        vm_cpu_trend = await self.query_range("vmware_vm_cpu_usage_average", hours=12)
        vm_mem_trend = await self.query_range("vmware_vm_mem_usage_average", hours=12)

        # ==================== Trends HOST ====================
        cpu_trend = await self.query_range(
            "vmware_host_cpu_usage_average or "
            "(vmware_host_cpu_usagemhz_average / vmware_host_cpu_max * 100)",
            hours=12,
        )
        mem_trend = await self.query_range("vmware_host_memory_usage", hours=12)

        alerts = await self.get_alerts()

        # ======================== CALCULS HOST ========================
        cpu_mhz    = self._scalar(cpu_mhz_query)
        cpu_max    = self._scalar(cpu_max_query) or 1.0
        cpu_pct    = self._scalar(cpu_pct_query)

        # vmware_host_cpu_usage_average est en centièmes de %
        # (ex: 157 → 1.57%). On détecte et normalise.
        if cpu_pct > 100:
            cpu_pct = round(cpu_pct / 100, 2)
        if cpu_pct <= 0:
            cpu_pct = round((cpu_mhz / cpu_max) * 100, 2)
        cpu_pct = min(max(cpu_pct, 0.0), 100.0)

        mem_mb     = self._scalar(mem_usage_query)
        mem_max_mb = self._scalar(mem_max_query) or 1.0
        mem_pct    = round((mem_mb / mem_max_mb) * 100, 2)

        host_name = "Unknown"
        if host_info:
            host_name = host_info[0].get("metric", {}).get("host_name", host_name)

        cpu_model = "N/A"
        if host_hw_info:
            cpu_model = host_hw_info[0].get("metric", {}).get("hardware_cpu_model", "N/A")

        esxi_version = "N/A"
        if host_info:
            esxi_version = host_info[0].get("metric", {}).get("version", "N/A")

        # ======================== CALCULS DATASTORE ========================
        ds_cap      = self._scalar(ds_capacity)
        ds_free_val = self._scalar(ds_free)
        ds_cap_gb   = round(ds_cap     / 1_000_000_000, 2)
        ds_free_gb  = round(ds_free_val / 1_000_000_000, 2)
        ds_used_gb  = round(ds_cap_gb - ds_free_gb, 2)
        ds_free_pct = round((ds_free_gb / ds_cap_gb) * 100, 2) if ds_cap_gb > 0 else 0.0

        # ======================== CALCULS VMs ========================

        # --- Indexation par vm_name ---
        vm_power_map        = self._index_by_vm(vm_power)
        vm_cpu_mhz_map      = self._index_by_vm(vm_cpu_mhz)
        vm_cpu_pct_raw_map  = self._index_by_vm(vm_cpu_pct_raw)
        vm_cpu_limit_map    = self._index_by_vm(vm_cpu_limit)
        vm_mem_pct_raw_map  = self._index_by_vm(vm_mem_pct_raw)
        vm_mem_size_map     = self._index_by_vm(vm_mem_size)          # MB
        vm_mem_consumed_map = self._index_by_vm(vm_mem_consumed)      # KB
        vm_mem_active_map   = self._index_by_vm(vm_mem_active)        # KB
        vm_mem_balloon_map  = self._index_by_vm(vm_mem_balloon)       # KB
        vm_mem_swapped_map  = self._index_by_vm(vm_mem_swapped)       # KB
        vm_disk_read_map    = self._index_by_vm(vm_disk_read)
        vm_disk_write_map   = self._index_by_vm(vm_disk_write)
        vm_net_rx_map       = self._index_by_vm(vm_net_rx)
        vm_net_tx_map       = self._index_by_vm(vm_net_tx)
        vm_num_cpu_map      = self._index_by_vm(vm_num_cpu)
        vm_boot_ts_map      = self._index_by_vm(vm_boot_ts)           # epoch seconds
        vm_snapshots_map    = self._index_by_vm(vm_snapshots)

        # --- Guest disk : on garde uniquement la partition "/" ---
        vm_disk_free_map = {}
        vm_disk_cap_map  = {}
        for r in vm_disk_free:
            m = r.get("metric", {})
            if m.get("partition", "") == "/":
                vm_disk_free_map[m.get("vm_name", "")] = float(r["value"][1])
        for r in vm_disk_cap:
            m = r.get("metric", {})
            if m.get("partition", "") == "/":
                vm_disk_cap_map[m.get("vm_name", "")] = float(r["value"][1])

        # --- VMware Tools : la métrique est labelisée par tools_status ---
        # On cherche le label dont la valeur vaut 1
        vm_tools_map = {}
        for r in vm_tools_status:
            m = r.get("metric", {})
            name = m.get("vm_name", "")
            if name and float(r["value"][1]) == 1:
                vm_tools_map[name] = m.get("tools_status", "unknown")

        vm_cpu_trend_map = self._index_range_by_vm(vm_cpu_trend)
        vm_mem_trend_map = self._index_range_by_vm(vm_mem_trend)

        # --- Union de tous les noms de VM détectés ---
        # vm_power est la source la plus fiable (présente pour ON et OFF)
        all_vm_names = (
            set(vm_power_map.keys())
            | set(vm_cpu_mhz_map.keys())
            | set(vm_mem_size_map.keys())
            | set(vm_num_cpu_map.keys())
        )

        logger.info(f"[Prometheus] VMs détectées : {sorted(all_vm_names)}")

        now_ts = time()

        vms = {}
        for vm_name in sorted(all_vm_names):

            # ── Power state ──────────────────────────────────────────────
            power_state_val = int(vm_power_map.get(vm_name, 0))
            power_state_str = {1: "poweredOn", 0: "poweredOff"}.get(
                power_state_val, "suspended"
            )

            # ── CPU ──────────────────────────────────────────────────────
            v_cpu_mhz   = vm_cpu_mhz_map.get(vm_name, 0.0)
            v_cpu_limit = vm_cpu_limit_map.get(vm_name, 0.0) or 1.0

            # vmware_vm_cpu_usage_average est en centièmes de % (ex: 119 → 1.19%)
            v_cpu_pct_raw = vm_cpu_pct_raw_map.get(vm_name, 0.0)
            if v_cpu_pct_raw > 100:
                v_cpu_pct   = round(v_cpu_pct_raw / 100, 2)
                cpu_source  = "usage_average/100"
            elif v_cpu_pct_raw > 0:
                v_cpu_pct   = round(v_cpu_pct_raw, 2)
                cpu_source  = "usage_average"
            else:
                # Fallback : MHz utilisés / MHz alloués
                v_cpu_pct  = round((v_cpu_mhz / v_cpu_limit) * 100, 2)
                cpu_source = "mhz_fallback"
                logger.info(
                    f"[Prometheus] {vm_name}: cpu_usage_average absent, "
                    f"fallback MHz → {v_cpu_pct:.2f}%"
                )
            v_cpu_pct = min(max(v_cpu_pct, 0.0), 100.0)

            # ── RAM ──────────────────────────────────────────────────────
            v_mem_size_mb = vm_mem_size_map.get(vm_name, 0.0) or 1.0  # MB

            # FIX BUG 3 — source unique avec log explicite du fallback
            # vmware_vm_mem_usage_average est en centièmes de % (ex: 3399 → 33.99%)
            v_mem_pct_raw = vm_mem_pct_raw_map.get(vm_name, 0.0)
            if v_mem_pct_raw > 100:
                v_mem_pct   = round(v_mem_pct_raw / 100, 2)
                mem_source  = "usage_average/100"
            elif v_mem_pct_raw > 0:
                v_mem_pct   = round(v_mem_pct_raw, 2)
                mem_source  = "usage_average"
            else:
                # Fallback via mem_consumed (KB → MB) / mem_size (MB)
                # NOTE : cette valeur diffère de usage_average car consumed
                # mesure les pages physiques allouées (différent du % guest VMware).
                consumed_kb = vm_mem_consumed_map.get(vm_name, 0.0)
                v_mem_pct   = round((consumed_kb / 1024 / v_mem_size_mb) * 100, 2)
                mem_source  = "consumed_fallback"
                logger.info(
                    f"[Prometheus] {vm_name}: mem_usage_average absent, "
                    f"fallback consumed_average → {v_mem_pct:.2f}%"
                )
            v_mem_pct = min(max(v_mem_pct, 0.0), 100.0)

            # RAM consommée en MB (depuis consumed_average en KB)
            consumed_kb = vm_mem_consumed_map.get(vm_name, 0.0)
            v_mem_mb    = round(consumed_kb / 1024, 2)

            v_mem_balloon_kb = vm_mem_balloon_map.get(vm_name, 0.0)
            v_mem_swapped_kb = vm_mem_swapped_map.get(vm_name, 0.0)
            v_mem_active_kb  = vm_mem_active_map.get(vm_name, 0.0)

            # ── Disque / Réseau ──────────────────────────────────────────
            v_disk_read_kbs  = round(vm_disk_read_map.get(vm_name, 0.0),  2)
            v_disk_write_kbs = round(vm_disk_write_map.get(vm_name, 0.0), 2)
            v_net_rx_kbs     = round(vm_net_rx_map.get(vm_name, 0.0),     2)
            v_net_tx_kbs     = round(vm_net_tx_map.get(vm_name, 0.0),     2)

            # ── Disque invité (partition /) ──────────────────────────────
            guest_disk_free_gb = round(
                vm_disk_free_map.get(vm_name, 0.0) / 1_000_000_000, 2
            )
            guest_disk_cap_gb = round(
                vm_disk_cap_map.get(vm_name, 0.0) / 1_000_000_000, 2
            )
            guest_disk_used_gb  = round(guest_disk_cap_gb - guest_disk_free_gb, 2)
            guest_disk_free_pct = (
                round(guest_disk_free_gb / guest_disk_cap_gb * 100, 1)
                if guest_disk_cap_gb > 0 else 0.0
            )

            # ── Uptime — FIX BUG 1 : boot_timestamp parfois dans le futur ──
            boot_ts  = vm_boot_ts_map.get(vm_name, 0.0)
            uptime_s = self._safe_uptime(vm_name, boot_ts, now_ts)
            uptime_h = round(uptime_s / 3600, 1)

            # ── Snapshots ────────────────────────────────────────────────
            snap_count = int(vm_snapshots_map.get(vm_name, 0))

            # ── VMware Tools ─────────────────────────────────────────────
            tools_status = vm_tools_map.get(vm_name, "unknown")

            vms[vm_name] = {
                # Identité
                "name":          vm_name,
                "guest_os":      "N/A",
                "guest_os_full": "N/A",
                "annotation":    "",

                # État
                "power_state":    power_state_str,
                "uptime_seconds": uptime_s,
                "uptime_hours":   uptime_h,

                # CPU
                "num_cpus":       int(vm_num_cpu_map.get(vm_name, 0)),
                "cpu_demand_mhz": round(v_cpu_mhz, 2),
                "cpu_limit_mhz":  round(v_cpu_limit, 2),
                "cpu_pct":        round(v_cpu_pct, 1),

                # RAM
                "mem_size_mb":    round(v_mem_size_mb, 2),
                "mem_usage_mb":   v_mem_mb,
                "mem_pct":        round(v_mem_pct, 1),
                "mem_active_kb":  round(v_mem_active_kb,  2),
                "mem_balloon_kb": round(v_mem_balloon_kb, 2),
                "mem_swapped_kb": round(v_mem_swapped_kb, 2),

                # Disque VM
                "disk_read_kbs":  v_disk_read_kbs,
                "disk_write_kbs": v_disk_write_kbs,

                # Disque invité (partition /)
                "guest_disk_cap_gb":   guest_disk_cap_gb,
                "guest_disk_used_gb":  guest_disk_used_gb,
                "guest_disk_free_gb":  guest_disk_free_gb,
                "guest_disk_free_pct": guest_disk_free_pct,

                # Réseau
                "net_rx_kbs": v_net_rx_kbs,
                "net_tx_kbs": v_net_tx_kbs,

                # Snapshots & Tools
                "snapshots":    snap_count,
                "tools_status": tools_status,

                # Trends 12h
                "trends": {
                    "cpu": vm_cpu_trend_map.get(
                        vm_name, {"timestamps": [], "values": []}
                    ),
                    "memory": vm_mem_trend_map.get(
                        vm_name, {"timestamps": [], "values": []}
                    ),
                },
            }

        powered_on_count = sum(
            1 for v in vms.values() if v["power_state"] == "poweredOn"
        )
        logger.info(
            f"[Prometheus] Collecte terminée — "
            f"{len(vms)} VMs, {powered_on_count} allumées"
        )

        return {
            "host": {
                "name":             host_name,
                "cpu_demand_mhz":   round(cpu_mhz, 2),
                "cpu_max_mhz":      round(cpu_max, 2),
                "cpu_pct":          round(cpu_pct, 1),
                "mem_usage_mb":     round(mem_mb, 2),
                "mem_max_mb":       round(mem_max_mb, 2),
                "mem_pct":          round(mem_pct, 1),
                "power_state":      int(self._scalar(host_power)),
                "maintenance_mode": bool(self._scalar(host_maintenance)),
                "esxi_version":     esxi_version,
                "cpu_model":        cpu_model,
                "num_cpus":         int(self._scalar(host_num_cpu)),
            },
            "datastore": {
                "name":        "datastore1",
                "capacity_gb": ds_cap_gb,
                "free_gb":     ds_free_gb,
                "used_gb":     ds_used_gb,
                "free_pct":    round(ds_free_pct, 1),
                "used_pct":    round(100 - ds_free_pct, 1),
                "accessible":  bool(self._scalar(ds_accessible)),
            },
            "vms":    vms,
            "alerts": alerts,
            "trends": {
                "cpu":    self._parse_range(cpu_trend),
                "memory": self._parse_range(mem_trend),
            },
        }
