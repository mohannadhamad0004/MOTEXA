// Tow company signup, step 5 of 5: a read-only review of everything staged in memory, then the one real submission.
// Each section has Edit, which opens that step with ?from=review so its main button comes straight back here.
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, View } from "react-native";
import { MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import { cityLabel } from "../../core/constants/cities";
import { DButton, cardStyle, useDT } from "../department/ui";
import { truckTypeLabel } from "../department/departments";
import { fmtPoint } from "../department/LocationRow";
import { docLabel } from "./labels";
import { ProviderButton, ProviderChoice, ProviderNote } from "./kit";
import { COMPANY_KINDS, submitTowSignup, towSignupProblems } from "./towSignupSubmit";
import { getTowSignupDraft } from "./towSignupDraft";

const ROUTE = { company: "/provider/tow-signup", location: "/provider/tow-signup/location", trucks: "/provider/tow-signup/trucks", documents: "/provider/tow-signup/documents" } as const;
const ltr = (v: string) => "⁦" + v + "⁩";

export default function TowSignupStep5() {
  const d = getTowSignupDraft();
  if (!d) return <Redirect href={"/provider/tow-signup" as never} />;
  return <Body />;
}

/** The server's English messages, in Arabic when the app is Arabic (anything unknown is shown as the server sent it). */
const ERRORS: [RegExp, string][] = [
  [/already expired/i, "انتهت صلاحية أحد المستندات."],
  [/outside the area/i, "هذا الموقع خارج المنطقة التي تخدمها MOTEXA."],
  [/plate .* already exists|plates? .* exists|listed twice/i, "رقم لوحة شاحنة مستخدم بالفعل."],
  [/Unable to create this account/i, "تعذّر إنشاء هذا الحساب. إذا سجلت من قبل فسجّل الدخول."],
  [/Too many/i, "محاولات كثيرة. حاول لاحقًا."],
  [/Add at least one tow truck/i, "أضف شاحنة سحب واحدة على الأقل."],
  [/File data is missing|expiry date is required/i, "ملف أو تاريخ انتهاء ناقص. راجع المستندات."],
  [/JPEG|PNG|5 MB/i, "الملفات يجب أن تكون JPEG أو PNG أو PDF وبحد أقصى 5 ميغابايت."],
  [/too large/i, "الملفات كبيرة جدًا. استخدم ملفات أصغر."],
];

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  const m = useMechanicTheme();
  const dt = useDT();
  return (
    <View style={{ ...cardStyle(dt), padding: 14, gap: 10 }}>
      <View style={{ flexDirection: m.row, alignItems: "center", gap: 8 }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: dt.ink, fontSize: 15, lineHeight: m.ar ? 24 : 21, fontWeight: "800", textAlign: m.align }}>{title}</Text>
        <View style={{ minWidth: 96 }}>
          <DButton variant="ghost" icon="create-outline" label={m.t("Edit", "تعديل")} onPress={onEdit} compact />
        </View>
      </View>
      {children}
    </View>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  const m = useMechanicTheme();
  const dt = useDT();
  return (
    <View style={{ flexDirection: m.row, gap: 10, alignItems: "flex-start" }}>
      <Text style={{ width: 104, color: dt.muted, fontSize: 12, lineHeight: 19, textAlign: m.align }}>{k}</Text>
      <Text style={{ flex: 1, color: dt.ink, fontSize: 13, lineHeight: 20, fontWeight: "600", textAlign: m.align }}>{v}</Text>
    </View>
  );
}

function Body() {
  const m = useMechanicTheme();
  const dt = useDT();
  const [, bump] = useState(0);
  useFocusEffect(useCallback(() => bump((n) => n + 1), [])); // back from an edit: read the draft again
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const d = getTowSignupDraft();
  if (!d) return <Redirect href={"/provider/tow-signup" as never} />;
  const problems = towSignupProblems(d);
  const edit = (k: keyof typeof ROUTE) => router.push(`${ROUTE[k]}?from=review` as never);
  const day = (v?: string) => v ?? "";

  async function submit() {
    if (busy || problems.length || !accept) return;
    setBusy(true);
    setError("");
    try {
      await submitTowSignup(d!);
      router.replace("/provider/tow-signup/submitted" as never);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const network = e instanceof TypeError || /network|failed to fetch/i.test(msg);
      const known = m.ar ? ERRORS.find(([re]) => re.test(msg))?.[1] : undefined;
      setError(network ? m.t("The server could not be reached. Check your connection and try again. Your details are kept.", "تعذّر الوصول إلى الخادم. تحقق من الاتصال وحاول مرة أخرى. بياناتك محفوظة.") : (known ?? msg) || m.t("The application could not be submitted. Your details are kept; try again.", "تعذّر إرسال الطلب. بياناتك محفوظة، حاول مرة أخرى."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <MechanicPage back title={m.t("Review application", "مراجعة الطلب")} subtitle={m.t("5 of 5 — Review application", "5 من 5 — مراجعة الطلب")}>
      <View style={{ flexDirection: m.row, gap: 6, marginTop: -8, marginBottom: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: "#B18350" }} />
        ))}
      </View>
      <View style={{ gap: 13 }}>
        <ProviderNote>{m.t("Your application will be reviewed by the MOTEXA Tow Admin before your towing account can start receiving requests.", "ستتم مراجعة طلبك من قبل مشرف السحب في MOTEXA قبل أن يتمكن حسابك من استقبال الطلبات.")}</ProviderNote>
        {error ? <ProviderNote error>{error}</ProviderNote> : null}
        {problems.length ? (
          <ProviderNote error>
            {problems.map((p) => m.t(...p.text)).filter((x, i, a) => a.indexOf(x) === i).join(" ")}
          </ProviderNote>
        ) : null}

        <Section title={m.t("Company", "الشركة")} onEdit={() => edit("company")}>
          <Line k={m.t("Company", "الشركة")} v={d.businessName} />
          <Line k={m.t("Owner / manager", "المالك / المدير")} v={d.fullName} />
          <Line k={m.t("Phone", "الهاتف")} v={ltr(d.phone)} />
          <Line k={m.t("Email", "البريد")} v={d.email} />
          <Line k={m.t("City", "المدينة")} v={cityLabel(d.city, m.ar)} />
          <Line k={m.t("Address", "العنوان")} v={d.address} />
          <Line k={m.t("Password", "كلمة المرور")} v="••••••••" />
        </Section>

        <Section title={m.t("Company location", "موقع الشركة")} onEdit={() => edit("location")}>
          {d.baseLat !== undefined && d.baseLng !== undefined ? (
            <>
              <Line k={m.t("Coordinates", "الإحداثيات")} v={ltr(fmtPoint(d.baseLat, d.baseLng))} />
              {d.locationAddress ? <Line k={m.t("Place", "المكان")} v={d.locationAddress} /> : null}
              <Line k={m.t("Chosen by", "طريقة الاختيار")} v={d.locationSource === "current_location" ? m.t("Your location", "موقعك الحالي") : m.t("Placed on the map", "محدد على الخريطة")} />
            </>
          ) : (
            <Text style={{ color: dt.muted, fontSize: 13, textAlign: m.align }}>{m.t("Not set.", "غير محدد.")}</Text>
          )}
        </Section>

        <Section title={m.t(`Tow trucks (${d.trucks.length})`, `شاحنات السحب (${d.trucks.length})`)} onEdit={() => edit("trucks")}>
          {d.trucks.map((t) => (
            <View key={t.localId} style={{ flexDirection: m.row, gap: 10, alignItems: "center" }}>
              <Image source={{ uri: t.photoUri }} style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: dt.border }} resizeMode="cover" accessibilityLabel={m.t("Truck photo", "صورة الشاحنة")} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: dt.ink, fontSize: 14, fontWeight: "800", textAlign: m.align }}>{ltr(t.plateNumber)}</Text>
                <Text numberOfLines={1} style={{ color: dt.muted, fontSize: 12, textAlign: m.align }}>{[t.make, t.model].join(" ")} · {truckTypeLabel(m.t, t.truckType)}</Text>
                <Text numberOfLines={2} style={{ color: dt.muted, fontSize: 12, textAlign: m.align, writingDirection: t.locationAddress ? undefined : "ltr" }}>{t.locationAddress ?? fmtPoint(t.baseLat, t.baseLng)}</Text>
              </View>
            </View>
          ))}
        </Section>

        <Section title={m.t("Company documents", "مستندات الشركة")} onEdit={() => edit("documents")}>
          {COMPANY_KINDS.map((k) => (
            <Line key={k} k={docLabel(m.t, k)} v={d.companyDocuments[k]?.fileName ?? m.t("Missing", "ناقص")} />
          ))}
        </Section>

        <Section title={m.t("Truck documents", "مستندات الشاحنات")} onEdit={() => edit("documents")}>
          {d.trucks.map((t) => {
            const docs = d.truckDocuments[t.localId] ?? {};
            return (
              <View key={t.localId} style={{ gap: 6 }}>
                <Text style={{ color: dt.ink, fontSize: 13, fontWeight: "800", textAlign: m.align }}>{ltr(t.plateNumber)}</Text>
                {(["registration", "license"] as const).map((kind) => (
                  <Line
                    key={kind}
                    k={kind === "registration" ? m.t("Registration", "الترخيص") : m.t("Operating licence", "رخصة التشغيل")}
                    v={docs[kind] ? `${docs[kind]!.fileName} · ${m.t("expires", "ينتهي")} ${day(docs[kind]!.expiresAt)}` : m.t("Missing", "ناقص")}
                  />
                ))}
              </View>
            );
          })}
        </Section>

        <ProviderChoice label={m.t("I accept the MOTEXA terms for service providers", "أوافق على شروط MOTEXA لمزودي الخدمة")} selected={accept} onPress={() => setAccept(!accept)} icon={accept ? "checkmark-circle" : "ellipse-outline"} />
        <ProviderButton label={m.t("Submit for review", "إرسال للمراجعة")} onPress={submit} busy={busy} disabled={busy || problems.length > 0 || !accept} />
        {!accept && problems.length === 0 ? <Text style={{ color: dt.muted, fontSize: 12, textAlign: m.align }}>{m.t("Accept the terms to submit.", "وافق على الشروط للإرسال.")}</Text> : null}
        <ProviderButton secondary label={m.t("Back", "رجوع")} onPress={() => router.back()} />
        <View style={{ flexDirection: m.row, gap: 8, alignItems: "center" }}>
          <Ionicons name="lock-closed-outline" size={14} color={dt.muted} />
          <Text style={{ flex: 1, color: dt.muted, fontSize: 11, lineHeight: 17, textAlign: m.align }}>{m.t("Nothing is sent until you press Submit. Your documents are private to you and the MOTEXA team.", "لا يُرسل شيء قبل الضغط على إرسال. مستنداتك خاصة بك وبفريق MOTEXA.")}</Text>
        </View>
      </View>
    </MechanicPage>
  );
}
