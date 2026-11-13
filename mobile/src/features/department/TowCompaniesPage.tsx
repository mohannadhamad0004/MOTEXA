// Tow Admin: Tow companies (the Companies tab). EVERY tow company the admin controls, as a list with real status filters and search.
// Data: GET /admin/tow/companies, GET /admin/tow/trucks and the provider review list (documents waiting). "Show on map" opens the
// full-screen directory map (/dept/directory-map: company bases, active tows, drivers on jobs). Opening a company goes to the existing
// review screen, which holds the documents and the approve / request changes / reject actions.
import { Ionicons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import InteractiveButton from "../../components/InteractiveButton";
import { Text } from "../../components/MotexaVisual";
import { cityLabel } from "../../core/constants/cities";
import { useLoad } from "../../core/hooks/useLoad";
import { review } from "../provider/api";
import { TowCompany, Truck, towAdminService } from "../tow/towService";
import { Avatar, DButton, DeptPage, Empty, ItemCard, Load, Pill, Section, StatusChip, useDT } from "./ui";

const go = (path: string) => router.push(path as Href);
const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const ltr = (v: string) => "⁦" + v + "⁩";

type Company = TowCompany & { truckCount: number; pendingTruckCount: number };
type Filter = "ALL" | "PENDING" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
const FILTERS: { k: Filter; en: string; ar: string }[] = [
  { k: "ALL", en: "All", ar: "الكل" },
  { k: "PENDING", en: "Pending", ar: "قيد المراجعة" },
  { k: "NEEDS_CHANGES", en: "Needs changes", ar: "تعديلات" },
  { k: "APPROVED", en: "Approved", ar: "معتمدة" },
  { k: "REJECTED", en: "Rejected", ar: "مرفوضة" },
];
const expiredDocs = (t: Truck) => t.documents.filter((x) => !!x.expiresAt && new Date(x.expiresAt).getTime() < Date.now()).length;

export function TowCompaniesPage() {
  const d = useDT();
  const state = useLoad(async () => {
    const [companies, trucks, pending] = await Promise.all([towAdminService.listCompanies(NOACTOR) as Promise<Company[]>, towAdminService.listTrucks(NOACTOR), review.list("TOW", "NEW")]);
    return { companies, trucks, pendingDocs: new Map(pending.map((p) => [p.id, p.pendingDocuments])) };
  }, []);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");

  const data = state.data;
  const trucksOf = (id: string) => (data?.trucks ?? []).filter((t) => t.companyId === id);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.companies ?? []).filter((c) => {
      if (filter !== "ALL" && c.verification !== filter) return false;
      if (!needle) return true;
      const hay = [c.name, c.contactName, c.phone, c.city, cityLabel(c.city, true), ...(data?.trucks ?? []).filter((t) => t.companyId === c.id).flatMap((t) => [t.plate, t.make, t.model])].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [data, filter, q]);
  const count = (k: Filter) => (data?.companies ?? []).filter((c) => k === "ALL" || c.verification === k).length;

  return (
    <DeptPage onRefresh={() => void state.reload()} refreshing={state.loading && !!data}>
      <Section title={d.t("Tow companies", "شركات السحب")} caption={d.t("Every company, its trucks and where they operate from.", "كل شركة وشاحناتها والمكان الذي تعمل منه.")} />
      <View style={{ marginBottom: 12 }}>
        <DButton icon="map-outline" label={d.t("Show on map", "عرض على الخريطة")} onPress={() => go("/dept/directory-map")} />
      </View>
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 10, borderRadius: 17, borderWidth: 1, borderColor: d.border, backgroundColor: d.paper, paddingHorizontal: 14, marginBottom: 12 }}>
        <Ionicons name="search-outline" size={20} color={d.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={d.t("Company, owner, phone or plate", "الشركة أو المالك أو الهاتف أو اللوحة")}
          placeholderTextColor={d.muted}
          accessibilityLabel={d.t("Search companies", "بحث في الشركات")}
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
              <Empty icon="search-outline" text={q || filter !== "ALL" ? d.t("Nothing matches.", "لا توجد نتائج مطابقة.") : d.t("No tow companies yet.", "لا توجد شركات سحب بعد.")} />
            ) : (
              shown.map((c) => {
                const trucks = trucksOf(c.id);
                const waiting = data!.pendingDocs.get(c.id) ?? 0;
                const expired = trucks.reduce((n, t) => n + expiredDocs(t), 0);
                return (
                  <ItemCard key={c.id} label={c.name} onPress={() => go(`/dept/review/company/${c.id}`)}>
                    <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
                      <Avatar name={c.name} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={2} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{c.name}</Text>
                        <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{[c.contactName, cityLabel(c.city, d.ar)].filter(Boolean).join(" · ")}</Text>
                        {c.phone ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{ltr(c.phone)}</Text> : null}
                      </View>
                    </View>
                    <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      <StatusChip status={c.verification} />
                      <Pill icon="car-sport-outline" label={`${c.truckCount} ${c.truckCount === 1 ? d.t("truck", "شاحنة") : d.t("trucks", "شاحنات")}`} />
                      {c.pendingTruckCount ? <Pill tone="amber" label={`${d.t("Pending trucks", "شاحنات قيد المراجعة")}: ${c.pendingTruckCount}`} /> : null}
                      {waiting ? <Pill tone="amber" icon="document-text-outline" label={`${waiting} ${d.t("documents to review", "مستندات للمراجعة")}`} /> : null}
                      {expired ? <Pill tone="bad" icon="alert-circle-outline" label={`${expired} ${d.t("expired", "منتهية")}`} /> : null}
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <DButton variant="ghost" icon="eye-outline" label={d.t("View company", "عرض الشركة")} onPress={() => go(`/dept/review/company/${c.id}`)} />
                    </View>
                  </ItemCard>
                );
              })
            )
        }
      </Load>
    </DeptPage>
  );
}
