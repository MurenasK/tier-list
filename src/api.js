// src/api.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;          // e.g. https://your-backend.onrender.com
const PASSWORD = import.meta.env.VITE_API_PASSWORD;   // must match backend

const api = axios.create({
  baseURL: API_URL,
  headers: {
    Authorization: PASSWORD,
    "Content-Type": "application/json",
  },
});

export default api;
