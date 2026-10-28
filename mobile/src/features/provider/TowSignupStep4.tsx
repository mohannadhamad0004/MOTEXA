// Tow company signup, step 4 of 5: documents. Company documents first, then ONE card per truck from step 3 (keyed by the truck's
// localId). Files stay on the device as local references in the in-memory draft; nothing is uploaded and no API is called here.
// Documents that expire need a date (YYYY-MM-DD, the format the existing onboarding uses) and a date in the past is refused.
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, View } from "react-native";
import { MechanicField, MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import InteractiveButton from "../../components/InteractiveButton";
import { DButton, Pill, cardStyle, useDT } from "../department/ui";
import { truckTypeLabel } from "../department/departments";
import { docLabel } from "./labels";
import { ProviderButton, ProviderNote } from "./kit";
import { CompanyDocKind, StagedDoc, TowSignupTruck, TruckDocKind, getTowSignupDraft, parseExpiry, setTowCompanyDoc, setTowTruckDoc } from "./towSignupDraft";

const COMPANY_KINDS: CompanyDocKind[] = ["COMMERCIAL_REGISTRATION", "OWNER_ID", "DRIVER_LICENCE"];
const TRUCK_KINDS: { kind: TruckDocKind; en: string; ar: string }[] = [
  { kind: "registration", en: "Truck registration", ar: "ترخيص تسجيل الشاحنة" },
  { kind: "license", en: "Tow truck operating licence", ar: "رخصة تشغيل شاحنة السحب" },
];

export default function TowSignupStep4() {
  const d = getTowSignupDraft();
  if (!d) return <Redirect href={"/provider/tow-signup" as never} />;
  if (d.baseLat === undefined) return <Redirect href={"/provider/tow-signup/location" as never} />;
  if (d.trucks.length === 0) return <Redirect href={"/provider/tow-signup/trucks" as never} />;
  return <Body />;
}

/** One document: the file (preview or name) with Choose / Replace / Remove, and its expiry date when it expires. */
function DocRow({ title, doc, expiry, setExpiry, expires, tried, onPick, onRemove, error }: { title: string; doc?: StagedDoc; expiry: string; setExpiry: (v: string) => void; expires: boolean; tried: boolean; onPick: () => void; onRemove: () => void; error: string }) {
  const m = useMechanicTheme();
  const dt = useDT();
  const e = tried ? ({ file: !doc, date: false } as const) : { file: false, date: false };
  const fileErr = e.file ? m.t("Choose the document.", "اختر المستند.") : "";
  const dateErr = expires && error && (tried || expiry.trim()) ? error : ""; // typed values are checked live, an empty one only after Review
  const bad = dt.chip("bad").fg;
  const image = doc?.mimeType?.startsWith("image/") || /\.(jpe?g|png)$/i.test(doc?.fileName ?? "");
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: fileErr || dateErr ? bad : dt.border }}>
      <Text style={{ color: dt.ink, fontSize: 13, lineHeight: 20, fontWeight: "700", textAlign: m.align }}>{title}</Text>
      {doc ? (
        <View style={{ flexDirection: m.row, alignItems: "center", gap: 10 }}>
          {image ? <Image source={{ uri: doc.uri }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: dt.border }} resizeMode="cover" accessibilityLabel={title} /> : <Ionicons name="document-text-outline" size={30} color={dt.accent} />}
          <Text numberOfLines={2} style={{ flex: 1, color: dt.muted, fontSize: 12, lineHeight: 18, textAlign: m.align }}>{doc.fileName}</Text>
        </View>
      ) : null}
      {expires ? <MechanicField label={m.t("Expiry date (YYYY-MM-DD)", "تاريخ الانتهاء (YYYY-MM-DD)")} icon="calendar-outline" value={expiry} onChangeText={setExpiry} maxLength={10} keyboardType="numbers-and-punctuation" /> : null}
      {dateErr ? <Text accessibilityRole="alert" style={{ color: bad, fontSize: 12, lineHeight: 18, textAlign: m.align }}>{dateErr}</Text> : null}
      {fileErr ? <Text accessibilityRole="alert" style={{ color: bad, fontSize: 12, lineHeight: 18, textAlign: m.align }}>{fileErr}</Text> : null}
      <View style={{ flexDirection: m.row, gap: 10 }}>
        <View style={{ flex: 1 }}>
          <DButton variant={doc ? "ghost" : "primary"} icon="cloud-upload-outline" label={doc ? m.t("Replace", "استبدال") : m.t("Choose file", "اختيار ملف")} onPress={onPick} />
        </View>
        {doc ? (
          <View style={{ flex: 1 }}>
            <DButton variant="ghost" icon="trash-outline" label={m.t("Remove", "إزالة")} onPress={onRemove} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Body() {
  const m = useMechanicTheme();
  const dt = useDT();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);
  const draft = getTowSignupDraft()!;
  // typed expiry dates, kept apart from the files so a date can be typed before the file is chosen
  const [expiry, setExpiry] = useState<Record<string, string>>(() => {
    const e: Record<string, string> = {};
    for (const k of COMPANY_KINDS) if (draft.companyDocuments[k]?.expiresAt) e[`company:${k}`] = draft.companyDocuments[k]!.expiresAt!;
    for (const t of draft.trucks) for (const { kind } of TRUCK_KINDS) if (draft.truckDocuments[t.localId]?.[kind]?.expiresAt) e[`${t.localId}:${kind}`] = draft.truckDocuments[t.localId]![kind]!.expiresAt!;
    return e;
  });
  const [tried, setTried] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ [draft.trucks[0].localId]: true });
    const [pickError, setPickError] = useState("");

  async function pick(): Promise<StagedDoc | null> {
    setPickError("");
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "application/pdf"], copyToCacheDirectory: true, multiple: false });
      if (r.canceled) return null;
      const a = r.assets[0];
      if (a.size && a.size > 5 * 1024 * 1024) {
        setPickError(m.t("Choose a document under 5 MB.", "اختر مستندًا أقل من 5 ميغابايت."));
        return null;
      }
      return { uri: a.uri, fileName: a.name, mimeType: a.mimeType };
    } catch {
      setPickError(m.t("The file could not be read.", "تعذّر قراءة الملف."));
      return null;
    }
  }

  const dateError = (key: string): string => {
    const v = (expiry[key] ?? "").trim();
    if (!v) return m.t("Enter the expiry date.", "أدخل تاريخ الانتهاء.");
    const p = parseExpiry(v);
    if (!p.ok) return m.t("Use the date format YYYY-MM-DD.", "استخدم صيغة التاريخ YYYY-MM-DD.");
    if (p.expired) return m.t("This document has already expired.", "انتهت صلاحية هذا المستند.");
    return "";
  };
  const withDate = (key: string, doc: StagedDoc): StagedDoc => ({ ...doc, expiresAt: (expiry[key] ?? "").trim() || undefined });

  const companyMissing = COMPANY_KINDS.filter((k) => !draft.companyDocuments[k]);
  // a truck is complete when both files exist and both dates are valid and not expired
  const truckProblems = (t: TowSignupTruck) => {
    const docs = draft.truckDocuments[t.localId] ?? {};
    return TRUCK_KINDS.filter(({ kind }) => !docs[kind] || !!dateError(`${t.localId}:${kind}`)).length;
  };
  const allOk = companyMissing.length === 0 && draft.trucks.every((t) => truckProblems(t) === 0);

  const next = () => {
    setTried(true);
    if (!allOk) {
      setOpen(Object.fromEntries(draft.trucks.map((t) => [t.localId, truckProblems(t) > 0])));
      return;
    }
    if (from === "review") router.back();
    else router.push("/provider/tow-signup/review" as never);
  };

  return (
    <MechanicPage back title={m.t("Documents", "المستندات")} subtitle={m.t("4 of 5 — Documents", "4 من 5 — المستندات")}>
      <View style={{ flexDirection: m.row, gap: 6, marginTop: -8, marginBottom: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 3 ? "#B18350" : m.border }} />
        ))}
      </View>
      <View style={{ gap: 13 }}>
        <ProviderNote>{m.t("MOTEXA verifies your company and every truck before you can receive requests. JPEG, PNG or PDF, up to 5 MB. Files stay on this device until you submit.", "تتحقق MOTEXA من شركتك ومن كل شاحنة قبل أن تتمكن من استقبال الطلبات. JPEG أو PNG أو PDF حتى 5 ميغابايت. تبقى الملفات على هذا الجهاز حتى ترسل الطلب.")}</ProviderNote>
        {pickError ? <ProviderNote error>{pickError}</ProviderNote> : null}
        {tried && !allOk ? <ProviderNote error>{m.t("Some documents are missing or have a problem. Check the cards marked below.", "بعض المستندات ناقصة أو بها مشكلة. راجع البطاقات المعلّمة أدناه.")}</ProviderNote> : null}

        <Text accessibilityRole="header" style={{ color: dt.ink, fontSize: 17, lineHeight: m.ar ? 28 : 24, fontWeight: "700", textAlign: m.align, marginTop: 4 }}>{m.t("Company documents", "مستندات الشركة")}</Text>
        <View style={{ ...cardStyle(dt), padding: 12, gap: 10 }}>
          {COMPANY_KINDS.map((k) => (
            <DocRow
              key={k}
              title={docLabel(m.t, k)}
              doc={draft.companyDocuments[k]}
              expires={false}
              expiry=""
              setExpiry={() => {}}
              tried={tried}
              error=""
              onPick={async () => {
                const f = await pick();
                if (f) {
                  setTowCompanyDoc(k, f);
                  refresh();
                }
              }}
              onRemove={() => {
                setTowCompanyDoc(k, null);
                refresh();
              }}
            />
          ))}
        </View>

        <Text accessibilityRole="header" style={{ color: dt.ink, fontSize: 17, lineHeight: m.ar ? 28 : 24, fontWeight: "700", textAlign: m.align, marginTop: 8 }}>{m.t("Truck documents", "مستندات الشاحنات")}</Text>
        {draft.trucks.map((t) => {
          const docs = draft.truckDocuments[t.localId] ?? {};
          const problems = truckProblems(t);
          const isOpen = !!open[t.localId];
          return (
            <View key={t.localId} style={{ ...cardStyle(dt), padding: 12, gap: 10, borderColor: tried && problems ? dt.chip("bad").border : undefined }}>
              <InteractiveButton accessibilityRole="button" accessibilityState={{ expanded: isOpen }} accessibilityLabel={`${t.plateNumber} ${t.make} ${t.model}`} onPress={() => setOpen((o) => ({ ...o, [t.localId]: !isOpen }))} style={{ flexDirection: m.row, alignItems: "center", gap: 10 }}>
                <Image source={{ uri: t.photoUri }} style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: dt.border }} resizeMode="cover" accessibilityLabel={m.t("Truck photo", "صورة الشاحنة")} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: dt.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: m.align }}>{"⁦" + t.plateNumber + "⁩"}</Text>
                  <Text numberOfLines={1} style={{ color: dt.muted, fontSize: 12, lineHeight: 18, textAlign: m.align }}>{[t.make, t.model].join(" ")} · {truckTypeLabel(m.t, t.truckType)}</Text>
                </View>
                <Pill tone={problems ? "amber" : "ok"} icon={problems ? "alert-circle-outline" : "checkmark-circle-outline"} label={problems ? m.t(`${problems} to complete`, `${problems} للإكمال`) : m.t("Complete", "مكتمل")} />
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={dt.accent} />
              </InteractiveButton>
              {isOpen
                ? TRUCK_KINDS.map(({ kind, en, ar }) => {
                    const key = `${t.localId}:${kind}`;
                    return (
                      <DocRow
                        key={kind}
                        title={m.t(en, ar)}
                        doc={docs[kind]}
                        expires
                        expiry={expiry[key] ?? ""}
                        tried={tried}
                        error={dateError(key)}
                        setExpiry={(v) => {
                          setExpiry((c) => ({ ...c, [key]: v }));
                          const cur = docs[kind];
                          if (cur) {
                            setTowTruckDoc(t.localId, kind, { ...cur, expiresAt: v.trim() || undefined });
                            refresh();
                          }
                        }}
                        onPick={async () => {
                          const f = await pick();
                          if (f) {
                            setTowTruckDoc(t.localId, kind, withDate(key, f));
                            refresh();
                          }
                        }}
                        onRemove={() => {
                          setTowTruckDoc(t.localId, kind, null);
                          setExpiry((c) => ({ ...c, [key]: "" }));
                          refresh();
                        }}
                      />
                    );
                  })
                : null}
            </View>
          );
        })}

        <ProviderButton label={from === "review" ? m.t("Save and return to review", "حفظ والعودة إلى المراجعة") : m.t("Review application", "مراجعة الطلب")} onPress={next} />
        <ProviderButton secondary label={m.t("Back", "رجوع")} onPress={() => router.back()} />
      </View>
    </MechanicPage>
  );
}
