// Parts Admin dashboard (the Spare-parts department Home): inspect, verify, approve. Real data only: counts from GET /admin/parts/stats,
// shops (with their product counts) from GET /admin/parts/shops, applications from the provider review list. The admin API has no
// cross-shop product list (products are reviewed inside each shop: hide / show), so there is no product feed here, only the real count.
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
import { fmtDay } from "../provider/labels";
import type { Verification } from "../parts/partsService";
import { Head, Kpi, Rise, Skeleton, Tap } from "./TowAdminHome";
import { Avatar, DeptPage, Empty, Pill, StatusChip, cardStyle, useDT } from "./ui";

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

export function PartsAdminHome() {
  const d = useDT();
  const stats = useLoad(async () => api<{ stats: Record<string, number> }>("GET", "/admin/parts/stats").then((r) => r.stats), []);
  const shops = useLoad(async () => api<{ shops: ShopRow[] }>("GET", "/admin/parts/shops").then((r) => r.shops), []);
  const queue = useLoad(() => review.list("PARTS", "NEW"), [], 15000);

  const num = (v: number | undefined) => (stats.data ? String(v ?? 0) : stats.loading ? "…" : "—");
  const pending = stats.data?.pendingShops ?? 0;
  const hidden = stats.data?.hiddenProducts ?? 0;
  const list = [...(shops.data ?? [])].sort((a, b) => Number(b.verificationStatus === "APPROVED") - Number(a.verificationStatus === "APPROVED")).slice(0, 3);
  const reload = () => (void stats.reload(), void shops.reload(), void queue.reload());
  const oops = (e: string) => <Empty icon="cloud-offline-outline" text={e || d.t("Something went wrong.", "حدث خطأ ما.")} hint={d.t("Pull down to try again.", "اسحب للأسفل للمحاولة مجددًا.")} />;

  return (
    <DeptPage hero={<Hero />} onRefresh={reload} refreshing={(stats.loading || shops.loading || queue.loading) && !!(stats.data || shops.data)}>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", justifyContent: "space-between", rowGap: 12, marginBottom: 22 }}>
        <Kpi i={0} icon="clipboard-outline" value={num(stats.data?.pendingShops)} label={d.t("Pending shops", "متاجر قيد المراجعة")} warn={pending > 0} onPress={() => go("/dept/requests")} />
        <Kpi i={1} icon="create-outline" value={num(stats.data?.needsChanges)} label={d.t("Needs changes", "بانتظار التعديل")} onPress={() => go("/dept/requests")} />
        <Kpi i={2} icon="shield-checkmark-outline" value={num(stats.data?.approvedShops)} label={d.t("Approved shops", "متاجر معتمدة")} onPress={() => go("/dept/directory")} />
        <Kpi i={3} icon="eye-off-outline" value={num(stats.data?.hiddenProducts)} label={d.t("Hidden products", "منتجات مخفية")} onPress={() => go("/dept/directory")} />
      </View>

      <Head title={d.t("Needs review", "بحاجة إلى مراجعة")} caption={d.t("Shop applications waiting for a decision", "طلبات متاجر بانتظار القرار")} action={d.t("All", "الكل")} onAction={() => go("/dept/requests")} />
      {queue.data ? (
        queue.data.length === 0 ? (
          <Empty icon="checkmark-done-outline" text={d.t("Nothing is waiting for review.", "لا شيء بانتظار المراجعة.")} hint={d.t("New shop applications appear here.", "تظهر طلبات المتاجر الجديدة هنا.")} />
        ) : (
          queue.data.slice(0, 3).map((r, i) => (
            <Rise key={r.id} i={4 + i}>
              <Tap label={r.name} onPress={() => go(`/dept/review/shop/${r.id}`)} style={{ ...cardStyle(d), padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
                  <Avatar name={r.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{r.name}</Text>
                    <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{r.ownerName} · {cityLabel(r.city, d.ar)}</Text>
                  </View>
                  <Ionicons name={d.ar ? "chevron-back" : "chevron-forward"} size={18} color={d.accent} />
                </View>
                <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  <StatusChip status={r.status} />
                  {r.submittedAt ? <Pill icon="calendar-outline" label={fmtDay(r.submittedAt)} /> : null}
                  {r.pendingDocuments ? <Pill tone="amber" icon="document-text-outline" label={`${r.pendingDocuments} ${d.t("documents waiting", "مستندات بانتظار المراجعة")}`} /> : null}
                  <Pill tone="bronze" icon="search-outline" label={d.t("Review", "مراجعة")} />
                </View>
              </Tap>
            </Rise>
          ))
        )
      ) : queue.loading ? (
        <Skeleton n={2} />
      ) : (
        oops(queue.error ?? "")
      )}

      <View style={{ height: 14 }} />
      <Head title={d.t("Parts shops", "متاجر قطع الغيار")} action={d.t("All", "الكل")} onAction={() => go("/dept/directory")} />
      {shops.data ? (
        list.length === 0 ? (
          <Empty icon="storefront-outline" text={d.t("No parts shops yet.", "لا توجد متاجر بعد.")} />
        ) : (
          list.map((s, i) => (
            <Rise key={s.id} i={7 + i}>
              <Tap label={s.shopName} onPress={() => go(`/dept/review/shop/${s.id}`)} style={{ ...cardStyle(d), padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
                  <Avatar name={s.shopName} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{s.shopName}</Text>
                    <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>
                      {[cityLabel(s.city, d.ar), `${s.productCount} ${s.productCount === 1 ? d.t("product", "منتج") : d.t("products", "منتجات")}`].join(" · ")}
                    </Text>
                  </View>
                  <StatusChip status={s.verificationStatus} />
                </View>
                {s.hiddenProductCount > 0 ? (
                  <View style={{ flexDirection: d.row, marginTop: 10 }}>
                    <Pill tone="amber" icon="eye-off-outline" label={`${s.hiddenProductCount} ${d.t("hidden", "مخفي")}`} />
                  </View>
                ) : null}
              </Tap>
            </Rise>
          ))
        )
      ) : shops.loading ? (
        <Skeleton n={2} />
      ) : (
        oops(shops.error ?? "")
      )}

      <View style={{ height: 14 }} />
      <Head title={d.t("Product review", "مراجعة المنتجات")} />
      <Rise i={10}>
        <Tap label={d.t("Product review", "مراجعة المنتجات")} onPress={() => go("/dept/directory")} style={{ ...cardStyle(d), padding: 14 }}>
          <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: d.soft }}>
              <Ionicons name="disc-outline" size={22} color={d.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: d.ink, fontSize: 14, lineHeight: 21, fontWeight: "800", textAlign: d.align }}>{d.t("Products are reviewed inside each shop", "تُراجَع المنتجات داخل كل متجر")}</Text>
              <Text style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>
                {stats.data ? `${hidden} ${d.t("hidden right now. Open a shop to hide or show a product.", "مخفي حاليًا. افتح متجرًا لإخفاء منتج أو إظهاره.")}` : d.t("Open a shop to hide or show a product.", "افتح متجرًا لإخفاء منتج أو إظهاره.")}
              </Text>
            </View>
            <Ionicons name={d.ar ? "chevron-back" : "chevron-forward"} size={18} color={d.accent} />
          </View>
        </Tap>
      </Rise>

      <Text style={{ fontSize: 8, lineHeight: 16, letterSpacing: 1, textAlign: "center", marginTop: 14, color: d.muted }}>MOTEXA • PARTS ADMIN</Text>
    </DeptPage>
  );
}
