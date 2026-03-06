// src/theme.js
import { createTheme } from "@mui/material/styles";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#6b21a8" },      // mauve foncé
    secondary: { main: "#9333ea" },    // violet dynamique
    background: { default: "#111827", paper: "#1f2937" },
  },
});

export default darkTheme;
