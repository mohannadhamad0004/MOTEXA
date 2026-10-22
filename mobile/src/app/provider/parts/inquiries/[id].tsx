import { Async } from "../../../../components/ui/Feedback";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { DashboardLayout } from "../../../../components/layout/DashboardLayout";
import { KV } from "../../../../components/ui/Rows";
import { useL } from "../../../../core/hooks/useL";
import { useLoad } from "../../../../core/hooks/useLoad";
import { Text } from "../../../../components/ui/Text";
import { useTheme } from "../../../../theme/useTheme";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { InquiryStatusBadge, Thread } from "../../../../features/requests/requestBits";
import { shopInquiries } from "../../../../features/requests/requestsService";

export default function ShopInquiryThread() {
  const { c: col } = useTheme();
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
    <DashboardLayout tag="QUESTION / P3" brand="MOTEXA PARTS" title={t("Customer question", "سؤال عميل")} back>
      <Async state={state}>
        {(q) => (
          <>
            <Card>
              <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{q.product.name}</Text>
                  <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>{q.product.partNumber}</Text>
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
    </DashboardLayout>
  );
}
