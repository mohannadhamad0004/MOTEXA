// Every request of the company and its drivers = List (the Jobs tab; Active jobs and History are the same list on another chip):
// search, ONE chip row New · Active · Done with counts, compact rows (customer, car, who drives it, live state), ⋮ per row. Every 10 s.
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { FilterChips, ManagePage, ManageRow } from "../../../../components/manage/ManagePage";
import { useL } from "../../../../core/hooks/useL";
import { useLoad } from "../../../../core/hooks/useLoad";
import { useInTabs } from "../../../../features/providerhub/inTabs";
import { towTone } from "../../../../features/requests/garageBits";
import { fmtDateTime, useTowStatusLabels } from "../../../../features/requests/requestBits";
import { companyTowRequests } from "../../../../features/requests/requestsService";
import { liveLabel } from "../../../../features/tow/dispatchService";
import { companyJobActions } from "../../../../features/tow/provider/companyActions";

type Bucket = "new" | "active" | "done";
const OF: Record<Bucket, string[]> = { new: ["REQUESTED"], active: ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"], done: ["COMPLETED", "CANCELLED", "DECLINED"] };
const isBucket = (b?: string): b is Bucket => b === "new" || b === "active" || b === "done";

export default function CompanyDispatch({ initialBucket = "new" }: { initialBucket?: Bucket }) {
  const { t } = useL();
  const L = useTowStatusLabels();
  const tabRoot = useInTabs();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<Bucket>(isBucket(params.filter) ? params.filter : initialBucket);
  useEffect(() => { if (isBucket(params.filter)) setBucket(params.filter); }, [params.filter]);
  const list = useLoad(() => companyTowRequests.list(), [], 10_000);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = (list.data ?? []).filter((r) => words.every((w) => `${r.customerName} ${r.pickupAddress} ${r.vehicle.make} ${r.vehicle.model} ${r.driver?.name ?? ""}`.toLowerCase().includes(w)));
  const count = (b: Bucket) => found.filter((r) => OF[b].includes(r.status)).length;
  // no driver yet first (it needs the owner), then the newest
  const rows = found.filter((r) => OF[bucket].includes(r.status)).sort((a, b) => Number(!!a.driver) - Number(!!b.driver) || b.updatedAt.localeCompare(a.updatedAt));
  return (
    <ManagePage title={t("Tow requests", "طلبات السحب")} back={!tabRoot} tabBar={tabRoot}
      line={list.data ? t(`${count("new")} new · ${count("active")} active`, `${count("new")} جديدة · ${count("active")} نشطة`) : undefined}
      actions={[{ key: "live", label: t("Live map", "الخريطة المباشرة"), icon: "map-outline", run: () => router.push("/provider/tow/live" as Href) }]}
      search={{ value: q, onChange: setQ, placeholder: t("Customer, place, car or driver", "العميل أو المكان أو السيارة أو السائق") }}
      filters={<FilterChips value={bucket} onChange={setBucket} filters={[
        { key: "new", label: t("New", "جديدة"), count: list.data ? count("new") : undefined }, { key: "active", label: t("Active", "نشطة"), count: list.data ? count("active") : undefined },
        { key: "done", label: t("Done", "منتهية"), count: list.data ? count("done") : undefined },
      ]} />}
      items={rows} keyOf={(r) => r.id}
      renderItem={(r) => <ManageRow title={`${r.customerName} · ${r.vehicle.make} ${r.vehicle.model}`}
        sub={[r.driver ? `${t("Driver", "السائق")}: ${r.driver.name}${r.driver.live ? ` · ${liveLabel(r.driver.live, t)}` : ""}` : r.status === "REQUESTED" ? t("No driver yet: assign one", "لا يوجد سائق بعد: أسند واحدًا") : t("No driver (company handled)", "بدون سائق (تديره الشركة)"), r.pickupAddress, fmtDateTime(r.updatedAt)].filter(Boolean).join(" · ")}
        status={{ label: r.status === "EN_ROUTE" && r.arrivedAt ? L.ARRIVED : L[r.status], tone: towTone(r.status) }}
        onPress={() => router.push({ pathname: "/provider/tow/dispatch/[id]", params: { id: r.id } })} actions={companyJobActions(t, r, { reload: list.reload })} />}
      loading={!list.data && !list.error} error={list.error} onRetry={() => void list.reload()}
      empty={{ text: q ? t("No job matches.", "لا توجد مهمة مطابقة.") : bucket === "new" ? t("No new requests.", "لا توجد طلبات جديدة.") : bucket === "active" ? t("No active jobs.", "لا توجد مهام نشطة.") : t("No finished requests yet.", "لا توجد طلبات منتهية بعد."), action: q ? { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } : undefined }}
      onRefresh={() => void list.reload()} refreshing={false} detailHint={t("Tap a job to open it.", "اضغط على مهمة لفتحها.")} />
  );
}
