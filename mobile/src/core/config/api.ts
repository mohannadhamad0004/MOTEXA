import * as SecureStore from "../../components/SessionStore"; // same token store as the login (SecureStore on a phone, session storage on web)

const API_ROOT = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "").replace(/\/api$/, "");

/** Full backend URL for a path. Works whether EXPO_PUBLIC_API_URL ends with /api or not, and whether `path` starts with /api or not. */
export const apiUrl = (path = "") => {
  const rest = path.replace(/^\/?api(?=\/|$)/, "").replace(/^\/+/, "");
  return API_ROOT ? `${API_ROOT}/api${rest ? "/" + rest : ""}` : "";
};

export const API_URL = apiUrl();

// Upload progress: a request body over BIG bytes (photos / documents) is sent with XMLHttpRequest so the screen can show how far it is.
// Screens read it with useUploadProgress(); null = nothing is uploading.
const BIG = 120_000;
let progress: number | null = null;
const listeners = new Set<(p: number | null) => void>();
const setProgress = (p: number | null) => {
  progress = p;
  listeners.forEach((l) => l(p));
};
export const uploadProgress = { get: () => progress, subscribe: (l: (p: number | null) => void) => (listeners.add(l), () => void listeners.delete(l)) };

function xhrJson(method: string, url: string, headers: Record<string, string>, body: string) {
  return new Promise<{ ok: boolean; status: number; data: any }>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.min(0.99, e.loaded / e.total));
    x.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(x.responseText);
      } catch {
        /* not JSON */
      }
      resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, data });
    };
    x.onerror = () => reject(new Error("Network request failed"));
    x.ontimeout = () => reject(new Error("Network request failed"));
    x.timeout = 120_000;
    x.send(body);
  });
}

/** Authenticated JSON request to the real backend. Throws Error(message) on non-2xx (with `status` and `data`; no `status` = it never reached the server). */
export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await SecureStore.getItemAsync("motexa_access_token");
  const json = body === undefined ? undefined : JSON.stringify(body);
  if (json && json.length > BIG) {
    setProgress(0);
    try {
      const r = await xhrJson(method, `${API_URL}${path}`, { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, json);
      if (!r.ok) throw Object.assign(new Error(r.data?.message ?? `Request failed (${r.status})`), { status: r.status, data: r.data });
      return r.data as T;
    } finally {
      setProgress(null);
    }
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Callers can read extra fields the server sent with an error, e.g. `existingInquiryId` on a 409.
    throw Object.assign(new Error(data?.message ?? `Request failed (${res.status})`), { status: res.status, data });
  }
  return data as T;
}

/** Image source for a private document: requires the admin's bearer token (never a public URL). */
export async function privateImageSource(path: string) {
  const token = await SecureStore.getItemAsync("motexa_access_token");
  return { uri: `${API_URL}${path}`, headers: { Authorization: `Bearer ${token ?? ""}` } };
}
