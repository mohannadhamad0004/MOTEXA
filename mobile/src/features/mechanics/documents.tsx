// A mechanic's private documents (identity, certificate, workshop proof) on the Garage kit: pick one to upload, and the list that opens
// a document (image full screen, PDF in the system viewer / a download on web). Same calls as before; documents stay private
// (the owner and the Mechanics admin only).
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { GButton, GIcon, GText, Note, StatusChip, type GIconName } from "../../components/garage";
import { mechanicApi, type MechanicDocument } from "../../components/mechanic-api";
import { useL } from "../../core/hooks/useL";
import { gType, useGarageTheme } from "../../theme/garage";

export async function pickMechanicDocument(kind: string) {
  const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "application/pdf"], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const a = result.assets[0];
  if (a.size && a.size > 5 * 1024 * 1024) throw Error("Choose a document under 5 MB.");
  let base64: string;
  if (Platform.OS === "web") {
    const blob = a.file ?? (await (await fetch(a.uri)).blob());
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(Error("Document could not be read."));
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.readAsDataURL(blob);
    });
  } else base64 = await new File(a.uri).base64();
  return { kind, fileName: a.name, mimeType: a.mimeType, base64 };
}

const ICON: Record<string, GIconName> = { IDENTITY: "id-card-outline", CERTIFICATE: "ribbon-outline", WORKSHOP_PROOF: "storefront-outline" };

/** One row per document kind: label, file name (or the accepted formats), Uploaded chip; tap = view. `onUpload` adds Upload / Replace. */
export function MechanicDocs({ documents, onUpload, requireCertificate = true, includeWorkshopProof = false, busy = false }: {
  documents: MechanicDocument[]; onUpload?: (kind: string) => void; requireCertificate?: boolean; includeWorkshopProof?: boolean; busy?: boolean;
}) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const [preview, setPreview] = useState<{ base64: string; mimeType: string } | null>(null);
  const [opening, setOpening] = useState(false), [error, setError] = useState("");
  const label = (kind: string) => kind === "IDENTITY" ? t("Identity document · Required", "الهوية الشخصية · مطلوبة")
    : kind === "WORKSHOP_PROOF" ? t("Workshop ownership / use · Required", "ملكية الورشة أو حق استخدامها · مطلوب")
    : requireCertificate ? t("Experience / training certificate · Required", "شهادة خبرة أو تدريب · مطلوبة") : t("Experience / training certificate · Optional", "شهادة خبرة أو تدريب · اختيارية");
  async function open(doc: MechanicDocument) {
    setOpening(true); setError("");
    try {
      const { document: d } = await mechanicApi("/api/mechanics/documents/" + doc.id);
      if (d.mimeType.startsWith("image/")) setPreview(d);
      else if (Platform.OS === "web") {
        const bytes = Uint8Array.from(atob(d.base64), (c: string) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const a = document.createElement("a"); a.href = url; a.download = "MOTEXA-document.pdf"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        if (!(await Sharing.isAvailableAsync())) throw Error(t("Document opening is unavailable on this device.", "فتح المستندات غير متاح على هذا الجهاز."));
        const file = new File(Paths.cache, "motexa-private-" + Date.now() + ".pdf");
        file.write(d.base64, { encoding: "base64" });
        try { await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" }); } finally { if (file.exists) file.delete(); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : t("Document could not be opened.", "تعذّر فتح المستند.")); } finally { setOpening(false); }
  }
  const kinds = ["IDENTITY", "CERTIFICATE", ...(includeWorkshopProof || documents.some((d) => d.kind === "WORKSHOP_PROOF") ? ["WORKSHOP_PROOF"] : [])];
  return (
    <View>
      {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
      {kinds.map((kind, i) => {
        const doc = documents.find((d) => d.kind === kind);
        return (
          <View key={kind} style={{ paddingVertical: 8, gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: g.line }}>
            <Pressable disabled={!doc || opening} accessibilityRole="button" accessibilityLabel={`${label(kind)}${doc ? `. ${t("View document", "عرض المستند")}` : ""}`} onPress={() => doc && void open(doc)}
              style={({ pressed }) => [row, { minHeight: 48, alignItems: "center", gap: 12, opacity: pressed ? 0.7 : 1 }]}>
              <GIcon name={ICON[kind] ?? "document-outline"} size={22} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <GText style={[gType.bodySm, align, { fontWeight: "700" }]}>{label(kind)}</GText>
                {kind === "WORKSHOP_PROOF" && !doc ? <GText soft style={[gType.caption, align]}>{t("Ownership document, rental agreement or written authorization to use the workshop.", "سند ملكية، أو عقد إيجار، أو إذن مكتوب لاستخدام الورشة.")}</GText> : null}
                <GText soft numberOfLines={1} style={[gType.caption, align]}>{doc ? doc.fileName : t("JPEG, PNG or PDF · Maximum 5 MB", "JPEG أو PNG أو PDF · حتى 5 ميغابايت")}</GText>
              </View>
              {doc ? <StatusChip tone="success" icon="lock-closed-outline" label={t("Uploaded privately", "مرفوع بشكل خاص")} /> : null}
              {doc ? <GIcon name="eye-outline" size={18} color={g.soft} /> : null}
            </Pressable>
            {onUpload ? <GButton variant="secondary" icon="cloud-upload-outline" disabled={busy} label={doc ? t("Replace document", "استبدال المستند") : t("Upload document", "رفع المستند")} onPress={() => onUpload(kind)} /> : null}
          </View>
        );
      })}
      <GText soft style={[gType.tiny, align, { paddingVertical: 8 }]}>{t("Private: visible only to MOTEXA admins and the owner.", "خاصة: تظهر فقط لمسؤولي MOTEXA والمالك.")}</GText>
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={{ flex: 1, padding: 20, paddingTop: 50, backgroundColor: "#17100CF2", justifyContent: "center", gap: 12 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
            {preview ? <Image accessible accessibilityLabel={t("Private document preview", "معاينة مستند خاص")} source={{ uri: "data:" + preview.mimeType + ";base64," + preview.base64 }} resizeMode="contain" style={{ width: "100%", height: 500 }} /> : null}
          </ScrollView>
          <GButton label={t("Close preview", "إغلاق المعاينة")} onPress={() => setPreview(null)} />
        </View>
      </Modal>
    </View>
  );
}
