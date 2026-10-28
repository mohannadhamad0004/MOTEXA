// Parts shop signup, step 3 of 4: business documents. The documents are the ones the backend already requires for a parts shop
// (commercial registration, trade licence, owner ID) plus the storefront photo it requires before submitting. Files stay on the device as
// local references in the in-memory draft; nothing is uploaded and no API is called. None of these documents expires in the current
// workflow, so no expiry date is asked.
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, View } from "react-native";
import { MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import { DButton, cardStyle, useDT } from "../department/ui";
import { docLabel } from "./labels";
import { ProviderButton, ProviderNote } from "./kit";
import { PartsDocKind, getPartsSignupDraft, setPartsDoc } from "./partsSignupDraft";
import type { StagedDoc } from "./towSignupDraft";

/** The storefront photo is an image only (the server refuses a PDF for it); the other documents may also be a PDF. */
const DOCS: { kind: PartsDocKind; pdf: boolean; hint: [string, string] }[] = [
  { kind: "COMMERCIAL_REGISTRATION", pdf: true, hint: ["The business registration of this shop or its company.", "السجل التجاري لهذا المتجر أو لشركته."] },
  { kind: "TRADE_LICENCE", pdf: true, hint: ["The trade or municipal licence of this shop.", "رخصة المهن أو البلدية لهذا المتجر."] },
  { kind: "OWNER_ID", pdf: true, hint: ["ID of the owner or authorized representative.", "هوية المالك أو الممثل المفوّض."] },
  { kind: "STOREFRONT_PHOTO", pdf: false, hint: ["A clear photo of the shop front (JPEG or PNG).", "صورة واضحة لواجهة المتجر (JPEG أو PNG)."] },
];

export default function PartsSignupStep3() {
  const d = getPartsSignupDraft();
  if (!d) return <Redirect href={"/provider/parts-signup" as never} />;
  if (d.lat === undefined) return <Redirect href={"/provider/parts-signup/location" as never} />;
  if (d.categories.length === 0) return <Redirect href={"/provider/parts-signup/categories" as never} />;
  return <Body />;
}

function Body() {
  const m = useMechanicTheme();
  const dt = useDT();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [, bump] = useState(0);
  const [tried, setTried] = useState(false);
  const [pickError, setPickError] = useState("");
  const draft = getPartsSignupDraft()!;
  const bad = dt.chip("bad").fg;

  async function pick(kind: PartsDocKind, pdf: boolean) {
    setPickError("");
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: pdf ? ["image/jpeg", "image/png", "application/pdf"] : ["image/jpeg", "image/png"], copyToCacheDirectory: true, multiple: false });
      if (r.canceled) return;
      const a = r.assets[0];
      if (a.size && a.size > 5 * 1024 * 1024) return setPickError(m.t("Choose a document under 5 MB.", "اختر مستندًا أقل من 5 ميغابايت."));
      const doc: StagedDoc = { uri: a.uri, fileName: a.name, mimeType: a.mimeType };
      setPartsDoc(kind, doc);
      bump((n) => n + 1);
    } catch {
      setPickError(m.t("The file could not be read.", "تعذّر قراءة الملف."));
    }
  }
  const remove = (kind: PartsDocKind) => {
    setPartsDoc(kind, null);
    bump((n) => n + 1);
  };

  const missing = DOCS.filter((x) => !draft.businessDocuments[x.kind]);
  const next = () => {
    setTried(true);
    if (missing.length) return;
    if (from === "review") router.back();
    else router.push("/provider/parts-signup/review" as never);
  };

  return (
    <MechanicPage back title={m.t("Business documents", "مستندات النشاط")} subtitle={m.t("4 of 5 — Business documents", "4 من 5 — مستندات النشاط")}>
      <View style={{ flexDirection: m.row, gap: 6, marginTop: -8, marginBottom: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 3 ? "#B18350" : m.border }} />
        ))}
      </View>
      <View style={{ gap: 13 }}>
        <ProviderNote>{m.t("Upload the documents MOTEXA needs to verify this shop before it can publish and sell parts. JPEG, PNG or PDF, up to 5 MB. Files stay on this device until you submit.", "ارفع المستندات التي تحتاجها MOTEXA للتحقق من هذا المتجر قبل أن يتمكن من نشر وبيع القطع. JPEG أو PNG أو PDF حتى 5 ميغابايت. تبقى الملفات على هذا الجهاز حتى ترسل الطلب.")}</ProviderNote>
        {pickError ? <ProviderNote error>{pickError}</ProviderNote> : null}
        {tried && missing.length ? <ProviderNote error>{m.t("Some documents are missing. Check the cards marked below.", "بعض المستندات ناقصة. راجع البطاقات المعلّمة أدناه.")}</ProviderNote> : null}
        {DOCS.map(({ kind, pdf, hint }) => {
          const doc = draft.businessDocuments[kind];
          const image = doc?.mimeType?.startsWith("image/") || /\.(jpe?g|png)$/i.test(doc?.fileName ?? "");
          const miss = tried && !doc;
          return (
            <View key={kind} style={{ ...cardStyle(dt, miss ? "bad" : undefined), padding: 14, gap: 8 }}>
              <Text style={{ color: dt.ink, fontSize: 14, lineHeight: 21, fontWeight: "800", textAlign: m.align }}>{docLabel(m.t, kind)}</Text>
              <Text style={{ color: dt.muted, fontSize: 12, lineHeight: 18, textAlign: m.align }}>{m.t(...hint)}</Text>
              {doc ? (
                <View style={{ flexDirection: m.row, alignItems: "center", gap: 10 }}>
                  {image ? <Image source={{ uri: doc.uri }} accessibilityLabel={docLabel(m.t, kind)} style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: dt.border }} resizeMode="cover" /> : <Ionicons name="document-text-outline" size={30} color={dt.accent} />}
                  <Text numberOfLines={2} style={{ flex: 1, color: dt.muted, fontSize: 12, lineHeight: 18, textAlign: m.align }}>{doc.fileName}</Text>
                </View>
              ) : null}
              {miss ? <Text accessibilityRole="alert" style={{ color: bad, fontSize: 12, lineHeight: 18, textAlign: m.align }}>{m.t("Choose the document.", "اختر المستند.")}</Text> : null}
              <View style={{ flexDirection: m.row, gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <DButton variant={doc ? "ghost" : "primary"} icon="cloud-upload-outline" label={doc ? m.t("Replace", "استبدال") : m.t("Choose file", "اختيار ملف")} onPress={() => pick(kind, pdf)} />
                </View>
                {doc ? (
                  <View style={{ flex: 1 }}>
                    <DButton variant="ghost" icon="trash-outline" label={m.t("Remove", "إزالة")} onPress={() => remove(kind)} />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
        <ProviderButton label={from === "review" ? m.t("Save and return to review", "حفظ والعودة إلى المراجعة") : m.t("Review application", "مراجعة الطلب")} onPress={next} />
        <ProviderButton secondary label={m.t("Back", "رجوع")} onPress={() => router.back()} />
      </View>
    </MechanicPage>
  );
}
