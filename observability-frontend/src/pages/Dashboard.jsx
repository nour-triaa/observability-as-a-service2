// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { Grid, Card, CardContent, Typography, Box, Paper, CircularProgress } from "@mui/material";
import { Link } from "react-router-dom";

// Garder tes VMS pour la section détaillée
import { VMS } from "../data/vms";

export default function Dashboard() {
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      const end = Math.floor(Date.now() / 1000);
      const start = end - 60 * 5; // 5 dernières minutes
      const step = 30;

      const metricsData = {};

      for (const vm of VMS) {
        try {
          // Exemple : mémoire utilisée
          const query = `(1 - (node_memory_MemAvailable_bytes{instance="${vm.ip}:9100"} / node_memory_MemTotal_bytes{instance="${vm.ip}:9100"})) * 100`;
          const response = await fetch(
            `http://prometheus.local/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
          );
          const data = await response.json();
          const lastValue =
            data?.data?.result?.[0]?.values?.slice(-1)[0]?.[1] ?? null;

          metricsData[vm.name] = {
            tenant: vm.tenant,
            memoryUsage: lastValue ? parseFloat(lastValue).toFixed(2) : "—",
          };
        } catch (err) {
          console.error(`Erreur pour ${vm.name}:`, err);
          metricsData[vm.name] = { tenant: vm.tenant, memoryUsage: "Erreur" };
        }
      }

      setMetrics(metricsData);
      setLoading(false);
    };

    fetchMetrics();
  }, []);

  return (
    <Box sx={{ p: 4, background: "#0f172a", minHeight: "100vh" }}>
      {/* 🔹 Tableau Prometheus */}
      <Typography variant="h5" sx={{ color: "#f1f5f9", mb: 3 }}>
        Metrics VMs (Memory Usage)
      </Typography>

      <Paper
        elevation={6}
        sx={{ p: 3, borderRadius: 3, background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", mb: 6 }}
      >
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : (
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={{ color: "#f1f5f9", textAlign: "left", p: 1 }}>VM Name</Box>
                <Box component="th" sx={{ color: "#f1f5f9", textAlign: "left", p: 1 }}>Tenant</Box>
                <Box component="th" sx={{ color: "#f1f5f9", textAlign: "left", p: 1 }}>Memory Usage (%)</Box>
              </Box>
            </Box>
            <Box component="tbody">
              {Object.entries(metrics).map(([vmName, data]) => (
                <Box component="tr" key={vmName}>
                  <Box component="td" sx={{ color: "#f1f5f9", p: 1 }}>{vmName}</Box>
                  <Box component="td" sx={{ color: "#60a5fa", fontWeight: "bold", p: 1 }}>{data.tenant}</Box>
                  <Box component="td" sx={{ color: "#34d399", p: 1 }}>{data.memoryUsage}</Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {/* 🖥️ Section VMs détaillées */}
      <Typography variant="h6" sx={{ color: "#f1f5f9", mb: 3 }}>
        Tenants et VMs
      </Typography>
      <Grid container spacing={3}>
        {VMS.map((vm) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={vm.name}>
            <Link to={`/vm/${vm.name}`} style={{ textDecoration: "none" }}>
              <Card
                sx={{
                  background: "linear-gradient(120deg, #334155 0%, #1e293b 100%)",
                  color: "white",
                  p: 2,
                  cursor: "pointer",
                  transition: "0.3s",
                  "&:hover": {
                    transform: "scale(1.05)",
                    boxShadow: "0 0 20px rgba(96,165,250,0.7)",
                  },
                }}
              >
                <CardContent>
                  <Typography variant="h6">{vm.name}</Typography>
                  <Typography variant="body2" sx={{ color: "#60a5fa", fontWeight: "bold" }}>
                    {vm.tenant}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#34d399", mt: 1 }}>
                    CPU: {vm.cpu || "—"}% | Memory: {vm.memory || "—"}% | Network: {vm.network || "—"}%
                  </Typography>
                </CardContent>
              </Card>
            </Link>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
