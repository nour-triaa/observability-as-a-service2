import React from "react";

function Home({ onChoose }) {
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "linear-gradient(180deg, #0f172a, #1e3a8a)"
    }}>
      <h1 style={{ color: "#fff", marginBottom: "50px" }}>Bienvenue</h1>
      <button onClick={() => onChoose("register")} style={buttonStyle}>Créer un compte</button>
      <button onClick={() => onChoose("login")} style={{...buttonStyle, marginTop: "20px"}}>Connexion</button>
    </div>
  );
}

const buttonStyle = {
  padding: "15px 30px",
  fontSize: "18px",
  color: "#fff",
  background: "#2563eb",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "0.3s",
};

export default Home;
