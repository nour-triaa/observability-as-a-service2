import axios from "axios";

// 🔹 URL dynamique selon l'environnement
// Local : frontend dev server → localhost:8080
// Kubernetes : utiliser le service interne
const API_URL = window.location.hostname === "localhost"
  ? "http://localhost:8080/api/auth"
  : "http://identity-service:8080/api/auth";

// --- Enregistrement d'un utilisateur ---
export const register = async (data) => {
  const response = await axios.post(`${API_URL}/register`, data);
  return response.data;
};

// --- Connexion ---
export const login = async (data) => {
  const response = await axios.post(`${API_URL}/authenticate`, data);
  setToken(response.data.token); // stocker le JWT
  return response.data;
};

// --- Gestion du token ---
export const setToken = (token) => localStorage.setItem("token", token);
export const getToken = () => localStorage.getItem("token");
export const logout = () => localStorage.removeItem("token");
