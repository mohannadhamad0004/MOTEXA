import { SESSION_EXPIRED } from "../../../core/session/sessionExpiry";
const EXPIRED = "SESSION_EXPIRED";
import { jobAfterLocationError } from "../../../features/shared/locationPolicy";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { GButton, Note, StatusChip, Timeline } from "../../../components/garage";
import type { ItemAction } from "../../../components/ItemActionsMenu";
import { StepFooter } from "../../../components/manage/Form";
import { ManageEntry } from "../../../components/manage/ManagePage";
import { Block, Facts, Page } from "../../../components/manage/Page";
import { ErrorState, SkeletonBlock } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { OrderMap, useShareLocation } from "../../../features/orders/orderBits";
import { towTone } from "../../../features/requests/garageBits";
import { fmtDateTime, useProblemLabels, useTowStatusLabels } from "../../../features/requests/requestBits";
import { DriverStep, TowJob, driverApi, jobSteps } from "../../../features/tow/dispatchService";
import { gShape } from "../../../theme/garage";

/**
 * The driver's job = Detail (its steps as a step flow): the map (the customer's pin, the destination once towing, his own live
 * position, the road route), the customer's first name + car + note, the timeline. ONE primary in the footer = the next step
 * (Accept -> On the way -> Arrived -> Loading -> Towing -> Delivered -> Completed), each confirmed with a second tap; Decline / Cancel
 * (reason required) are in ⋮. While the job is active and this screen is open his location is sent every ~10 s
 * (foreground only); it stops when the job ends or the screen closes.
 */
export default function DriverJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const L = useTowStatusLabels();
  const problem = useProblemLabels();
  const { height } = useWindowDimensions();
  const [j, setJ] = useState<TowJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
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
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const stageText = (k: string) => ({ ON_THE_WAY: t("On the way", "في الطريق"), ARRIVED: t("Arrived", "وصل"), LOADING: t("Loading", "التحميل"), TOWING: t("Towing", "جارٍ السحب"), DELIVERED: t("Delivered", "تم التسليم") } as Record<string, string>)[k] ?? L[k as keyof typeof L] ?? k;
  const step = (to: DriverStep) => act(to, () => driverApi.move(id, to));
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

  const actions: ItemAction[] = !j ? [] : [
    ...(j.status === "REQUESTED" ? [{ key: "decline", label: t("Decline", "رفض"), icon: "close-circle-outline" as const, destructive: true,
      confirm: { title: t("Decline this job?", "رفض هذه المهمة؟"), confirmLabel: t("Decline", "رفض"), reason: { label: t("Why do you decline? (your company sees this)", "لماذا ترفض؟ (تراه شركتك)"), required: true } },
      run: (why?: string) => driverApi.decline(id, why ?? "").then(() => router.replace("/driver" as never)) }] : []),
    ...(["ACCEPTED", "EN_ROUTE"].includes(j.status) ? [{ key: "cancel", label: t("Cancel job", "إلغاء المهمة"), icon: "close-circle-outline" as const, destructive: true,
      confirm: { title: t("Cancel this job?", "إلغاء هذه المهمة؟"), confirmLabel: t("Cancel job", "إلغاء المهمة"), reason: { label: t("Why do you cancel? (the customer sees this)", "لماذا تلغي؟ (يراه الزبون)"), required: true } },
      run: (why?: string) => driverApi.cancel(id, why ?? "").then(() => load()) }] : []),
    ...(locProblem && canOpenSettings ? [{ key: "settings", label: t("Open Settings", "فتح الإعدادات"), icon: "settings-outline" as const, run: () => void openSettings() }] : []),
  ];
  const footer = !j ? undefined : j.status === "REQUESTED"
    ? <GButton icon="checkmark" label={t("Accept", "قبول")} busy={busy === "accept"} disabled={!!busy} onPress={() => void act("accept", () => driverApi.accept(id))} />
    : next ? <StepFooter back={confirm === next.key ? { label: t("Not yet", "ليس الآن"), onPress: () => setConfirm(null) } : undefined}
        primary={{ icon: confirm === next.key ? "checkmark-done" : "arrow-forward", label: confirm === next.key ? t(`Tap again to confirm: ${next.label}`, `اضغط مرة أخرى للتأكيد: ${next.label}`) : next.label, busy: busy === next.key, disabled: !!busy,
          onPress: () => (confirm === next.key ? void step(next.key).then(() => setConfirm(null)) : setConfirm(next.key)) }} />
    : undefined;
  return (
    <Page title={j ? `${j.customer.firstName} · ${j.vehicle.make} ${j.vehicle.model}` : t("Job", "المهمة")} line={j ? (j.status === "IN_PROGRESS" ? j.dropoffAddress : j.pickupAddress) : undefined}
      actions={actions.length ? actions : undefined} onRefresh={load} refreshing={false} footer={footer}>
      {error && !j ? <ErrorState text={error === EXPIRED ? t(...SESSION_EXPIRED) : error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!j && !error ? <SkeletonBlock height={Math.round(height * 0.5)} radius={gShape.card} /> : null}
      {j ? (
        <>
          <View style={{ alignSelf: "flex-start" }}><StatusChip tone={towTone(j.status)} label={stageText(j.stage ?? j.status)} /></View>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error === EXPIRED ? t(...SESSION_EXPIRED) : error}</Note> : null}
          {notReaching ? <Note tone="danger" icon="cloud-offline-outline">{t("Your location isn't reaching the customer", "موقعك لا يصل إلى الزبون")}</Note> : null}
          {locProblem ? <Note tone="danger" icon="location-outline">{locProblem}</Note> : null}
          {weak && !locProblem ? <Note tone="warning" icon="cellular-outline">{t("GPS signal is weak: the customer may see your position late. Move to an open area.", "إشارة GPS ضعيفة: قد يرى الزبون موقعك متأخرًا. انتقل إلى مكان مكشوف.")}</Note> : null}
          {working && me ? <Note icon="radio-outline">{t("Sharing your location with the customer and your company while this screen is open.", "تتم مشاركة موقعك مع الزبون وشركتك أثناء فتح هذه الشاشة.")}</Note> : null}
          <OrderMap orderId={`tow:${j.id}`} height={Math.round(height * 0.5)} delivery={target} shop={null} courier={null} me={me} meFresh={meFresh} />
          {["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(j.status) ? <ManageEntry icon="chatbubble-ellipses-outline" title={t("Chat with the customer", "محادثة الزبون")} sub={t("Messages stay inside MOTEXA", "تبقى الرسائل داخل موتكسا")} onPress={() => router.push({ pathname: "/driver/job/chat", params: { id: j.id } })} /> : null}
          <Block title={t("Job", "المهمة")}>
            <Facts rows={[[t("Customer", "الزبون"), j.customer.firstName], [t("Problem", "المشكلة"), problem[j.problemType]], [t("Note", "ملاحظة"), j.notes], [t("Destination", "الوجهة"), j.dropoffAddress]]} />
          </Block>
          <Block title={t("Steps", "الخطوات")}>
            <View style={{ paddingVertical: 10 }}><Timeline steps={jobSteps(j, t).map(([label, at]) => ({ label, at: at ? fmtDateTime(at) : undefined, state: at ? "done" : "todo" }))} /></View>
          </Block>
        </>
      ) : null}
    </Page>
  );
}
