// src/theme.js
import { createTheme } from "@mui/material/styles";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#0ea5e9" },    // bleu cyan pour accents
    secondary: { main: "#38bdf8" },  // bleu clair pour hover/boutons
    background: {
      default: "#0f111a",
      paper: "#1e1f2a",
    },
    text: {
      primary: "#f5f5f7",
      secondary: "#a1a1aa",
    },
    success: { main: "#22c55e" },
    error: { main: "#f87171" },
    warning: { main: "#facc15" },
    info: { main: "#3b82f6" },
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Arial', sans-serif",
    h1: { fontWeight: 700, letterSpacing: "-0.5px" },
    h2: { fontWeight: 700, letterSpacing: "-0.25px" },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
    button: { textTransform: "none", fontWeight: 500 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          background: "#1e1f2a",
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          transition: "0.3s",
          borderLeft: "5px solid #0ea5e9", // accent bleu cyan
          "&:hover": {
            transform: "translateY(-5px)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 500,
          background: "linear-gradient(145deg, #0ea5e9, #38bdf8)",
          color: "#fff",
          transition: "0.3s",
          "&:hover": {
            transform: "translateY(-2px)",
            background: "linear-gradient(145deg, #0b83b5, #22ccee)", // hover bleu
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: {
          background: "rgba(31, 41, 55, 0.95)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: "rgba(30, 31, 42, 0.95)",
          color: "#ffffff",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          "&.Mui-selected": {
            backgroundColor: "rgba(14,165,233,0.25)", // bleu sélection
            color: "#fff",
            "&:hover": { backgroundColor: "rgba(14,165,233,0.35)" },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: "#333", fontSize: "0.85rem" },
      },
    },
    MuiTypography: {
      styleOverrides: {
        h3: { color: "#f5f5f7", fontWeight: 700 },
        h6: { fontWeight: 600, color: "#f5f5f7" },
      },
    },
  },
});

export default darkTheme;
