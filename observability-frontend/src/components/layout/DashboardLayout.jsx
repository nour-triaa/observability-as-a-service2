// src/components/layout/DashboardLayout.jsx
import * as React from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  Box,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import SettingsIcon  from "@mui/icons-material/Settings";
import BarChartIcon  from "@mui/icons-material/BarChart";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import StorageIcon   from "@mui/icons-material/Storage";

const drawerWidth   = 252;
const SESSION_TIMEOUT = 5 * 60 * 1000;

const P = {
  bg:        "#f4f6f9",
  surface:   "#ffffff",
  border:    "#e4e9f0",
  text:      "#0d1117",
  textSub:   "#3d4a5c",
  textMuted: "#8b97a8",
  blue:      "#1d6af4",
  blueLight: "#e8f0fe",
  blueDark:  "#1558d6",
  green:     "#12a05a",
  greenLight:"#e6f7ef",
  red:       "#e03131",
  redLight:  "#fef0f0",
  orange:    "#d4620a",
};

const navItems = [
  { label: "Tableau de bord", path: "/dashboard", icon: <DashboardIcon fontSize="small" /> },
  { label: "Métriques",       path: "/metrics",   icon: <BarChartIcon  fontSize="small" /> },
  { label: "Stockage",        path: "/storage",   icon: <StorageIcon   fontSize="small" /> },
  { label: "Paramètres",      path: "/settings",  icon: <SettingsIcon  fontSize="small" /> },
];

export default function DashboardLayout({ children }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [time,     setTime]     = React.useState(new Date());

  // Horloge
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Session timeout
  React.useEffect(() => {
    const sessionStart = localStorage.getItem("sessionStart");
    const now = Date.now();
    if (!sessionStart) {
      localStorage.setItem("sessionStart", now);
    } else if (now - parseInt(sessionStart) > SESSION_TIMEOUT) {
      localStorage.removeItem("token");
      localStorage.removeItem("sessionStart");
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("sessionStart");
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <Box sx={{ display: "flex", backgroundColor: P.bg, minHeight: "100vh" }}>
      <CssBaseline />

      {/* ── AppBar ── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: P.surface,
          color: P.text,
          borderBottom: `1px solid ${P.border}`,
          boxShadow: "0 1px 0 rgba(13,17,23,0.06)",
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between", px: "24px !important", minHeight: "64px !important" }}>

          {/* Logo */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              component="img"
              src="/next.png"
              alt="Logo"
              sx={{
                height: 46,
                width: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 2px 6px rgba(29,106,244,0.20))",
                transition: "filter 0.2s",
                "&:hover": { filter: "drop-shadow(0 3px 10px rgba(29,106,244,0.35))" },
              }}
            />
            <Box sx={{ borderLeft: `1px solid ${P.border}`, pl: 2, ml: 0.5 }}>
              <Typography sx={{
                fontWeight: 800, fontSize: 14, color: P.text,
                letterSpacing: "-0.02em", lineHeight: 1.2,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                OaaS Platform
              </Typography>
              <Typography sx={{
                fontSize: 9, color: P.textMuted,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.1em",
              }}>
                OBSERVABILITY AS A SERVICE
              </Typography>
            </Box>
          </Box>

          {/* Right side */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>

            {/* Clock */}
            <Box sx={{
              px: 1.5, py: 0.6, borderRadius: 1.5,
              background: P.bg, border: `1px solid ${P.border}`,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, color: P.textSub, letterSpacing: "0.04em",
            }}>
              {time.toLocaleTimeString("fr-FR")}
            </Box>

            {/* User avatar */}
            <Box sx={{
              display: "flex", alignItems: "center", gap: 1,
              px: 1.5, py: 0.6, borderRadius: 1.5,
              border: `1px solid ${P.border}`,
              background: P.surface, cursor: "pointer",
              transition: "background 0.15s",
              "&:hover": { background: P.bg },
            }}>
              <Box sx={{
                width: 26, height: 26, borderRadius: "50%",
                background: `linear-gradient(135deg, ${P.blue} 0%, #4f9ef8 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 10, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                AD
              </Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: P.text, fontFamily: "'DM Sans', sans-serif" }}>
                Admin
              </Typography>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* ── Sidebar ── */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            background: P.surface,
            borderRight: `1px solid ${P.border}`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "1px 0 8px rgba(13,17,23,0.04)",
          },
        }}
      >
        <Box>
          <Toolbar sx={{ minHeight: "64px !important" }} />

          {/* Nav label */}
          <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
            <Typography sx={{
              fontSize: 9, fontWeight: 700, color: P.textMuted,
              letterSpacing: "0.14em", textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Navigation
            </Typography>
          </Box>

          <List sx={{ px: 1.5 }}>
            {navItems.map(({ label, path, icon }) => {
              const active = isActive(path);
              return (
                <ListItemButton
                  key={path}
                  component={Link}
                  to={path}
                  sx={{
                    borderRadius: 1.5,
                    mb: 0.4,
                    px: 1.5,
                    py: 1.1,
                    backgroundColor: active ? P.blueLight : "transparent",
                    border: `1px solid ${active ? "#c0d8fa" : "transparent"}`,
                    transition: "all 0.18s ease",
                    "& .MuiListItemIcon-root": {
                      color: active ? P.blue : P.textMuted,
                      minWidth: 36,
                      transition: "color 0.18s",
                    },
                    "& .MuiListItemText-primary": {
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: active ? P.blue : P.textSub,
                      fontFamily: "'DM Sans', sans-serif",
                    },
                    "&:hover": {
                      backgroundColor: active ? P.blueLight : "#f1f4f8",
                      transform: "translateX(2px)",
                      "& .MuiListItemIcon-root": { color: P.blue },
                      "& .MuiListItemText-primary": { color: P.blue },
                    },
                  }}
                >
                  <ListItemIcon>{icon}</ListItemIcon>
                  <ListItemText primary={label} />
                  {active && (
                    <Box sx={{ width: 5, height: 5, borderRadius: "50%", background: P.blue, flexShrink: 0 }} />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        {/* Logout */}
        <Box sx={{ p: 2 }}>
          <Divider sx={{ mb: 2, borderColor: P.border }} />
          <Button
            fullWidth
            variant="contained"
            startIcon={<ExitToAppIcon />}
            onClick={handleLogout}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: 13,
              backgroundColor: P.blue,
              borderRadius: 1.5,
              py: 1.2,
              boxShadow: "0 4px 12px rgba(29,106,244,0.25)",
              fontFamily: "'DM Sans', sans-serif",
              "&:hover": {
                backgroundColor: P.blueDark,
                boxShadow: "0 6px 18px rgba(29,106,244,0.35)",
                transform: "translateY(-1px)",
              },
              transition: "all 0.18s",
            }}
          >
            Déconnexion
          </Button>
        </Box>
      </Drawer>

      {/* ── Main Content ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          background: P.bg,
          minHeight: "100vh",
          mt: "64px",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
