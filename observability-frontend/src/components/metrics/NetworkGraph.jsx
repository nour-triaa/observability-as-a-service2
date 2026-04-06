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
  const [stats, setStats] = useState({ rx: null, tx: null });
  const [loading, setLoading] = useState(true);
  const [allZero, setAllZero] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const end   = Math.floor(Date.now() / 1000);
        const start = end - 24 * 3600; // dernière 24h
        const step  = 300;             // 5 minutes

        const [resRx, resTx] = await Promise.all([
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_net_received_average{vm_name="${vmName}"}`)}&start=${start}&end=${end}&step=${step}`),
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_net_transmitted_average{vm_name="${vmName}"}`)}&start=${start}&end=${end}&step=${step}`),
        ]);
        const [jRx, jTx] = await Promise.all([resRx.json(), resTx.json()]);

        const rxValues = jRx.data.result[0]?.values || [];
        const txValues = jTx.data.result[0]?.values || [];

        if (!rxValues.length && !txValues.length) {
          setAllZero(true);
          setChartData(null);
          return;
        }

        const rxData = rxValues.map(v => parseFloat(v[1]));
        const txData = txValues.map(v => parseFloat(v[1]));

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
        setChartData(null);
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
      legend: { display: true, position: "top" },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 12 } },
      y: { beginAtZero: true },
    },
  };

  return (
    <div style={{ height: 200 }}>
      {loading && <div>…</div>}
      {!loading && chartData && <Line data={chartData} options={options} />}
      {!loading && !chartData && <div>Aucune donnée réseau</div>}
    </div>
  );
}
