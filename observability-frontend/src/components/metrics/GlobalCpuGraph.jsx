// src/components/metrics/GlobalCpuGraph.jsx
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
  Filler,
} from "chart.js";
import { VMS } from "../../data/vms";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function GlobalCpuGraph() {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    async function fetchAllCpu() {
      try {
        const end = Math.floor(Date.now() / 1000);
        const start = end - 3600; // dernière heure
        const step = 30;

        const datasets = [];
        let labelsSet = false;

        // Filtrer seulement les tenants 1 à 4
        const filteredVMs = VMS.filter(vm => ["tenant1","tenant2","tenant3","tenant4"].includes(vm.tenant));

        for (const vm of filteredVMs) {
          const query = `rate(node_cpu_seconds_total{instance="${vm.ip}:9100"}[5m])`;
          const response = await fetch(
            `http://prometheus.local/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
          );

          const data = await response.json();
          if (data.status !== "success" || !data.data.result.length) continue;

          // Fusionner toutes les cores pour avoir un usage CPU total par VM
          const combinedValues = data.data.result[0].values.map((v, idx) => {
            return data.data.result.reduce((sum, core) => sum + parseFloat(core.values[idx][1]), 0) * 100;
          });

          // Labels basés sur la première série
          if (!labelsSet) {
            const labels = data.data.result[0].values.map(v => {
              const d = new Date(v[0] * 1000);
              return `${d.getHours()}:${d.getMinutes()}`;
            });
            setChartData(prev => ({ ...prev, labels }));
            labelsSet = true;
          }

          datasets.push({
            label: `${vm.tenant} (${vm.name})`,
            data: combinedValues,
            fill: true, // remplit l'aire sous la courbe
            borderColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
            backgroundColor: `hsla(${Math.random() * 360}, 70%, 50%, 0.3)`,
            tension: 0.3,
          });
        }

        setChartData(prev => ({ ...prev, datasets }));
      } catch (err) {
        console.error("Erreur fetch Global CPU:", err);
      }
    }

    fetchAllCpu();
  }, []);

  return (
    <Line
      data={chartData}
      options={{
        responsive: true,
        plugins: {
          legend: { display: true, position: "bottom" },
          title: { display: true, text: "CPU Usage Global (Tenant 1-4)" },
          tooltip: { mode: "index", intersect: false },
        },
        interaction: { mode: "nearest", axis: "x", intersect: false },
        scales: {
          y: { 
            beginAtZero: true, 
            max: 100, 
            title: { display: true, text: "%" },
            stacked: true // empile les courbes
          },
          x: { 
            title: { display: true, text: "Time" },
            stacked: true
          },
        },
      }}
    />
  );
}
