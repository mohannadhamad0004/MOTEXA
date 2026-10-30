import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, ErrorState, GarageHero, GaragePage, GButton, GText, ListRow, Note, Section, SkeletonBlock, StatusChip } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { shortId } from "../../../features/requests/activeRequest";
import { GarageThread, inquiryTone } from "../../../features/requests/garageBits";
import { customerInquiries } from "../../../features/requests/requestsService";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

export default function InquiryThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const { row, align } = useGarageTheme();
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
  const statusLabel = { OPEN: t("Open", "مفتوح"), ANSWERED: t("Answered", "تم الرد"), CLOSED: t("Closed", "مغلق") };
  const q = state.data;

  return (
    <GaragePage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      hero={<GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/customer/requests"))} title={t("Your question", "سؤالك")} line={q ? `${q.shop.name} · ${shortId(id)}` : shortId(id)} />}
    >
      {state.error && !q ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !q ? (
        <SkeletonBlock height={140} radius={gShape.card} />
      ) : (
        <View>
          <Card>
            <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
              <View style={{ flex: 1 }}>
                <GText numberOfLines={2} style={[gType.label, { fontWeight: "800" }, align]}>{q.product.name}</GText>
                <GText soft numberOfLines={1} style={[gType.caption, align, { writingDirection: "ltr" }]}>{q.product.partNumber}</GText>
              </View>
              <StatusChip tone={inquiryTone(q.status)} label={statusLabel[q.status]} />
            </View>
            <ListRow divider icon="storefront-outline" title={t("Shop", "المتجر")} sub={`${q.shop.name} · ${q.shop.city}`} />
            <ListRow divider icon="layers-outline" title={t("Quantity", "الكمية")} end={<GText style={gType.label}>{String(q.quantity)}</GText>} />
            {q.product.id ? <ListRow divider icon="cube-outline" title={t("View the part", "عرض القطعة")} onPress={() => router.push(`/customer/parts/${q.product.id}`)} /> : null}
          </Card>
          {!q.product.id ? <Note>{t("This part is no longer listed.", "هذه القطعة لم تعد معروضة.")}</Note> : null}

          <Section title={t("Messages", "الرسائل")}>
            <GarageThread
              messages={q.messages ?? []}
              canReply={q.status !== "CLOSED"}
              busy={busy}
              error={err}
              onSend={(body) => act(() => customerInquiries.reply(q.id, body))}
              startedText={t(`Question sent to ${q.shop.name}`, `تم إرسال السؤال إلى ${q.shop.name}`)}
              closedText={q.status === "CLOSED" ? t("This question is closed. No new messages can be added.", "تم إغلاق هذا السؤال. لا يمكن إضافة رسائل جديدة.") : undefined}
            />
          </Section>

          {q.status !== "CLOSED" ? (
            <View style={{ marginTop: 20, gap: 8 }}>
              {!confirm ? (
                <GButton variant="ghost" icon="lock-closed-outline" label={t("Close this question", "إغلاق هذا السؤال")} disabled={busy} onPress={() => setConfirm(true)} />
              ) : (
                <View style={[row, { gap: 10 }]}>
                  <GButton flex variant="secondary" label={t("Cancel", "إلغاء")} onPress={() => setConfirm(false)} />
                  <GButton flex variant="danger" label={t("Yes, close it", "نعم، أغلقه")} disabled={busy} onPress={async () => { if (await act(() => customerInquiries.close(q.id))) setConfirm(false); }} />
                </View>
              )}
            </View>
          ) : null}
        </View>
      )}
    </GaragePage>
  );
}
