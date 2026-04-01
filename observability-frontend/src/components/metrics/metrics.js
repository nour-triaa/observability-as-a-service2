// Exemple simple : metrics.js
export async function fetchMetrics() {
  const services = ['identity-service', 'frontend', 'collector'];
  const metrics = [];

  for (const svc of services) {
    const cpuResp = await fetch(`http://prometheus.local/api/v1/query?query=rate(node_cpu_seconds_total{job="${svc}"}[5m])`);
    const memResp = await fetch(`http://prometheus.local/api/v1/query?query=node_memory_Active_bytes{job="${svc}"}`);
    const cpu = await cpuResp.json();
    const mem = await memResp.json();

    metrics.push({
      service: svc,
      cpu: cpu.data.result[0]?.value[1] * 100 || 0,
      memory: mem.data.result[0]?.value[1] || 0,
      errors: Math.floor(Math.random() * 5), // temporaire si pas d'erreurs réelles
      requests: Math.floor(Math.random() * 100) // temporaire
    });
  }

  return metrics;
}
