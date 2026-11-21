// The password typed at signup / sign-in, kept in memory only until the email code is entered (never stored, never in a URL):
// POST /auth/verify-email needs it next to the code. Lost on an app reload; the code screen then asks for it.
let held: { email: string; password: string } | null = null;
export const holdPassword = (email: string, password: string) => void (held = { email, password });
export const heldPassword = (email: string) => (held?.email === email ? held.password : "");
export const dropPassword = () => void (held = null);
