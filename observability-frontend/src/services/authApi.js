import axios from "axios";

/*
  IMPORTANT ARCHITECTURE :

  On utilise une URL relative "/api/auth"
  ➜ En DEV : Vite proxy redirige vers http://localhost:8080
  ➜ En PROD : Nginx / Ingress redirige vers identity-service
  ➜ Aucun localhost ou identity-service hardcodé ici
*/

const API_BASE_URL = "/api/auth";

// ─────────────────────────────────────────────
// Axios instance dédiée
// ─────────────────────────────────────────────
const authAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─────────────────────────────────────────────
// Interceptor → Ajoute automatiquement le JWT
// ─────────────────────────────────────────────
authAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────────
// Token helpers
// ─────────────────────────────────────────────
const TOKEN_KEY = "token";

export const setToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const logout = () => {
  removeToken();
};

// ─────────────────────────────────────────────
// Auth API
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

    if (token) {
      setToken(token);
    }

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

