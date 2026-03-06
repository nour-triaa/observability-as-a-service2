import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";
import App from "./App.jsx";

// Thème dark + mauve
const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#6b21a8" },
    secondary: { main: "#9333ea" },
    background: {
      default: "#111827",
      paper: "#1f2937",
    },
  },
  typography: { fontFamily: "'Roboto', sans-serif" },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
