import { Stack } from "expo-router";
import { View } from "react-native";
import { ToastHost } from "../../components/ItemActionsMenu";
import { RoleGate } from "../../components/layout/RoleGate";
import { useAppearance } from "../../components/Appearance";
import { Tabs } from "../../components/garage";
import { AreaProvider } from "../../components/manage/Page";
import { DepartmentProvider, canOpenDepartments, useDepartment } from "../../features/department/DepartmentContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { useL } from "../../core/hooks/useL";

/** The department's own name is the trail's root; an account with two or more departments switches them on its home tabs. */
function DeptArea({ children }: { children: React.ReactNode }) {
  const { available, active, setActive } = useDepartment();
  const { t } = useL();
  const top = available.length > 1 ? (
    <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
      <Tabs value={active.key} options={available.map(d => ({ key: d.key, label: t(d.en, d.ar) }))} onChange={k => setActive(k)} />
    </View>
  ) : null;
  return <AreaProvider value={{ root: { href: "/dept", en: active.en, ar: active.ar }, top }}>{children}</AreaProvider>;
}

// Shared area of every sub-admin (towing, parts, mechanics). Client-side UX gate only: every endpoint enforces the same rule.
export default function DeptLayout() {
  const { dark } = useAppearance();
  const { isArabic } = useLanguage();
  return (
    <RoleGate allow={canOpenDepartments}>
      <DepartmentProvider>
        <DeptArea>
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false, animation: isArabic ? "slide_from_left" : "slide_from_right", contentStyle: { backgroundColor: dark ? "#211B17" : "#FFF9EF" } }} />
            <ToastHost />
          </View>
        </DeptArea>
      </DepartmentProvider>
    </RoleGate>
  );
}
