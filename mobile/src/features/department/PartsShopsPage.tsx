// Parts Admin: Parts shops (the Shops tab). EVERY parts shop account the admin controls, as a list with real status filters and search.
// Data: GET /admin/parts/shops (all shops, not paginated, so filters, counts and search are complete) and the provider review list
// (documents waiting). "Show on map" opens the full-screen directory map (/dept/directory-map: one pin per saved shop location, coloured
// by status). Opening a shop goes to the existing review screen, which holds the documents and the approve / request changes / reject actions.
import { Ionicons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import InteractiveButton from "../../components/InteractiveButton";
import { Text } from "../../components/MotexaVisual";
import { api } from "../../core/config/api";
import { CATALOG_GROUPS } from "../../core/constants/categories";
import { cityLabel } from "../../core/constants/cities";
import { useLoad } from "../../core/hooks/useLoad";
import { review } from "../provider/api";
import type { Verification } from "../parts/partsService";
import { ItemRow } from "../../components/ItemActionsMenu";
import { providerActions } from "./itemActions";
import { Avatar, DButton, DeptPage, Empty, Load, Pill, Section, StatusChip, cardStyle, useDT } from "./ui";

const go = (path: string) => router.push(path as Href);
const ltr = (v: string) => "⁦" + v + "⁩";

type Shop = {
  id: string;
  shopName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  city: string;
  address: string | null;
  verificationStatus: Verification;
  baseLat: number | null;
  baseLng: number | null;
  locationAddress: string | null;
  brandName: string | null;
  branchName: string | null;
  categories: string[];
  productCount: number;
  hiddenProductCount: number;
  storefrontUri?: string | null;
};
type Filter = "ALL" | "PENDING" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
const FILTERS: { k: Filter; en: string; ar: string }[] = [
  { k: "ALL", en: "All", ar: "الكل" },
  { k: "PENDING", en: "Pending", ar: "قيد المراجعة" },
  { k: "NEEDS_CHANGES", en: "Needs changes", ar: "تعديلات" },
  { k: "APPROVED", en: "Approved", ar: "معتمدة" },
  { k: "REJECTED", en: "Rejected", ar: "مرفوضة" },
];
const CATEGORY = new Map(CATALOG_GROUPS.flatMap((g) => g.categories).map((c) => [c.key, c]));
/** the localized label of a category key (never the raw key) */
const catLabel = (k: string, ar: boolean) => {
  const c = CATEGORY.get(k);
  return c ? (ar ? c.ar : c.en) : "";
};

export function PartsShopsPage() {
  const d = useDT();
  const state = useLoad(async () => {
    const [shops, pending] = await Promise.all([api<{ shops: Shop[] }>("GET", "/admin/parts/shops").then((r) => r.shops), review.list("PARTS", "NEW")]);
    return { shops, pendingDocs: new Map(pending.map((p) => [p.id, p.pendingDocuments])) };
  }, []);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");

  const data = state.data;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.shops ?? []).filter((s) => {
      if (filter !== "ALL" && s.verificationStatus !== filter) return false;
      if (!needle) return true;
      return [s.shopName, s.brandName, s.branchName, s.ownerName, s.phone, s.city, cityLabel(s.city, true)].join(" ").toLowerCase().includes(needle);
    });
  }, [data, filter, q]);
  const count = (k: Filter) => (data?.shops ?? []).filter((s) => k === "ALL" || s.verificationStatus === k).length;

  const labels = (s: Shop) => s.categories.map((k) => catLabel(k, d.ar)).filter(Boolean);
  /** shop name, then brand · branch on its own line so a long name never squeezes the rest */
  const Names = ({ s }: { s: Shop }) => (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={2} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{s.shopName}</Text>
      {s.brandName || s.branchName ? <Text numberOfLines={2} style={{ color: d.accent, fontSize: 12, lineHeight: 19, fontWeight: "700", textAlign: d.align }}>{[s.brandName, s.branchName].filter(Boolean).join(" · ")}</Text> : null}
      <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{[s.ownerName, cityLabel(s.city, d.ar)].filter(Boolean).join(" · ")}</Text>
      {s.phone ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{ltr(s.phone)}</Text> : null}
    </View>
  );

  return (
    <DeptPage onRefresh={() => void state.reload()} refreshing={state.loading && !!data}>
      <Section title={d.t("Parts shops", "متاجر قطع الغيار")} caption={d.t("Every shop account: one account is one physical shop or branch.", "كل حساب متجر: الحساب الواحد هو متجر أو فرع فعلي واحد.")} />
      <View style={{ marginBottom: 12 }}>
        <DButton icon="map-outline" label={d.t("Show on map", "عرض على الخريطة")} onPress={() => go("/dept/directory-map")} />
      </View>
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 10, borderRadius: 17, borderWidth: 1, borderColor: d.border, backgroundColor: d.paper, paddingHorizontal: 14, marginBottom: 12 }}>
        <Ionicons name="search-outline" size={20} color={d.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={d.t("Shop, brand, owner, phone or city", "المتجر أو العلامة أو المالك أو الهاتف أو المدينة")}
          placeholderTextColor={d.muted}
          accessibilityLabel={d.t("Search shops", "بحث في المتاجر")}
          style={{ flex: 1, minHeight: 46, color: d.ink, textAlign: d.align }}
        />
      </View>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <InteractiveButton
            key={f.k}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.k }}
            onPress={() => setFilter(f.k)}
            style={{ paddingHorizontal: 14, minHeight: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: filter === f.k ? d.fill : d.border, backgroundColor: filter === f.k ? d.fill : "transparent" }}
          >
            <Text style={{ color: filter === f.k ? d.fillInk : d.ink, fontSize: 13, fontWeight: "600" }}>
              {d.t(f.en, f.ar)}
              {data ? ` (${count(f.k)})` : ""}
            </Text>
          </InteractiveButton>
        ))}
      </View>

      <Load state={state}>
        {() =>
            shown.length === 0 ? (
              <Empty icon="search-outline" text={q || filter !== "ALL" ? d.t("Nothing matches.", "لا توجد نتائج مطابقة.") : d.t("No parts shops yet.", "لا توجد متاجر بعد.")} />
            ) : (
              shown.map((s) => {
                const waiting = data!.pendingDocs.get(s.id) ?? 0;
                const cats = labels(s);
                return (
                  <ItemRow key={s.id} title={s.shopName} subtitle={[s.brandName, s.branchName].filter(Boolean).join(" · ") || undefined} box={{ ...cardStyle(d), padding: 14 }} style={{ marginBottom: 10 }} onPress={() => go(`/dept/review/shop/${s.id}`)}
                    actions={providerActions(d.t, "PARTS", { id: s.id, status: s.verificationStatus === "DRAFT" ? "DRAFT" : s.verificationStatus, pendingDocuments: waiting }, () => state.reload())}>
                    <View style={{ flexDirection: d.row, alignItems: "flex-start", gap: 12 }}>
                      <Avatar name={s.shopName} />
                      <Names s={s} />
                    </View>
                    <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      <StatusChip status={s.verificationStatus} />
                      {s.verificationStatus === "APPROVED" ? <Pill icon="cube-outline" label={`${s.productCount} ${s.productCount === 1 ? d.t("product", "منتج") : d.t("products", "منتجات")}`} /> : null}
                      {s.baseLat == null || s.baseLng == null ? <Pill tone="amber" icon="location-outline" label={d.t("Location missing", "الموقع غير محدد")} /> : null}
                      {waiting ? <Pill tone="amber" icon="document-text-outline" label={`${waiting} ${d.t("documents to review", "مستندات للمراجعة")}`} /> : null}
                    </View>
                    {cats.length ? (
                      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {cats.slice(0, 3).map((c) => (
                          <Pill key={c} tone="bronze" label={c} />
                        ))}
                        {cats.length > 3 ? <Pill label={`+${cats.length - 3}`} /> : null}
                      </View>
                    ) : null}
                  </ItemRow>
                );
              })
            )
        }
      </Load>
    </DeptPage>
  );
}
