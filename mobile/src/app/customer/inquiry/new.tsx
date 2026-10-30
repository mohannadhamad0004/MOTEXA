import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, ErrorState, Field, GarageHero, GaragePage, GButton, GText, Note, SkeletonBlock, StepperHeader, StickyActionBar } from "../../../components/garage";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { catalogService } from "../../../features/catalog/catalogService";
import { customerInquiries, existingIdOf } from "../../../features/requests/requestsService";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

// "Ask the shop" in three steps: the part + quantity, the question, review + send. If the customer already has this question
// open, the server answers with that thread and we open it instead.
export default function NewInquiry() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const state = useLoad(() => catalogService.getPart(productId), [productId]);
  const [step, setStep] = useState(0);
  const [quantity, setQuantity] = useState("1");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const steps = [t("Part", "القطعة"), t("Question", "السؤال"), t("Send", "الإرسال")];

  const qty = Number(quantity);
  const qtyOk = Number.isInteger(qty) && qty >= 1 && qty <= 999;
  const qOk = question.trim().length >= 3;

  const next = () => {
    setErr(null);
    if (step === 0 && !qtyOk) return setErr(t("Quantity must be a whole number from 1 to 999.", "يجب أن تكون الكمية عددًا صحيحًا من 1 إلى 999."));
    if (step === 1 && !qOk) return setErr(t("Please write your question.", "يرجى كتابة سؤالك."));
    setStep(step + 1);
  };
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const inq = await customerInquiries.create({ productId, quantity: qty, question: question.trim() });
      router.replace(`/customer/inquiry/${inq.id}`);
    } catch (e: any) {
      const existing = existingIdOf(e, "existingInquiryId");
      if (existing) router.replace(`/customer/inquiry/${existing}`);
      else setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const back = () => (step > 0 ? setStep(step - 1) : router.canGoBack() ? router.back() : router.navigate("/customer/parts"));

  const p = state.data;
  return (
    <GaragePage
      hero={<GarageHero variant="detail" onBack={back} title={t("Ask the shop", "اسأل المتجر")} line={p ? p.shop.name : undefined} />}
      bottom={
        p ? (
          <StickyActionBar>
            {step > 0 ? <GButton variant="secondary" label={t("Back", "رجوع")} onPress={back} /> : null}
            {step < 2 ? <GButton flex label={t("Next", "التالي")} icon="arrow-forward" onPress={next} /> : <GButton flex icon="send" label={t("Send question", "إرسال السؤال")} busy={busy} onPress={submit} />}
          </StickyActionBar>
        ) : undefined
      }
    >
      {state.error && !p ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !p ? (
        <SkeletonBlock height={160} radius={gShape.card} />
      ) : (
        <View>
          <StepperHeader steps={steps} index={step} label={(i, n) => t(`Step ${i} of ${n}`, `الخطوة ${i} من ${n}`)} />
          <Card>
            <GText numberOfLines={2} style={[gType.label, { fontWeight: "800" }, align]}>{p.name}</GText>
            <GText soft numberOfLines={1} style={[gType.caption, align]}>{`${p.brand} · ${p.partNumber}`}</GText>
            <View style={[row, { alignItems: "center", justifyContent: "space-between", marginTop: 8 }]}>
              <GText soft numberOfLines={1} style={[gType.caption, { flex: 1 }, align]}>{`${p.shop.name} · ${p.shop.city}`}</GText>
              <GText style={{ fontSize: 16, fontWeight: "800", color: g.accentText, writingDirection: "ltr" }}>{formatPrice(p.price)}</GText>
            </View>
          </Card>
          <View style={{ marginTop: 16 }}>
            {step === 0 ? (
              <Field label={t("Quantity", "الكمية")} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" maxLength={3} error={quantity && !qtyOk ? t("1 to 999", "من 1 إلى 999") : undefined} />
            ) : step === 1 ? (
              <Field label={t("Your question", "سؤالك")} value={question} onChangeText={setQuestion} multiline maxLength={1000} placeholder={t("Is this available? Does it fit my car?", "هل هي متوفرة؟ هل تناسب سيارتي؟")} />
            ) : (
              <Card soft>
                <GText soft style={[gType.caption, align, { fontWeight: "700" }]}>{t("Quantity", "الكمية")}</GText>
                <GText style={[gType.body, align, { marginBottom: 10 }]}>{quantity}</GText>
                <GText soft style={[gType.caption, align, { fontWeight: "700" }]}>{t("Your question", "سؤالك")}</GText>
                <GText style={[gType.body, align]}>{question.trim()}</GText>
              </Card>
            )}
          </View>
          {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
          <Note icon="lock-closed-outline">{t("The shop sees your name and your question. Your email is never shared.", "يرى المتجر اسمك وسؤالك فقط. لا تتم مشاركة بريدك الإلكتروني أبدًا.")}</Note>
        </View>
      )}
    </GaragePage>
  );
}
