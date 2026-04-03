import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Filler, Tooltip, Legend,
} from "chart.js";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const PROM = "http://prometheus.local/api/v1/query_range";

export default function NetworkGraph({ vmName }) {
  const [chartData, setChartData] = useState(null);
  const [stats,     setStats]     = useState({ rx: null, tx: null });
  const [loading,   setLoading]   = useState(true);
  const [allZero,   setAllZero]   = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const end   = Math.floor(Date.now() / 1000);
        const start = end - 1800;

        const [resRx, resTx] = await Promise.all([
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_net_received_average{vm_name="${vmName}"}`)}&start=${start}&end=${end}&step=30`),
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_net_transmitted_average{vm_name="${vmName}"}`)}&start=${start}&end=${end}&step=30`),
        ]);
        const [jRx, jTx] = await Promise.all([resRx.json(), resTx.json()]);

        const rxValues = jRx.data.result[0]?.values || [];
        const txValues = jTx.data.result[0]?.values || [];

        if (!rxValues.length && !txValues.length) {
          setAllZero(true);
          setLoading(false);
          return;
        }

        const rxData = rxValues.map(v => parseFloat(v[1]));
        const txData = txValues.map(v => parseFloat(v[1]));

        // Vérifier si tout est à 0
        const isAllZero = [...rxData, ...txData].every(v => v === 0);
        setAllZero(isAllZero);

        const lastRx = rxData[rxData.length - 1] ?? null;
        const lastTx = txData[txData.length - 1] ?? null;
        setStats({ rx: lastRx, tx: lastTx });

        const labels = rxValues.map(v =>
          new Date(v[0] * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );

        setChartData({
          labels,
          datasets: [
            {
              label: "RX (KB/s)",
              data: rxData,
              borderColor: "#60a5fa",
              backgroundColor: "rgba(96,165,250,0.06)",
              borderWidth: 1.5,
              tension: 0.4,
              fill: true,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
            {
              label: "TX (KB/s)",
              data: txData,
              borderColor: "#34d399",
              backgroundColor: "rgba(52,211,153,0.06)",
              borderWidth: 1.5,
              tension: 0.4,
              fill: true,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
          ],
        });
      } catch (e) {
        console.error("NetworkGraph error:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [vmName]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: { color: "#475569", font: { size: 9, family: "'JetBrains Mono'" }, boxWidth: 10, padding: 10 },
      },
      tooltip: {
        mode: "index", intersect: false,
        backgroundColor: "#0d1626",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        titleColor: "#64748b",
        bodyColor: "#f1f5f9",
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} KB/s` },
      },
    },
    scales: {
      x: {
        ticks: { color: "#334155", font: { size: 9, family: "'JetBrains Mono'" }, maxTicksLimit: 6 },
        grid: { color: "rgba(255,255,255,0.03)" },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#334155", font: { size: 9, family: "'JetBrains Mono'" }, callback: v => `${v}` },
        grid: { color: "rgba(255,255,255,0.04)" },
      },
    },
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
            Réseau
          </span>
        </div>
        {!loading && stats.rx !== null && (
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ fontSize: 10, color: "#60a5fa", fontFamily: "'JetBrains Mono', monospace" }}>
              ↓ {stats.rx.toFixed(1)} KB/s
            </span>
            <span style={{ fontSize: 10, color: "#34d399", fontFamily: "'JetBrains Mono', monospace" }}>
              ↑ {stats.tx?.toFixed(1)} KB/s
            </span>
          </div>
        )}
      </div>

      {/* Trafic nul = VM idle, afficher quand même le graphe avec indication */}
      {!loading && allZero && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
          padding: "6px 12px", borderRadius: 8,
          background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.12)",
        }}>
          <span style={{ fontSize: 10, color: "#3b82f6", fontFamily: "'JetBrains Mono', monospace" }}>
            Trafic réseau nul — VM inactive ou trafic non mesuré
          </span>
        </div>
      )}

      <div style={{ height: 90 }}>
        {loading && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e3a5f", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>…</div>
        )}
        {!loading && chartData && <Line data={chartData} options={options} />}
        {!loading && !chartData && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e3a5f", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            Aucune donnée réseau
          </div>
        )}
      </div>
    </div>
  );
}

