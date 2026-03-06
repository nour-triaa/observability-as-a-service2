import { Typography, Box, Card, CardContent } from "@mui/material";

export default function Dashboard() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        backgroundColor: "#111827", // fond principal
        padding: 4,
      }}
    >
      {/* Titre */}
      <Typography
        variant="h3"
        sx={{
          fontWeight: "bold",
          marginBottom: 4,
          color: "#ffffff", // texte blanc
        }}
      >
        Dashboard
      </Typography>

      {/* Carte Grafana */}
      <Card
        sx={{
          width: "80%",
          maxWidth: 900,
          borderRadius: 3,
          boxShadow: 6,
          backgroundColor: "#1f2937", // fond de la carte
        }}
      >
        <CardContent>
          <iframe
            src="http://grafana.local/d-solo/adlwcvp/chrome?orgId=1&panelId=1"
            width="100%"
            height="400"
            style={{ border: "none", backgroundColor: "#1f2937" }}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
