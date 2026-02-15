
import axios from "axios";

/*
  IMPORTANT ARCHITECTURE :

  On utilise une URL relative "/api/auth"
  ➜ En DEV : Vite proxy redirige vers http://localhost:8080
  ➜ En PROD : Nginx / Ingress redirige vers identity-service
  ➜ Aucun localhost ou identity-service hardcodé ici
*/

// URL principale (DEV / PROD)
const API_BASE_URL = "/api/auth";

// URL Minikube NodePort (optionnelle si tu veux tester)
const MINIKUBE_API_URL = "http://192.168.49.2:32237/api/auth";

// ─────────────────────────────────────────────
// Axios instance principale
// ─────────────────────────────────────────────
const authAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─────────────────────────────────────────────
// Axios instance Minikube (optionnelle)
// ─────────────────────────────────────────────
export const authAxiosMinikube = axios.create({
  baseURL: MINIKUBE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─────────────────────────────────────────────
// Interceptor → Ajoute automatiquement le JWT
// ─────────────────────────────────────────────
const attachJWT = (axiosInstance) => {
  axiosInstance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
};

attachJWT(authAxios);
attachJWT(authAxiosMinikube);

// ─────────────────────────────────────────────
// Token helpers
// ─────────────────────────────────────────────
const TOKEN_KEY = "token";

export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

export const logout = () => removeToken();

// ─────────────────────────────────────────────
// Auth API (utilise l’instance principale par défaut)
// ─────────────────────────────────────────────
export const register = async (data) => {
  try {
    const response = await authAxios.post("/register", data);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "Registration failed" };
  }
};

export const login = async (credentials) => {
  try {
    const response = await authAxios.post("/authenticate", credentials);
    const { token } = response.data;
    if (token) setToken(token);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "Login failed" };
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await authAxios.get("/me");
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to fetch user" };
  }
};

