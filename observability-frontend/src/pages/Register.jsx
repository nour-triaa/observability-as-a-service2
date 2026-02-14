import React, { useState } from "react";
import { register } from "../services/authApi";

function Register({ goBack, onSuccess }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await register(form);
      alert("Compte créé avec succès !");
      if (onSuccess) onSuccess(data);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création du compte : " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", background: "linear-gradient(180deg, #93c5fd, #a78bfa)" }}>
      <h2 style={{ marginBottom: "20px" }}>Créer un compte</h2>
      <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", width:"300px" }}>
        <input name="firstName" placeholder="Nom" value={form.firstName} onChange={handleChange} style={inputStyle} required />
        <input name="lastName" placeholder="Prénom" value={form.lastName} onChange={handleChange} style={inputStyle} required />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} style={inputStyle} required />
        <input name="password" type="password" placeholder="Mot de passe" value={form.password} onChange={handleChange} style={inputStyle} required />
        <button type="submit" style={buttonStyle}>Créer</button>
      </form>
      <button onClick={goBack} style={{ marginTop:"20px", background:"none", color:"#fff", border:"none", cursor:"pointer" }}>Retour</button>
    </div>
  );
}

const inputStyle = { margin:"10px 0", padding:"10px", borderRadius:"5px", border:"1px solid #ccc" };
const buttonStyle = { padding:"10px", background:"#2563eb", color:"#fff", border:"none", borderRadius:"5px", cursor:"pointer", marginTop:"10px" };

export default Register;
