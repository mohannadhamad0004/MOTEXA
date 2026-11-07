import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Card, Chip, ErrorState, Field, GarageHero, GaragePage, GButton, GText, ListRow, Note, Section, SkeletonBlock, StatusChip, Timeline } from "../../../components/garage";
import { cityCentre } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { catalogService } from "../../../features/catalog/catalogService";
import { REFRESH_MS } from "../../../features/mechanics/mechanicsService";
import { shortId } from "../../../features/requests/activeRequest";
import { toSteps, towTone } from "../../../features/requests/garageBits";
import { buildTimeline, towHeadline, useProblemLabels, useTowStatusLabels } from "../../../features/requests/requestBits";
import { TowStatus, customerTowRequests } from "../../../features/requests/requestsService";
import { WhileYouWait } from "../../../features/requests/WhileYouWait";
import { RequestRouteMap } from "../../../features/shared/RequestRouteMap";
import { MAPS_AVAILABLE } from "../../../features/shared/maps";
import { RouteSummary, useRoute } from "../../../features/shared/useRoute";
import { useTruckLabels } from "../../../features/tow/truckBits";
import { customerAfter } from "../../../features/tow/dispatchService";
import { CompanyLine, DriverCard } from "../../../features/tow/DriverCard";
import { fmtDateTime } from "../../../features/requests/requestBits";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

// The status bar. The server gives `stage` (ON_THE_WAY / ARRIVED / LOADING / TOWING / DELIVERED, else the status itself).
const STAGES = ["REQUESTED", "ACCEPTED", "ON_THE_WAY", "ARRIVED", "LOADING", "TOWING", "DELIVERED", "COMPLETED"] as const;
const OPEN: TowStatus[] = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];
/** The driver's point is "delayed" when it is older than this. */
const DELAYED_S = 60;

export default function TowRequestStatus() {
  const { row, align } = useGarageTheme();
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { t } = useL();
  const { type } = useTruckLabels();
  const problem = useProblemLabels();
  const statusLabel = useTowStatusLabels();
  // The server is re-read every 10 s while this screen is focused (the truck's live point); same keys, so the status and the map
  // change in place (no remount).
  const state = useLoad(() => customerTowRequests.get(id), [id], Math.min(REFRESH_MS, 5_000));
  const stageLabel: Record<string, string> = {
    REQUESTED: t("Requested", "تم الطلب"), ACCEPTED: t("Accepted", "تم القبول"), ON_THE_WAY: t("Driver on the way", "السائق في الطريق"), ARRIVED: t("Arrived", "وصل"),
    LOADING: t("Loading", "التحميل"), TOWING: t("Towing", "جارٍ السحب"), DELIVERED: t("Delivered", "تم التسليم"), COMPLETED: t("Completed", "مكتمل"),
  };
  // one tick a second while a live point is shown, for "Last updated N s ago"
  const [now, setNow] = useState(Date.now());
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [reporting, setReporting] = useState(false);
  const [report, setReport] = useState("");
  const [sentReport, setSentReport] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mapChoice, setMapOpen] = useState<boolean | null>(null);

  const cancel = async () => {
    setBusy(true);
    setErr(null);
    try {
      await customerTowRequests.cancel(id, reason.trim());
      setCancelling(false);
      state.reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const r = state.data;
  const hasLive = !!r?.driver?.live && ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(r.status);
  useEffect(() => {
    if (!hasLive) return;
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [hasLive]);
  // the company base point (else its city centre) is the other end of the route
  const company = useLoad(() => (r ? catalogService.getTowCompany(r.company.id) : Promise.resolve(null)), [r?.company.id]);
  const co = company.data?.company;
  const base = co ? (co.baseLat !== null && co.baseLng !== null ? { lat: co.baseLat, lng: co.baseLng } : cityCentre(co.city)) : null;
  // once a driver works on it: the truck's live point (route from the truck), else the company base
  const live = r?.driver?.live ?? null;
  const ageS = live ? Math.max(0, Math.round((now - new Date(live.at).getTime()) / 1000)) : null;
  const delayed = ageS !== null && ageS > DELAYED_S;
  // The assigned driver's point is from the authorized live-tracking response; company base coordinates are already public-rounded by the API.
  const provider = live ? { lat: live.lat, lng: live.lng } : base;
  // to the customer first; once towing, the route goes to the destination
  const goal = r && r.status === "IN_PROGRESS" && r.dropoff ? r.dropoff : (r?.pickup ?? null);
  const { route, loading: routing } = useRoute(r?.id ? `tow:${r.id}:${goal === r?.dropoff ? "d" : "p"}` : null, goal, provider, 50);
  // the map opens by itself while the truck is live; the customer can still hide it
  const mapOpen = mapChoice ?? !!live;
  const canMap = MAPS_AVAILABLE && !!r?.pickup && !!provider;

  return (
    <GaragePage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      hero={
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/customer/requests"))}
          title={r ? towHeadline(t, r.status, r.company.name) : t("Tow request", "طلب سحب")}
          line={r ? `${r.company.name} · ${r.company.city} · ${shortId(r.id)}` : shortId(id)}
        >
          {r ? <StatusChip tone={towTone(r.status)} label={statusLabel[r.status]} /> : null}
        </GarageHero>
      }
    >
      {state.error && !r ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !r ? (
        <SkeletonBlock height={240} radius={gShape.card} />
      ) : (
        <View>
          {created === "1" ? <Note tone="success" icon="checkmark-circle">{t("Request sent. You will see the answer here.", "تم إرسال الطلب. سترى الرد هنا.")}</Note> : null}
          {r.status === "REQUESTED" && r.offerExpiresAt ? (
            <Note icon="time-outline">
              {r.choiceMode === "NEAREST"
                ? t("Waiting for the nearest driver to accept. If he does not answer in time we offer it to the next one.", "بانتظار قبول أقرب سائق. إن لم يردّ في الوقت المناسب نعرضه على التالي.")
                : t("Waiting for a driver to accept. If nobody answers in time, you can choose another company or driver.", "بانتظار قبول سائق. إن لم يرد أحد في الوقت المناسب يمكنك اختيار شركة أو سائق آخر.")}
            </Note>
          ) : null}
          {r.timedOut ? (
            <View style={{ gap: 10 }}>
              <Note tone="danger" icon="time-outline">{t("Nobody accepted in time.", "لم يقبل أحد في الوقت المناسب.")}</Note>
              <GButton icon="navigate-outline" label={t("Try Nearest available", "جرّب الأقرب المتاح")} onPress={() => router.replace({ pathname: "/customer/towrequest/new", params: { mode: "NEAREST" } })} />
              <GButton variant="secondary" icon="business-outline" label={t("Choose another company", "اختر شركة أخرى")} onPress={() => router.replace("/customer/tow")} />
              <GButton variant="secondary" icon="person-outline" label={t("Choose another driver", "اختر سائقًا آخر")} onPress={() => router.replace("/customer/tow/drivers")} />
            </View>
          ) : null}
          {r.status === "DECLINED" && r.declineReason ? <Note tone="danger" icon="close-circle-outline">{`${t("Declined by the company", "رفضته الشركة")}\n${r.declineReason}`}</Note> : null}
          {r.status === "CANCELLED" && !r.timedOut ? (
            <Note tone="danger" icon="close-circle-outline">{`${r.cancelledBy === "COMPANY" ? t("Cancelled by the company", "ألغته الشركة") : r.cancelledBy === "ADMIN" ? t("Cancelled by MOTEXA", "ألغته موتكسا") : t("Cancelled by you", "ألغيته أنت")}${r.cancelReason ? `\n${r.cancelReason}` : ""}`}</Note>
          ) : null}

          {canMap ? (
            <Card pad={12}>
              <ListRow icon="map-outline" title={mapOpen ? t("Hide map", "إخفاء الخريطة") : t("View on map", "عرض على الخريطة")} onPress={() => setMapOpen(!mapOpen)} />
              {mapOpen ? (
                <View style={{ marginTop: 8, borderRadius: gShape.small, overflow: "hidden" }}>
                  <RequestRouteMap reqId={r.id} kind="tow" height={280} provider={{ ...provider!, name: r.driver ? r.driver.name : r.company.name }} providerStale={delayed || !!live?.stale} pickup={goal!} route={route} />
                </View>
              ) : null}
              {live ? (
                <ListRow
                  divider
                  icon={delayed ? "alert-circle-outline" : "radio-outline"}
                  title={delayed ? t("Driver's location is delayed", "موقع السائق متأخر") : t("Live location", "الموقع المباشر")}
                  sub={t(`Last updated ${ageS}s ago`, `آخر تحديث قبل ${ageS} ث`)}
                />
              ) : null}
              <View style={{ paddingTop: 8 }}>
                <RouteSummary route={route} loading={routing} />
              </View>
            </Card>
          ) : null}

          <Section title={t("Status", "الحالة")}>
            <Card>
              <Timeline
                steps={
                  r.status === "DECLINED" || r.status === "CANCELLED"
                    ? [{ label: r.status === "DECLINED" ? t("Declined", "مرفوض") : t("Cancelled", "ملغى"), state: "failed" as const, at: fmtDateTime(r.updatedAt) }]
                    : STAGES.map((k, i) => {
                        const cur = STAGES.indexOf((r.stage ?? r.status) as (typeof STAGES)[number]);
                        const at = r.timeline.find((x) => x.status === (k === "ON_THE_WAY" ? "EN_ROUTE" : k === "TOWING" ? "IN_PROGRESS" : k))?.at ?? (k === "ARRIVED" ? r.arrivedAt : k === "LOADING" ? r.loadingAt : k === "DELIVERED" ? r.deliveredAt : null);
                        return { label: stageLabel[k], at: at && i <= cur ? fmtDateTime(at) : undefined, state: i < cur || (r.status === "COMPLETED" && i <= cur) ? ("done" as const) : i === cur ? ("current" as const) : ("todo" as const) };
                      })
                }
              />
              {OPEN.includes(r.status) ? <GText soft style={[gType.tiny, align, { marginTop: 12 }]}>{t("Updates automatically", "يتحدّث تلقائياً")}</GText> : null}
            </Card>
          </Section>

          {r.driver ? (
            <Section title={t("Your driver", "سائقك")}>
              <DriverCard d={r.driver} extra={route?.kind === "road" && route.minutes !== null && OPEN.includes(r.status) ? t(`About ${route.minutes} min to ${goal === r.dropoff ? "the destination" : "you"}`, `نحو ${route.minutes} د ${goal === r.dropoff ? "إلى الوجهة" : "إليك"}`) : null} />
              {r.canChat ? (
                <View style={{ marginTop: 10 }}>
                  <GButton icon="chatbubble-ellipses-outline" label={t("Chat with the driver", "محادثة السائق")} onPress={() => router.push({ pathname: "/customer/towrequest/chat", params: { id: r.id } })} />
                </View>
              ) : null}
            </Section>
          ) : (
            <Section title={t("Responsible company", "الشركة المسؤولة")}>
              <Card pad={12}>
                <CompanyLine company={r.company} />
              </Card>
              {r.status === "REQUESTED" ? <GText soft style={[gType.caption, align, { marginTop: 6 }]}>{t("A driver will be assigned as soon as the company or a driver accepts.", "سيُعيَّن سائق فور قبول الشركة أو أحد السائقين.")}</GText> : null}
            </Section>
          )}

          {r.status === "COMPLETED" ? (
            <Section title={t("Summary", "الملخص")}>
              <Card pad={12}>
                {r.driver ? <ListRow icon="person-outline" title={r.driver.name} sub={`${r.company.name}${r.truck ? ` · ${type[r.truck.type]}` : ""}`} /> : null}
                <ListRow divider icon="time-outline" title={t("Times", "الأوقات")} sub={[r.timeline.find((x) => x.status === "REQUESTED"), r.timeline.find((x) => x.status === "COMPLETED")].filter(Boolean).map((x) => fmtDateTime(x!.at)).join(" → ")} />
                {r.distanceKm !== null ? <ListRow divider icon="speedometer-outline" title={t("Distance", "المسافة")} sub={t(`About ${r.distanceKm} km (straight line pickup to destination)`, `نحو ${r.distanceKm} كم (خط مستقيم من الاستلام إلى الوجهة)`)} /> : null}
                <ListRow divider icon="cash-outline" title={t("Price", "السعر")} sub={t("Agreed directly with the company. MOTEXA does not set tow prices yet.", "يُتفق عليه مباشرة مع الشركة. لا تحدد موتكسا أسعار السحب بعد.")} />
              </Card>
            </Section>
          ) : null}
          {r.reviewed ? <Note tone="success" icon="star">{`${t("You rated this tow", "قيّمت هذا السحب")}: ${"★".repeat(r.reviewed.stars)}${r.reviewed.comment ? `\n${r.reviewed.comment}` : ""}`}</Note> : null}
          {r.canReview ? (
            <Section title={t("Rate your driver", "قيّم سائقك")}>
              <Card>
                <View style={[row, { gap: 6, marginBottom: 10 }]}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Chip key={n} label={"★".repeat(n)} on={stars === n} onPress={() => setStars(n)} />
                  ))}
                </View>
                <Field label={t("Comment (optional)", "تعليق (اختياري)")} value={comment} onChangeText={setComment} multiline maxLength={500} />
                <GButton label={t("Send rating", "إرسال التقييم")} disabled={!stars || busy} busy={busy} onPress={async () => {
                  setBusy(true);
                  setErr(null);
                  try {
                    await customerAfter.review(r.id, stars, comment.trim());
                    state.reload();
                  } catch (e: any) {
                    setErr(e.message);
                  } finally {
                    setBusy(false);
                  }
                }} />
              </Card>
            </Section>
          ) : null}
          {!["REQUESTED", "DECLINED"].includes(r.status) && r.driver ? (
            <View style={{ marginTop: 12 }}>
              {sentReport ? (
                <Note tone="success" icon="checkmark-circle">{t("Thank you. The MOTEXA team will look at your report.", "شكرًا لك. سيراجع فريق موتكسا بلاغك.")}</Note>
              ) : !reporting ? (
                <GButton variant="ghost" icon="flag-outline" label={t("Report a problem", "الإبلاغ عن مشكلة")} onPress={() => setReporting(true)} />
              ) : (
                <Card>
                  <Field label={t("What went wrong?", "ما المشكلة؟")} value={report} onChangeText={setReport} multiline maxLength={1000} />
                  <View style={[row, { gap: 10 }]}>
                    <GButton flex variant="secondary" label={t("Back", "رجوع")} onPress={() => setReporting(false)} />
                    <GButton flex label={t("Send report", "إرسال البلاغ")} disabled={report.trim().length < 5 || busy} busy={busy} onPress={async () => {
                      setBusy(true);
                      setErr(null);
                      try {
                        await customerAfter.report(r.id, report.trim());
                        setSentReport(true);
                      } catch (e: any) {
                        setErr(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }} />
                  </View>
                </Card>
              )}
            </View>
          ) : null}

          {(["REQUESTED", "ACCEPTED", "EN_ROUTE"] as TowStatus[]).includes(r.status) ? <WhileYouWait /> : null}

          <Section title={t("Details", "التفاصيل")}>
            <Card pad={12}>
              <ListRow icon="location-outline" title={t("Pickup", "الاستلام")} sub={r.pickupAddress} />
              <ListRow divider icon="flag-outline" title={t("Destination", "الوجهة")} sub={r.dropoffAddress} />
              <ListRow divider icon="alert-circle-outline" title={t("Problem", "المشكلة")} sub={problem[r.problemType]} />
              <ListRow divider icon="car-sport-outline" title={t("Car", "السيارة")} sub={[r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")} />
              {r.truck ? <ListRow divider icon="car-outline" title={t("Assigned truck", "الشاحنة المعيّنة")} sub={[type[r.truck.type], r.truck.make, r.truck.model, r.truck.year].filter(Boolean).join(" ")} /> : null}
              {r.notes ? <ListRow divider icon="document-text-outline" title={t("Notes", "ملاحظات")} sub={r.notes} /> : null}
            </Card>
          </Section>

          {err ? <View style={{ marginTop: 12 }}><Note tone="danger" icon="alert-circle-outline">{err}</Note></View> : null}
          {r.canCancel ? (
            <View style={{ marginTop: 24 }}>
              {!cancelling ? (
                <GButton variant="danger" label={t("Cancel request", "إلغاء الطلب")} disabled={busy} onPress={() => setCancelling(true)} />
              ) : (
                <Card>
                  {r.cancelWarning ? <Note tone="warning" icon="alert-circle-outline">{t("Your driver is already on the way. Cancelling now tells the company and the driver. Please give a reason.", "سائقك في الطريق بالفعل. الإلغاء الآن يُبلغ الشركة والسائق. يرجى ذكر السبب.")}</Note> : null}
                  <Field label={r.cancelWarning ? t("Reason", "السبب") : t("Reason (optional)", "السبب (اختياري)")} value={reason} onChangeText={setReason} multiline maxLength={300} />
                  <View style={[row, { gap: 10 }]}>
                    <GButton flex variant="secondary" label={t("Keep the request", "إبقاء الطلب")} disabled={busy} onPress={() => setCancelling(false)} />
                    <GButton flex variant="danger" label={t("Confirm cancellation", "تأكيد الإلغاء")} busy={busy} disabled={r.cancelWarning && !reason.trim()} onPress={cancel} />
                  </View>
                </Card>
              )}
            </View>
          ) : null}
        </View>
      )}
    </GaragePage>
  );
}
