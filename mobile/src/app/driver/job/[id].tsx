import { SESSION_EXPIRED } from "../../../core/session/sessionExpiry";
const EXPIRED = "SESSION_EXPIRED";
import { jobAfterLocationError } from "../../../features/shared/locationPolicy";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Card, ErrorState, Field, GarageHero,  GButton, ListRow, Note, SkeletonBlock, StatusChip, Timeline } from "../../../components/garage";
import { ProviderLayout as GaragePage } from "../../../components/layout/ProviderLayout";
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
      setError(e.status === 401 ? EXPIRED : e.message);
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
  // every step is confirmed with a second tap, in order, and cannot be skipped or undone (the server enforces it too)
  const [confirm, setConfirm] = useState<DriverStep | null>(null);
  // foreground only: a point at most every 5 s, and only after 20 m of movement (every 15 s while standing still)
  const { me, meFresh, weak, notReaching, problem: locProblem, canOpenSettings, openSettings } = useShareLocation(id, working, (p) => driverApi.ping(id, p), { minMs: 5_000, minMeters: 20 });

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
  const stageText = (k: string) => ({ ON_THE_WAY: t("On the way", "في الطريق"), ARRIVED: t("Arrived", "وصل"), LOADING: t("Loading", "التحميل"), TOWING: t("Towing", "جارٍ السحب"), DELIVERED: t("Delivered", "تم التسليم") } as Record<string, string>)[k] ?? L[k as keyof typeof L] ?? k;
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
        : j.status === "EN_ROUTE" && !j.loadingAt
          ? { key: "LOADING", label: t("Loading the car", "تحميل السيارة") }
          : j.status === "EN_ROUTE"
            ? { key: "IN_PROGRESS", label: t("Start towing", "بدء السحب") }
            : j.status === "IN_PROGRESS" && !j.deliveredAt
              ? { key: "DELIVERED", label: t("Delivered", "تم التسليم") }
              : j.status === "IN_PROGRESS"
                ? { key: "COMPLETED", label: t("Complete the job", "إنهاء المهمة") }
                : null;

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero variant="detail" onBack={back} title={j ? `${j.customer.firstName} · ${j.vehicle.make} ${j.vehicle.model}` : t("Job", "المهمة")} line={j ? (j.status === "IN_PROGRESS" ? j.dropoffAddress : j.pickupAddress) : undefined}>
          {j ? <StatusChip tone={towTone(j.status)} label={stageText(j.stage ?? j.status)} /> : null}
        </GarageHero>
      }
    >
      {error && !j ? <ErrorState text={error === EXPIRED ? t(...SESSION_EXPIRED) : error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!j && !error ? <SkeletonBlock height={Math.round(height * 0.5)} radius={gShape.card} /> : null}
      {j ? (
        <View style={{ gap: 12 }}>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error === EXPIRED ? t(...SESSION_EXPIRED) : error}</Note> : null}
          {notReaching ? <Note tone="danger" icon="cloud-offline-outline">{t("Your location isn't reaching the customer", "موقعك لا يصل إلى الزبون")}</Note> : null}
          {locProblem ? <Note tone="danger" icon="location-outline">{locProblem}</Note> : null}
          {weak && !locProblem ? <Note tone="warning" icon="cellular-outline">{t("GPS signal is weak: the customer may see your position late. Move to an open area.", "إشارة GPS ضعيفة: قد يرى الزبون موقعك متأخرًا. انتقل إلى مكان مكشوف.")}</Note> : null}
          {locProblem && canOpenSettings ? <GButton variant="secondary" icon="settings-outline" label={t("Open Settings", "فتح الإعدادات")} onPress={() => void openSettings()} /> : null}
          {working && me ? <Note icon="radio-outline">{t("Sharing your location with the customer and your company while this screen is open.", "تتم مشاركة موقعك مع الزبون وشركتك أثناء فتح هذه الشاشة.")}</Note> : null}

          <OrderMap orderId={`tow:${j.id}`} height={Math.round(height * 0.5)} delivery={target} shop={null} courier={null} me={me} meFresh={meFresh} />

          {j.status === "REQUESTED" ? (
            <View style={[row, { gap: 10 }]}>
              <GButton flex variant="secondary" label={t("Decline", "رفض")} disabled={!!busy} onPress={() => setStop("decline")} />
              <GButton flex icon="checkmark" label={t("Accept", "قبول")} busy={busy === "accept"} disabled={!!busy} onPress={() => void act("accept", () => driverApi.accept(id))} />
            </View>
          ) : null}
          {next ? (
            <View style={{ gap: 8 }}>
              <GButton
                icon={confirm === next.key ? "checkmark-done" : "arrow-forward"}
                label={confirm === next.key ? t(`Tap again to confirm: ${next.label}`, `اضغط مرة أخرى للتأكيد: ${next.label}`) : next.label}
                busy={busy === next.key}
                disabled={!!busy}
                onPress={() => (confirm === next.key ? void step(next.key).then(() => setConfirm(null)) : setConfirm(next.key))}
                style={{ minHeight: 60 }}
              />
              {confirm === next.key ? <GButton variant="ghost" label={t("Not yet", "ليس الآن")} onPress={() => setConfirm(null)} /> : null}
            </View>
          ) : null}

          <Card pad={12}>
            <ListRow icon="person-outline" title={j.customer.firstName} sub={problem[j.problemType]} end={undefined} />
            {["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(j.status) ? <ListRow divider icon="chatbubble-ellipses-outline" title={t("Chat with the customer", "محادثة الزبون")} sub={t("Messages stay inside MOTEXA", "تبقى الرسائل داخل موتكسا")} onPress={() => router.push({ pathname: "/driver/job/chat", params: { id: j.id } })} /> : null}
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
