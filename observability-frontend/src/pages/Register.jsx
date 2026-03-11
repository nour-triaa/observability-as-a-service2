// src/pages/Register.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register, login } from "../services/authApi";

import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
} from "@mui/material";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      await register(form);
      await login({ email: form.email, password: form.password });
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
            Create Account
          </Typography>

          <Typography
            variant="body2"
            align="center"
            sx={{ mb: 3, color: "text.secondary" }}
          >
            Sign up to start using the dashboard
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="First Name"
              name="firstName"
              margin="normal"
              value={form.firstName}
              onChange={handleChange}
            />

            <TextField
              fullWidth
              label="Last Name"
              name="lastName"
              margin="normal"
              value={form.lastName}
              onChange={handleChange}
            />

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

            <TextField
              fullWidth
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              margin="normal"
              value={form.confirmPassword}
              onChange={handleChange}
            />

            <Button
              fullWidth
              variant="contained"
              type="submit"
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
              Register
            </Button>

            <Button
              fullWidth
              sx={{
                mt: 2,
                color: "#38bdf8",
                "&:hover": {
                  backgroundColor: "rgba(14,165,233,0.08)",
                },
              }}
              onClick={() => navigate("/login")}
            >
              Back to Login
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}
