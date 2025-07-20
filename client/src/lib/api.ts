// client/src/lib/api.ts
type HTTPMethod = "GET" | "POST" | "PATCH" | "DELETE";

const BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname.includes("pages.dev")
    ? "https://escala-parlacom-api.onrender.com"
    : "")
).replace(/\/$/, "");

async function request<T>(
  path: string,
  method: HTTPMethod,
  body?: any,
  init?: RequestInit
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  // 204 or empty
  if (res.status === 204) return null as unknown as T;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error("Resposta não é JSON válida");
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, "GET", undefined, init),
  post: <T>(path: string, body?: any, init?: RequestInit) =>
    request<T>(path, "POST", body, init),
  patch: <T>(path: string, body?: any, init?: RequestInit) =>
    request<T>(path, "PATCH", body, init),
  del: <T>(path: string, init?: RequestInit) =>
    request<T>(path, "DELETE", undefined, init),
};
