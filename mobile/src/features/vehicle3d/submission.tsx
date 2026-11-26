// Car 3D submissions: the pieces shared by the customer's screen (screens.tsx) and the Parts Admin review (adminScreens.tsx):
// labels, the photo of one view, the private model preview. No page frame here.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, TextInput, View } from "react-native";
import { Card, Chip, GButton, GText, Note } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { Car3DView } from "../car3d/Car3DView";
import { gType, useGarageTheme } from "../../theme/garage";
import { privateAssetBase64, submissionApi, submissionModel, views, type Submission, type ViewName } from "./api";

export const labels = {
  front: ["Front", "الأمام"], rear: ["Rear", "الخلف"], left: ["Left side", "الجانب الأيسر"], right: ["Right side", "الجانب الأيمن"],
} as const;
export const statusLabels = {
  DRAFT: ["Add four photos", "أضف أربع صور"], PROCESSING: ["Creating your private model…", "جارٍ إنشاء نموذجك الخاص…"],
  READY: ["Your private model is ready", "نموذجك الخاص جاهز"], SUBMITTED: ["Under review", "قيد المراجعة"],
  APPROVED: ["Approved for MOTEXA catalog", "معتمد لكتالوج موتكسا"], REJECTED: ["Submission rejected", "تم رفض الطلب"],
  FAILED: ["Generation failed", "تعذّر إنشاء النموذج"],
} as const;
export const stageLabels:Record<string,readonly [string,string]>={UPLOAD:["Upload photos","رفع الصور"],QUEUED:["Ready to generate","جاهز للإنشاء"],REQUESTING:["Starting generation","بدء إنشاء النموذج"],GENERATING:["Generating","جارٍ إنشاء النموذج"],DOWNLOADING:["Downloading private model","تنزيل النموذج الخاص"],PREPARING:["Preparing model","تجهيز النموذج"],READY:["Ready to preview","جاهز للعرض"],FAILED:["Generation failed","تعذّر إنشاء النموذج"]};

export function Check({ label, checked, onPress, disabled }: { label: string; checked: boolean; onPress: () => void; disabled?: boolean }) {
  const { g, row, align } = useGarageTheme();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[row,{ minHeight: 48, gap: 12, alignItems: "center", paddingVertical: 10, opacity: disabled ? .5 : 1 }]}>
    <GText style={{ color: g.accentText, fontSize: 22 }}>{checked ? "☑" : "☐"}</GText>
    <GText style={[gType.bodySm,align,{ flex: 1, minWidth: 0 }]}>{label}</GText>
  </Pressable>;
}
export const validationArabic: Record<string,string> = {
  "Model exceeds the configured size limit.": "يتجاوز حجم النموذج الحد المسموح.",
  "Invalid GLB container.": "ملف GLB غير صالح.",
  "Invalid GLB JSON.": "بيانات ملف GLB غير صالحة.",
  "Model must be self-contained, with no resource URLs.": "يجب أن يحتوي الملف على موارده كاملة دون روابط خارجية.",
  "Animated or skinned models are not supported for catalog promotion.": "لا يمكن اعتماد النماذج المتحركة أو ذات الهياكل العظمية.",
  "Vehicle length must be between 2.5 and 8 metres.": "يجب أن يكون طول السيارة بين ٢٫٥ و٨ أمتار.",
  "GLB could not be loaded.": "تعذّر تحميل ملف النموذج.",
  "Model must contain one nonempty scene.": "يجب أن يحتوي النموذج على مشهد واحد غير فارغ.",
  "Only finite triangle geometry is supported.": "يجب أن تكون هندسة النموذج مثلثات ذات إحداثيات صالحة.",
  "Invalid geometry indices.": "فهارس هندسة النموذج غير صالحة.",
  "Model needs nonzero geometry and at most 500,000 triangles.": "يجب أن يحتوي النموذج على هندسة فعلية وبحد أقصى ٥٠٠ ألف مثلث.",
  "Invalid or extreme model bounds.": "أبعاد النموذج غير صالحة أو متطرفة.",
  "Model is not upright. Correct its orientation before review.": "النموذج غير قائم. صحّح اتجاهه قبل المراجعة.",
  "Bounds do not have sensible vehicle proportions.": "نسب أبعاد النموذج لا تناسب مركبة.",
  "Model scale is extreme.": "مقياس النموذج متطرف.",
  "Normalized model exceeds the configured size limit.": "يتجاوز النموذج الحد المسموح بعد ضبط المقياس.",
  "Decoded geometry exceeds the safe memory limit.": "تتجاوز هندسة النموذج الحد الآمن للذاكرة بعد فك الضغط.",
  "Only embedded JPEG, PNG and WebP textures are supported.": "يُسمح فقط بخامات JPEG وPNG وWebP المضمّنة داخل الملف.",
  "Texture buffer is invalid.": "بيانات خامات النموذج غير صالحة.",
  "Textures exceed safe decoding limits or cannot be loaded.": "خامات النموذج تتجاوز حدود فك الضغط الآمنة أو تعذّر تحميلها.",
  "The MOTEXA viewer could not render this model. Check the local Three.js r160/browser setup and model materials.": "تعذّر عرض النموذج في عارض موتكسا. تحقق من إعداد Three.js r160 والمتصفح وخامات النموذج.",
};

export function Photo({ s, view, admin }: { s: Submission; view: ViewName; admin: boolean }) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const { t } = useL();
  const hasPhoto = s.photos[view];
  useEffect(() => {
    let current = true;
    if (hasPhoto) void privateAssetBase64(s.id,view,admin).then(b64 => { if (current) setUri(`data:image/jpeg;base64,${b64}`); }, () => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [s.id, hasPhoto, s.photoRevision, view, admin]);
  return <View style={{ gap: 6 }}>
    <GText style={gType.label}>{t(labels[view][0],labels[view][1])}</GText>
    {uri ? <Image accessibilityLabel={t(labels[view][0],labels[view][1])} source={{ uri }} style={{ width: "100%", height: 160, borderRadius: 12 }} resizeMode="contain" /> : <GText soft>{failed ? t("Could not load photo. Refresh to retry.", "تعذّر تحميل الصورة. حدّث للمحاولة.") : s.photos[view] ? t("Loading private photo…", "جارٍ تحميل الصورة الخاصة…") : t("Photo required", "الصورة مطلوبة")}</GText>}
  </View>;
}
export function ModelPreview({ s, admin }: { s: Submission; admin: boolean }) {
  const { g } = useGarageTheme();
  const { id, lengthM, make, model: name, generationName } = s;
  const model = useMemo(() => submissionModel({id,lengthM,make,model:name,generationName}), [id,lengthM,make,name,generationName]);
  const loader = useCallback(() => privateAssetBase64(s.id,"model",admin), [s.id,admin]);
  return <Car3DView model={model} assetLoader={loader} color="#c3c7cc" bg={g.cardSoft} interactive style={{ height: 300, borderRadius: 16 }} />;
}
