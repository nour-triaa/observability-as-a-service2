const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const AI_ANALYZER = process.env.AI_ANALYZER_URL || "http://ai-analyzer.local";
const PROM = process.env.PROM_URL || "http://prometheus.local/api/v1/query";

// ─── Helper Prometheus ────────────────────────────────────────────────────────
async function pq(expr) {
  try {
    const res = await axios.get(PROM, {
      params: { query: expr },
      timeout: 8000,
    });
    return res.data?.data?.result || [];
  } catch (e) {
    console.warn(`[pq] WARN — query failed: ${expr.slice(0, 60)}… → ${e.message}`);
    return [];
  }
}

function safeFloat(val, decimals = 2) {
  const f = parseFloat(val);
  return isNaN(f) ? 0 : parseFloat(f.toFixed(decimals));
}

function firstVal(results, fallback = 0) {
  return results[0] ? safeFloat(results[0].value[1]) : fallback;
}

// ─── Scrape Prometheus Alerts ───────────────────────────────────────────────
async function scrapeAlerts() {
  try {
    const [alerts, alertsState] = await Promise.all([
      pq('ALERTS{alertstate="firing"}'),
      pq('ALERTS_FOR_STATE')
    ]);

    const importantAlerts = alerts
      .map(a => {
        const alertName = a.metric?.alertname || "unknown";
       
        // Exclure OldVMSnapshot
        if (alertName === "OldVMSnapshot") return null;

        const stateItem = alertsState.find(s =>
          s.metric?.alertname === alertName &&
          s.metric?.vm_name === a.metric?.vm_name
        );

        return {
          name: alertName,
          severity: a.metric?.severity || "info",
          state: a.metric?.alertstate || "firing",
          vm_name: a.metric?.vm_name || null,
          host_name: a.metric?.host_name || null,
          ds_name: a.metric?.ds_name || null,
          tools_status: a.metric?.tools_status || null,
          value: safeFloat(a.value?.[1]),
          since: stateItem ? parseInt(stateItem.value?.[1] || 0) : 0
        };
      })
      .filter(a => a !== null && a.value > 0);

    return {
      total_active: importantAlerts.length,
      by_severity: {
        critical: importantAlerts.filter(a => a.severity === "critical").length,
        warning: importantAlerts.filter(a => a.severity === "warning").length,
      },
      alerts: importantAlerts
    };
  } catch (e) {
    console.warn("[scrapeAlerts] failed:", e.message);
    return { total_active: 0, by_severity: { critical: 0, warning: 0 }, alerts: [] };
  }
}

// ─── Scrape VMware metrics ────────────────────────────────────────────────────
async function scrapeVMwareMetrics() {
  // ── Hyperviseur ESXi ────────────────────────────────────────────────────────
  const [
    hostCpuUsage,
    hostCpuMax,
    hostMemUsage,
    hostMemMax,
    hostNumCpu,
    hostProductInfo,
    hostHardwareInfo,
    hostUptimeInfo,
    hostNetReceived,
    hostNetSent,
  ] = await Promise.all([
    pq("vmware_host_cpu_usage"),
    pq("vmware_host_cpu_max"),
    pq("vmware_host_memory_usage"),
    pq("vmware_host_memory_max"),
    pq("vmware_host_num_cpu"),
    pq("vmware_host_product_info"),
    pq("vmware_host_hardware_info"),
    pq("vmware_host_uptime_seconds"),
    pq("vmware_host_net_received_average"),
    pq("vmware_host_net_transmitted_average"),
  ]);

  const cpuUsageMhz = firstVal(hostCpuUsage);
  const cpuMaxMhz = firstVal(hostCpuMax);
  const memUsageMb = firstVal(hostMemUsage);
  const memMaxMb = firstVal(hostMemMax);

  const cpuPct = cpuMaxMhz > 0 ? safeFloat((cpuUsageMhz / cpuMaxMhz) * 100) : 0;
  const memPct = memMaxMb > 0 ? safeFloat((memUsageMb / memMaxMb) * 100) : 0;

  const uptimeDays = safeFloat(firstVal(hostUptimeInfo) / 86400, 1);

  const hypervisor = {
    cpu_usage_mhz: cpuUsageMhz,
    cpu_max_mhz: cpuMaxMhz,
    cpu_usage_percent: cpuPct,
    memory_usage_mb: memUsageMb,
    memory_max_mb: memMaxMb,
    memory_usage_percent: memPct,
    num_cpu: firstVal(hostNumCpu),
    uptime_days: uptimeDays,
    version: hostProductInfo[0]?.metric?.version || "unknown",
    cpu_model: hostHardwareInfo[0]?.metric?.hardware_cpu_model || "unknown",
    net_received_kbps: firstVal(hostNetReceived),
    net_sent_kbps: firstVal(hostNetSent),
    cpu_alert: cpuPct > 80,
    memory_alert: memPct > 85,
  };

  // ── Datastore ───────────────────────────────────────────────────────────────
  const [
    dsCapacity,
    dsFree,
    dsProvisioned,
    dsVms,
  ] = await Promise.all([
    pq("vmware_datastore_capacity_size"),
    pq("vmware_datastore_freespace_size"),
    pq("vmware_datastore_provisoned_size"),
    pq("vmware_datastore_vms"),
  ]);

  const toGb = bytes => safeFloat(bytes / 1024 / 1024 / 1024, 1);

  const datastores = dsCapacity.map((r) => {
    const name = r.metric?.ds_name || r.metric?.instance || "unknown";
    const cap = safeFloat(r.value[1]);
    const freeItem = dsFree.find(x => (x.metric?.ds_name || x.metric?.instance) === name);
    const provItem = dsProvisioned.find(x => (x.metric?.ds_name || x.metric?.instance) === name);
    const vmsItem = dsVms.find(x => (x.metric?.ds_name || x.metric?.instance) === name);

    const free = freeItem ? safeFloat(freeItem.value[1]) : 0;
    const prov = provItem ? safeFloat(provItem.value[1]) : 0;
    const vmCount = vmsItem ? safeFloat(vmsItem.value[1]) : 0;

    const used = cap - free;
    const usedPct = cap > 0 ? safeFloat((used / cap) * 100) : 0;

    return {
      name,
      capacity_gb: toGb(cap),
      free_gb: toGb(free),
      used_gb: toGb(used),
      provisioned_gb: toGb(prov),
      used_percent: usedPct,
      vm_count: vmCount,
      storage_alert: usedPct > 80,
    };
  });

  // ── VMs ─────────────────────────────────────────────────────────────────────
  const [
    vmPowerState,
    vmCpuUsage,
    vmMemConsumed,
    vmMemMax,
    vmNumCpu,
    vmNetReceived,
    vmNetSent,
    vmDiskRead,
    vmDiskWrite,
  ] = await Promise.all([
    pq("vmware_vm_power_state"),
    pq("vmware_vm_cpu_usage_average"),
    pq("vmware_vm_mem_consumed_average"),
    pq("vmware_vm_memory_max"),
    pq("vmware_vm_num_cpu"),
    pq("vmware_vm_net_received_average"),
    pq("vmware_vm_net_transmitted_average"),
    pq("vmware_vm_disk_read_average"),
    pq("vmware_vm_disk_write_average"),
  ]);

  const vmNames = [...new Set(vmPowerState.map(r => r.metric?.vm_name).filter(Boolean))];

  const pwrMap = {};
  vmPowerState.forEach(r => {
    if (r.metric?.vm_name) pwrMap[r.metric.vm_name] = r.value[1] === "1" ? "on" : "off";
  });

  const makeMap = (results) => {
    const m = {};
    results.forEach(r => {
      const name = r.metric?.vm_name;
      if (name) m[name] = safeFloat(r.value[1]);
    });
    return m;
  };

  const cpuMap = makeMap(vmCpuUsage);
  const memConMap = makeMap(vmMemConsumed);
  const memMaxMap = makeMap(vmMemMax);
  const numCpuMap = makeMap(vmNumCpu);
  const netRxMap = makeMap(vmNetReceived);
  const netTxMap = makeMap(vmNetSent);
  const diskRMap = makeMap(vmDiskRead);
  const diskWMap = makeMap(vmDiskWrite);

  const vms = vmNames.map(name => {
    const memConKb = memConMap[name] || 0;
    const memMaxMb = memMaxMap[name] || 0;
    const memConMb = memConKb / 1024;
    const memPctVm = memMaxMb > 0 ? safeFloat((memConMb / memMaxMb) * 100) : 0;

    return {
      name,
      power_state: pwrMap[name] || "unknown",
      cpu_usage_mhz: cpuMap[name] || 0,
      num_cpu: numCpuMap[name] || 0,
      memory_consumed_mb: safeFloat(memConMb),
      memory_max_mb: memMaxMb,
      memory_used_percent: memPctVm,
      net_received_kbps: netRxMap[name] || 0,
      net_sent_kbps: netTxMap[name] || 0,
      disk_read_kbps: diskRMap[name] || 0,
      disk_write_kbps: diskWMap[name] || 0,
      memory_alert: memPctVm > 85,
    };
  });

  // ── Alerts ──────────────────────────────────────────────────────────────────
  const alerts = await scrapeAlerts();

  // ── Summary ─────────────────────────────────────────────────────────────────
  const summary = {
    total_vms: vms.length,
    vms_on: vms.filter(v => v.power_state === "on").length,
    vms_off: vms.filter(v => v.power_state === "off").length,
    vms_mem_alert: vms.filter(v => v.memory_alert).length,
    host_cpu_alert: hypervisor.cpu_alert,
    host_mem_alert: hypervisor.memory_alert,
    ds_storage_alerts: datastores.filter(d => d.storage_alert).length,
    active_alerts: alerts.total_active,
    critical_alerts: alerts.by_severity.critical,
    warning_alerts: alerts.by_severity.warning,
  };

  return { summary, hypervisor, datastores, vms, alerts };
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "metrics-bridge", version: "2.1.2" });
});

// ── GET /api/metrics-analysis ─────────────────────────────────────────────────
app.get("/api/metrics-analysis", async (req, res) => {
  const serviceName = req.query.service || "vmware-esxi";

  try {
    const metrics = await scrapeVMwareMetrics();

    const topVmsByCpu = [...metrics.vms]
      .sort((a, b) => b.cpu_usage_mhz - a.cpu_usage_mhz)
      .slice(0, 8);

    const topVmsByMem = [...metrics.vms]
      .sort((a, b) => b.memory_used_percent - a.memory_used_percent)
      .slice(0, 8);

    const llmPayload = {
      service_name: "vmware-esxi",
      hypervisor_name: `${metrics.hypervisor.version} - ${metrics.hypervisor.cpu_model || "Unknown CPU"}`,

      hypervisor: {
        cpu: {
          usage_percent: metrics.hypervisor.cpu_usage_percent,
          used_mhz: metrics.hypervisor.cpu_usage_mhz,
          total_mhz: metrics.hypervisor.cpu_max_mhz,
          cores: metrics.hypervisor.num_cpu,
          status: metrics.hypervisor.cpu_alert ? "CRITICAL" : "NORMAL"
        },
        memory: {
          usage_percent: metrics.hypervisor.memory_usage_percent,
          used_gb: safeFloat(metrics.hypervisor.memory_usage_mb / 1024, 1),
          total_gb: safeFloat(metrics.hypervisor.memory_max_mb / 1024, 1),
          status: metrics.hypervisor.memory_alert ? "CRITICAL" : "NORMAL"
        },
        uptime_days: metrics.hypervisor.uptime_days,
        network: {
          received_kbps: metrics.hypervisor.net_received_kbps,
          sent_kbps: metrics.hypervisor.net_sent_kbps
        }
      },

      datastores: metrics.datastores.map(ds => ({
        name: ds.name,
        used_percent: ds.used_percent,
        used_gb: ds.used_gb,
        free_gb: ds.free_gb,
        provisioned_gb: ds.provisioned_gb,
        vm_count: ds.vm_count,
        status: ds.storage_alert ? "CRITICAL" : "NORMAL"
      })),

      top_cpu_consumers: topVmsByCpu.map(vm => ({
        name: vm.name,
        power_state: vm.power_state,
        cpu_mhz: vm.cpu_usage_mhz,
        cpu_cores: vm.num_cpu,
        memory_percent: vm.memory_used_percent,
        memory_mb: vm.memory_consumed_mb
      })),

      top_memory_consumers: topVmsByMem.map(vm => ({
        name: vm.name,
        power_state: vm.power_state,
        memory_percent: vm.memory_used_percent,
        memory_mb: vm.memory_consumed_mb,
        cpu_mhz: vm.cpu_usage_mhz
      })),

      active_alerts: metrics.alerts.alerts.map(a => ({
        alert: a.name,
        severity: a.severity.toUpperCase(),
        vm: a.vm_name,
        detail: a.tools_status ? `Tools: ${a.tools_status}` : "",
        since: a.since
      })),

      context_instruction: `
Tu es un expert VMware vSphere. Analyse ces métriques et donne une réponse claire :
1. État global de santé (CPU / RAM / Stockage)
2. Problèmes prioritaires actuels (avec explication)
3. Actions recommandées concrètes
4.Donner une analyse détaillée sur la situation globale de l'hyperviseur (CPU, mémoire, stockage, contention, etc.)
5.Réaliser une analyse approfondie par VM
6. Risques si rien n'est fait`
    };

    const aiRes = await axios.post(
      `${AI_ANALYZER}/analyze/metrics`,
      { 
        metrics: llmPayload, 
        service_name: "vmware-esxi", 
        analysis_type: "full_diagnostic" 
      },
      { timeout: 35000 }
    );

    res.json({
      service: serviceName,
      timestamp: new Date().toISOString(),
      metrics,
      llm_input: llmPayload,
      analysis: aiRes.data,
    });
  } catch (err) {
    console.error("[metrics-analysis] ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/raw-metrics ──────────────────────────────────────────────────────
app.get("/api/raw-metrics", async (req, res) => {
  try {
    const metrics = await scrapeVMwareMetrics();
    res.json({ timestamp: new Date().toISOString(), metrics });
  } catch (err) {
    console.error("[raw-metrics] ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Metrics Bridge v2.1.2 (VMware - Alerts importants) running on port ${PORT}`);
  console.log(` AI Analyzer : ${AI_ANALYZER}`);
  console.log(` Prometheus : ${PROM}`);
});
