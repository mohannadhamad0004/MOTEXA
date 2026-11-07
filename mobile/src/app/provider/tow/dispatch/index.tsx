import { SearchBar } from "../../../../components/ui/Input";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { EmptyState, ErrorState, GarageHero,  GIcon, GText, SkeletonRows, StatusChip, Tabs, Tap } from "../../../../components/garage";
import { ProviderLayout as GaragePage } from "../../../../components/layout/ProviderLayout";
import { useL } from "../../../../core/hooks/useL";
import { towTone } from "../../../../features/requests/garageBits";
import { fmtDateTime, useTowStatusLabels } from "../../../../features/requests/requestBits";
import { CompanyTowRequest, companyTowRequests } from "../../../../features/requests/requestsService";
import { liveLabel } from "../../../../features/tow/dispatchService";
import { gShape, gType, useGarageTheme } from "../../../../theme/garage";

type Bucket = "new" | "active" | "done";
const OF: Record<Bucket, string[]> = { new: ["REQUESTED"], active: ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"], done: ["COMPLETED", "CANCELLED", "DECLINED"] };

/** Every request of the company and its drivers: New / Active / Done with counts, who has it, the live state. Every 10 s. */
export default function CompanyDispatch({ initialBucket = "new" }: {initialBucket?:Bucket}) {
  const { g, shadow, row, align } = useGarageTheme();
  const { t } = useL();
  const L = useTowStatusLabels();
  const [q,setQ]=useState("");
  const [bucket, setBucket] = useState<Bucket>(initialBucket);
  const [list, setList] = useState<CompanyTowRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setList(await companyTowRequests.list());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
      const h = setInterval(load, 10_000);
      return () => clearInterval(h);
    }, [load])
  );
  const count = (b: Bucket) => (list ?? []).filter((r) => OF[b].includes(r.status)).length;
  const shown = (list ?? []).filter((r) => OF[bucket].includes(r.status) && (!q.trim() || `${r.customerName} ${r.pickupAddress} ${r.vehicle.make} ${r.vehicle.model}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/provider/tow"))}
          title={t("Tow requests", "طلبات السحب")}
          line={list ? t(`${count("new")} new · ${count("active")} active`, `${count("new")} جديدة · ${count("active")} نشطة`) : undefined}
          action={{ icon: "map-outline", label: t("Live map", "الخريطة المباشرة"), onPress: () => router.push("/provider/tow/live") }}
        />
      }
    >
      <SearchBar value={q} onChange={setQ} placeholder={t("Search jobs","ابحث في المهام")}/>
      <Tabs
        value={bucket}
        onChange={setBucket}
        options={[
          { key: "new", label: t("New", "جديدة"), count: list ? count("new") : undefined },
          { key: "active", label: t("Active", "نشطة"), count: list ? count("active") : undefined },
          { key: "done", label: t("Done", "منتهية"), count: list ? count("done") : undefined },
        ]}
      />
      <View style={{ marginTop: 16, gap: 12 }}>
        {!list && !error ? (
          <SkeletonRows count={4} />
        ) : error && !list ? (
          <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} />
        ) : !shown.length ? (
          <EmptyState photo="empty.requests" text={bucket === "new" ? t("No new requests.", "لا توجد طلبات جديدة.") : bucket === "active" ? t("No active jobs.", "لا توجد مهام نشطة.") : t("No finished requests yet.", "لا توجد طلبات منتهية بعد.")} />
        ) : (
          shown.map((r) => (
            <Tap key={r.id} label={`${r.customerName}, ${L[r.status]}`} onPress={() => router.push({ pathname: "/provider/tow/dispatch/[id]", params: { id: r.id } })} style={[{ padding: 14, borderRadius: gShape.card, backgroundColor: g.card, gap: 6 }, shadow(1)]}>
              <View style={[row, { alignItems: "center", gap: 8 }]}>
                <GIcon name="car-outline" size={18} />
                <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flex: 1 }, align]}>{`${r.customerName} · ${r.vehicle.make} ${r.vehicle.model}`}</GText>
                <GIcon name="chevron-forward" size={16} color={g.soft} flip />
              </View>
              <GText soft numberOfLines={1} style={[gType.caption, align]}>{r.pickupAddress}</GText>
              <GText style={[gType.caption, align, { color: r.driver ? g.ink : g.warning, fontWeight: "700" }]}>
                {r.driver ? `${t("Driver", "السائق")}: ${r.driver.name}${r.driver.live ? ` · ${liveLabel(r.driver.live, t)}` : ""}` : r.status === "REQUESTED" ? t("No driver yet: assign one", "لا يوجد سائق بعد: أسند واحدًا") : t("No driver (company handled)", "بدون سائق (تديره الشركة)")}
              </GText>
              <View style={[row, { alignItems: "center", justifyContent: "space-between" }]}>
                <StatusChip tone={towTone(r.status)} label={r.status === "EN_ROUTE" && r.arrivedAt ? L.ARRIVED : L[r.status]} />
                <GText soft style={[gType.tiny, { writingDirection: "ltr" }]}>{fmtDateTime(r.updatedAt)}</GText>
              </View>
            </Tap>
          ))
        )}
      </View>
    </GaragePage>
  );
}
