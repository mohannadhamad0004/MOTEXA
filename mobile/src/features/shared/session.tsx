import { apiUrl } from "./api";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  adminPermissions: { permission: string }[];
};

const TOKEN_KEY = "motexa_access_token";

// UX gating only. These are NOT security: real endpoints must enforce the same rules server-side.
export const isPartsProvider = (u: SessionUser) => u.role === "PARTS_PROVIDER";
export const isTowProvider = (u: SessionUser) => u.role === "TOW_PROVIDER";
const hasPerm = (u: SessionUser, p: string) =>
  u.role === "SUPER_ADMIN" ||
  (u.role === "ADMIN" && u.adminPermissions.some((x) => x.permission === p));
export const canManageParts = (u: SessionUser) => hasPerm(u, "MANAGE_SPARE_PARTS");
export const canManageMechanics = (u: SessionUser) => hasPerm(u, "MANAGE_MECHANICS");
export const canManageTow = (u: SessionUser) => hasPerm(u, "MANAGE_TOWING");

export async function signOut() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  router.replace("/auth/login");
}

type State = { status: "loading" } | { status: "none" } | { status: "ready"; user: SessionUser };

async function fetchSession(): Promise<State> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const api = apiUrl();
    if (!token || !api) return { status: "none" };
    const res = await fetch(`${api.replace(/\/$/, "")}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) await SecureStore.deleteItemAsync(TOKEN_KEY);
    if (!res.ok) return { status: "none" };
    const data = await res.json();
    return data?.success && data.user?.status === "ACTIVE"
      ? { status: "ready", user: data.user }
      : { status: "none" };
  } catch {
    return { status: "none" };
  }
}

const UserContext = createContext<SessionUser | null>(null);
export const useSessionUser = () => {
  const u = useContext(UserContext);
  if (!u) throw new Error("useSessionUser must be used inside <RoleGate>");
  return u;
};

export function useSession(): State {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    fetchSession().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

/** Shape the (mock) services take; the real backend would read this from the token instead. */
export const asActor = (u: SessionUser) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  role: u.role,
  permissions: u.adminPermissions.map((p) => p.permission),
});
