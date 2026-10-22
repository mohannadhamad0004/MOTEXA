import { Async, Notice } from "../../../components/ui/Feedback";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { ReasonPanel } from "../../../components/ui/ReasonPanel";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { HistoryList, KV, PrivateDocs, VerificationBadge } from "../../../features/shared/blocks";
import { asActor, useSessionUser } from "../../../features/shared/session";
import { cityLabel } from "../../../core/constants/cities";
import { TowCompany, Truck, towAdminService } from "../../../features/tow/towService";
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
          {truck.maxWeightKg ? <KV k={t("Max load", "الحمل الأقصى")} v={`${truck.maxWeightKg} ${t("kg", "كغ")}`} /> : null}
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

/** Approve / reject the company account itself (trucks are decided one by one below). */
function CompanyDecision({ company, onDone }: { company: TowCompany; onDone: () => void }) {
  const user = useSessionUser();
  const { t } = useL();
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const decide = async (d: { approve: true } | { approve: false; reason: string }) => {
    setBusy(true);
    setErr(null);
    try {
      await towAdminService.decideCompany(asActor(user), company.id, d);
      setRejecting(false);
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader title={t("Company decision", "قرار الشركة")} />
      <Card>
        <Notice icon="information-circle-outline">
          {t(
            "This approves the company account only. Each truck is approved separately below.",
            "هذا اعتماد لحساب الشركة فقط. تُعتمد كل شاحنة على حدة أدناه."
          )}
        </Notice>
        {company.rejectionReason ? <Notice tone="danger" icon="close-circle-outline">{company.rejectionReason}</Notice> : null}
        {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
        {!rejecting && (
          <View style={{ gap: 8 }}>
            {company.verification !== "APPROVED" && (
              <Button label={t("Approve company", "اعتماد الشركة")} icon="checkmark-circle-outline" disabled={busy} onPress={() => decide({ approve: true })} />
            )}
            {company.verification !== "REJECTED" && (
              <Button label={t("Reject company", "رفض الشركة")} variant="danger" disabled={busy} onPress={() => setRejecting(true)} />
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
    </>
  );
}

export default function AdminTowDetail() {
  const { c: col } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t, isArabic } = useL();
  const state = useLoad(() => towAdminService.getCompany(asActor(user), id), [id, user.id]);

  return (
    <DashboardLayout kind="tow" tag="COMPANY / A2" brand="MOTEXA ADMIN" title={state.data?.company.name ?? t("Tow company", "شركة سحب")} back>
      <Async state={state}>
        {({ company, trucks, companyHistory }) => {
          // Company decisions and truck events, merged in time order.
          const history = [
            ...companyHistory.map((h) => ({ ...h, actor: `${h.actor} · ${t("company", "الشركة")}` })),
            ...trucks.flatMap((tr) => tr.history.map((h) => ({ ...h, actor: `${h.actor} · ${tr.plate}` }))),
          ].sort((a, b) => a.at.localeCompare(b.at));
          return (
            <>
              <VerificationBadge value={company.verification} />
              <SectionHeader title={t("Company", "الشركة")} />
              <Card>
                <KV k={t("Contact", "المسؤول")} v={company.contactName} />
                <KV k={t("Phone", "الهاتف")} v={company.phone} />
                <KV k={t("City", "المدينة")} v={company.city} />
                <KV k={t("Address", "العنوان")} v={company.address} />
                <KV k={t("Working hours", "ساعات العمل")} v={company.workingHours} />
                <KV k={t("Service area", "منطقة الخدمة")} v={company.serviceCities.map((c) => cityLabel(c, isArabic)).join(isArabic ? "، " : ", ")} />
                <KV k={t("Description", "الوصف")} v={company.description} />
              </Card>
              <PrivateDocs
                title={t("Company documents", "مستندات الشركة")}
                docs={company.documents.map((d) => ({ label: d.kind, fileName: d.fileName, uri: d.uri }))}
              />
              <CompanyDecision company={company} onDone={state.reload} />
              <SectionHeader title={`${t("Trucks", "الشاحنات")} (${trucks.length})`} />
              <Text style={{ color: col.textDim, fontSize: 11, marginBottom: 10 }}>
                {t("Each truck is approved individually. Admins review and decide; truck details are owned by the company.", "تُعتمد كل شاحنة على حدة. يراجع المسؤول ويقرر فقط؛ بيانات الشاحنة يملكها المزود.")}
              </Text>
              {trucks.map((tr) => <TruckReview key={tr.id} truck={tr} onDone={state.reload} />)}
              <SectionHeader title={t("Verification history", "سجل الاعتماد")} />
              <HistoryList items={history} />
            </>
          );
        }}
      </Async>
    </DashboardLayout>
  );
}
