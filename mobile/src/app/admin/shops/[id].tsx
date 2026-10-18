import { Async, EmptyState, Notice } from "../../../components/ui/Feedback";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { ReasonPanel } from "../../../components/ui/ReasonPanel";
import { Screen } from "../../../components/layout/Screen";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { ImageTile } from "../../../components/ui/Rows";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { StockBadge, fitmentSummary } from "../../../features/parts/partsBits";
import { Product, partsAdminService } from "../../../features/parts/partsService";
import { HistoryList, KV, PrivateDocs, VerificationBadge } from "../../../features/shared/blocks";
import { findCategory, labelOf } from "../../../core/constants/categories";
import { formatPrice } from "../../../core/constants/money";
import { asActor, useSessionUser } from "../../../features/shared/session";

/** One product with the only product action an admin has: hide it (reason required) or show it again. */
function ProductModeration({ product: p, onDone }: { product: Product; onDone: () => void }) {
  const { c: col } = useTheme();
  const user = useSessionUser();
  const { t, row, align, isArabic } = useL();
  const [hiding, setHiding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const change = async (c: { hidden: true; reason: string } | { hidden: false }) => {
    setBusy(true);
    setErr(null);
    try {
      await partsAdminService.setProductVisibility(asActor(user), p.id, c);
      setHiding(false);
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={[row, { gap: 14 }]}>
        <ImageTile uri={p.imageUri} icon="cube-outline" size={64} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{p.name}</Text>
          <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>{p.brand} · {p.partNumber}</Text>
          <Text numberOfLines={1} style={[{ color: col.textDim, fontSize: 12, marginTop: 2 }, align]}>{fitmentSummary(p, t)}</Text>
          <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 2 }, align]}>
            {p.category ? labelOf(findCategory(p.category), isArabic) : t("No category", "بدون فئة")}
          </Text>
        </View>
      </View>
      <View style={[row, { flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 12 }]}>
        <Text style={{ color: col.accent, fontSize: 15, fontWeight: "800", marginHorizontal: 4 }}>{formatPrice(p.price)}</Text>
        <Badge tone="neutral" label={`${t("Qty", "الكمية")} ${p.stock}`} />
        <StockBadge stock={p.stock} />
        {p.hidden && <Badge tone="danger" icon="eye-off-outline" label={t("Hidden", "مخفية")} />}
      </View>
      {p.hidden && p.hiddenReason ? (
        <View style={{ marginTop: 12 }}>
          <Notice tone="danger" icon="eye-off-outline">{p.hiddenReason}</Notice>
        </View>
      ) : null}
      {err ? <View style={{ marginTop: 12 }}><Notice tone="danger" icon="alert-circle-outline">{err}</Notice></View> : null}
      <View style={{ marginTop: 12, gap: 8 }}>
        {!hiding && !p.hidden && (
          <Button variant="ghost" icon="eye-off-outline" label={t("Hide", "إخفاء")} disabled={busy} onPress={() => setHiding(true)} />
        )}
        {!hiding && p.hidden && (
          <Button variant="ghost" icon="eye-outline" label={t("Show again", "إظهار مرة أخرى")} disabled={busy} onPress={() => change({ hidden: false })} />
        )}
        {hiding && (
          <ReasonPanel
            title={t("Reason for hiding (required)", "سبب الإخفاء (مطلوب)")}
            confirmLabel={t("Confirm hide", "تأكيد الإخفاء")}
            onCancel={() => setHiding(false)}
            onConfirm={(reason) => change({ hidden: true, reason })}
          />
        )}
      </View>
    </Card>
  );
}

export default function AdminShopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t } = useL();
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const state = useLoad(() => partsAdminService.getShop(asActor(user), id), [id, user.id]);

  const decide = async (d: { approve: true } | { approve: false; reason: string }) => {
    setBusy(true);
    setErr(null);
    try {
      await partsAdminService.decideShop(asActor(user), id, d);
      setRejecting(false);
      state.reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header brand="MOTEXA ADMIN" title={state.data?.name ?? t("Parts shop", "متجر قطع غيار")} back />
      <Async state={state}>
        {(s) => (
          <>
            <VerificationBadge value={s.verification} />
            <SectionHeader title={t("Business", "النشاط التجاري")} />
            <Card>
              <KV k={t("Shop name", "اسم المتجر")} v={s.name} />
              <KV k={t("Address", "العنوان")} v={s.address} />
              <KV k={t("City", "المدينة")} v={s.city} />
            </Card>
            <SectionHeader title={t("Owner / contact", "المالك / جهة الاتصال")} />
            <Card>
              <KV k={t("Name", "الاسم")} v={s.ownerName} />
              <KV k={t("Phone", "الهاتف")} v={s.phone} />
              <KV k={t("Email", "البريد")} v={s.ownerEmail} />
            </Card>
            <PrivateDocs
              title={t("Verification documents", "مستندات التحقق")}
              docs={s.documents.map((d) => ({ label: d.kind, fileName: d.fileName, uri: d.uri }))}
            />
            <SectionHeader title={t("Decision", "القرار")} />
            <Card>
              <Notice icon="information-circle-outline">
                {t(
                  "This approves the shop account only. Product listings are owned by the shop and are not editable here.",
                  "هذا اعتماد لحساب المتجر فقط. منتجات المتجر يملكها المتجر ولا تُعدَّل من هنا."
                )}
              </Notice>
              {s.rejectionReason ? <Notice tone="danger" icon="close-circle-outline">{s.rejectionReason}</Notice> : null}
              {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
              {!rejecting && (
                <View style={{ gap: 8 }}>
                  {s.verification !== "APPROVED" && (
                    <Button label={t("Approve shop", "اعتماد المتجر")} icon="checkmark-circle-outline" disabled={busy} onPress={() => decide({ approve: true })} />
                  )}
                  {s.verification !== "REJECTED" && (
                    <Button label={t("Reject shop", "رفض المتجر")} variant="danger" disabled={busy} onPress={() => setRejecting(true)} />
                  )}
                </View>
              )}
              {rejecting && (
                <ReasonPanel
                  title={t("Rejection reason (required)", "سبب الرفض (مطلوب)")}
                  confirmLabel={t("Confirm rejection", "تأكيد الرفض")}
                  onCancel={() => setRejecting(false)}
                  onConfirm={(reason) => decide({ approve: false, reason })}
                />
              )}
            </Card>
            <SectionHeader title={`${t("Products", "المنتجات")} (${s.products.length})`} />
            {s.products.length ? (
              s.products.map((p) => <ProductModeration key={p.id} product={p} onDone={state.reload} />)
            ) : (
              <EmptyState icon="cube-outline" text={t("This shop has no products yet.", "لا توجد منتجات لهذا المتجر بعد.")} />
            )}
            <SectionHeader title={t("Verification history", "سجل الاعتماد")} />
            <HistoryList items={s.history} />
          </>
        )}
      </Async>
    </Screen>
  );
}
