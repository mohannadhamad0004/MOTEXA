// Garage owner: Home (Dashboard), Profile (entry rows), Garage info (Form) and the Live map (a Detail whose body is the map).
// Every number comes from GET /garage/me; a Needs-you row whose count is 0 is left out, a tile shows "—" until it is known.
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Chip, Field, GText, HeroLayout, Note, Section, Toggle } from "../../components/garage";
import { showToast } from "../../components/ItemActionsMenu";
import { StepFooter, useDiscardGuard } from "../../components/manage/Form";
import { ManageEntry } from "../../components/manage/ManagePage";
import { Block, Kpis, Loaded, LogOut, NeedsRow, Page } from "../../components/manage/Page";
import { cityLabel } from "../../core/constants/cities";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gType, useGarageTheme } from "../../theme/garage";
import { MechanicLiveMap } from "../mechanics/MechanicLiveMap";
import { useSkillLabel } from "../mechanics/mechanicBits";
import { MECHANIC_SKILLS, garageOwner } from "../mechanics/mechanicsService";
import { onboarding } from "../provider/api";
import { AppearanceSection } from "../providerhub/AppearanceSection";
import { MiniMap } from "../shared/MiniMap";
import { MAPS_AVAILABLE } from "../shared/maps";

const go = (p: string) => router.push(p as Href);

export function GarageHome() {
  const { t, isArabic } = useL();
  const state = useLoad(() => garageOwner.me(), [], 15_000);
  const msgs = useLoad(() => onboarding.messages().then((r) => r.unread).catch(() => 0), [], 30_000);
  const d = state.data, c = d?.counts;
  const name = d ? (isArabic && d.garage.nameAr ? d.garage.nameAr : d.garage.name) : t("Garage", "الكراج");
  const needs = [
    c?.toAssign ? { icon: "person-add-outline" as const, title: t("Requests to assign", "طلبات للإسناد"), count: c.toAssign, to: "/garage/requests?filter=assign" } : null,
    c?.activeJobs ? { icon: "navigate-outline" as const, title: t("Active jobs", "مهام جارية"), count: c.activeJobs, to: "/garage/requests?filter=active" } : null,
    msgs.data ? { icon: "chatbubbles-outline" as const, title: t("New messages from MOTEXA", "رسائل جديدة من موتكسا"), count: msgs.data, to: "/garage/messages" } : null,
  ].filter((n): n is NonNullable<typeof n> => !!n);
  return (
    <Page title={name} back={false} tabBar onRefresh={() => { void state.reload(); void msgs.reload(); }} refreshing={false}
      hero={<HeroLayout config={{
        tab: "mechanics",
        title: name,
        line: c ? t(`${c.free} free · ${c.busy} busy · ${c.offline} offline`, `${c.free} متاح · ${c.busy} مشغول · ${c.offline} غير متصل`) : undefined,
        top: { label: t("Garage", "الكراج"), actions: [] },
        action: c?.toAssign
          ? { kind: "button", label: t("Assign requests", "إسناد الطلبات"), icon: "person-add-outline", onPress: () => go("/garage/requests?filter=assign") }
          : { kind: "button", label: t("Live map", "الخريطة المباشرة"), icon: "map-outline", onPress: () => go("/garage/live") },
      }} />}>
      <Section title={t("Needs you now", "بحاجة إليك الآن")}>
        <View style={{ gap: 8 }}>
          {needs.map((n) => <NeedsRow key={n.to} icon={n.icon} title={n.title} count={n.count} onPress={() => go(n.to)} />)}
          {c && msgs.data !== null && !needs.length ? <Note tone="success" icon="checkmark-circle-outline">{t("All good: nothing needs you right now.", "كل شيء على ما يرام: لا شيء يحتاجك الآن.")}</Note> : null}
          {c?.unapproved ? <Note icon="time-outline">{t(`${c.unapproved} of your mechanics ${c.unapproved === 1 ? "waits" : "wait"} for MOTEXA to approve the ID.`, `${c.unapproved} من ميكانيكييك بانتظار موافقة موتكسا على الهوية.`)}</Note> : null}
          {state.error && !d ? <Note tone="danger" icon="alert-circle-outline">{t("Could not load your numbers. Pull down to try again.", "تعذّر تحميل الأرقام. اسحب للأسفل للمحاولة مجددًا.")}</Note> : null}
        </View>
      </Section>
      <Kpis items={[
        { label: t("Mechanics", "الميكانيكيون"), value: c?.mechanics, icon: "people-outline", onPress: () => go("/garage/mechanics") },
        { label: t("Free now", "متاحون الآن"), value: c?.free, icon: "checkmark-circle-outline", onPress: () => go("/garage/mechanics?filter=FREE") },
        { label: t("On a job", "في مهمة"), value: c?.busy, icon: "construct-outline", onPress: () => go("/garage/mechanics?filter=BUSY") },
        { label: t("Active jobs", "مهام جارية"), value: c?.activeJobs, icon: "navigate-outline", onPress: () => go("/garage/requests?filter=active") },
      ]} />
      <Section title={t("Shortcuts", "اختصارات")}>
        <View style={{ gap: 8 }}>
          <ManageEntry icon="map-outline" title={t("Live map", "الخريطة المباشرة")} onPress={() => go("/garage/live")} />
          <ManageEntry icon="person-add-outline" title={t("Add a mechanic", "إضافة ميكانيكي")} onPress={() => go("/garage/mechanics?add=1")} />
          <ManageEntry icon="time-outline" title={t("History", "السجل")} onPress={() => go("/garage/requests?filter=history")} />
        </View>
      </Section>
    </Page>
  );
}

export function GarageProfile() {
  const { t, isArabic } = useL();
  const { align } = useGarageTheme();
  const skill = useSkillLabel();
  const state = useLoad(() => garageOwner.me(), []);
  const x = state.data?.garage;
  return (
    <Page title={x ? (isArabic && x.nameAr ? x.nameAr : x.name) : t("Profile", "الملف")} line={x ? cityLabel(x.city, isArabic) : undefined} back={false} tabBar onRefresh={() => void state.reload()} refreshing={false}>
      <Section title={t("Garage", "الكراج")}>
        <View style={{ gap: 8 }}>
          <ManageEntry icon="business-outline" title={t("Garage info", "معلومات الكراج")} sub={x ? [x.open24h ? t("Open 24/7", "مفتوح 24/7") : x.workingHours, x.services.map(skill).join(", ")].filter(Boolean).join(" · ") : undefined} onPress={() => go("/garage/info")} />
          <ManageEntry icon="map-outline" title={t("Live map", "الخريطة المباشرة")} onPress={() => go("/garage/live")} />
          <ManageEntry icon="time-outline" title={t("History", "السجل")} onPress={() => go("/garage/requests?filter=history")} />
        </View>
      </Section>
      <Section title={t("Location", "الموقع")}>
        <View style={{ gap: 8 }}>
          {x?.base && MAPS_AVAILABLE ? (
            <View style={{ borderRadius: 16, overflow: "hidden" }}>
              <MiniMap pins={[{ id: "me", name: x.name, lat: x.base.lat, lng: x.base.lng, kind: "mech", dim: false }]} me={null} height={150} fitKey={`${x.base.lat},${x.base.lng}`} onOpen={() => go("/garage/live")} label={t("Open the live map", "فتح الخريطة المباشرة")} />
            </View>
          ) : null}
          {x ? <GText soft style={[gType.caption, align]}>{[x.address, cityLabel(x.city, isArabic)].filter(Boolean).join(" · ")}</GText> : null}
          <GText soft style={[gType.tiny, align]}>{t("The map point was checked by MOTEXA. To move it, write to the MOTEXA team.", "راجعت موتكسا نقطة الخريطة. لتغييرها راسل فريق موتكسا.")}</GText>
        </View>
      </Section>
      <Section title={t("Documents", "المستندات")}>
        <ManageEntry icon="document-text-outline" title={t("Application and documents", "الطلب والمستندات")} sub={t("Private: only you and MOTEXA see them.", "خاصة: لا يراها إلا أنت وموتكسا.")} onPress={() => go("/provider/onboarding")} />
      </Section>
      <AppearanceSection />
      <LogOut />
    </Page>
  );
}

/** What customers read about the garage (description, hours, services). Name, phone, city and the map point are checked by MOTEXA. */
export function GarageInfo() {
  const { t } = useL();
  const { row, align } = useGarageTheme();
  const skill = useSkillLabel();
  const state = useLoad(() => garageOwner.me(), []);
  const x = state.data?.garage;
  const [f, setF] = useState<{ description: string; workingHours: string; open24h: boolean; services: string[] } | null>(null);
  useEffect(() => { if (x && !f) setF({ description: x.description ?? "", workingHours: x.open24h ? "" : x.workingHours ?? "", open24h: x.open24h, services: x.services }); }, [x, f]);
  const dirty = !!x && !!f && (f.description !== (x.description ?? "") || f.open24h !== x.open24h || (!f.open24h && f.workingHours !== (x.workingHours ?? "")) || f.services.join() !== x.services.join());
  useDiscardGuard(dirty);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!f) return;
    if (!f.services.length) return setErr(t("Choose at least one service.", "اختر خدمة واحدة على الأقل."));
    if (!f.open24h && !f.workingHours.trim()) return setErr(t("Enter your working hours, or choose Open 24/7.", "أدخل ساعات العمل أو اختر مفتوح 24/7."));
    setBusy(true); setErr(null);
    try {
      await garageOwner.update({ description: f.description, open24h: f.open24h, services: f.services, ...(f.open24h ? {} : { workingHours: f.workingHours }) });
      showToast(t("Saved.", "تم الحفظ."), "ok");
      setF(null);
      await state.reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Page title={t("Garage info", "معلومات الكراج")} line={x?.name} footer={f ? <StepFooter primary={{ label: t("Save", "حفظ"), icon: "checkmark", busy, disabled: busy || !dirty, onPress: () => void save() }} /> : undefined}>
      <Loaded state={state}>{() => f ? (
        <>
          <Block title={t("Services", "الخدمات")}>
            <View style={[row, { flexWrap: "wrap", gap: 8, paddingVertical: 10 }]}>
              {MECHANIC_SKILLS.map((k) => <Chip key={k} label={skill(k)} on={f.services.includes(k)} onPress={() => setF({ ...f, services: f.services.includes(k) ? f.services.filter((s) => s !== k) : [...f.services, k] })} />)}
            </View>
          </Block>
          <Block title={t("Working hours", "ساعات العمل")}>
            <View style={{ paddingVertical: 6 }}>
              <Toggle label={t("Open 24/7", "مفتوح 24/7")} value={f.open24h} onChange={(v) => setF({ ...f, open24h: v })} />
              {!f.open24h ? <Field label={t("Hours (for example Sat-Thu 08:00-18:00)", "الساعات (مثال: السبت-الخميس 08:00-18:00)")} value={f.workingHours} onChangeText={(v) => setF({ ...f, workingHours: v })} maxLength={100} /> : null}
            </View>
          </Block>
          <Block title={t("About your garage", "عن كراجك")}>
            <View style={{ paddingVertical: 6 }}>
              <Field label={t("Description (customers see it)", "الوصف (يراه الزبائن)")} value={f.description} onChangeText={(v) => setF({ ...f, description: v })} multiline maxLength={600} />
              <GText soft style={[gType.tiny, align]}>{`${f.description.length}/600`}</GText>
            </View>
          </Block>
          {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
          <Note icon="shield-checkmark-outline">{t("The name, phone, city and map point were checked by MOTEXA. To change them, write to the MOTEXA team.", "راجعت موتكسا الاسم والهاتف والمدينة ونقطة الخريطة. لتغييرها راسل فريق موتكسا.")}</Note>
        </>
      ) : null}</Loaded>
    </Page>
  );
}

/** The garage's online mechanics (latest point, shared only while Online) and its active jobs, every 10 s. */
export function GarageLive() {
  const { t } = useL();
  const state = useLoad(() => garageOwner.live(), [], 10_000);
  return (
    <Page title={t("Live map", "الخريطة المباشرة")} line={state.data ? t(`${state.data.jobs.length} active jobs · ${state.data.mechanics.length} online`, `${state.data.jobs.length} مهام نشطة · ${state.data.mechanics.length} متصل`) : undefined} onRefresh={() => void state.reload()} refreshing={false}>
      <Loaded state={state}>{(d) => <MechanicLiveMap jobs={d.jobs} people={d.mechanics} base={d.base} onOpen={(id) => go(`/garage/requests/${id}`)} />}</Loaded>
      <Note icon="phone-portrait-outline">{t("Mechanics share their position only while Online and only while the MOTEXA app is open on their phone.", "يشارك الميكانيكيون موقعهم فقط أثناء الاتصال وفقط عندما يكون تطبيق موتكسا مفتوحًا على هواتفهم.")}</Note>
    </Page>
  );
}
