import { Async, Notice } from "../../../components/ui/Feedback";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { ProviderLayout as DashboardLayout } from "../../../components/layout/ProviderLayout";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { ImageTile } from "../../../components/ui/Rows";
import { goBack } from "../../../core/hooks/nav";
import { TruckWizard } from "../../../features/fleet/TruckWizard";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { HistoryList, KV, PrivateDocs, VerificationBadge } from "../../../features/shared/blocks";
import { asActor, useSessionUser } from "../../../features/shared/session";
import { DocKind, TRUCK_TYPES, Truck, TruckInput, TruckType, towFleetService } from "../../../features/tow/towService";
import { ExpiredNotice, OperationalBadge, TruckSummary, docLabel, useTruckLabels } from "../../../features/tow/truckBits";
import { isRealDate } from "../../../core/constants/files";

function TruckView({ truck, onChange }: { truck: Truck; onChange: () => void }) {
  const user = useSessionUser();
  const { t } = useL();
  const { type } = useTruckLabels();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wizard = editing ? <TruckWizard truck={truck} onSaved={() => { setEditing(false); onChange(); }} onClose={() => setEditing(false)} /> : null;

  const remove = async () => {
    try {
      await towFleetService.removeTruck(asActor(user), truck.id);
      goBack("/provider/tow");
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const setOperational = async (value: "AVAILABLE" | "OUT_OF_SERVICE") => {
    setStatusBusy(true);
    setErr(null);
    try {
      await towFleetService.setOperational(asActor(user), truck.id, value);
      onChange();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <>
      {wizard}
      <ExpiredNotice truck={truck} />
      <Card>
        <TruckSummary truck={truck} />
      </Card>

      <SectionHeader title={t("Vehicle", "المركبة")} />
      <Card>
        <KV k={t("Type", "النوع")} v={type[truck.type]} />
        <KV k={t("Plate", "اللوحة")} v={truck.plate} />
        <KV k={t("Make / model", "الشركة / الطراز")} v={`${truck.make} ${truck.model}`} />
        <KV k={t("Year", "السنة")} v={truck.year} />
        {truck.maxWeightKg ? <KV k={t("Max load", "الحمل الأقصى")} v={`${truck.maxWeightKg} ${t("kg", "كغ")}`} /> : null}
      </Card>

      <SectionHeader title={t("Status", "الحالة")} />
      <Card>
        <View style={{ gap: 10, alignItems: "flex-start" }}>
          <VerificationBadge value={truck.verification} prefix={t("Approval", "الاعتماد")} />
          <OperationalBadge value={truck.operational} />
        </View>
        {truck.verification === "APPROVED" && !truck.hasActiveJob && (
          <View style={{ marginTop: 12 }}>
            <Button
              variant="ghost"
              icon={truck.operational === "AVAILABLE" ? "pause-circle-outline" : "play-circle-outline"}
              label={truck.operational === "AVAILABLE" ? t("Set out of service", "تعيين خارج الخدمة") : t("Set available", "تعيين كمتاح")}
              disabled={statusBusy}
              onPress={() => setOperational(truck.operational === "AVAILABLE" ? "OUT_OF_SERVICE" : "AVAILABLE")}
            />
          </View>
        )}
        {truck.hasActiveJob && (
          <View style={{ marginTop: 12 }}>
            <Notice icon="navigate-outline">{t("This truck is on an active job. Its status changes when the job ends.", "هذه الشاحنة في مهمة نشطة. تتغير حالتها عند انتهاء المهمة.")}</Notice>
          </View>
        )}
        {truck.rejectionReason ? (
          <View style={{ marginTop: 12 }}>
            <Notice tone="danger" icon="close-circle-outline">{truck.rejectionReason}</Notice>
          </View>
        ) : null}
      </Card>

      <PrivateDocs
        title={t("Documents", "المستندات")}
        docs={truck.documents.map((d) => ({ label: docLabel(t, d.kind), fileName: d.fileName, expiresAt: d.expiresAt, uri: d.uri }))}
      />
      <SectionHeader title={t("History", "السجل")} />
      <HistoryList items={truck.history} />

      <View style={{ height: 20 }} />
      {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
      <View style={{ gap: 8 }}>
        <Button icon="create-outline" label={t("Edit truck", "تعديل الشاحنة")} disabled={truck.hasActiveJob} onPress={() => setEditing(true)} />
        {truck.hasActiveJob && (
          <Notice icon="lock-closed-outline">
            {t("This truck is engaged in a service and cannot be removed until it finishes.", "هذه الشاحنة منشغلة بخدمة ولا يمكن إزالتها حتى تنتهي.")}
          </Notice>
        )}
        {!confirm ? (
          <Button variant="danger" icon="trash-outline" label={t("Remove truck", "إزالة الشاحنة")} disabled={truck.hasActiveJob} onPress={() => setConfirm(true)} />
        ) : (
          <>
            <Button variant="danger" label={t("Yes, remove this truck", "نعم، أزل هذه الشاحنة")} onPress={remove} />
            <Button variant="ghost" label={t("Cancel", "إلغاء")} onPress={() => setConfirm(false)} />
          </>
        )}
      </View>
    </>
  );
}

export default function TruckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t } = useL();
  const isNew = id === "new";
  const state = useLoad<Truck | null>(
    () => (isNew ? Promise.resolve(null) : towFleetService.getMyTruck(asActor(user), id)),
    [id, user.id]
  );

  return (
    <DashboardLayout tag="TRUCK / T3" brand="MOTEXA TOW" title={isNew ? t("Add truck", "إضافة شاحنة") : t("Truck", "الشاحنة")} back>
      {isNew ? (
        <TruckWizard onSaved={() => goBack("/provider/tow")} onClose={() => goBack("/provider/tow")} />
      ) : (
        <Async state={state as { data: Truck | null; error: string | null; loading: boolean; reload: () => void }}>
          {(tr) => <TruckView truck={tr} onChange={state.reload} />}
        </Async>
      )}
    </DashboardLayout>
  );
}
