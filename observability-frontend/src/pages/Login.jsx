// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authApi";

import { Container, Box, TextField, Button, Typography, Paper } from "@mui/material";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form);
      // redirection après succès
      navigate("/dashboard");
    } catch (err) {
      alert("Erreur : " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ height: "100vh", display: "flex", alignItems: "center" }}>
        <Paper sx={{ p: 4, width: "100%" }} elevation={3}>
          <Typography variant="h4" align="center" gutterBottom>
            Login
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

            <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
              Login
            </Button>

            <Button fullWidth sx={{ mt: 2 }} onClick={() => navigate("/register")}>
              Create Account
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
}
