// src/components/metrics/ProVmMetrics.jsx
import React, { useEffect, useState } from "react";
import { fetchVmMetrics } from "./fetchVmMetrics";
import { Paper, Typography, Box } from "@mui/material";

export default function ProVmMetrics() {
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    async function load() {
      const data = await fetchVmMetrics();
      setMetrics(data);
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {metrics.map((vm) => (
        <Paper
          key={vm.instance}
          elevation={6}
          sx={{
            p: 3,
            flex: "1 1 300px",
            background: "linear-gradient(135deg, #1e293b, #334155)",
            color: "#f1f5f9",
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            {vm.instance}
          </Typography>
          <Typography>CPU: {vm.cpu}%</Typography>
          <Typography>Memory: {vm.memory}%</Typography>
          <Typography color={vm.errors > 0 ? "error.main" : "success.main"}>
            Errors: {vm.errors}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}
