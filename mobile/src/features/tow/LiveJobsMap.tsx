// The "live" view of tow jobs (company Live map and the tow admins' Active tows): every active job on our map (the driver's
// point when he shares it, the customer's pin), a list beside it, and the road route + distance / time for the job you tap.
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { EmptyState, GIcon, GText, Note, StatusChip, Tap } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { towTone } from "../requests/garageBits";
import { useTowStatusLabels } from "../requests/requestBits";
import { MAPS_AVAILABLE, ServiceMap, ServicePin } from "../shared/maps";
import { RouteSummary, useRoute } from "../shared/useRoute";
import { TowJob, liveLabel } from "./dispatchService";

export function LiveJobsMap({ jobs, onOpen, showCompany = false }: { jobs: TowJob[]; onOpen: (id: string) => void; showCompany?: boolean }) {
  const { g, shadow, row, align } = useGarageTheme();
  const { t } = useL();
  const L = useTowStatusLabels();
  const { height } = useWindowDimensions();
  const [sel, setSel] = useState<string | null>(null);
  const chosen = jobs.find((j) => j.id === sel) ?? null;
  const r3 = (p: { lat: number; lng: number } | null | undefined) => (p ? { lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 } : null);
  const from = chosen ? r3(chosen.driver?.live ?? chosen.company.base) : null;
  const to = chosen ? (chosen.status === "IN_PROGRESS" && chosen.dropoff ? chosen.dropoff : chosen.pickup) : null;
  const { route, loading } = useRoute(chosen && from ? `live:${chosen.id}:${from.lat},${from.lng}` : null, from, to);
  const pins: ServicePin[] = jobs.flatMap((j) => [
    ...(j.driver?.live ? [{ id: `d:${j.id}`, name: j.driver.name, lat: j.driver.live.lat, lng: j.driver.live.lng, kind: "tow" as const, dim: j.driver.live.stale, color: "#B5541C" }] : []),
    ...(j.pickup ? [{ id: `p:${j.id}`, name: j.customer.firstName, lat: j.pickup.lat, lng: j.pickup.lng, kind: "hq" as const, dim: false }] : []),
  ]);
  const fit: [number, number][] = route?.coords ?? pins.map((p) => [p.lat, p.lng] as [number, number]);
  const mapH = Math.round(height * 0.45);

  if (!jobs.length) return <EmptyState photo="empty.requests" text={t("No active tow job.", "لا توجد مهمة سحب نشطة.")} />;
  return (
    <View style={{ gap: 12 }}>
      {MAPS_AVAILABLE ? (
        <View style={{ height: mapH, borderRadius: gShape.card, overflow: "hidden" }}>
          <ServiceMap
            height={mapH}
            pins={pins}
            selectedId={chosen ? (chosen.driver?.live ? `d:${chosen.id}` : `p:${chosen.id}`) : null}
            me={null}
            route={route ? { coords: route.coords, dashed: route.kind === "line", key: `live:${chosen?.id}:${route.kind}` } : null}
            fit={fit}
            fitKey={`live:${sel ?? "-"}:${route ? route.kind : "-"}:${jobs.length}`}
            pad={{ top: 0, bottom: 0, left: 0, right: 0 }}
            onSelect={(pid) => setSel(pid.slice(2))}
            onBackground={() => setSel(null)}
          />
        </View>
      ) : (
        <Note>{t("The map is not available on this platform.", "الخريطة غير متاحة على هذه المنصة.")}</Note>
      )}
      {chosen ? <RouteSummary route={route} loading={loading} /> : null}
      {jobs.map((j) => (
        <Tap key={j.id} label={j.customer.firstName} onPress={() => setSel(j.id === sel ? null : j.id)} style={[{ padding: 12, borderRadius: gShape.card, backgroundColor: j.id === sel ? g.tint : g.card, gap: 4 }, shadow(1)]}>
          <View style={[row, { alignItems: "center", gap: 8 }]}>
            <GIcon name="car-outline" size={18} />
            <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flex: 1 }, align]}>{showCompany ? `${j.company.name} · ${j.customer.firstName}` : `${j.customer.firstName} · ${j.vehicle.make} ${j.vehicle.model}`}</GText>
            <StatusChip tone={towTone(j.status)} label={j.status === "EN_ROUTE" && j.arrivedAt ? L.ARRIVED : L[j.status]} />
          </View>
          <GText soft numberOfLines={1} style={[gType.caption, align]}>{j.driver ? `${j.driver.name} · ${liveLabel(j.driver.live, t)}` : t("No driver yet", "لا يوجد سائق بعد")}</GText>
          <Tap label={t("Open", "فتح")} onPress={() => onOpen(j.id)} style={[row, { minHeight: 44, alignItems: "center", gap: 4 }]}>
            <GText style={[gType.caption, { color: g.accentText, fontWeight: "800" }]}>{t("Open", "فتح")}</GText>
            <GIcon name="chevron-forward" size={14} flip />
          </Tap>
        </Tap>
      ))}
    </View>
  );
}
