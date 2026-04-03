import { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Filler, Tooltip, Legend,
} from "chart.js";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const PROM = "http://prometheus.local/api/v1/query_range";

export default function CpuGraph({ vmName }) {
  const [chartData, setChartData] = useState(null);
  const [current, setCurrent]     = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const end   = Math.floor(Date.now() / 1000);
        const start = end - 1800;

        // FIX: cpu_usage_average est en MHz*100 (centimillièmes de %)
        // → diviser par 100 pour obtenir le % réel
        const [resUsage, resMax] = await Promise.all([
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_cpu_usage_average{vm_name="${vmName}"}`)}&start=${start}&end=${end}&step=30`),
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_max_cpu_usage{vm_name="${vmName}"}`)}&start=${start}&end=${end}&step=30`),
        ]);
        const [jUsage, jMax] = await Promise.all([resUsage.json(), resMax.json()]);

        if (!jUsage.data.result.length) { setLoading(false); return; }

        const values    = jUsage.data.result[0].values;
        const maxValues = jMax.data.result[0]?.values || [];

        // cpu_usage_average / max_cpu_usage * 100 = % réel
        const pctData = values.map((v, i) => {
          const usage = parseFloat(v[1]);
          const max   = maxValues[i] ? parseFloat(maxValues[i][1]) : 0;
          return max > 0 ? parseFloat(((usage / max) * 100).toFixed(1)) : parseFloat((usage / 100).toFixed(1));
        });

        const last = pctData[pctData.length - 1];
        setCurrent(last);

        setChartData({
          labels: values.map(v => new Date(v[0] * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })),
          datasets: [{
            label: "CPU %",
            data: pctData,
            borderColor: "#f87171",
            backgroundColor: "rgba(248,113,113,0.08)",
            borderWidth: 1.5,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
          }],
        });
      } catch (e) {
        console.error("CpuGraph error:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [vmName]);

  const color = current === null ? "#475569" : current > 80 ? "#f87171" : current > 50 ? "#fb923c" : "#4ade80";

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index", intersect: false,
        backgroundColor: "#0d1626",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        titleColor: "#64748b",
        bodyColor: "#f1f5f9",
        callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)}%` },
      },
    },
    scales: {
      x: {
        ticks: { color: "#334155", font: { size: 9, family: "'JetBrains Mono'" }, maxTicksLimit: 6 },
        grid: { color: "rgba(255,255,255,0.03)" },
      },
      y: {
        beginAtZero: true, max: 100,
        ticks: { color: "#334155", font: { size: 9, family: "'JetBrains Mono'" }, callback: v => `${v}%` },
        grid: { color: "rgba(255,255,255,0.04)" },
      },
    },
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
            <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
          </svg>
          <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
            CPU Usage
          </span>
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, color: loading ? "#334155" : color, fontFamily: "'JetBrains Mono', monospace" }}>
          {loading ? "…" : current === null ? "N/A" : `${current.toFixed(1)}%`}
        </span>
      </div>
      <div style={{ height: 90 }}>
        {chartData ? <Line data={chartData} options={options} /> : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e3a5f", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            Aucune donnée
          </div>
        )}
      </div>
    </div>
  );
}

