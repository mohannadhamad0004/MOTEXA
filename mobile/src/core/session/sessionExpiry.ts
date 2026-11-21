// Pure rules for an expired session (tested without React Native).
export const SESSION_EXPIRED: readonly [string, string] = ["Your session expired, please sign in again", "انتهت جلستك، يرجى تسجيل الدخول مرة أخرى"];
/** A 401 on a request that carried a token = the token expired (or the session was revoked). Login failures never go through api(). */
export const isSessionExpiry = (status: number | undefined, hadToken: boolean) => status === 401 && hadToken;
export const expiredText = (language: string | null) => (language === "ar" ? SESSION_EXPIRED[1] : SESSION_EXPIRED[0]);

// E-03 refresh tokens (pure, tested in tests/session-refresh.test.mjs; wired in core/config/api.ts).
export const ACCESS_KEY = "motexa_access_token";
export const REFRESH_KEY = "motexa_refresh_token";

/** true when the JWT's `exp` is less than `marginMs` away. Undecodable -> false (api() still refreshes on a 401). */
export function expiresSoon(token: string, now = Date.now(), marginMs = 60_000) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const exp = JSON.parse(atob(part + "===".slice((part.length + 3) % 4))).exp;
    return typeof exp === "number" && exp * 1000 - now < marginMs;
  } catch {
    return false;
  }
}

type TokenStore = { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; del(k: string): Promise<void> };
/**
 * One refresh at a time: the server rotates the refresh token, so a second parallel refresh with the same token would look like
 * theft and end the session. Resolves the new access token; null = signed out (both tokens cleared); throws = server unreachable
 * (tokens kept, the user stays signed in). A sign-out or new sign-in during the call wins: its result is then discarded.
 */
export function createRefresher(store: TokenStore, post: (refreshToken: string) => Promise<{ status: number; data: any }>) {
  let running: Promise<string | null> | null = null;
  const run = async () => {
    const token = await store.get(REFRESH_KEY);
    if (!token) return null;
    const r = await post(token);
    if ((await store.get(REFRESH_KEY)) !== token) return store.get(ACCESS_KEY);
    if (r.status === 401) {
      await store.del(ACCESS_KEY);
      await store.del(REFRESH_KEY);
      return null;
    }
    if (r.status < 200 || r.status >= 300 || !r.data?.accessToken || !r.data?.refreshToken) throw new Error("Network request failed");
    await store.set(REFRESH_KEY, r.data.refreshToken);
    await store.set(ACCESS_KEY, r.data.accessToken);
    return r.data.accessToken as string;
  };
  return () => (running ??= run().finally(() => (running = null)));
}
