// src/components/layout/DashboardLayout.jsx
import * as React from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Box,
  CssBaseline,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Container,
  Divider,
  Button,
  Avatar,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SettingsIcon from "@mui/icons-material/Settings";
import BarChartIcon from "@mui/icons-material/BarChart";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";

const drawerWidth = 240;
const SESSION_TIMEOUT = 5 * 60 * 1000;

export default function DashboardLayout({ children }) {
  const [open, setOpen] = React.useState(true);
  const navigate = useNavigate();

  const toggleDrawer = () => setOpen(!open);

  React.useEffect(() => {
    const sessionStart = localStorage.getItem("sessionStart");
    const now = new Date().getTime();

    if (!sessionStart) {
      localStorage.setItem("sessionStart", now);
    } else if (now - sessionStart > SESSION_TIMEOUT) {
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

  const menuStyle = {
    borderRadius: 2,
    transition: "all 0.25s ease",
    "&:hover": {
      backgroundColor: "rgba(14,165,233,0.12)",
      transform: "translateX(4px)",
      boxShadow: "0 4px 12px rgba(14,165,233,0.25)",
    },
    "&.Mui-selected": {
      backgroundColor: "rgba(14,165,233,0.2)",
      boxShadow: "0 4px 14px rgba(14,165,233,0.35)",
      "&:hover": {
        backgroundColor: "rgba(14,165,233,0.3)",
      },
    },
  };

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      {/* APPBAR */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backdropFilter: "blur(8px)",
          backgroundColor: "rgba(31,41,55,0.95)",
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              edge="start"
              color="inherit"
              onClick={toggleDrawer}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>

            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Dashboard
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar alt="Profil" src="/avatar.jpg" />

            <Button
              variant="contained"
              startIcon={<ExitToAppIcon />}
              onClick={handleLogout}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                backgroundColor: "#0ea5e9",
                color: "#fff",
                borderRadius: "8px",
                px: 3,
                py: 1,
                transition: "0.3s",
                boxShadow: "0 6px 18px rgba(14,165,233,0.35)",
                "&:hover": {
                  backgroundColor: "#0284c7",
                  transform: "translateY(-2px)",
                  boxShadow: "0 10px 22px rgba(14,165,233,0.5)",
                },
              }}
            >
              Quitter
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* SIDEBAR */}
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            background: "rgba(30,31,42,0.95)",
            color: "#ffffff",
            borderRight: "1px solid rgba(255,255,255,0.05)",
          },
        }}
      >
        <Toolbar />
        <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />

        <List>
          <ListItemButton component={Link} to="/dashboard" sx={menuStyle}>
            <ListItemIcon sx={{ color: "inherit" }}>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItemButton>

          <ListItemButton component={Link} to="/metrics" sx={menuStyle}>
            <ListItemIcon sx={{ color: "inherit" }}>
              <BarChartIcon />
            </ListItemIcon>
            <ListItemText primary="Metrics" />
          </ListItemButton>

          <ListItemButton component={Link} to="/settings" sx={menuStyle}>
            <ListItemIcon sx={{ color: "inherit" }}>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </List>
      </Drawer>

      {/* MAIN */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          background: "linear-gradient(180deg,#111827 0%,#1e1f2a 100%)",
          minHeight: "100vh",
        }}
      >
        <Container maxWidth="lg">{children}</Container>
      </Box>
    </Box>
  );
}
