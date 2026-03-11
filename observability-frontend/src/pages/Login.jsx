// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authApi";

import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
} from "@mui/material";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form);
      navigate("/dashboard");
    } catch (err) {
      alert("Erreur : " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg,#111827 0%,#1e1f2a 100%)",
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={6}
          sx={{
            p: 5,
            borderRadius: 3,
            background: "#1e1f2a",
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
          }}
        >
          <Typography
            variant="h4"
            align="center"
            gutterBottom
            sx={{ fontWeight: 700 }}
          >
            Welcome Back
          </Typography>

          <Typography
            variant="body2"
            align="center"
            sx={{ mb: 3, color: "text.secondary" }}
          >
            Login to access your dashboard
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              margin="normal"
              value={form.email}
              onChange={handleChange}
            />

            <TextField
              fullWidth
              label="Password"
              name="password"
              type="password"
              margin="normal"
              value={form.password}
              onChange={handleChange}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{
                mt: 3,
                py: 1.2,
                fontWeight: 600,
                backgroundColor: "#0ea5e9",
                color: "#fff",
                transition: "0.3s",
                boxShadow: "0 6px 18px rgba(14,165,233,0.35)",
                "&:hover": {
                  backgroundColor: "#0284c7",
                  transform: "translateY(-2px)",
                  boxShadow: "0 10px 22px rgba(14,165,233,0.5)",
                },
              }}
            >
              Login
            </Button>

            <Button
              fullWidth
              sx={{
                mt: 2,
                color: "#38bdf8",
                "&:hover": { backgroundColor: "rgba(14,165,233,0.08)" },
              }}
              onClick={() => navigate("/register")}
            >
              Create Account
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}
