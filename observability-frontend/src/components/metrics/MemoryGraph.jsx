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

export default function MemoryGraph({ vmName }) {
  const [data, setData] = useState({ labels: [], datasets: [] });
  const [error, setError] = useState(false); // pour détecter les VMs sans VMware Tools

  useEffect(() => {
    async function fetchData() {
      try {
        const end = Math.floor(Date.now() / 1000);
        const start = end - 3600; // dernière heure
        const step = 30;

        const fetchMetric = async (metric) => {
          const res = await fetch(
            `http://prometheus.local/api/v1/query_range?query=${encodeURIComponent(
              `${metric}{vm_name="${vmName}"}`
            )}&start=${start}&end=${end}&step=${step}`
          );
          const json = await res.json();
          return json.data.result.length ? json.data.result[0].values : [];
        };

        const consumedValues = await fetchMetric("vmware_vm_mem_consumed_average");
        const activeValues = await fetchMetric("vmware_vm_mem_active_average");

        // Si aucune valeur n'est retournée, VMware Tools manquant
        if (!consumedValues.length || !activeValues.length) {
          setError(true);
          setData({ labels: [], datasets: [] });
          return;
        }

        setError(false);

        // Calcul Memory Usage % (mem_used / mem_guest)
        const memoryPercent = consumedValues.map((v, i) => {
          const consumed = parseFloat(v[1]);
          const active = parseFloat(activeValues[i]?.[1] || 0);
          return active > 0 ? ((consumed / active) * 100).toFixed(1) : 0;
        });

        setData({
          labels: consumedValues.map(v => new Date(v[0] * 1000).toLocaleTimeString()),
          datasets: [
            {
              label: "Memory Usage (%)",
              data: memoryPercent,
              borderColor: "#60a5fa",
              backgroundColor: "rgba(96,165,250,0.2)",
              tension: 0.4,
              fill: true,
            },
          ],
        });
      } catch (err) {
        console.error("Erreur fetch MemoryGraph:", err);
        setError(true);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [vmName]);

  if (error) {
    return (
      <div style={{ color: "red", fontWeight: "bold", textAlign: "center", marginTop: 20 }}>
        Impossible de récupérer les données mémoire pour {vmName} (VMware Tools absent ?)
      </div>
    );
  }

  return (
    <Line
      data={data}
      options={{
        responsive: true,
        plugins: {
          legend: { display: true, position: "top" },
          title: { display: true, text: `Memory Usage - ${vmName}`, color: "#f1f5f9", font: { size: 16 } },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          y: { beginAtZero: true, max: 100, title: { display: true, text: "Memory (%)", color: "#f1f5f9" } },
          x: { title: { display: true, text: "Time", color: "#f1f5f9" } },
        },
      }}
    />
  );
}
