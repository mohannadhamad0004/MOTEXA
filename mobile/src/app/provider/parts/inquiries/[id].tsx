import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { InquiryStatusBadge, Thread } from "../../../../features/requests/requestBits";
import { shopInquiries } from "../../../../features/requests/requestsService";
import { C } from "../../../../features/shared/palette";
import { Async, Button, Card, Header, KV, Screen, useL, useLoad } from "../../../../features/shared/ui";

export default function ShopInquiryThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, row, align } = useL();
  const state = useLoad(() => shopInquiries.get(id), [id]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      state.reload();
      return true;
    } catch (e: any) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header brand="MOTEXA PARTS" title={t("Customer question", "سؤال عميل")} back />
      <Async state={state}>
        {(q) => (
          <>
            <Card>
              <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{q.product.name}</Text>
                  <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>{q.product.partNumber}</Text>
                </View>
                <InquiryStatusBadge value={q.status} />
              </View>
              <KV k={t("Customer", "العميل")} v={q.customerName} />
              <KV k={t("Quantity", "الكمية")} v={q.quantity} />
            </Card>

            <Thread
              messages={q.messages ?? []}
              canReply={q.status !== "CLOSED"}
              busy={busy}
              error={err}
              onSend={(body) => act(() => shopInquiries.reply(q.id, body))}
            />

            {q.status !== "CLOSED" && (
              <View style={{ marginTop: 16, gap: 8 }}>
                {!confirm ? (
                  <Button variant="ghost" icon="lock-closed-outline" label={t("Close this question", "إغلاق هذا السؤال")} disabled={busy} onPress={() => setConfirm(true)} />
                ) : (
                  <>
                    <Button variant="danger" label={t("Yes, close it", "نعم، أغلقه")} disabled={busy} onPress={async () => { if (await act(() => shopInquiries.close(q.id))) setConfirm(false); }} />
                    <Button variant="ghost" label={t("Cancel", "إلغاء")} onPress={() => setConfirm(false)} />
                  </>
                )}
              </View>
            )}
          </>
        )}
      </Async>
    </Screen>
  );
}
