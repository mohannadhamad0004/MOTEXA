import { Image } from "expo-image";
import { ReactNode, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import { GButton, GText, Note, Sheet } from "../../components/garage";
import { uploadProgress } from "../../core/config/api";
import { publicImageUrl } from "../../core/constants/files";
import { PickedPhoto, photoErrorText, pickPhoto } from "../../core/hooks/pickPhoto";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";

/** How far the current photo upload is (0..1), or null when nothing is uploading. Fed by api() for large bodies. */
export const useUploadProgress = () => useSyncExternalStore(uploadProgress.subscribe, uploadProgress.get, uploadProgress.get);

/** A thin bar + percentage while a photo / document upload is on its way. */
export function UploadBar() {
  const p = useUploadProgress();
  const { t } = useL();
  const { g, align } = useGarageTheme();
  if (p === null) return null;
  return (
    <View style={{ marginBottom: 10 }} accessibilityRole="progressbar" accessibilityLabel={t("Uploading", "جارٍ الرفع")}>
      <GText soft style={[gType.caption, align, { marginBottom: 4 }]}>{t(`Uploading… ${Math.round(p * 100)}%`, `جارٍ الرفع… ${Math.round(p * 100)}٪`)}</GText>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: g.line, overflow: "hidden" }}>
        <View style={{ height: 6, width: `${Math.max(4, Math.round(p * 100))}%`, backgroundColor: g.accent }} />
      </View>
    </View>
  );
}

/** One photo: preview (local pick or the stored one), a button, and the exact reason when picking / converting fails. */
export function PhotoField({ label, value, onChange, hint, round, required }: { label: string; value: string | null; onChange: (uri: string, base64: string) => void; hint?: string; round?: boolean; required?: boolean }) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const src = value ? (value.startsWith("/") ? publicImageUrl(value) : value) : null;
  const choose = async () => {
    setErr(null);
    setBusy(true);
    try {
      const p: PickedPhoto | null = await pickPhoto();
      if (p) onChange(p.uri, p.base64);
    } catch (e) {
      setErr(photoErrorText(e, t));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ marginBottom: 14 }}>
      <GText style={[gType.caption, align, { fontWeight: "700", marginBottom: 6 }]}>{`${label}${required ? " *" : ""}`}</GText>
      <View style={[row, { alignItems: "center", gap: 12 }]}>
        <View style={{ width: 84, height: 84, borderRadius: round ? 42 : gShape.card, backgroundColor: g.tint, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
          {src ? <Image source={{ uri: src }} style={{ width: 84, height: 84 }} contentFit="cover" accessibilityLabel={label} /> : <GText soft style={gType.caption}>{t("No photo", "لا صورة")}</GText>}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <GButton variant="secondary" icon="image-outline" label={src ? t("Change photo", "تغيير الصورة") : t("Choose photo", "اختيار صورة")} busy={busy} disabled={busy} onPress={() => void choose()} />
          {hint ? <GText soft style={[gType.tiny, align]}>{hint}</GText> : null}
        </View>
      </View>
      {err ? <View style={{ marginTop: 8 }}><Note tone="danger" icon="alert-circle-outline">{err}</Note></View> : null}
    </View>
  );
}

/** Progress dots: filled up to the current step. */
export function Dots({ count, index }: { count: number; index: number }) {
  const { t } = useL();
  const { g, row } = useGarageTheme();
  return (
    <View style={[row, { gap: 8, alignItems: "center", marginBottom: 16 }]} accessibilityLabel={t(`Step ${index + 1} of ${count}`, `الخطوة ${index + 1} من ${count}`)}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ height: 8, width: i === index ? 24 : 8, borderRadius: 4, backgroundColor: i <= index ? g.accent : g.line }} />
      ))}
    </View>
  );
}

/**
 * A short step form in a sheet: progress dots, one screen of fields per step, Back / Next, and Save on the last step.
 * `validate(step)` returns an error text to stay on the step, or null. `onSave` throws to show its message.
 */
export function StepSheet({ visible, title, steps, onClose, validate, onSave, render, saveLabel }: {
  visible: boolean;
  title: string;
  steps: string[];
  onClose: () => void;
  validate: (step: number) => string | null;
  onSave: () => Promise<void>;
  render: (step: number) => ReactNode;
  saveLabel?: string;
}) {
  const { t } = useL();
  const { align } = useGarageTheme();
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const last = step === steps.length - 1;
  const next = async () => {
    const v = validate(step);
    if (v) return setErr(v);
    setErr(null);
    if (!last) return setStep(step + 1);
    setBusy(true);
    try {
      await onSave();
      setStep(0);
    } catch (e: any) {
      setErr(e?.message ?? t("Something went wrong.", "حدث خطأ ما."));
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setStep(0);
    setErr(null);
    onClose();
  };
  return (
    <Sheet
      visible={visible}
      onClose={close}
      closeLabel={t("Close", "إغلاق")}
      title={title}
      tall
      footer={
        <View style={{ gap: 8 }}>
          <UploadBar />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {step > 0 ? <GButton flex variant="secondary" label={t("Back", "رجوع")} disabled={busy} onPress={() => { setErr(null); setStep(step - 1); }} /> : null}
            <GButton flex label={last ? (saveLabel ?? t("Save", "حفظ")) : t("Next", "التالي")} busy={busy} disabled={busy} onPress={() => void next()} />
          </View>
        </View>
      }
    >
      <Dots count={steps.length} index={step} />
      <GText style={[gType.title, align, { marginBottom: 12 }]}>{steps[step]}</GText>
      {render(step)}
      {err ? <View style={{ marginTop: 8 }}><Note tone="danger" icon="alert-circle-outline">{err}</Note></View> : null}
    </Sheet>
  );
}
