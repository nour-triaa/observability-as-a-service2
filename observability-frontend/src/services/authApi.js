import axios from "axios";

// ← URL complète de ton API Gateway accessible depuis le navigateur
export const API_URL = "http://myapp.local/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// Ajoute le token à chaque requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Endpoints
export const register = (data) =>
  api.post("/auth/register", data).then((res) => res.data);

export const login = (credentials) =>
  api.post("/auth/authenticate", credentials).then((res) => {
    if (res.data.token) localStorage.setItem("token", res.data.token);
    return res.data;
  });

export const getCurrentUser = () => api.get("/auth/me").then((res) => res.data);

export const logout = () => localStorage.removeItem("token");

export default api;
