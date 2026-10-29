const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export const API_BASE = `${API_URL}/api`;
export const SOCKET_URL = API_URL;
