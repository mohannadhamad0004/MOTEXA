// The driver's home = Dashboard (docs/guide/10-ui-system.md): the Mo hero (name, company, the ONE action = the Online switch), the
// jobs that need him (new ones to answer, the active one), his truck, recent jobs, appearance and Log out. Refreshed every 15 s.
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { HeroLayout, Note, Section, type Tone } from "../../components/garage";
import { ManageRow } from "../../components/manage/ManagePage";
import { Block, Facts, LogOut, Page } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { towTone } from "../../features/requests/garageBits";
import { fmtDateTime, useTowStatusLabels } from "../../features/requests/requestBits";
import { AppearanceSection } from "../../features/providerhub/AppearanceSection";
import { TowJob, driverApi } from "../../features/tow/dispatchService";
import { useTruckLabels } from "../../features/tow/truckBits";

const WAITING = ["REQUESTED"];
const ACTIVE = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];

export default function DriverHome() {
  const { t } = useL();
  const L = useTowStatusLabels();
  const { type } = useTruckLabels();
  const state = useLoad(() => driverApi.me(), [], 15_000);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const d = state.data?.driver;
  const toggle = async () => {
    if (!d || busy) return;
    setBusy(true); setError(null);
    try { await driverApi.setOffline(!d.offline); await state.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const statusTone: Record<string, Tone> = { FREE: "success", BUSY: "accent", OFFLINE: "neutral", NO_TRUCK: "warning", UNAPPROVED: "warning" };
  const statusLabel: Record<string, string> = { FREE: t("Free", "متاح"), BUSY: t("Busy", "مشغول"), OFFLINE: t("Offline", "غير متصل"), NO_TRUCK: t("No truck ready", "لا شاحنة جاهزة"), UNAPPROVED: t("Licence not approved", "الرخصة غير معتمدة") };
  const jobs = state.data?.jobs ?? [];
  const now = jobs.filter((j) => WAITING.includes(j.status) || ACTIVE.includes(j.status)).sort((a, b) => Number(ACTIVE.includes(b.status)) - Number(ACTIVE.includes(a.status)));
  const past = jobs.filter((j) => !WAITING.includes(j.status) && !ACTIVE.includes(j.status));
  const row = (j: TowJob) => <ManageRow key={j.id} title={`${j.customer.firstName} · ${j.vehicle.make} ${j.vehicle.model}`} sub={`${j.pickupAddress} · ${fmtDateTime(j.updatedAt)}`}
    status={{ label: j.status === "EN_ROUTE" && j.arrivedAt ? L.ARRIVED : L[j.status], tone: towTone(j.status) }} onPress={() => router.push({ pathname: "/driver/job/[id]", params: { id: j.id } })} />;
  return (
    <Page title={d?.name ?? t("My jobs", "مهامي")} back={false} onRefresh={() => void state.reload()} refreshing={false}
      hero={<HeroLayout config={{
        tab: "tow", title: d?.name ?? t("My jobs", "مهامي"), line: d ? [d.company, statusLabel[d.status]].filter(Boolean).join(" · ") : undefined,
        top: { label: t("Driver", "السائق"), actions: [] },
        action: d ? { kind: "toggle", label: d.offline ? t("Go online", "اتصل الآن") : t("Online", "متصل"), icon: "radio-outline", on: !d.offline, busy, onPress: () => void toggle() } : undefined,
      }} />}>
      {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
      {state.error && !d ? <Note tone="danger" icon="alert-circle-outline">{state.error}</Note> : null}
      {d?.approval && d.approval !== "APPROVED" ? (
        <Note tone={d.approval === "PENDING" ? "warning" : "danger"} icon="shield-checkmark-outline">
          {d.approval === "PENDING"
            ? t("Your licence is waiting for MOTEXA's review. You cannot go free or take jobs until it is approved.", "رخصتك بانتظار مراجعة موتكسا. لا يمكنك أن تصبح متاحًا أو تستلم مهام قبل الموافقة.")
            : `${d.approval === "REJECTED" ? t("Your licence was rejected", "تم رفض رخصتك") : t("You were suspended", "تم إيقافك")}${d.approvalReason ? `: ${d.approvalReason}` : ""}. ${t("Talk to your company.", "تحدث مع شركتك.")}`}
        </Note>
      ) : null}
      <Section title={t("Needs you now", "بحاجة إليك الآن")}>
        {now.length ? <View>{now.map(row)}</View> : d ? <Note tone="success" icon="checkmark-circle-outline">{t("No new or active job.", "لا توجد مهمة جديدة أو حالية.")}</Note> : null}
      </Section>
      {d ? (
        <Block title={t("My truck", "شاحنتي")}>
          <Facts rows={[[t("Status", "الحالة"), statusLabel[d.status]], [t("Truck", "الشاحنة"), d.truck ? `${type[d.truck.type]} · ${d.truck.make} ${d.truck.model}` : t("No truck linked: ask your company to link one", "لا توجد شاحنة مرتبطة: اطلب من شركتك ربط شاحنة")],
            [t("Plate", "اللوحة"), d.truck?.plate]]} />
        </Block>
      ) : null}
      {past.length ? <Section title={t("Recent", "الأخيرة")}><View>{past.map(row)}</View></Section> : null}
      <AppearanceSection />
      <LogOut />
    </Page>
  );
}
