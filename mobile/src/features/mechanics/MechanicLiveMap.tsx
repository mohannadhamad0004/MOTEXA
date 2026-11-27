// The "live" view of mechanic jobs (garage owner's Live map, mechanics admin's live map): every active job on one map (the mechanic's
// point while he shares it, the customer's pin), the Online garage mechanics (latest point, shared only while Online), and the road
// route + distance / time for the job you tap. Same shape as the tow LiveJobsMap.
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { EmptyState, GIcon, GText, Note, StatusChip, Tap } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { mechTone } from "../requests/garageBits";
import { MAPS_AVAILABLE, ServiceMap, ServicePin } from "../shared/maps";
import { RouteSummary, useRoute } from "../shared/useRoute";
import { liveLabel } from "../tow/dispatchService";
import { useMechanicStatusLabels } from "./mechanicBits";
import type { GarageStaff, MechanicSideRequest } from "./mechanicsService";

const ONLINE = "#2E7D4F";

export function MechanicLiveMap({ jobs, people, onOpen, base = null, showGarage = false }: { jobs: MechanicSideRequest[]; people: GarageStaff[]; onOpen: (id: string) => void; base?: { lat: number; lng: number } | null; showGarage?: boolean }) {
  const { g, shadow, row, align } = useGarageTheme();
  const { t } = useL();
  const L = useMechanicStatusLabels();
  const { height } = useWindowDimensions();
  const [sel, setSel] = useState<string | null>(null);
  const chosen = jobs.find((j) => j.id === sel) ?? null;
  const from = chosen ? chosen.live ?? base : null;
  const to = chosen?.location.point ?? null;
  const { route, loading } = useRoute(chosen ? `mlive:${chosen.id}:${chosen.status}` : null, from, to, 50);
  const status: Record<string, string> = { FREE: t("Free", "متاح"), BUSY: t("Busy", "مشغول"), OFFLINE: t("Offline", "غير متصل"), UNAPPROVED: t("Not approved", "غير معتمد") };
  const pins: ServicePin[] = jobs
    .flatMap((j) => [
      ...(j.live ? [{ id: `m:${j.id}`, name: j.mechanicName ?? "", lat: j.live.lat, lng: j.live.lng, kind: "mech" as const, dim: j.live.stale }] : []),
      ...(j.location.point ? [{ id: `c:${j.id}`, name: j.customerName, lat: j.location.point.lat, lng: j.location.point.lng, kind: "car" as const, dim: !!j.location.approximate }] : []),
    ])
    .concat(people.filter((p) => p.live && !jobs.some((j) => j.live && j.mechanicUserId === p.userId)).map((p) => ({ id: `o:${p.id}`, name: p.name, lat: p.live!.lat, lng: p.live!.lng, kind: "mech" as const, dim: p.live!.stale, color: ONLINE })));
  const fit: [number, number][] = route?.coords ?? pins.map((p) => [p.lat, p.lng] as [number, number]);
  const mapH = Math.round(height * 0.45);

  if (!jobs.length && !people.length) return <EmptyState photo="empty.requests" text={t("No active job and no mechanic online.", "لا توجد مهمة نشطة ولا ميكانيكي متصل.")} />;
  return (
    <View style={{ gap: 12 }}>
      {MAPS_AVAILABLE ? (
        pins.length ? (
          <View style={{ height: mapH, borderRadius: gShape.card, overflow: "hidden" }}>
            <ServiceMap
              height={mapH}
              pins={pins}
              selectedId={chosen ? (chosen.live ? `m:${chosen.id}` : `c:${chosen.id}`) : null}
              me={null}
              route={route ? { coords: route.coords, dashed: route.kind === "line", key: `mlive:${chosen?.id}:${route.kind}` } : null}
              fit={fit}
              fitKey={`mlive:${sel ?? "-"}:${route ? route.kind : "-"}:${pins.length}`}
              pad={{ top: 0, bottom: 0, left: 0, right: 0 }}
              onSelect={(pid) => (pid.startsWith("o:") ? null : setSel(pid.slice(2)))}
              onBackground={() => setSel(null)}
            />
          </View>
        ) : (
          <Note>{t("Nobody is sharing a location right now.", "لا أحد يشارك موقعه الآن.")}</Note>
        )
      ) : (
        <Note>{t("The map is not available on this platform.", "الخريطة غير متاحة على هذه المنصة.")}</Note>
      )}
      {chosen ? <RouteSummary route={route} loading={loading} /> : null}
      {people.length ? (
        <View style={{ gap: 6 }}>
          <GText style={[gType.label, align, { fontWeight: "800" }]}>{`${t("Online now", "متصلون الآن")} · ${people.length}`}</GText>
          {people.map((p) => (
            <View key={p.id} style={[row, { alignItems: "center", gap: 8, minHeight: 40 }]}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.live && !p.live.stale ? ONLINE : g.soft }} />
              <GText numberOfLines={1} style={[gType.bodySm, align, { flex: 1 }]}>{showGarage ? `${p.name} · ${p.garage.name}` : p.name}</GText>
              <GText soft style={gType.caption}>{`${status[p.status] ?? p.status} · ${liveLabel(p.live, t)}`}</GText>
            </View>
          ))}
        </View>
      ) : null}
      {jobs.map((j) => (
        <View key={j.id} style={[{ borderRadius: gShape.card, backgroundColor: j.id === sel ? g.tint : g.card, overflow: "hidden" }, shadow(1)]}>
          <Tap label={j.customerName} onPress={() => setSel(j.id === sel ? null : j.id)} style={{ padding: 12, paddingBottom: 0, gap: 4 }}>
            <View style={[row, { alignItems: "center", gap: 8 }]}>
              <GIcon name={j.serviceMode === "WORKSHOP" ? "business-outline" : "car-outline"} size={18} />
              <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flex: 1 }, align]}>{showGarage && j.garage ? `${j.garage.name} · ${j.customerName}` : `${j.customerName} · ${j.vehicle.make} ${j.vehicle.model}`}</GText>
              <StatusChip tone={mechTone(j.status)} label={L[j.status]} />
            </View>
            <GText soft numberOfLines={1} style={[gType.caption, align]}>{j.mechanicName ? `${j.mechanicName} · ${j.serviceMode === "ON_SITE" ? liveLabel(j.live, t) : t("Workshop visit", "زيارة الورشة")}` : t("No mechanic yet", "لا يوجد ميكانيكي بعد")}</GText>
          </Tap>
          {/* a sibling of the select Tap, not inside it: a button inside a button is invalid DOM on web */}
          <Tap label={t("Open", "فتح")} onPress={() => onOpen(j.id)} style={[row, { minHeight: 44, alignItems: "center", gap: 4, paddingHorizontal: 12 }]}>
            <GText style={[gType.caption, { color: g.accentText, fontWeight: "800" }]}>{t("Open", "فتح")}</GText>
            <GIcon name="chevron-forward" size={14} flip />
          </Tap>
        </View>
      ))}
    </View>
  );
}
