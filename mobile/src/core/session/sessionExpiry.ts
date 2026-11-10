// Pure rules for an expired session (tested without React Native).
export const SESSION_EXPIRED: readonly [string, string] = ["Your session expired, please sign in again", "انتهت جلستك، يرجى تسجيل الدخول مرة أخرى"];
/** A 401 on a request that carried a token = the token expired (or the session was revoked). Login failures never go through api(). */
export const isSessionExpiry = (status: number | undefined, hadToken: boolean) => status === 401 && hadToken;
export const expiredText = (language: string | null) => (language === "ar" ? SESSION_EXPIRED[1] : SESSION_EXPIRED[0]);
