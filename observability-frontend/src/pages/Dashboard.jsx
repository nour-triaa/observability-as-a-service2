import React from "react";
import { logout as removeToken } from "../services/authApi";

function Dashboard({ user, logout }) {
  const handleLogout = () => {
    removeToken();  // supprime le token
    if (logout) logout(); // remonte l'action à App.jsx
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "linear-gradient(180deg, #1e3a8a, #2563eb)",
      color: "#fff",
      textAlign: "center"
    }}>
      <h1>Hello, {user?.firstName || "User"}! 🌟</h1>
      <p>It’s your dashboard.</p>
      <button 
        onClick={handleLogout} 
        style={{
          marginTop: "30px",
          padding: "12px 25px",
          borderRadius: "8px",
          border: "none",
          background: "#f59e0b",
          color: "#fff",
          cursor: "pointer"
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default Dashboard;
