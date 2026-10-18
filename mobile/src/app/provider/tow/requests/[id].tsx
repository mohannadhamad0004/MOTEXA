import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { MAPS_AVAILABLE, TripMap } from "../../../../features/shared/maps";
import { mapsDirectionsUrl } from "../../../../features/shared/geo";
import { Timeline, TowStatusBadge, useProblemLabels } from "../../../../features/requests/requestBits";
import { CompanyTowRequest, companyTowRequests } from "../../../../features/requests/requestsService";
import { C } from "../../../../features/shared/palette";
import { asActor, useSessionUser } from "../../../../features/shared/session";
import { Async, Button, Card, Header, KV, Notice, ReasonPanel, Screen, Section, useL, useLoad } from "../../../../features/shared/ui";
import { towFleetService } from "../../../../features/tow/towService";
import { useTruckLabels } from "../../../../features/tow/truckBits";

const NEXT = {
  ACCEPTED: { to: "EN_ROUTE", en: "Start: on the way", ar: "بدء: في الطريق", icon: "navigate-outline" },
  EN_ROUTE: { to: "IN_PROGRESS", en: "Arrived: in progress", ar: "وصلت: قيد التنفيذ", icon: "construct-outline" },
  IN_PROGRESS: { to: "COMPLETED", en: "Mark completed", ar: "تحديد كمكتمل", icon: "flag-outline" },
} as const;

type Mode = "none" | "pick" | "decline" | "cancel";

export default function CompanyRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t, row, align } = useL();
  const { type } = useTruckLabels();
  const problem = useProblemLabels();
  const state = useLoad(() => companyTowRequests.get(id), [id]);
  const fleet = useLoad(() => towFleetService.getMyFleet(asActor(user)), [user.id]);
  const [mode, setMode] = useState<Mode>("none");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const act = async (fn: () => Promise<CompanyTowRequest>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setMode("none");
      setPickedId(null);
      state.reload();
      fleet.reload(); // a truck's availability changes with the job
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header brand="MOTEXA TOW" title={t("Tow request", "طلب سحب")} back />
      <Async state={state}>
        {(r) => {
          const available = (fleet.data?.trucks ?? []).filter((x) => x.verification === "APPROVED" && x.operational === "AVAILABLE");
          const next = NEXT[r.status as keyof typeof NEXT];
          return (
            <>
              <Card>
                <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={[{ color: C.text, fontSize: 16, fontWeight: "800" }, align]}>{r.customerName}</Text>
                  </View>
                  <TowStatusBadge value={r.status} />
                </View>
              </Card>

              {r.status === "DECLINED" && r.declineReason ? <Notice tone="danger" icon="close-circle-outline">{`${t("Declined", "مرفوض")}\n${r.declineReason}`}</Notice> : null}
              {r.status === "CANCELLED" ? (
                <Notice tone="danger" icon="close-circle-outline">
                  {r.cancelledBy === "COMPANY" ? t("Cancelled by your company", "ألغتها شركتك") : t("Cancelled by the customer", "ألغاها العميل")}
                  {r.cancelReason ? `\n${r.cancelReason}` : ""}
                </Notice>
              ) : null}

              {r.pickup ? (
                <>
                  <Section title={t("Map", "الخريطة")} />
                  {MAPS_AVAILABLE ? <TripMap pickup={r.pickup} dropoff={r.dropoff} height={190} /> : null}
                  <View style={{ gap: 8, marginBottom: 6 }}>
                    <Button variant="ghost" icon="navigate-outline" label={t("Open pickup in Google Maps", "افتح نقطة الاستلام في خرائط جوجل")} onPress={() => Linking.openURL(mapsDirectionsUrl(r.pickup!))} />
                    {r.dropoff ? <Button variant="ghost" icon="flag-outline" label={t("Open destination in Google Maps", "افتح الوجهة في خرائط جوجل")} onPress={() => Linking.openURL(mapsDirectionsUrl(r.dropoff!))} /> : null}
                  </View>
                </>
              ) : null}

              <Section title={t("Trip", "الرحلة")} />
              <Card>
                <KV k={t("Pickup", "الاستلام")} v={r.pickupAddress} />
                <KV k={t("Destination", "الوجهة")} v={r.dropoffAddress} />
                <KV k={t("Car", "السيارة")} v={[r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")} />
                <KV k={t("Problem", "المشكلة")} v={problem[r.problemType]} />
                <KV k={t("Contact phone", "هاتف التواصل")} v={r.contactPhone} />
                {r.notes ? <KV k={t("Notes", "ملاحظات")} v={r.notes} /> : null}
              </Card>

              {r.truck && (
                <>
                  <Section title={t("Assigned truck", "الشاحنة المعيّنة")} />
                  <Card>
                    <KV k={t("Type", "النوع")} v={type[r.truck.type]} />
                    <KV k={t("Vehicle", "المركبة")} v={[r.truck.make, r.truck.model, r.truck.year].filter(Boolean).join(" ")} />
                    {r.truck.plateNumber ? <KV k={t("Plate", "اللوحة")} v={r.truck.plateNumber} /> : null}
                  </Card>
                </>
              )}

              <Section title={t("Status", "الحالة")} />
              <Timeline items={r.timeline} />

              {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}

              {r.status === "REQUESTED" && mode === "none" && (
                <View style={{ gap: 8 }}>
                  <Button icon="checkmark-circle-outline" label={t("Accept", "قبول")} disabled={busy} onPress={() => setMode("pick")} />
                  <Button variant="danger" label={t("Decline", "رفض")} disabled={busy} onPress={() => setMode("decline")} />
                </View>
              )}
              {r.status === "REQUESTED" && mode === "pick" && (
                <Card>
                  <Text style={[{ color: C.text, fontSize: 14, fontWeight: "800", marginBottom: 10 }, align]}>{t("Choose a truck", "اختر شاحنة")}</Text>
                  {!available.length ? (
                    <Notice icon="alert-circle-outline">{t("You have no approved, available truck. Set one available first.", "لا توجد لديك شاحنة معتمدة ومتاحة. اجعل إحداها متاحة أولًا.")}</Notice>
                  ) : (
                    available.map((tr) => (
                      <View key={tr.id} style={{ marginBottom: 8 }}>
                        <Button
                          variant={pickedId === tr.id ? "primary" : "ghost"}
                          icon={pickedId === tr.id ? "radio-button-on" : "radio-button-off"}
                          label={`${type[tr.type]} · ${tr.make} ${tr.model} · ${tr.plate}`}
                          onPress={() => setPickedId(tr.id)}
                        />
                      </View>
                    ))
                  )}
                  <View style={{ gap: 8, marginTop: 6 }}>
                    <Button label={t("Confirm and accept", "تأكيد والقبول")} disabled={busy || !pickedId} onPress={() => act(() => companyTowRequests.accept(r.id, pickedId!))} />
                    <Button variant="ghost" label={t("Back", "رجوع")} onPress={() => { setMode("none"); setPickedId(null); }} />
                  </View>
                </Card>
              )}
              {r.status === "REQUESTED" && mode === "decline" && (
                <ReasonPanel
                  title={t("Reason for declining (required)", "سبب الرفض (مطلوب)")}
                  confirmLabel={t("Confirm decline", "تأكيد الرفض")}
                  onCancel={() => setMode("none")}
                  onConfirm={(reason) => act(() => companyTowRequests.decline(r.id, reason))}
                />
              )}

              {next && mode !== "cancel" && (
                <View style={{ gap: 8 }}>
                  <Button icon={next.icon} label={t(next.en, next.ar)} disabled={busy} onPress={() => act(() => companyTowRequests.setStatus(r.id, next.to))} />
                  {r.status === "ACCEPTED" && <Button variant="danger" label={t("Cancel this job", "إلغاء هذه المهمة")} disabled={busy} onPress={() => setMode("cancel")} />}
                </View>
              )}
              {r.status === "ACCEPTED" && mode === "cancel" && (
                <ReasonPanel
                  title={t("Reason for cancelling (required)", "سبب الإلغاء (مطلوب)")}
                  confirmLabel={t("Confirm cancellation", "تأكيد الإلغاء")}
                  onCancel={() => setMode("none")}
                  onConfirm={(reason) => act(() => companyTowRequests.cancel(r.id, reason))}
                />
              )}
            </>
          );
        }}
      </Async>
    </Screen>
  );
}
