import { Stack } from "expo-router";
import { RoleGate } from "../../components/layout/RoleGate";
import { useAppearance } from "../../components/Appearance";
import { DepartmentProvider, canOpenDepartments } from "../../features/department/DepartmentContext";
import { useLanguage } from "../../i18n/LanguageContext";

// Shared area of every sub-admin (towing, parts, mechanics). Client-side UX gate only: every endpoint enforces the same rule.
export default function DeptLayout() {
  const { dark } = useAppearance();
  const { isArabic } = useLanguage();
  return (
    <RoleGate allow={canOpenDepartments}>
      <DepartmentProvider>
        <Stack screenOptions={{ headerShown: false, animation: isArabic ? "slide_from_left" : "slide_from_right", contentStyle: { backgroundColor: dark ? "#211B17" : "#FFF9EF" } }} />
      </DepartmentProvider>
    </RoleGate>
  );
}
