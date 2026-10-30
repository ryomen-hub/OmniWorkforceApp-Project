import { useCallback, useEffect, useState } from "react";

const API_BASE = "http://localhost:4000/api";

export async function adminApiRequest(path, authHeader, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authHeader,
      ...options.headers,
    },
  });

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status}).`);
  }
  return data;
}

export function useAdminRows(path, authHeader) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApiRequest(path, authHeader);
      if (!Array.isArray(data)) throw new Error("The server returned an unexpected response.");
      setRows(data);
    } catch (requestError) {
      setError(requestError.message || "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, [path, authHeader]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, setRows, loading, error, reload };
}
