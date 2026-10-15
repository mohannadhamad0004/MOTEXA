import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { partsAdminService } from "../../../features/parts/partsService";
import { HistoryList, KV, PrivateDocs, VerificationBadge } from "../../../features/shared/blocks";
import { asActor, useSessionUser } from "../../../features/shared/session";
import {
  Async, Button, Card, Header, Notice, ReasonPanel, Screen, Section, useL, useLoad,
} from "../../../features/shared/ui";

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
            <Section title={t("Business", "النشاط التجاري")} />
            <Card>
              <KV k={t("Shop name", "اسم المتجر")} v={s.name} />
              <KV k={t("Address", "العنوان")} v={s.address} />
              <KV k={t("City", "المدينة")} v={s.city} />
            </Card>
            <Section title={t("Owner / contact", "المالك / جهة الاتصال")} />
            <Card>
              <KV k={t("Name", "الاسم")} v={s.ownerName} />
              <KV k={t("Phone", "الهاتف")} v={s.phone} />
              <KV k={t("Email", "البريد")} v={s.ownerEmail} />
            </Card>
            <PrivateDocs
              title={t("Verification documents", "مستندات التحقق")}
              docs={s.documents.map((d) => ({ label: d.kind, fileName: d.fileName }))}
            />
            <Section title={t("Decision", "القرار")} />
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
            <Section title={t("Verification history", "سجل الاعتماد")} />
            <HistoryList items={s.history} />
          </>
        )}
      </Async>
    </Screen>
  );
}
