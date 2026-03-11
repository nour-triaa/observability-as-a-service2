// src/theme.js
import { createTheme } from "@mui/material/styles";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#6b21a8" },    // mauve foncé
    secondary: { main: "#9333ea" },  // violet dynamique
    background: {
      default: "#111827",  // fond principal
      paper: "#1f2937",    // fond des cartes / sidebar
    },
    text: {
      primary: "#f9fafb",  // texte principal clair
      secondary: "#d1d5db", // texte secondaire/gris
    },
    success: { main: "#10b981" }, // pour alertes positives
    error: { main: "#ef4444" },   // pour alertes / erreurs
    warning: { main: "#f59e0b" }, // pour alertes attention
    info: { main: "#3b82f6" },    // pour info
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Arial', sans-serif",
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
    button: { textTransform: "none" }, // boutons plus clean
  },
  shape: {
    borderRadius: 8, // coins des cartes et boutons arrondis
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)", // cartes plus profondes
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,  // coins arrondis pour boutons
          textTransform: "none",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: {
          backgroundColor: "#1f2937", // barre header sombre
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#1f2937", // sidebar sombre
          color: "#ffffff",
        },
      },
    },
  },
});

export default darkTheme;
