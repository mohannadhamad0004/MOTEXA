import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { HistoryList, KV, PrivateDocs, VerificationBadge } from "../../../features/shared/blocks";
import { C } from "../../../features/shared/palette";
import { asActor, useSessionUser } from "../../../features/shared/session";
import {
  Async, Button, Card, Header, Notice, ReasonPanel, Screen, Section, useL, useLoad,
} from "../../../features/shared/ui";
import { Truck, towAdminService } from "../../../features/tow/towService";
import { TruckSummary, docLabel, useTruckLabels } from "../../../features/tow/truckBits";

function TruckReview({ truck, onDone }: { truck: Truck; onDone: () => void }) {
  const user = useSessionUser();
  const { t } = useL();
  const { type } = useTruckLabels();
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const decide = async (d: { approve: true } | { approve: false; reason: string }) => {
    setBusy(true);
    setErr(null);
    try {
      await towAdminService.decideTruck(asActor(user), truck.id, d);
      setRejecting(false);
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <TruckSummary truck={truck} />
      <View style={{ height: 12 }} />
      <Button
        variant="ghost"
        label={open ? t("Hide details", "إخفاء التفاصيل") : t("Review details", "عرض التفاصيل")}
        icon={open ? "chevron-up" : "chevron-down"}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <View style={{ marginTop: 8 }}>
          <KV k={t("Type", "النوع")} v={type[truck.type]} />
          <KV k={t("Plate", "اللوحة")} v={truck.plate} />
          <KV k={t("Vehicle", "المركبة")} v={[truck.make, truck.model, truck.year].filter(Boolean).join(" ")} />
          <PrivateDocs
            title={t("Documents", "المستندات")}
            docs={truck.documents.map((d) => ({ label: docLabel(t, d.kind), fileName: d.fileName, expiresAt: d.expiresAt, uri: d.uri }))}
          />
          {truck.rejectionReason ? <Notice tone="danger" icon="close-circle-outline">{truck.rejectionReason}</Notice> : null}
          {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
          {truck.verification === "PENDING" && !rejecting && (
            <View style={{ gap: 8 }}>
              <Button label={t("Approve truck", "اعتماد الشاحنة")} icon="checkmark-circle-outline" disabled={busy} onPress={() => decide({ approve: true })} />
              <Button label={t("Reject truck", "رفض الشاحنة")} variant="danger" disabled={busy} onPress={() => setRejecting(true)} />
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
        </View>
      )}
    </Card>
  );
}

export default function AdminTowDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t } = useL();
  const state = useLoad(() => towAdminService.getCompany(asActor(user), id), [id, user.id]);

  return (
    <Screen>
      <Header brand="MOTEXA ADMIN" title={state.data?.company.name ?? t("Tow company", "شركة سحب")} back />
      <Async state={state}>
        {({ company, trucks }) => {
          const history = trucks.flatMap((tr) =>
            tr.history.map((h) => ({ ...h, actor: `${h.actor} · ${tr.plate}` }))
          ).sort((a, b) => a.at.localeCompare(b.at));
          return (
            <>
              <VerificationBadge value={company.verification} />
              <Section title={t("Company", "الشركة")} />
              <Card>
                <KV k={t("Contact", "المسؤول")} v={company.contactName} />
                <KV k={t("Phone", "الهاتف")} v={company.phone} />
                <KV k={t("City", "المدينة")} v={company.city} />
              </Card>
              <PrivateDocs
                title={t("Company documents", "مستندات الشركة")}
                docs={company.documents.map((d) => ({ label: d.kind, fileName: d.fileName, uri: d.uri }))}
              />
              <Section title={`${t("Trucks", "الشاحنات")} (${trucks.length})`} />
              <Text style={{ color: C.textDim, fontSize: 11, marginBottom: 10 }}>
                {t("Each truck is approved individually. Admins review and decide; truck details are owned by the company.", "تُعتمد كل شاحنة على حدة. يراجع المسؤول ويقرر فقط؛ بيانات الشاحنة يملكها المزود.")}
              </Text>
              {trucks.map((tr) => <TruckReview key={tr.id} truck={tr} onDone={state.reload} />)}
              <Section title={t("Verification history", "سجل الاعتماد")} />
              <HistoryList items={history} />
            </>
          );
        }}
      </Async>
    </Screen>
  );
}
