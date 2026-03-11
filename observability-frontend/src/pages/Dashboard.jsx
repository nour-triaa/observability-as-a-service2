// src/pages/Dashboard.jsx
import { Typography, Box, Card, CardContent } from "@mui/material";
import CpuGraph from "../components/metrics/CpuGraph"; // Remplace par ton GPUGraph si nécessaire

export default function DashboardPage() {
  return (
    <Box
      sx={{
        flexGrow: 1,
        minHeight: "100vh",
        p: 3,
        background: "linear-gradient(180deg, #111827 0%, #1e1f2a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Titre principal */}
      <Typography
        variant="h3"
        sx={{
          fontWeight: 700,
          color: "text.primary",
          mb: 4,
          textAlign: "center",
        }}
      >
        Dashboard
      </Typography>

      {/* Carte unique pour le graphique */}
      <Card
        sx={{
          width: "100%",
          maxWidth: 1200, // largeur maximale du graphique
          bgcolor: "background.paper",
          borderRadius: 3,
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          transition: "0.3s",
          "&:hover": {
            transform: "translateY(-5px)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
          },
        }}
      >
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            GPU Usage
          </Typography>
          <CpuGraph /> {/* Remplace CpuGraph par GPUGraph si tu as un vrai composant GPU */}
        </CardContent>
      </Card>
    </Box>
  );
}
