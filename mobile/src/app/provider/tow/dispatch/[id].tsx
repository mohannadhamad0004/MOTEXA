import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Card, Chip, ErrorState, Field, GarageHero,  GButton, ListRow, Note, Section, SkeletonBlock, StatusChip, Timeline } from "../../../../components/garage";
import { ProviderLayout as GaragePage } from "../../../../components/layout/ProviderLayout";
import { useL } from "../../../../core/hooks/useL";
import { OrderMap } from "../../../../features/orders/orderBits";
import { toSteps, towTone } from "../../../../features/requests/garageBits";
import { buildTimeline, useProblemLabels, useTowStatusLabels } from "../../../../features/requests/requestBits";
import { CompanyTowRequest, TowStatus, companyTowRequests } from "../../../../features/requests/requestsService";
import { CompanyDriver, companyDispatch, liveLabel } from "../../../../features/tow/dispatchService";
import { gShape, useGarageTheme } from "../../../../theme/garage";

const PATH: (TowStatus | "ARRIVED")[] = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED"];

/**
 * One request, company side: every detail, who has it (and who the customer asked for), the live map, the timeline, and the
 * company's actions: assign / transfer to a FREE driver (until the driver is on the way), decline a new one, cancel an
 * accepted / on-the-way one. Only the driver moves a job he has; a request without drivers still opens the classic screen.
 */
export default function CompanyDispatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { row } = useGarageTheme();
  const { t } = useL();
  const L = useTowStatusLabels();
  const problem = useProblemLabels();
  const [r, setR] = useState<CompanyTowRequest | null>(null);
  const [drivers, setDrivers] = useState<CompanyDriver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [stop, setStop] = useState<"decline" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    try {
      const [req, ds] = await Promise.all([companyTowRequests.get(id), companyDispatch.drivers()]);
      setR(req);
      setDrivers(ds);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
      const h = setInterval(load, 10_000);
      return () => clearInterval(h);
    }, [load])
  );
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setStop(null);
      setReason("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const free = drivers.filter((d) => d.status === "FREE" && d.id !== r?.driver?.id);
  const live = r?.driver?.live ?? null;

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/provider/tow/dispatch"))} title={r ? `${r.customerName} · ${r.vehicle.make} ${r.vehicle.model}` : t("Request", "الطلب")} line={r ? r.pickupAddress : undefined}>
          {r ? <StatusChip tone={towTone(r.status)} label={r.status === "EN_ROUTE" && r.arrivedAt ? L.ARRIVED : L[r.status]} /> : null}
        </GarageHero>
      }
    >
      {error && !r ? <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!r && !error ? <SkeletonBlock height={240} radius={gShape.card} /> : null}
      {r ? (
        <View style={{ gap: 12 }}>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
          <Card pad={12}>
            <ListRow icon="person-circle-outline" title={r.driver ? `${t("Driver", "السائق")}: ${r.driver.name}` : t("No driver yet", "لا يوجد سائق بعد")} sub={r.driver ? `${r.driver.phone} · ${liveLabel(live, t)}` : undefined} />
            {r.requestedDriver ? <ListRow divider icon="star-outline" title={t("The customer asked for", "طلب الزبون")} sub={r.requestedDriver.name} /> : null}
          </Card>

          {r.canReassign ? (
            <Section title={r.driver ? t("Transfer to another free driver", "التحويل إلى سائق متاح آخر") : t("Assign to a free driver", "الإسناد إلى سائق متاح")} style={{ marginTop: 4 }}>
              {free.length ? (
                <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
                  {free.map((d) => (
                    <Chip key={d.id} icon="person-outline" label={d.truck ? `${d.name} · ${d.truck.plate}` : d.name} onPress={() => void act(`assign:${d.id}`, () => companyDispatch.assign(r.id, d.id))} />
                  ))}
                </View>
              ) : (
                <Note>{drivers.length ? t("No other driver is free right now.", "لا يوجد سائق آخر متاح الآن.") : t("You have no drivers yet. Add them under Drivers, or answer it on the classic screen.", "ليس لديك سائقون بعد. أضفهم من «السائقون» أو أجب من الشاشة الكلاسيكية.")}</Note>
              )}
              {r.status === "ACCEPTED" && r.driver ? <Note icon="information-circle-outline">{t("Transferring frees the current truck; the new driver accepts with his own.", "التحويل يحرّر الشاحنة الحالية؛ ويقبل السائق الجديد بشاحنته.")}</Note> : null}
            </Section>
          ) : null}
          {!r.driver && r.status === "REQUESTED" && !drivers.length ? (
            <GButton variant="secondary" icon="open-outline" label={t("Answer on the classic screen (choose a truck)", "الرد من الشاشة الكلاسيكية (اختيار شاحنة)")} onPress={() => router.push({ pathname: "/provider/tow/requests/[id]", params: { id: r.id } })} />
          ) : null}

          {r.pickup ? (
            <Section title={t("Map", "الخريطة")}>
              <OrderMap orderId={`tow:${r.id}`} height={260} delivery={r.pickup} shop={null} courier={live ? { lat: live.lat, lng: live.lng } : null} />
            </Section>
          ) : null}

          <Section title={t("Status", "الحالة")}>
            <Card>
              <Timeline steps={toSteps(buildTimeline(PATH, r.timeline as { status: TowStatus | "ARRIVED"; at: string }[], r.status === "EN_ROUTE" && r.arrivedAt ? "ARRIVED" : r.status, L))} />
            </Card>
          </Section>

          <Section title={t("Details", "التفاصيل")}>
            <Card pad={12}>
              <ListRow icon="location-outline" title={t("Pickup", "الاستلام")} sub={r.pickupAddress} />
              <ListRow divider icon="flag-outline" title={t("Destination", "الوجهة")} sub={r.dropoffAddress} />
              <ListRow divider icon="alert-circle-outline" title={t("Problem", "المشكلة")} sub={problem[r.problemType]} />
              <ListRow divider icon="call-outline" title={t("Customer phone", "هاتف الزبون")} sub={r.contactPhone} />
              {r.notes ? <ListRow divider icon="document-text-outline" title={t("Notes", "ملاحظات")} sub={r.notes} /> : null}
              {r.truck ? <ListRow divider icon="car-outline" title={t("Truck", "الشاحنة")} sub={[r.truck.plateNumber, r.truck.make, r.truck.model].filter(Boolean).join(" · ")} /> : null}
            </Card>
          </Section>

          {r.status === "REQUESTED" && !stop ? <GButton variant="danger" label={t("Decline request", "رفض الطلب")} onPress={() => setStop("decline")} /> : null}
          {(r.status === "ACCEPTED" || r.status === "EN_ROUTE") && !stop ? <GButton variant="danger" label={t("Cancel job", "إلغاء المهمة")} onPress={() => setStop("cancel")} /> : null}
          {stop ? (
            <Card>
              <Field label={t("Reason (the customer sees this)", "السبب (يراه الزبون)")} value={reason} onChangeText={setReason} maxLength={300} multiline />
              <View style={[row, { gap: 10 }]}>
                <GButton flex variant="secondary" label={t("Back", "رجوع")} onPress={() => setStop(null)} />
                <GButton flex variant="danger" label={stop === "decline" ? t("Decline", "رفض") : t("Cancel job", "إلغاء المهمة")} disabled={!reason.trim()} busy={busy === stop} onPress={() => void act(stop, () => (stop === "decline" ? companyTowRequests.decline(r.id, reason.trim()) : companyTowRequests.cancel(r.id, reason.trim())))} />
              </View>
            </Card>
          ) : null}
        </View>
      ) : null}
    </GaragePage>
  );
}
