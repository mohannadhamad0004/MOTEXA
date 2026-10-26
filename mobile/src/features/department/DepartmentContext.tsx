// Which department the admin is working in. The list comes from the account's permissions (a super admin gets all three).
// A header switcher appears only when there are two or more. The choice is kept while the app is open.
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { SessionUser, useSessionUser } from "../../core/session/session";
import { DEPARTMENTS, DEPT_ORDER, Dept, DeptKey } from "./departments";

type Ctx = { available: Dept[]; active: Dept; setActive: (k: DeptKey) => void };
const DepartmentContext = createContext<Ctx | null>(null);

/** Departments this account may open (UX only: every endpoint enforces the same rule on the server). */
export function departmentsFor(u: SessionUser): Dept[] {
  const held = new Set(u.adminPermissions.map((p) => p.permission));
  return DEPT_ORDER.filter((k) => u.role === "SUPER_ADMIN" || (u.role === "ADMIN" && held.has(k))).map((k) => DEPARTMENTS[k]);
}

export const canOpenDepartments = (u: SessionUser) => departmentsFor(u).length > 0;

let remembered: DeptKey | null = null;

export function DepartmentProvider({ children, force }: { children: ReactNode; force?: DeptKey }) {
  const user = useSessionUser();
  const available = useMemo(() => departmentsFor(user), [user]);
  const [key, setKey] = useState<DeptKey | null>(force ?? remembered);
  const active = available.find((d) => d.key === (force ?? key)) ?? available[0];
  const setActive = useCallback((k: DeptKey) => {
    remembered = k;
    setKey(k);
  }, []);
  const value = useMemo(() => ({ available, active, setActive }), [available, active, setActive]);
  if (!active) return null;
  return <DepartmentContext.Provider value={value}>{children}</DepartmentContext.Provider>;
}

export function useDepartment() {
  const v = useContext(DepartmentContext);
  if (!v) throw new Error("useDepartment must be used inside <DepartmentProvider>");
  return v;
}
