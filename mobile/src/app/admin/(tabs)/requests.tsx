import {EditorialTitle} from '../../../components/PremiumUI';
import { useAppearanceStyles, useAppearance } from "../../../components/Appearance";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Href, router } from "expo-router";
import { Text } from "../../../components/MotexaVisual";
import { CanvasFill } from "../../../components/BrandSurfaces";
import LanguageSwitch from "../../../components/LanguageSwitch";
import { useLanguage } from "../../../i18n/LanguageContext";
import { api } from "../../../core/config/api";
import { useLoad } from "../../../core/hooks/useLoad";
import { adminAccessoryApi } from "../../../features/accessory3d/api";
import { NEEDS_ACTION } from "../../../features/department/ThreeDRequests";
import { rememberDepartment } from "../../../features/department/DepartmentContext";
import type { DeptKey } from "../../../features/department/departments";

// D-04: a real overview of what is waiting across departments (counts from the same endpoints the department homes use).
// A source that fails shows "—" on its own rows; nothing is estimated.
type Counts = { tow?: Record<string, number>; dash?: { pendingMechanics: number; partsShops?: { pending: number } }; threeD?: number };
async function loadCounts(): Promise<Counts> {
  const [tow, dash, acc] = await Promise.allSettled([
    api<{ stats: Record<string, number> }>("GET", "/admin/tow/stats").then((r) => r.stats),
    api<{ stats: Counts["dash"] }>("GET", "/admin-management/dashboard").then((r) => r.stats),
    adminAccessoryApi.list().then((l) => l.filter((a) => NEEDS_ACTION.includes(a.status)).length),
  ]);
  const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : undefined);
  return { tow: ok(tow), dash: ok(dash), threeD: ok(acc) };
}

type Item = { key: string; dept: DeptKey; path: string; icon: keyof typeof Ionicons.glyphMap; en: string; ar: string; deptEn: string; deptAr: string; count: (c: Counts) => number | undefined };
const ITEMS: Item[] = [
  { key: "tow-companies", dept: "MANAGE_TOWING", path: "/dept/requests", icon: "business-outline", en: "Tow company applications", ar: "طلبات شركات السحب", deptEn: "Towing", deptAr: "السحب", count: (c) => c.tow?.pendingCompanies },
  { key: "tow-trucks", dept: "MANAGE_TOWING", path: "/dept/requests", icon: "car-outline", en: "Trucks to review", ar: "شاحنات بانتظار المراجعة", deptEn: "Towing", deptAr: "السحب", count: (c) => c.tow?.pendingTrucks },
  { key: "drivers", dept: "MANAGE_TOWING", path: "/dept/tows/drivers", icon: "id-card-outline", en: "Driver licences", ar: "رخص السائقين", deptEn: "Towing", deptAr: "السحب", count: (c) => c.tow?.pendingDrivers },
  { key: "shops", dept: "MANAGE_SPARE_PARTS", path: "/dept/requests", icon: "storefront-outline", en: "Parts shop applications", ar: "طلبات متاجر القطع", deptEn: "Spare parts", deptAr: "قطع الغيار", count: (c) => c.dash?.partsShops?.pending },
  { key: "3d", dept: "MANAGE_SPARE_PARTS", path: "/dept/requests?seg=3d", icon: "cube-outline", en: "3D requests", ar: "طلبات ثلاثية الأبعاد", deptEn: "Spare parts", deptAr: "قطع الغيار", count: (c) => c.threeD },
  { key: "mechanics", dept: "MANAGE_MECHANICS", path: "/dept/requests", icon: "construct-outline", en: "Mechanic applications", ar: "طلبات الميكانيكيين", deptEn: "Mechanics", deptAr: "الميكانيك", count: (c) => c.dash?.pendingMechanics },
];

export default function RequestsScreen() {
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const { isArabic } = useLanguage();
  const insets = useSafeAreaInsets();
  const state = useLoad(loadCounts, [], 30000);
  const c = state.data ?? {};
  const known = ITEMS.map((i) => i.count(c)).filter((n): n is number => n !== undefined);
  const total = known.reduce((a, b) => a + b, 0);
  const row = isArabic ? "row-reverse" : "row";
  const align = isArabic ? "right" : "left";
  const accent = dark ? "#F1C68F" : "#754623";
  const open = (i: Item) => {
    rememberDepartment(i.dept);
    router.push(i.path as Href);
  };
  return (
    <View style={styles.page}>
      <CanvasFill />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} refreshControl={<RefreshControl refreshing={state.loading && !!state.data} onRefresh={() => void state.reload()} />}>
        <LanguageSwitch light compact unified />
        <Text style={[styles.eyebrow, { textAlign: align }]}>MOTEXA / {isArabic ? "مساحة الإدارة" : "WORKSPACE"}</Text>
        <EditorialTitle style={[styles.title, { textAlign: align }]}>{isArabic ? "الطلبات" : "Requests"}</EditorialTitle>
        <Text style={[styles.subtitle, { textAlign: align }]}>
          {!state.data
            ? isArabic ? "جارٍ التحميل…" : "Loading…"
            : known.length === 0
              ? isArabic ? "تعذّر تحميل الأرقام. اسحب للتحديث." : "Counts could not load. Pull to refresh."
              : total === 0
                ? isArabic ? "لا شيء بانتظار المراجعة في أي قسم." : "Nothing is waiting for review in any department."
                : isArabic ? `${total} بانتظار المراجعة في الأقسام` : `${total} waiting for review across departments`}
        </Text>
        <View style={styles.list}>
          {ITEMS.map((i, n) => {
            const v = i.count(c);
            const label = isArabic ? i.ar : i.en;
            const shown = !state.data ? "…" : v === undefined ? "—" : String(v);
            return (
              <Pressable key={i.key} accessibilityRole="button" accessibilityLabel={`${label}: ${shown}`} onPress={() => open(i)}
                style={({ pressed }) => [styles.row, n > 0 && styles.divider, { flexDirection: row, opacity: pressed ? 0.7 : 1 }]}>
                <View style={styles.icon}><Ionicons name={i.icon} size={20} color={accent} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowTitle, { textAlign: align }]} numberOfLines={2}>{label}</Text>
                  <Text style={[styles.rowSub, { textAlign: align }]}>{isArabic ? i.deptAr : i.deptEn}</Text>
                </View>
                <View style={[styles.count, !!v && styles.countOn]}><Text style={[styles.countText, !!v && styles.countTextOn]}>{shown}</Text></View>
                <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={accent} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
const baseStyles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 130, width: "100%", maxWidth: 800, alignSelf: "center" },
  eyebrow: { color: "#754623", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 32 },
  title: { color: "#30241D", fontSize: 34, fontWeight: "800", marginTop: 10 },
  subtitle: { color: "#574737", fontSize: 15, lineHeight: 25, marginTop: 10 },
  list: { marginTop: 24, borderWidth: 1, borderColor: "#CBB18D", borderRadius: 22, backgroundColor: "#FFF9EF", overflow: "hidden" },
  row: { alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 68, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: "#E8D7BE" },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F5E5CF", alignItems: "center", justifyContent: "center" },
  rowTitle: { color: "#30241D", fontSize: 15, fontWeight: "800", lineHeight: 21 },
  rowSub: { color: "#574737", fontSize: 12, lineHeight: 17, marginTop: 2 },
  count: { minWidth: 34, height: 28, paddingHorizontal: 8, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EFE3D2" },
  countOn: { backgroundColor: "#9A602D" },
  countText: { color: "#574737", fontSize: 13, fontWeight: "800" },
  countTextOn: { color: "#FFF9EF" },
});
