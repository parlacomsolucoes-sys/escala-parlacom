// client/src/lib/api.ts
import { getCurrentUserToken } from "./auth";

const base = (
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname.includes("pages.dev")
    ? "https://escala-parlacom-api.onrender.com"
    : "")
).replace(/\/$/, "");

async function request<T>(method: string, url: string, body?: any): Promise<T> {
  const token = await getCurrentUserToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(base + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 → sem conteúdo
  if (resp.status === 204) return undefined as unknown as T;

  if (!resp.ok) {
    let text: string;
    try {
      text = await resp.text();
    } catch {
      text = resp.statusText;
    }
    throw new Error(`${resp.status}: ${text}`);
  }
  return (await resp.json()) as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: any) => request<T>("POST", url, body),
  patch: <T>(url: string, body?: any) => request<T>("PATCH", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
};
