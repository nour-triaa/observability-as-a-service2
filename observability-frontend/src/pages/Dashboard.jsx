// src/pages/Dashboard.jsx
import { Grid, Card, CardContent, Typography, Box, Paper } from "@mui/material";
import { Link } from "react-router-dom";
import { VMS } from "../data/vms";
import GlobalCpuGraph from "../components/metrics/GlobalCpuGraph";

export default function Dashboard() {
  return (
    <Box sx={{ p: 4, background: "#0f172a", minHeight: "100vh" }}>
      
      {/* Bloc métriques globales style Grafana */}
      <Paper
        elevation={6}
        sx={{
          p: 4,
          mb: 6,
          borderRadius: 3,
          background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
        }}
      >
        <Typography variant="h5" sx={{ color: "#f1f5f9", mb: 3 }}>
          Vue globale CPU de toutes les VMs
        </Typography>
        <Box sx={{ height: "350px" }}>
          <GlobalCpuGraph />
        </Box>
      </Paper>

      {/* Tableau des tenants et VMs */}
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
                  <Typography
                    variant="body2"
                    sx={{ color: "#60a5fa", fontWeight: "bold" }}
                  >
                    {vm.tenant}
                  </Typography>
                  {/* Préparer pour d'autres métriques */}
                  <Typography
                    variant="body2"
                    sx={{ color: "#34d399", mt: 1 }}
                  >
                    CPU: {vm.cpu || "—"}% | Memory: {vm.memory || "—"}%
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
