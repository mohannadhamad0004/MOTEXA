// Parts Admin dashboard: five cards, each with a real count (GET /admin/parts/stats, the 3D accessory list, unread messages). Counts that have not loaded are hidden.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Text } from "../../components/MotexaVisual";
import { MoPartsAdminVideo, MOPARTS_ASPECT } from "../../components/blueprint/mascot/MoPartsAdminVideo";
import { api } from "../../core/config/api";
import { cityLabel } from "../../core/constants/cities";
import { useLoad } from "../../core/hooks/useLoad";
import { review } from "../provider/api";
import { adminAccessoryApi } from "../accessory3d/api";
import { fmtDay } from "../provider/labels";
import type { Verification } from "../parts/partsService";
import { Head, Kpi, Rise, Skeleton, Tap } from "./TowAdminHome";
import { Avatar, CountBadge, DButton, DeptPage, Empty, Pill, StatusChip, cardStyle, useDT } from "./ui";
import { useThreeDCount } from "./ThreeDRequests";

const go = (path: string) => router.push(path as Href);

type ShopRow = { id: string; shopName: string; ownerName: string; city: string; verificationStatus: Verification; productCount: number; hiddenProductCount: number };

/** Dark in both themes. Mo plays on every real focus of the dashboard (not on rerenders or refreshes) and again when tapped. */
function Hero() {
  const d = useDT();
  const { width } = useWindowDimensions();
  const [playKey, setPlayKey] = useState(0);
  useFocusEffect(useCallback(() => setPlayKey((k) => k + 1), []));
  const moW = Math.round(Math.min(190, Math.max(150, width * 0.45)));
  return (
    <LinearGradient colors={["#1B130E", "#2B1E15", "#3A2818"]} style={{ borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24 }}>
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: d.row, alignItems: "center", gap: 6 }}>
            <Ionicons name="search-outline" size={13} color="#E0A36F" />
            <Text style={{ color: "#E0A36F", fontSize: 11, lineHeight: 16, fontWeight: "700", letterSpacing: d.ar ? 0 : 2 }}>{d.t("PARTS / ADMIN", "قطع الغيار / الإدارة")}</Text>
          </View>
          <Text style={{ color: "#FFF1DF", fontSize: 28, lineHeight: d.ar ? 44 : 34, fontWeight: "800", marginTop: 2, textAlign: d.align }}>{d.t("Marketplace review", "مراجعة السوق")}</Text>
          <Text style={{ color: "#DCC7A8", fontSize: 13, lineHeight: 20, marginTop: 4, textAlign: d.align }}>{d.t("Review shops, products and marketplace submissions.", "راجِع المتاجر والمنتجات وطلبات السوق.")}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={d.t("Replay Mo", "إعادة تشغيل مو")} onPress={() => setPlayKey((k) => k + 1)} style={{ width: moW, height: moW * MOPARTS_ASPECT }}>
          <MoPartsAdminVideo width={moW} play={playKey > 0} playKey={playKey} />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

/** One home card: a header (title, real count, badge) plus up to two action buttons. No other buttons for the same place on this screen. */
function HomeCard({ icon, title, sub, count, badge, actions }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; sub: string; count?: number; badge?: number; actions: { label: string; onPress: () => void; ghost?: boolean }[] }) {
  const d = useDT();
  return (
    <View style={{ ...cardStyle(d), padding: 16, marginBottom: 14, gap: 12 }}>
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
        <Ionicons name={icon} size={26} color="#E0A36F" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: d.ink, fontSize: 16, fontWeight: "800", textAlign: d.align }}>{title}</Text>
          <Text style={{ color: d.muted, marginTop: 2, textAlign: d.align }}>{sub}</Text>
        </View>
        {count !== undefined ? <Text style={{ color: d.ink, fontSize: 22, fontWeight: "800" }}>{count}</Text> : null}
        <CountBadge n={badge ?? 0} />
      </View>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 10 }}>
        {actions.map((x) => <View key={x.label} style={{ flexGrow: 1, flexBasis: 140 }}><DButton compact label={x.label} variant={x.ghost ? "ghost" : "primary"} onPress={x.onPress} /></View>)}
      </View>
    </View>
  );
}

export function PartsAdminHome() {
  const d = useDT();
  const stats = useLoad(async () => api<{ stats: Record<string, number> }>("GET", "/admin/parts/stats").then((r) => r.stats), []);
  const threeD = useThreeDCount();
  const unread = useLoad(() => review.counts("PARTS").then((c) => c.unreadMessages), [], 15000);

  const num = (v: number | undefined) => (stats.data ? String(v ?? 0) : stats.loading ? "…" : "—");
  const pending = stats.data?.pendingShops ?? 0;
  const hidden = stats.data?.hiddenProducts ?? 0;
  const reload = () => (void stats.reload(), void threeD.list.reload(), void unread.reload());

  return (
    <DeptPage hero={<Hero />} onRefresh={reload} refreshing={stats.loading && !!stats.data}>
      {/* five cards, each with a real count; a count that has not loaded is hidden, never faked */}
      <HomeCard icon="storefront-outline" title={d.t("Shops", "المتاجر")} sub={d.t("Applications and approved shops", "الطلبات والمتاجر المعتمدة")} count={stats.data?.shops} badge={pending}
        actions={[{ label: d.t("Review applications", "مراجعة الطلبات"), onPress: () => go("/dept/requests") }, { label: d.t("All shops", "كل المتاجر"), ghost: true, onPress: () => go("/dept/directory") }]} />
      <HomeCard icon="disc-outline" title={d.t("Products", "المنتجات")} sub={d.t("Hide or show products inside each shop, and customer orders", "إخفاء المنتجات أو إظهارها داخل كل متجر، وطلبات الزبائن")} count={stats.data?.products} badge={hidden}
        actions={[{ label: d.t("Orders", "الطلبات"), onPress: () => go("/dept/orders") }, { label: d.t("Active deliveries", "التوصيلات الجارية"), ghost: true, onPress: () => go("/dept/orders/map") }]} />
      <HomeCard icon="car-sport-outline" title={d.t("3D cars", "سيارات ثلاثية الأبعاد")} sub={stats.data ? d.t(`${stats.data.cars3d ?? 0} published for customers`, `${stats.data.cars3d ?? 0} منشورة للعملاء`) : d.t("Loading…", "جارٍ التحميل…")} count={stats.data?.cars3d}
        actions={[{ label: d.t("Add 3D model", "إضافة نموذج"), onPress: () => go("/dept/3d/add") }, { label: d.t("Manage 3D models", "إدارة النماذج"), ghost: true, onPress: () => go("/dept/3d/vehicles") }]} />
      <HomeCard icon="cube-outline" title={d.t("3D accessories", "إكسسوارات ثلاثية الأبعاد")} sub={threeD.list.data ? (threeD.needs ? d.t(`${threeD.needs} waiting for you`, `${threeD.needs} بانتظارك`) : d.t("Nothing waiting", "لا شيء بانتظارك")) : d.t("Requests, fit review, publishing", "الطلبات ومراجعة التركيب والنشر")} count={threeD.list.data?.length} badge={threeD.needs}
        actions={[{ label: d.t("3D requests", "طلبات ثلاثية الأبعاد"), onPress: () => go("/dept/requests?seg=3d") }, { label: d.t("Fit review", "مراجعة التركيب"), ghost: true, onPress: () => go("/dept/accessory-zones?mode=fits") }]} />
      <HomeCard icon="chatbubbles-outline" title={d.t("Messages", "الرسائل")} sub={d.t("Conversations with shops", "المحادثات مع المتاجر")} count={unread.data ?? undefined} actions={[{ label: d.t("Open messages", "فتح الرسائل"), onPress: () => go("/dept/messages") }]} />

      <Text style={{ fontSize: 8, lineHeight: 16, letterSpacing: 1, textAlign: "center", marginTop: 14, color: d.muted }}>MOTEXA • PARTS ADMIN</Text>
    </DeptPage>
  );
}
