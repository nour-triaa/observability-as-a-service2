// src/components/metrics/NetworkGraph.jsx
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

export default function NetworkGraph({ ip }) {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    async function fetchData() {
      try {
        const end = Math.floor(Date.now() / 1000);
        const start = end - 3600;
        const step = 30;

        const query = `rate(node_network_receive_bytes_total{instance="${ip}:9100"}[5m])`;

        const response = await fetch(
          `http://prometheus.local/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
        );

        const data = await response.json();
        if (data.status !== "success" || !data.data.result.length) return;

        const result = data.data.result[0];
        const labels = result.values.map(v => {
          const d = new Date(v[0] * 1000);
          return `${d.getHours()}:${d.getMinutes()}`;
        });
        const values = result.values.map(v => parseFloat(v[1]));

        setChartData({
          labels,
          datasets: [
            {
              label: "Network Receive (bytes/s)",
              data: values,
              borderColor: "#facc15",
              backgroundColor: "rgba(250,204,21,0.2)",
              tension: 0.4,
            },
          ],
        });
      } catch (err) {
        console.error("Erreur fetch Network:", err);
      }
    }

    fetchData();
  }, [ip]);

  return <Line data={chartData} options={{ responsive: true, plugins: { legend: { display: true } } }} />;
}
