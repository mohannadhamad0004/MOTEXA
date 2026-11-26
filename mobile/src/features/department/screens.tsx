// The department tabs: each department brings its own Home, Requests and Directory (docs/guide/10-ui-system.md templates).
import { useDepartment } from "./DepartmentContext";
import { MechanicsAdminHome, MechanicsDirectory, MechanicsRequests } from "./mechanicsAdmin";
import { PartsAdminHome, PartsRequests, PartsShopsPage } from "./partsAdmin";
import { TowAdminHome, TowCompaniesPage, TowRequests } from "./towAdmin";

export function DeptHome() {
  const { active } = useDepartment();
  if (active.key === "MANAGE_TOWING") return <TowAdminHome />;
  if (active.key === "MANAGE_SPARE_PARTS") return <PartsAdminHome />;
  return <MechanicsAdminHome />;
}

export function DeptRequests() {
  const { active } = useDepartment();
  if (active.key === "MANAGE_TOWING") return <TowRequests />;
  if (active.key === "MANAGE_SPARE_PARTS") return <PartsRequests />;
  return <MechanicsRequests />;
}

/** `back`: opened outside the department tabs (the /admin/shops and /admin/tow routes). */
export function DeptDirectory({ back = false }: { back?: boolean }) {
  const { active } = useDepartment();
  if (active.key === "MANAGE_TOWING") return <TowCompaniesPage back={back} />;
  if (active.key === "MANAGE_SPARE_PARTS") return <PartsShopsPage back={back} />;
  return <MechanicsDirectory />;
}
