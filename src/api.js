// src/api.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;
const PASSWORD = import.meta.env.VITE_API_PASSWORD;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    Authorization: PASSWORD,
  },
});

export default api;
