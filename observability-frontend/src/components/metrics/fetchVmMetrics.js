// src/components/metrics/fetchVmMetrics.js
export async function fetchVmMetrics() {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 60 * 60; // dernière heure
  const end = now;
  const step = 30;

  // CPU
  const cpuResp = await fetch(
    `http://prometheus.local/api/v1/query_range?query=process_cpu_seconds_total{job="node-exporter"}&start=${start}&end=${end}&step=${step}`
  );
  const cpuData = await cpuResp.json();

  // Memory
  const memResp = await fetch(
    `http://prometheus.local/api/v1/query_range?query=node_memory_Active_bytes{job="node-exporter"}&start=${start}&end=${end}&step=${step}`
  );
  const memData = await memResp.json();

  // Errors
  const errResp = await fetch(
    `http://prometheus.local/api/v1/query?query=vm_errors_total{job="node-exporter"}`
  );
  const errData = await errResp.json();

  // Combinaison par VM
  const vms = {};
  cpuData.data.result.forEach(r => {
    const vm = r.metric.instance;
    if (!vms[vm]) vms[vm] = {};
    vms[vm].cpu = r.values[r.values.length - 1][1];
  });

  memData.data.result.forEach(r => {
    const vm = r.metric.instance;
    if (!vms[vm]) vms[vm] = {};
    vms[vm].memory = r.values[r.values.length - 1][1];
  });

  errData.data.result.forEach(r => {
    const vm = r.metric.instance;
    if (!vms[vm]) vms[vm] = {};
    vms[vm].errors = parseInt(r.value[1]);
  });

  return Object.entries(vms).map(([instance, metrics]) => ({
    instance,
    cpu: parseFloat(metrics.cpu).toFixed(2),
    memory: parseFloat(metrics.memory).toFixed(2),
    errors: metrics.errors || 0,
  }));
}
