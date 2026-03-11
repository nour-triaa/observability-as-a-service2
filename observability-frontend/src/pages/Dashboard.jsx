// src/pages/Dashboard.jsx
import { Typography, Box, Card, CardContent } from "@mui/material";
import CpuGraph from "../components/metrics/CpuGraph"; // <-- import du composant graphique

export default function DashboardPage() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "80vh",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      {/* Titre */}
      <Typography
        variant="h3"
        sx={{
          fontWeight: "bold",
          color: "text.primary",
          mb: 4,
          textAlign: "center",
        }}
      >
        Dashboard
      </Typography>

      {/* Carte avec le graphique CPU Node Exporter */}
      <Card
        sx={{
          width: "100%",
          maxWidth: 900,
          bgcolor: "background.paper",
          borderRadius: 3,
          boxShadow: 6,
          mb: 4,
        }}
      >
        <CardContent>
          <CpuGraph />
        </CardContent>
      </Card>

      {/* Si tu veux garder un graphique Grafana iframe (optionnel) */}
      {/*
      <Card
        sx={{
          width: "100%",
          maxWidth: 900,
          bgcolor: "background.paper",
          borderRadius: 3,
          boxShadow: 6,
        }}
      >
        <CardContent>
          <iframe
            src="http://grafana.local/d-solo/adlwcvp/chrome?orgId=1&panelId=1"
            width="100%"
            height="400"
            style={{
              border: "none",
              backgroundColor: "#1f2937",
              borderRadius: 8,
            }}
          />
        </CardContent>
      </Card>
      */}
    </Box>
  );
}
