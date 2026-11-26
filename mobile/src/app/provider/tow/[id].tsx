// One truck = Detail: approval + work status, vehicle facts, private documents, history. ONE primary: Edit truck (the step form);
// ⋮ = set out of service / available, remove (asks first). A truck on an active job cannot be edited or removed. /provider/tow/new
// opens the add-truck step form directly.
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { GButton, Note, StatusChip, type Tone } from "../../../components/garage";
import type { ItemAction } from "../../../components/ItemActionsMenu";
import { appStatus } from "../../../components/manage/ManagePage";
import { Block, DocRows, Facts, History, Loaded, Page } from "../../../components/manage/Page";
import { goBack } from "../../../core/hooks/nav";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { TruckWizard } from "../../../features/fleet/TruckWizard";
import { asActor, useSessionUser } from "../../../features/shared/session";
import { towFleetService, type Operational } from "../../../features/tow/towService";
import { docLabel, expiredList, useTruckLabels } from "../../../features/tow/truckBits";

const OPS: Record<Operational, [Tone, string, string]> = { AVAILABLE: ["success", "Available", "متاح"], BUSY: ["warning", "Busy", "مشغولة"], OUT_OF_SERVICE: ["neutral", "Out of service", "خارج الخدمة"] };
const HISTORY: Record<string, [string, string]> = { SUBMITTED: ["Submitted", "تم التقديم"], APPROVED: ["Approved", "تمت الموافقة"], REJECTED: ["Rejected", "تم الرفض"] };

export default function TruckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t } = useL();
  const { type } = useTruckLabels();
  const isNew = id === "new";
  const state = useLoad(() => (isNew ? Promise.resolve(null) : towFleetService.getMyTruck(asActor(user), id)), [id, user.id]);
  const [editing, setEditing] = useState(false);
  if (isNew) return <Page title={t("Add truck", "إضافة شاحنة")}><TruckWizard onSaved={() => goBack("/provider/tow/fleet")} onClose={() => goBack("/provider/tow/fleet")} /></Page>;
  const truck = state.data;
  const ops = truck ? OPS[truck.operational] : null;
  const actions: ItemAction[] = !truck ? [] : [
    ...(truck.verification === "APPROVED" && !truck.hasActiveJob ? [{ key: "ops", icon: truck.operational === "AVAILABLE" ? "pause-circle-outline" as const : "play-circle-outline" as const,
      label: truck.operational === "AVAILABLE" ? t("Set out of service", "تعيين خارج الخدمة") : t("Set available", "تعيين كمتاح"),
      run: () => towFleetService.setOperational(asActor(user), truck.id, truck.operational === "AVAILABLE" ? "OUT_OF_SERVICE" : "AVAILABLE").then(() => state.reload()) }] : []),
    { key: "remove", label: t("Remove truck", "إزالة الشاحنة"), icon: "trash-outline", destructive: true, disabled: truck.hasActiveJob,
      hint: truck.hasActiveJob ? t("It is on a job: it can be removed when the job ends.", "إنها في مهمة: يمكن إزالتها عند انتهاء المهمة.") : undefined,
      confirm: { title: t("Remove this truck?", "إزالة هذه الشاحنة؟"), confirmLabel: t("Yes, remove this truck", "نعم، أزل هذه الشاحنة") },
      run: () => towFleetService.removeTruck(asActor(user), truck.id).then(() => goBack("/provider/tow/fleet")) },
  ];
  return (
    <Page title={truck ? `${type[truck.type]} · ${truck.plate}` : t("Truck", "الشاحنة")} line={truck ? [truck.make, truck.model, truck.year].filter(Boolean).join(" ") : undefined}
      actions={actions.length ? actions : undefined} onRefresh={() => void state.reload()} refreshing={false}
      footer={truck ? <GButton icon="create-outline" label={t("Edit truck", "تعديل الشاحنة")} disabled={truck.hasActiveJob} onPress={() => setEditing(true)} /> : undefined}>
      <Loaded state={state}>{(truck) => (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <StatusChip {...appStatus(truck.verification, t)} />
            {ops ? <StatusChip tone={ops[0]} label={t(ops[1], ops[2])} /> : null}
          </View>
          {truck.expiredDocuments?.length ? <Note tone="danger" icon="alert-circle-outline">{`${t("Truck documents expired: this truck cannot take new work until they are renewed. Your company and your other trucks are not affected.", "انتهت صلاحية مستندات الشاحنة: لا يمكنها استلام أعمال جديدة حتى يتم تجديدها. شركتك وشاحناتك الأخرى غير متأثرة.")} ${expiredList(t, truck).join(t(", ", "، "))}`}</Note> : null}
          {truck.hasActiveJob ? <Note icon="navigate-outline">{t("This truck is on an active job. Its status changes when the job ends; it cannot be edited or removed until then.", "هذه الشاحنة في مهمة نشطة. تتغير حالتها عند انتهاء المهمة، ولا يمكن تعديلها أو إزالتها حتى ذلك.")}</Note> : null}
          {truck.rejectionReason ? <Note tone="danger" icon="close-circle-outline">{truck.rejectionReason}</Note> : null}
          <Block title={t("Vehicle", "المركبة")}>
            <Facts rows={[[t("Type", "النوع"), type[truck.type]], [t("Plate", "اللوحة"), truck.plate], [t("Make / model", "الشركة / الطراز"), `${truck.make} ${truck.model}`], [t("Year", "السنة"), truck.year ? String(truck.year) : null],
              [t("Max load", "الحمل الأقصى"), truck.maxWeightKg ? `${truck.maxWeightKg} ${t("kg", "كغ")}` : null]]} />
          </Block>
          <Block title={t("Documents", "المستندات")}>
            <DocRows docs={truck.documents.map((d) => ({ label: docLabel(t, d.kind), fileName: d.fileName, expiresAt: d.expiresAt, uri: d.uri }))} />
          </Block>
          <Block title={t("History", "السجل")}>
            {truck.history.length ? <History items={[...truck.history].reverse().map((h) => ({ title: HISTORY[h.action] ? t(...HISTORY[h.action]!) : h.action, at: h.at.slice(0, 10), who: h.actor, note: h.reason }))} />
              : <Note>{t("No history yet. Approvals and changes will show here.", "لا يوجد سجل بعد. ستظهر هنا الموافقات والتغييرات.")}</Note>}
          </Block>
          {editing ? <TruckWizard truck={truck} onSaved={() => { setEditing(false); void state.reload(); }} onClose={() => setEditing(false)} /> : null}
        </>
      )}</Loaded>
    </Page>
  );
}
