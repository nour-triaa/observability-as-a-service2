// src/pages/Register.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register, login } from "../services/authApi"; // login après register

import { Container, Box, TextField, Button, Typography, Paper } from "@mui/material";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    try {
      await register(form);
      // connexion automatique après création
      await login({ email: form.email, password: form.password });
      navigate("/dashboard");
    } catch (err) {
      alert("Erreur : " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ height: "100vh", display: "flex", alignItems: "center" }}>
        <Paper sx={{ p: 4, width: "100%" }} elevation={3}>
          <Typography variant="h4" gutterBottom align="center">
            Create Account
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField fullWidth label="First Name" name="firstName" margin="normal" value={form.firstName} onChange={handleChange} />
            <TextField fullWidth label="Last Name" name="lastName" margin="normal" value={form.lastName} onChange={handleChange} />
            <TextField fullWidth label="Email" name="email" type="email" margin="normal" value={form.email} onChange={handleChange} />
            <TextField fullWidth label="Password" name="password" type="password" margin="normal" value={form.password} onChange={handleChange} />
            <TextField fullWidth label="Confirm Password" name="confirmPassword" type="password" margin="normal" value={form.confirmPassword} onChange={handleChange} />

            <Button fullWidth variant="contained" sx={{ mt: 3 }} type="submit">
              Register
            </Button>

            <Button fullWidth sx={{ mt: 2 }} onClick={() => navigate("/login")}>
              Back to Login
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
}
