// /mechanic for a GARAGE mechanic (his garage added him; MOTEXA reviews his ID, there is no application to fill in) = Dashboard:
// Mo hero with the ONE action = the Online switch (only once approved), his requests waiting / active / done, his garage, appearance,
// Log out. While Online the role layout (OnDutySharing) sends his position about every 60 s, foreground only.
import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { HeroLayout, Note, Section, StatusChip } from "../../components/garage";
import { moHeroMedia } from "../../components/garage/MoHero";
import { showToast } from "../../components/ItemActionsMenu";
import { Block, Facts, Kpis, LogOut, NeedsRow, Page } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useSessionUser } from "../../core/session/session";
import { useStaffStatus } from "../garage/mechanics";
import { AppearanceSection } from "../providerhub/AppearanceSection";
import { setDutyOnline } from "../shared/onDuty";
import { useSkillLabel } from "./mechanicBits";
import { mechanicDuty, mechanicInbox, type Duty } from "./mechanicsService";

const go = (p: string) => router.push(p as Href);
export const ACTIVE_JOB = ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"];

export function GarageMechanicHome({ duty, reload }: { duty: Duty; reload: () => Promise<unknown> }) {
  const { t, isArabic } = useL();
  const user = useSessionUser();
  const skill = useSkillLabel();
  const status = useStaffStatus()(duty);
  const inbox = useLoad(() => mechanicInbox.list(), [], 15_000);
  const rows = inbox.data ?? [];
  const n = { waiting: rows.filter((r) => r.status === "REQUESTED").length, active: rows.filter((r) => ACTIVE_JOB.includes(r.status)).length, done: rows.filter((r) => r.status === "COMPLETED").length };
  const approved = duty.approval === "APPROVED";
  const online = approved && !duty.offline;
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try { await mechanicDuty.setOffline(online); setDutyOnline(!online); await reload(); }
    catch (e) { showToast((e as Error).message, "bad"); }
    finally { setBusy(false); }
  };
  const garage = isArabic && duty.garage.nameAr ? duty.garage.nameAr : duty.garage.name;
  return (
    <Page title={user.fullName} back={false} onRefresh={() => { void reload(); void inbox.reload(); }} refreshing={false}
      hero={<HeroLayout config={{
        tab: "mechanics", title: online ? t("You are Online", "أنت متصل") : t("You are Offline", "أنت غير متصل"), line: `${user.fullName} · ${garage}`,
        top: { label: t("Mechanic", "ميكانيكي"), actions: [] }, media: moHeroMedia("mechanic", t("Mo, the MOTEXA mascot", "مو، تميمة موتيكسا")),
        action: approved ? { kind: "toggle", on: online, icon: "radio-button-on-outline", label: online ? t("Online", "متصل") : t("Go Online", "اتصل الآن"), busy, onPress: () => void toggle() } : undefined,
      }} />}>
      {!approved ? (
        <Note tone={duty.approval === "PENDING" ? "warning" : "danger"} icon={duty.approval === "PENDING" ? "time-outline" : "close-circle-outline"}>
          {duty.approval === "PENDING"
            ? (duty.approvalReason ? `${t("MOTEXA asked your garage for a change", "طلبت موتكسا من كراجك تعديلًا")}: ${duty.approvalReason}` : t("MOTEXA is checking your ID. You can go Online and get jobs once it is approved.", "تتحقق موتكسا من هويتك. يمكنك الاتصال واستلام المهام بعد الاعتماد."))
            : [status.label, duty.approvalReason].filter(Boolean).join(": ")}
        </Note>
      ) : (
        <Note icon={online ? "navigate-outline" : "moon-outline"}>
          {online
            ? t("While Online, your garage and MOTEXA see your position (about every minute, only while this app is open). Go Offline to stop sharing.", "أثناء الاتصال يرى كراجك وموتكسا موقعك (كل دقيقة تقريبًا، فقط أثناء فتح التطبيق). اقطع الاتصال لإيقاف المشاركة.")
            : t("Offline: your garage gives you no new jobs and your position is not shared.", "غير متصل: لا يُسند إليك كراجك مهامًا جديدة ولا يُشارك موقعك.")}
        </Note>
      )}
      <Section title={t("Needs you now", "بحاجة إليك الآن")} style={{ marginTop: 0 }}>
        <View style={{ gap: 10 }}>
          {n.waiting ? <NeedsRow icon="construct-outline" title={t("New jobs waiting for your answer", "مهام جديدة بانتظار ردّك")} count={n.waiting} onPress={() => go("/mechanic/requests?filter=new")} /> : null}
          {n.active ? <NeedsRow icon="navigate-outline" title={t("Your active jobs", "مهامك الجارية")} count={n.active} onPress={() => go("/mechanic/requests?filter=active")} /> : null}
          {inbox.data && !n.waiting && !n.active ? <Note tone="success" icon="checkmark-circle-outline">{t("Nothing is waiting for you.", "لا شيء بانتظارك.")}</Note> : null}
          <Kpis items={[
            { label: t("Waiting for you", "بانتظارك"), value: inbox.data ? n.waiting : null, icon: "time-outline", onPress: () => go("/mechanic/requests?filter=new") },
            { label: t("Active jobs", "أعمال نشطة"), value: inbox.data ? n.active : null, icon: "construct-outline", onPress: () => go("/mechanic/requests?filter=active") },
            { label: t("Completed jobs", "أعمال مكتملة"), value: inbox.data ? n.done : null, icon: "flag-outline", onPress: () => go("/mechanic/requests?filter=past") },
          ]} />
        </View>
      </Section>
      <Block title={t("Your garage", "كراجك")} action={<StatusChip {...status} />}>
        <Facts rows={[[t("Garage", "الكراج"), garage], [t("Skills", "المهارات"), duty.skills.map(skill).join(", ")]]} />
      </Block>
      <AppearanceSection />
      <LogOut />
    </Page>
  );
}
