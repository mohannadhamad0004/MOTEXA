import * as SecureStore from "../../components/SessionStore"; // same token store as the login (SecureStore on a phone, session storage on web)
import { router } from "expo-router";
import { Alert, Platform } from "react-native";
import { expiredText, isSessionExpiry } from "../session/sessionExpiry";
import { errorTextFor } from "../session/errorText";

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

// 401 on an authenticated call = the 15-minute token ran out: clear it, say so once, go to login. (Refresh tokens: see STATUS.md, "For Diala".)
let expiring = false;
async function sessionExpired() {
  if (expiring) return;
  expiring = true;
  try {
    const text = expiredText(await SecureStore.getItemAsync("motexa_language").catch(() => null));
    await SecureStore.deleteItemAsync("motexa_access_token");
    router.replace("/auth/login");
    if (Platform.OS === "web") globalThis.alert?.(text);
    else Alert.alert(text);
  } catch {
    /* the redirect is best effort */
  }
}

/** Authenticated JSON request to the real backend. Throws Error(message) on non-2xx (with `status` and `data`; no `status` = it never reached the server). */
export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await SecureStore.getItemAsync("motexa_access_token");
  if (token) expiring = false; // a new sign-in re-arms the handler
  const json = body === undefined ? undefined : JSON.stringify(body);
  if (json && json.length > BIG) {
    setProgress(0);
    try {
      const r = await xhrJson(method, `${API_URL}${path}`, { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, json);
      if (!r.ok && isSessionExpiry(r.status, !!token)) void sessionExpired();
      if (!r.ok) throw await failure(r.status, r.data);
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
    if (isSessionExpiry(res.status, !!token)) void sessionExpired();
    // Callers can read extra fields the server sent with an error, e.g. `existingInquiryId` on a 409.
    throw await failure(res.status, data);
  }
  return data as T;
}

/** Image source for a private document: requires the admin's bearer token (never a public URL). */
export async function privateImageSource(path: string) {
  const token = await SecureStore.getItemAsync("motexa_access_token");
  return { uri: `${API_URL}${path}`, headers: { Authorization: `Bearer ${token ?? ""}` } };
}

/** The error thrown for a non-2xx answer: message in the saved language when the server sent a known errorCode (English text kept in `serverMessage`). */
async function failure(status: number, data: any) {
  const english = data?.message ?? `Request failed (${status})`;
  const language = data?.errorCode ? await SecureStore.getItemAsync("motexa_language").catch(() => null) : null;
  return Object.assign(new Error(errorTextFor(data?.errorCode, language, english)), { status, data, serverMessage: english, errorCode: data?.errorCode });
}
