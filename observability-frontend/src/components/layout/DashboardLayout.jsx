// src/components/layout/DashboardLayout.jsx
import * as React from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
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
  Avatar
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
  const location = useLocation();

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
    mb: 0.5,
    color: "#374151",
    transition: "all 0.25s ease",

    "& .MuiListItemIcon-root": {
      color: "#9ca3af",
      minWidth: 40,
      transition: "0.3s",
    },

    "&:hover": {
      backgroundColor: "#f1f5f9",
      transform: "translateX(4px)",

      "& .MuiListItemIcon-root": {
        color: "#0ea5e9",
      },
    },

    "&.Mui-selected": {
      backgroundColor: "#e0f2fe",
      color: "#0284c7",
      fontWeight: 600,

      "& .MuiListItemIcon-root": {
        color: "#0284c7",
      },
    },
  };

  return (
    <Box sx={{ display: "flex", backgroundColor: "#f3f4f6" }}>
      <CssBaseline />

      {/* APPBAR */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "#ffffff",
          color: "#111827",
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>

          {/* Logo + titre */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              component="img"
              src="/next.png"
              alt="Logo"
              sx={{ height: 48, objectFit: "contain" }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Cloud Dashboard
            </Typography>
          </Box>

          {/* Avatar supprimé, plus de nom utilisateur */}
          <Box />

        </Toolbar>
      </AppBar>

      {/* SIDEBAR */}
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            background: '#ffffff',
            color: '#111827',
            borderRight: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          },
        }}
      >
        <Box>
          <Toolbar />
          <Divider />

          <List sx={{ px: 1, mt: 1 }}>
            <ListItemButton component={Link} to="/dashboard" selected={location.pathname === "/dashboard"} sx={menuStyle}>
              <ListItemIcon><DashboardIcon /></ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItemButton>

            <ListItemButton component={Link} to="/metrics" selected={location.pathname === "/metrics"} sx={menuStyle}>
              <ListItemIcon><BarChartIcon /></ListItemIcon>
              <ListItemText primary="Metrics" />
            </ListItemButton>

            <ListItemButton component={Link} to="/settings" selected={location.pathname === "/settings"} sx={menuStyle}>
              <ListItemIcon><SettingsIcon /></ListItemIcon>
              <ListItemText primary="Settings" />
            </ListItemButton>
          </List>
        </Box>

        {/* Logout bouton bottom */}
        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<ExitToAppIcon />}
            onClick={handleLogout}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: '#0ea5e9',
              borderRadius: 2,
              py: 1.2,
              boxShadow: '0 4px 14px rgba(14,165,233,0.35)',
              '&:hover': { backgroundColor: '#0284c7' },
            }}
          >Logout</Button>
        </Box>
      </Drawer>

      {/* MAIN CONTENT */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, background: '#f3f4f6', minHeight: '100vh' }}>
        <Container maxWidth="lg">
          {children}
        </Container>
      </Box>
    </Box>
  );
}

