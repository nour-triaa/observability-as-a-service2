// src/components/metrics/CpuGraph.jsx
import { useEffect, useState } from "react";
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
import { Line } from "react-chartjs-2";

// On doit enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function CpuGraph() {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    async function fetchData() {
      try {
        // Timestamp actuel et il y a 24h
        const end = Math.floor(Date.now() / 1000);
        const start = end - 24 * 60 * 60; // 24 heures en secondes
        const step = 60; // 1 minute entre chaque point

        const response = await fetch(
          `http://prometheus.local/api/v1/query_range?query=process_cpu_seconds_total{job="node-exporter"}&start=${start}&end=${end}&step=${step}`
        );

        const data = await response.json();

        // Vérification des résultats
        if (data.status !== "success" || !data.data.result.length) {
          throw new Error("Pas de données CPU disponibles");
        }

        const result = data.data.result[0]; // On prend la première métrique

        const labels = result.values.map(v => {
          const date = new Date(v[0] * 1000);
          return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
        });

        const cpuValues = result.values.map(v => parseFloat(v[1]));

        setChartData({
          labels,
          datasets: [
            {
              label: "CPU Node Exporter",
              data: cpuValues,
              fill: false,
              borderColor: "rgba(75, 192, 192, 1)",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              tension: 0.3, // rend la ligne plus douce
            },
          ],
        });
      } catch (err) {
        console.error("Erreur fetch frontend:", err);
      }
    }

    fetchData();
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: 900 }}>
      <Line data={chartData} options={{
        responsive: true,
        plugins: {
          legend: { position: "top" },
          title: { display: true, text: "CPU Usage - Last 24h" },
        },
        scales: {
          x: {
            title: { display: true, text: "Time" },
          },
          y: {
            title: { display: true, text: "CPU Seconds" },
          },
        },
      }} />
    </div>
  );
}
