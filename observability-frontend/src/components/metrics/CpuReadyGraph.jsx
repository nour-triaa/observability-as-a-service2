import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";

export default function CpuReadyGraph({ vmName }) {
  const [cpuReady, setCpuReady] = useState("N/A");

  useEffect(() => {
    async function fetchCpuReady() {
      try {
        // Récupération des métriques CPU Ready et vCPU
        const res = await fetch(
          `http://prometheus.local/api/v1/query?query=${encodeURIComponent(
            `vmware_vm_cpu_ready_summation{vm_name="${vmName}"}`
          )}`
        );
        const resVcpu = await fetch(
          `http://prometheus.local/api/v1/query?query=${encodeURIComponent(
            `vmware_vm_num_cpu{vm_name="${vmName}"}`
          )}`
        );

        const data = await res.json();
        const vcpuData = await resVcpu.json();

        if (data.data.result.length > 0 && vcpuData.data.result.length > 0) {
          const cpuReadySeconds = parseFloat(data.data.result[0].value[1]);
          const vcpus = parseInt(vcpuData.data.result[0].value[1]);

          // Période d’échantillonnage en secondes
          const samplePeriod = 20; // par défaut 20s, adapter selon Prometheus scrape_interval

          // Formule CPU Ready %
          const cpuReadyPercent = ((cpuReadySeconds / (samplePeriod * vcpus)) * 100).toFixed(1);

          setCpuReady(cpuReadyPercent);
        } else {
          setCpuReady("N/A");
        }
      } catch (err) {
        console.error("Erreur fetch CPU Ready:", err);
        setCpuReady("N/A");
      }
    }

    fetchCpuReady();
    const interval = setInterval(fetchCpuReady, 30000);
    return () => clearInterval(interval);
  }, [vmName]);

  return (
    <Box sx={{ mt: 2 }}>
      <Typography>CPU Ready: {cpuReady} %</Typography>
    </Box>
  );
}
