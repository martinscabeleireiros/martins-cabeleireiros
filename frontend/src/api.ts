import { storage } from "@/src/utils/storage";

export const API = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = "admin_token";
export const USER_KEY = "admin_name";

export async function getToken() {
  return (await storage.secureGet(TOKEN_KEY, null)) as string | null;
}

export async function authHeaders(): Promise<Record<string, string>> {
  const t = await getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : "Erro de conexão. Tente novamente.";
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.auth) Object.assign(headers, await authHeaders());
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  return parse<T>(res);
}

export async function logout() {
  await storage.secureRemove(TOKEN_KEY);
  await storage.secureRemove(USER_KEY);
}
