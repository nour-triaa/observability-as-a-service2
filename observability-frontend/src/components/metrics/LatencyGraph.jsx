// src/components/metrics/LatencyGraph.jsx
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function LatencyGraph({ vmName }) {
  const [data, setData] = useState({ labels: [], datasets: [] });
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const end = Math.floor(Date.now() / 1000);
      const start = end - 1800; // 30 minutes

      // ⚠ Vérifie que le nom de métrique et label sont corrects
      const query = `vmware_vm_disk_read_latency_average{vm_name="${vmName}"}`;

      try {
        const res = await fetch(
          `http://prometheus.local/api/v1/query_range?query=${encodeURIComponent(
            query
          )}&start=${start}&end=${end}&step=30`
        );
        const json = await res.json();

        if (!json.data.result.length) {
          setNoData(true);
          setData({ labels: [], datasets: [] });
          return;
        }

        const values = json.data.result[0].values;
        setNoData(false);
        setData({
          labels: values.map(v => new Date(v[0] * 1000).toLocaleTimeString()),
          datasets: [
            {
              label: "Disk Read Latency (ms)",
              data: values.map(v => parseFloat(v[1])),
              borderColor: "#fbbf24",
              backgroundColor: "rgba(251,191,36,0.2)",
              tension: 0.4,
            },
          ],
        });
      } catch (err) {
        console.error("Erreur fetch Latency:", err);
        setNoData(true);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Rafraîchit toutes les 30s
    return () => clearInterval(interval);
  }, [vmName]);

  if (noData) {
    return (
      <div style={{ color: "#f87171", marginTop: "10px" }}>
        Pas de données disponibles pour {vmName}.
      </div>
    );
  }

  return (
    <Line
      data={data}
      options={{
        responsive: true,
        plugins: {
          legend: { display: true, labels: { color: "#f1f5f9" } },
          title: { display: true, text: `Latency de ${vmName}`, color: "#f1f5f9" },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Latency (ms)", color: "#f1f5f9" },
            ticks: { color: "#f1f5f9" },
          },
          x: {
            title: { display: true, text: "Time", color: "#f1f5f9" },
            ticks: { color: "#f1f5f9" },
          },
        },
      }}
    />
  );
}
