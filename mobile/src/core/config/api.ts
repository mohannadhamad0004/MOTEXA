import * as SecureStore from "../../components/SessionStore"; // same token store as the login (SecureStore on a phone, session storage on web)
import { router } from "expo-router";
import { Alert, Platform } from "react-native";
import { ACCESS_KEY, REFRESH_KEY, createRefresher, expiredText, expiresSoon, isSessionExpiry } from "../session/sessionExpiry";
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

// E-03: 15-minute access token + rotating refresh token (both in SecureStore on a phone, session storage on web).
const postJson = async (path: string, body: unknown) => {
  const r = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const store = { get: SecureStore.getItemAsync, set: SecureStore.setItemAsync, del: SecureStore.deleteItemAsync };
/** New access token from the refresh token. null = signed out; throws when the server can't be reached (still signed in). */
export const refreshSession = createRefresher(store, (refreshToken) => postJson("/auth/refresh", { refreshToken }));

/** The access token to send, refreshed first when it has under a minute left. Use this instead of reading the store directly. */
export async function getAccessToken() {
  const token = await SecureStore.getItemAsync(ACCESS_KEY);
  if (!token || !expiresSoon(token)) return token;
  try {
    return await refreshSession();
  } catch {
    return token; // offline: send the old one; a 401 is handled by api()
  }
}

/** After a sign-in. */
export async function saveSession(accessToken: string, refreshToken?: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  else await SecureStore.deleteItemAsync(REFRESH_KEY);
}

/** Sign-out: clears both tokens here and revokes the refresh token on the server (best effort, never blocks). */
export async function clearSession() {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null);
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  if (refreshToken) postJson("/auth/logout", { refreshToken }).catch(() => {});
}

// A 401 that a refresh could not fix = the session really ended: clear it, say so once, go to login.
let expiring = false;
async function sessionExpired() {
  if (expiring) return;
  expiring = true;
  try {
    const text = expiredText(await SecureStore.getItemAsync("motexa_language").catch(() => null));
    await clearSession();
    router.replace("/auth/login");
    if (Platform.OS === "web") globalThis.alert?.(text);
    else Alert.alert(text);
  } catch {
    /* the redirect is best effort */
  }
}

async function send(method: string, path: string, token: string | null, json: string | undefined) {
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (json && json.length > BIG) {
    setProgress(0);
    try {
      return await xhrJson(method, `${API_URL}${path}`, headers, json);
    } finally {
      setProgress(null);
    }
  }
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: json });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

/** Authenticated JSON request to the real backend. Throws Error(message) on non-2xx (with `status` and `data`; no `status` = it never reached the server). */
export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  if (token) expiring = false; // a new sign-in re-arms the handler
  const json = body === undefined ? undefined : JSON.stringify(body);
  let r = await send(method, path, token, json);
  if (r.status === 401 && token) {
    // refreshed once, then the same request again (it was refused before doing anything)
    const fresh = await refreshSession();
    if (fresh) r = await send(method, path, fresh, json);
  }
  if (!r.ok) {
    if (isSessionExpiry(r.status, !!token)) void sessionExpired();
    // Callers can read extra fields the server sent with an error, e.g. `existingInquiryId` on a 409.
    throw await failure(r.status, r.data);
  }
  return r.data as T;
}

/** Image source for a private document: requires the admin's bearer token (never a public URL). */
export async function privateImageSource(path: string) {
  const token = await getAccessToken();
  return { uri: `${API_URL}${path}`, headers: { Authorization: `Bearer ${token ?? ""}` } };
}

/** The error thrown for a non-2xx answer: message in the saved language when the server sent a known errorCode (English text kept in `serverMessage`). */
async function failure(status: number, data: any) {
  const english = data?.message ?? `Request failed (${status})`;
  const language = data?.errorCode ? await SecureStore.getItemAsync("motexa_language").catch(() => null) : null;
  return Object.assign(new Error(errorTextFor(data?.errorCode, language, english)), { status, data, serverMessage: english, errorCode: data?.errorCode });
}
