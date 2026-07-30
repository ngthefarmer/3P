import type { AuthUser } from "./types";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface AuthResponse {
  token: string;
  user: AuthUser;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export function register(username: string, password: string): Promise<AuthResponse> {
  return postJson<AuthResponse>("/api/auth/register", { username, password });
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return postJson<AuthResponse>("/api/auth/login", { username, password });
}
