import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { catalogService } from "../../../features/catalog/catalogService";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { customerInquiries, existingIdOf } from "../../../features/requests/requestsService";
import { C } from "../../../features/shared/palette";
import { Async, Button, Card, Field, Header, Notice, useL, useLoad } from "../../../features/shared/ui";

// "Ask the shop": one product, a quantity and a question. If the customer already has this question open,
// the server answers with that thread and we open it instead.
export default function NewInquiry() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { t, align } = useL();
  const state = useLoad(() => catalogService.getPart(productId), [productId]);
  const [quantity, setQuantity] = useState("1");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) return setErr(t("Quantity must be a whole number from 1 to 999.", "يجب أن تكون الكمية عددًا صحيحًا من 1 إلى 999."));
    if (question.trim().length < 3) return setErr(t("Please write your question.", "يرجى كتابة سؤالك."));
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

  return (
    <CustomerScreen>
      <Header brand="MOTEXA" title={t("Ask the shop", "اسأل المتجر")} back />
      <Async state={state}>
        {(p) => (
          <>
            <Card>
              <Text numberOfLines={2} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{p.name}</Text>
              <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                {p.brand} · {p.partNumber}
              </Text>
              <Text numberOfLines={1} style={[{ color: C.textDim, fontSize: 12, marginTop: 3 }, align]}>
                {p.shop.name} · {p.shop.city}
              </Text>
            </Card>
            <Card>
              <Field label={t("Quantity", "الكمية")} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" maxLength={3} />
              <Field
                label={t("Your question", "سؤالك")}
                value={question}
                onChangeText={setQuestion}
                multiline
                maxLength={1000}
                placeholder={t("Is this available? Does it fit my car?", "هل هي متوفرة؟ هل تناسب سيارتي؟")}
              />
              {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
              <Button icon="send-outline" label={t("Send question", "إرسال السؤال")} disabled={busy} onPress={submit} />
            </Card>
            <Notice icon="information-circle-outline">
              {t("The shop sees your name and your question. Your email is never shared.", "يرى المتجر اسمك وسؤالك فقط. لا تتم مشاركة بريدك الإلكتروني أبدًا.")}
            </Notice>
          </>
        )}
      </Async>
    </CustomerScreen>
  );
}
