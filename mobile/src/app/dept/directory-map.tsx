import { AdminMapScreen } from "../../features/department/AdminMapScreen";
import { useDepartment } from "../../features/department/DepartmentContext";

// Full-screen directory map ("Show on map" on the Companies / Shops page): the active department decides tow or parts.
export default function DirectoryMap() {
  const { active } = useDepartment();
  return <AdminMapScreen mode={active.key === "MANAGE_SPARE_PARTS" ? "parts" : "tow"} />;
}
