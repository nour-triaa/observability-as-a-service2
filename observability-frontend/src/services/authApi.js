import axios from "axios";

// ← URL complète que le navigateur doit utiliser
export const API_URL = "http://myapp.local/api";  // ← complète et accessible depuis le navigateur

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export const register = (data) => api.post("/auth/register", data).then(res => res.data);
export const login = (credentials) => api.post("/auth/authenticate", credentials).then(res => {
  if (res.data.token) localStorage.setItem("token", res.data.token);
  return res.data;
});
export const getCurrentUser = () => api.get("/auth/me").then(res => res.data);
export const logout = () => localStorage.removeItem("token");

export default api;

