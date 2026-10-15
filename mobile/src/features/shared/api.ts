import * as SecureStore from "expo-secure-store";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

/** Authenticated JSON request to the real backend. Throws Error(message) on non-2xx. */
export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await SecureStore.getItemAsync("motexa_access_token");
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data as T;
}

/** Image source for a private document: requires the admin's bearer token (never a public URL). */
export async function privateImageSource(path: string) {
  const token = await SecureStore.getItemAsync("motexa_access_token");
  return { uri: `${API_URL}${path}`, headers: { Authorization: `Bearer ${token ?? ""}` } };
}
