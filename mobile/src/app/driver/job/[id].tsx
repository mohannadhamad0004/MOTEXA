import { jobAfterLocationError } from "../../../features/shared/locationPolicy";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Linking, View, useWindowDimensions } from "react-native";
import { Card, ErrorState, Field, GarageHero, GaragePage, GButton, ListRow, Note, SkeletonBlock, StatusChip, Timeline } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { OrderMap, useShareLocation } from "../../../features/orders/orderBits";
import { towTone } from "../../../features/requests/garageBits";
import { fmtDateTime, useProblemLabels, useTowStatusLabels } from "../../../features/requests/requestBits";
import { DriverStep, TowJob, driverApi, jobSteps } from "../../../features/tow/dispatchService";
import { gShape, useGarageTheme } from "../../../theme/garage";

/**
 * The driver's job map: the customer's pin (the destination once towing), his own live position, the in-app road route with
 * distance + time, the customer's first name + car + note, and big status buttons: Accept -> On the way -> Arrived -> Towing ->
 * Completed (Cancel / Decline with a reason). While the job is active and this screen is open his location is sent every ~10 s
 * (foreground only); it stops when the job ends or the screen closes.
 */
export default function DriverJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { row } = useGarageTheme();
  const { t } = useL();
  const L = useTowStatusLabels();
  const problem = useProblemLabels();
  const { height } = useWindowDimensions();
  const [j, setJ] = useState<TowJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [stop, setStop] = useState<"decline" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const loadSequence = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const job = await driverApi.job(id);
      if (sequence !== loadSequence.current) return;
      setJ(job);
      setError(null);
    } catch (e: any) {
      if (sequence !== loadSequence.current) return;
      setJ(previous => jobAfterLocationError(previous, e));
      setError(e.message);
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
      const h = setInterval(load, 15_000);
      return () => { clearInterval(h); loadSequence.current++; };
    }, [load])
  );
  const working = !!j && j.id === id && ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(j.status);
  const { me, meFresh, problem: locProblem, canOpenSettings, openSettings } = useShareLocation(id, working, (p) => driverApi.ping(id, p));

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
  const step = (to: DriverStep) => act(to, () => driverApi.move(id, to));
  const back = () => (router.canGoBack() ? router.back() : router.navigate("/driver" as never));
  // before towing: drive to the customer; while towing: to the destination (when a point was given)
  const target = j ? (j.status === "IN_PROGRESS" && j.dropoff ? j.dropoff : j.pickup) : null;
  const next: { key: DriverStep; label: string } | null = !j
    ? null
    : j.status === "ACCEPTED"
      ? { key: "EN_ROUTE", label: t("On the way", "في الطريق") }
      : j.status === "EN_ROUTE" && !j.arrivedAt
        ? { key: "ARRIVED", label: t("Arrived", "وصلت") }
        : j.status === "EN_ROUTE"
          ? { key: "IN_PROGRESS", label: t("Start towing", "بدء السحب") }
          : j.status === "IN_PROGRESS"
            ? { key: "COMPLETED", label: t("Completed", "اكتمل") }
            : null;

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero variant="detail" onBack={back} title={j ? `${j.customer.firstName} · ${j.vehicle.make} ${j.vehicle.model}` : t("Job", "المهمة")} line={j ? (j.status === "IN_PROGRESS" ? j.dropoffAddress : j.pickupAddress) : undefined}>
          {j ? <StatusChip tone={towTone(j.status)} label={j.status === "EN_ROUTE" && j.arrivedAt ? L.ARRIVED : L[j.status]} /> : null}
        </GarageHero>
      }
    >
      {error && !j ? <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!j && !error ? <SkeletonBlock height={Math.round(height * 0.5)} radius={gShape.card} /> : null}
      {j ? (
        <View style={{ gap: 12 }}>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
          {locProblem ? <Note tone="danger" icon="location-outline">{locProblem}</Note> : null}
          {locProblem && canOpenSettings ? <GButton variant="secondary" icon="settings-outline" label={t("Open Settings", "فتح الإعدادات")} onPress={() => void openSettings()} /> : null}
          {working && me ? <Note icon="radio-outline">{t("Sharing your location with the customer and your company while this screen is open.", "تتم مشاركة موقعك مع الزبون وشركتك أثناء فتح هذه الشاشة.")}</Note> : null}

          <OrderMap orderId={`tow:${j.id}`} height={Math.round(height * 0.5)} delivery={target} shop={null} courier={null} me={me} meFresh={meFresh} />

          {j.status === "REQUESTED" ? (
            <View style={[row, { gap: 10 }]}>
              <GButton flex variant="secondary" label={t("Decline", "رفض")} disabled={!!busy} onPress={() => setStop("decline")} />
              <GButton flex icon="checkmark" label={t("Accept", "قبول")} busy={busy === "accept"} disabled={!!busy} onPress={() => void act("accept", () => driverApi.accept(id))} />
            </View>
          ) : null}
          {next ? <GButton icon="arrow-forward" label={next.label} busy={busy === next.key} disabled={!!busy} onPress={() => void step(next.key)} style={{ minHeight: 60 }} /> : null}

          <Card pad={12}>
            <ListRow icon="person-outline" title={j.customer.firstName} sub={problem[j.problemType]} end={undefined} />
            <ListRow divider icon="call-outline" title={j.contactPhone} sub={t("Call the customer", "اتصل بالزبون")} onPress={() => void Linking.openURL(`tel:${j.contactPhone.replace(/[^\d+]/g, "")}`)} />
            {j.notes ? <ListRow divider icon="document-text-outline" title={t("Note", "ملاحظة")} sub={j.notes} /> : null}
            <ListRow divider icon="flag-outline" title={t("Destination", "الوجهة")} sub={j.dropoffAddress} />
          </Card>

          <Card>
            <Timeline steps={jobSteps(j, t).map(([label, at]) => ({ label, at: at ? fmtDateTime(at) : undefined, state: at ? "done" : "todo" }))} />
          </Card>

          {["ACCEPTED", "EN_ROUTE"].includes(j.status) && !stop ? <GButton variant="danger" label={t("Cancel job", "إلغاء المهمة")} onPress={() => setStop("cancel")} /> : null}
          {stop ? (
            <Card>
              <Field label={stop === "decline" ? t("Why do you decline? (your company sees this)", "لماذا ترفض؟ (تراه شركتك)") : t("Why do you cancel? (the customer sees this)", "لماذا تلغي؟ (يراه الزبون)")} value={reason} onChangeText={setReason} maxLength={300} multiline />
              <View style={[row, { gap: 10 }]}>
                <GButton flex variant="secondary" label={t("Back", "رجوع")} onPress={() => setStop(null)} />
                <GButton
                  flex
                  variant="danger"
                  label={stop === "decline" ? t("Decline", "رفض") : t("Cancel job", "إلغاء المهمة")}
                  disabled={!reason.trim()}
                  busy={busy === stop}
                  onPress={() => void act(stop, () => (stop === "decline" ? driverApi.decline(id, reason.trim()).then(() => router.replace("/driver" as never)) : driverApi.cancel(id, reason.trim())))}
                />
              </View>
            </Card>
          ) : null}
        </View>
      ) : null}
    </GaragePage>
  );
}
