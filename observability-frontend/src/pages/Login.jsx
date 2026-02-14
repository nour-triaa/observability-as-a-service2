import React, { useState } from "react";
import { login } from "../services/authApi";

function Login({ goBack, onSuccess }) {
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login(form);
      alert("Connexion réussie !");
      if (onSuccess) onSuccess(data);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la connexion : " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", backgroundColor: "#111827", color:"#fff" }}>
      <h2 style={{ marginBottom: "20px" }}>Connexion</h2>
      <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", width:"300px" }}>
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} style={inputStyle} required />
        <input name="password" type="password" placeholder="Mot de passe" value={form.password} onChange={handleChange} style={inputStyle} required />
        <button type="submit" style={buttonStyle}>Se connecter</button>
      </form>
      <button onClick={goBack} style={{ marginTop:"20px", background:"none", color:"#fff", border:"none", cursor:"pointer" }}>Retour</button>
    </div>
  );
}

const inputStyle = { margin:"10px 0", padding:"10px", borderRadius:"5px", border:"1px solid #444", background:"#1f2937", color:"#fff" };
const buttonStyle = { padding:"10px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:"5px", cursor:"pointer", marginTop:"10px" };

export default Login;
