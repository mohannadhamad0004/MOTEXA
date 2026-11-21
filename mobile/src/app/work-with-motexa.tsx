import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, Chip, Field, GarageHero, GaragePage, GButton, GIcon, GText, Note, Section, SkeletonRows, StatusChip, Tap, Toggle, type GIconName } from "../components/garage";
import { api } from "../core/config/api";
import { CITIES, cityLabel } from "../core/constants/cities";
import { useL } from "../core/hooks/useL";
import { useSession, type SessionUser } from "../core/session/session";
import { applicationStatus, providerAccountText, workKindLabel, type WorkKind } from "../features/work/ProviderAccountNote";
import { gType, useGarageTheme } from "../theme/garage";

const KINDS: { kind: WorkKind; path: string; icon: GIconName; en: string; ar: string }[] = [
  { kind: "MECHANIC", path: "mechanic", icon: "construct-outline", en: "Repairs at your workshop, on site or online.", ar: "إصلاح في ورشتك أو في الموقع أو عن بُعد." },
  { kind: "TOW", path: "tow", icon: "car-outline", en: "Receive tow requests for your trucks.", ar: "استقبل طلبات السحب لشاحناتك." },
  { kind: "PARTS", path: "parts", icon: "cube-outline", en: "Sell car parts to MOTEXA customers.", ar: "بِع قطع السيارات لزبائن MOTEXA." },
];
/** Where each application is filled in (the existing wizards; open to the customer applicant). */
const WIZARD: Record<WorkKind, Href> = { MECHANIC: "/mechanic", TOW: "/provider/onboarding" as Href, PARTS: "/provider/onboarding" as Href };

/**
 * Work with MOTEXA: mechanics, tow companies and parts shops apply from a signed-in CUSTOMER account (Profile, or the sign-in
 * screen link). The application is filled in with the existing wizards; the role changes only when that department's admin approves.
 */
export default function WorkWithMotexa() {
  const s = useSession();
  const { t } = useL();
  const back = () => (router.canGoBack() ? router.back() : router.replace("/auth/login"));
  return (
    <GaragePage hero={<GarageHero variant="detail" title={t("Work with MOTEXA", "اعمل مع MOTEXA")} line={t("Mechanics, tow companies and parts shops", "ميكانيكيون وشركات سحب ومتاجر قطع غيار")} onBack={back} backLabel={t("Back", "رجوع")} />}>
      {s.status === "loading" ? <SkeletonRows count={3} /> : s.status === "ready" && s.user.role === "CUSTOMER" ? <Apply user={s.user} /> : <NotCustomer signedIn={s.status === "ready"} />}
    </GaragePage>
  );
}

function NotCustomer({ signedIn }: { signedIn: boolean }) {
  const { t } = useL();
  const { align } = useGarageTheme();
  return (
    <Card>
      <GText style={[gType.label, align, { fontWeight: "800" }]}>{t("Start from a customer account", "ابدأ من حساب زبون")}</GText>
      <GText soft style={[gType.bodySm, align, { marginTop: 6 }]}>
        {signedIn
          ? t("This account already has its own role, so it cannot apply. Use a customer account to work with MOTEXA.", "لهذا الحساب دوره الخاص، لذا لا يمكنه التقديم. استخدم حساب زبون للعمل مع MOTEXA.")
          : t("Create a customer account (or sign in), then open Profile → Work with MOTEXA to apply as a mechanic, tow company or parts shop.", "أنشئ حساب زبون (أو سجّل الدخول)، ثم افتح الملف الشخصي ← اعمل مع MOTEXA لتقدّم كميكانيكي أو شركة سحب أو متجر قطع غيار.")}
      </GText>
      {!signedIn && (
        <View style={{ gap: 10, marginTop: 16 }}>
          <GButton label={t("Create account", "إنشاء حساب")} icon="person-add-outline" onPress={() => router.push("/auth/signup")} />
          <GButton variant="secondary" label={t("Sign in", "تسجيل الدخول")} onPress={() => router.replace("/auth/login")} />
        </View>
      )}
    </Card>
  );
}

function Apply({ user }: { user: SessionUser }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const apps = user.applications ?? [];
  const open = apps.find((a) => a.status !== "REJECTED");
  const [kind, setKind] = useState<WorkKind | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    if (!kind || busy) return;
    setBusy(true);
    setError("");
    try {
      const path = KINDS.find((k) => k.kind === kind)!.path;
      await api("POST", `/apply/${path}`, { acknowledgeProviderAccount: understood, acceptTerms: terms, ...(kind !== "MECHANIC" ? { businessName, phone, city } : {}) });
      router.replace(WIZARD[kind]);
    } catch (e: any) {
      const code = e?.data?.code;
      setError(
        code === "ACTIVE_WORK" ? t("Finish or cancel your active requests and orders before applying.", "أنهِ طلباتك النشطة أو ألغِها قبل التقديم.")
        : code === "ALREADY_APPLIED" ? t("You already have an application. One account can apply for one kind of work.", "لديك طلب بالفعل. يمكن للحساب التقديم لنوع عمل واحد.")
        : code === "BUSINESS_NAME_INVALID" ? t("Enter the business name.", "أدخل اسم النشاط.")
        : code === "PHONE_INVALID" ? t("Enter a valid phone number.", "أدخل رقم هاتف صحيحًا.")
        : code === "CITY_NOT_IN_LIST" ? t("Choose your city from the list.", "اختر مدينتك من القائمة.")
        : !e?.status ? t("Could not connect. Check your connection and try again.", "تعذّر الاتصال. تحقق من الشبكة وحاول مجددًا.")
        : t("Something went wrong on our side. Please try again.", "حدث خطأ من جهتنا. يرجى المحاولة مرة أخرى."),
      );
    } finally {
      setBusy(false);
    }
  };

  if (open) {
    const [label, tone] = applicationStatus(t, open.status);
    return (
      <Card>
        <View style={[row, { alignItems: "center", gap: 12 }]}>
          <GIcon name={KINDS.find((k) => k.kind === open.kind)!.icon} size={24} />
          <GText style={[gType.label, align, { flex: 1, fontWeight: "800" }]}>{t("Your application", "طلبك")}: {workKindLabel(t, open.kind)}</GText>
          <StatusChip label={label} tone={tone} />
        </View>
        <GText soft style={[gType.bodySm, align, { marginTop: 10 }]}>
          {t("Your account stays a customer account until MOTEXA approves it.", "يبقى حسابك حساب زبون حتى توافق عليه MOTEXA.")}
        </GText>
        <GButton style={{ marginTop: 14 }} label={t("Open my application", "افتح طلبي")} icon="document-text-outline" onPress={() => router.push(WIZARD[open.kind])} />
      </Card>
    );
  }

  const ready = !!kind && understood && terms && (kind === "MECHANIC" || (businessName.trim().length >= 2 && phone.trim() && city));
  return (
    <>
      {apps.length > 0 && (
        <Note tone="danger" icon="close-circle-outline">
          {t(`Your ${workKindLabel(t, apps[0].kind).toLowerCase()} application was rejected. You can apply for another kind of work.`, `رُفض طلبك (${workKindLabel(t, apps[0].kind)}). يمكنك التقديم لنوع عمل آخر.`)}
        </Note>
      )}
      <Section title={t("What do you offer?", "ماذا تقدّم؟")} style={{ marginTop: 40 }}>
        <View style={{ gap: 10 }}>
          {KINDS.filter((k) => !apps.some((a) => a.kind === k.kind)).map((k) => {
            const on = kind === k.kind;
            return (
              <Tap key={k.kind} label={workKindLabel(t, k.kind) + (on ? t(", selected", "، محدد") : "")} onPress={() => setKind(k.kind)} style={[row, { alignItems: "center", gap: 14, padding: 14, borderRadius: 18, borderWidth: 2, borderColor: on ? g.accent : g.line, backgroundColor: on ? g.tint : g.card }]}>
                <GIcon name={k.icon} size={26} />
                <View style={{ flex: 1 }}>
                  <GText style={[gType.label, align, { fontWeight: "800" }]}>{workKindLabel(t, k.kind)}</GText>
                  <GText soft style={[gType.caption, align]}>{t(k.en, k.ar)}</GText>
                </View>
                <GIcon name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? g.accent : g.soft} />
              </Tap>
            );
          })}
        </View>
      </Section>

      {kind && (
        <Section title={workKindLabel(t, kind)}>
          {kind !== "MECHANIC" && (
            <Card>
              <Field label={kind === "TOW" ? t("Company name", "اسم الشركة") : t("Shop name", "اسم المتجر")} value={businessName} onChangeText={setBusinessName} maxLength={120} />
              <Field label={t("Business phone", "هاتف النشاط")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={24} />
              <GText style={[gType.label, align, { marginBottom: 8 }]}>{t("City", "المدينة")}</GText>
              <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
                {CITIES.map((c) => (
                  <Chip key={c.name} label={cityLabel(c.name, isArabic)} on={city === c.name} onPress={() => setCity(c.name)} />
                ))}
              </View>
            </Card>
          )}
          <View style={{ marginTop: 14 }}>
            <Note tone="warning" icon="swap-horizontal-outline">{providerAccountText(t, kind)}</Note>
            <Card>
              <Toggle label={t("I understand this account becomes a provider account after approval", "أفهم أن هذا الحساب يصبح حساب مزوّد خدمة بعد الموافقة")} value={understood} onChange={setUnderstood} />
              <Toggle label={t("I accept the MOTEXA terms for service providers", "أوافق على شروط MOTEXA لمزودي الخدمة")} value={terms} onChange={setTerms} />
            </Card>
            <GText soft style={[gType.caption, align, { marginTop: 10 }]}>
              {t("Next: your application form and documents. MOTEXA reviews it; until approval you keep using this account as a customer.", "بعدها: نموذج الطلب والمستندات. تراجعه MOTEXA، وحتى الموافقة تستمر باستخدام هذا الحساب كزبون.")}
            </GText>
            {!!error && <View style={{ marginTop: 12 }}><Note tone="danger" icon="alert-circle-outline">{error}</Note></View>}
            <GButton style={{ marginTop: 14 }} label={t("Start my application", "ابدأ طلبي")} icon="document-text-outline" onPress={() => void start()} busy={busy} disabled={!ready || busy} />
          </View>
        </Section>
      )}
    </>
  );
}
