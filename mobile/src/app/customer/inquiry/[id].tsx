import { Async, Notice } from "../../../components/ui/Feedback";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { KV } from "../../../components/ui/Rows";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Screen } from "../../../components/layout/Screen";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { InquiryStatusBadge, Thread } from "../../../features/requests/requestBits";
import { customerInquiries } from "../../../features/requests/requestsService";

export default function InquiryThread() {
  const { c: col } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, row, align } = useL();
  const state = useLoad(() => customerInquiries.get(id), [id]);
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
    <Screen onRefresh={state.reload} refreshing={state.loading && !!state.data}>
      <Header brand="MOTEXA" title={t("Your question", "سؤالك")} back />
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
              <KV k={t("Shop", "المتجر")} v={`${q.shop.name} · ${q.shop.city}`} />
              <KV k={t("Quantity", "الكمية")} v={q.quantity} />
            </Card>
            {q.product.id ? (
              <Button variant="ghost" icon="cube-outline" label={t("View the part", "عرض القطعة")} onPress={() => router.push(`/customer/parts/${q.product.id}`)} />
            ) : (
              <Notice icon="information-circle-outline">{t("This part is no longer listed.", "هذه القطعة لم تعد معروضة.")}</Notice>
            )}

            <Thread
              messages={q.messages ?? []}
              canReply={q.status !== "CLOSED"}
              busy={busy}
              error={err}
              onSend={(body) => act(() => customerInquiries.reply(q.id, body))}
            />

            {q.status !== "CLOSED" && (
              <View style={{ marginTop: 16, gap: 8 }}>
                {!confirm ? (
                  <Button variant="ghost" icon="lock-closed-outline" label={t("Close this question", "إغلاق هذا السؤال")} disabled={busy} onPress={() => setConfirm(true)} />
                ) : (
                  <>
                    <Button variant="danger" label={t("Yes, close it", "نعم، أغلقه")} disabled={busy} onPress={async () => { if (await act(() => customerInquiries.close(q.id))) setConfirm(false); }} />
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
