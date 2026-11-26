// Fleet = List (docs/guide/10-ui-system.md): segmented Drivers | Trucks with counts, compact rows with ONE status chip each (Free /
// Busy / Offline; trucks: awaiting approval / rejected), what cannot work first, ⋮ per row; "Add driver" / "I drive too" / "Add truck"
// are entry rows; adding or editing opens the short step forms (sheets). Also the /provider/tow/drivers and /trucks pages.
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { GText, type Tone } from "../../components/garage";
import { ManageEntry, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { publicImageUrl } from "../../core/constants/files";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { DriverWizard } from "../fleet/DriverWizard";
import { TruckWizard } from "../fleet/TruckWizard";
import { CompanyDriver, DriverStatus, companyDispatch } from "../tow/dispatchService";
import { companyDriverActions, companyTruckActions } from "../tow/provider/companyActions";
import { Truck, towFleetService } from "../tow/towService";
import { useTruckLabels } from "../tow/truckBits";
import { asActor, useSessionUser } from "../shared/session";
import { useInTabs } from "./inTabs";

type Part = "drivers" | "trucks";
type Wizard = null | { kind: "truck"; truck?: Truck } | { kind: "driver"; driver?: CompanyDriver; self?: boolean };

function Avatar({ uri, name, wide }: { uri: string | null; name: string; wide?: boolean }) {
  const { g } = useGarageTheme();
  const box = { width: wide ? 52 : 40, height: 40, borderRadius: wide ? gShape.small - 4 : 20, backgroundColor: g.tint, alignItems: "center" as const, justifyContent: "center" as const };
  return uri ? <Image source={{ uri }} style={box} contentFit="cover" /> : <View style={box}>{wide ? null : <GText style={[gType.label, { color: g.accentText, fontWeight: "800" }]}>{name.trim().charAt(0).toUpperCase()}</GText>}</View>;
}

export function FleetTab({ initial = "drivers" }: { initial?: Part }) {
  const { t } = useL();
  const user = useSessionUser();
  const { type } = useTruckLabels();
  const tabRoot = useInTabs();
  const [part, setPart] = useState<Part>(initial);
  const [wizard, setWizard] = useState<Wizard>(null);
  const state = useLoad(() => Promise.all([towFleetService.getMyFleet(asActor(user)), companyDispatch.drivers()]).then(([f, d]) => ({ trucks: f.trucks, drivers: d })), [user.id], 15_000);
  const trucks = state.data?.trucks, drivers = state.data?.drivers;
  // one chip: Free / Busy / Offline (everything that cannot work right now reads Offline, with the reason in the second line)
  const chip = (s: DriverStatus): { tone: Tone; label: string } =>
    s === "FREE" ? { tone: "success", label: t("Free", "متاح") } : s === "BUSY" ? { tone: "accent", label: t("Busy", "مشغول") } : { tone: "neutral", label: t("Offline", "غير متصل") };
  const reason = (d: CompanyDriver) =>
    d.status === "UNAPPROVED" ? (d.approval === "PENDING" ? (d.approvalReason ? `${t("MOTEXA asked for changes", "طلبت موتكسا تعديلات")}: ${d.approvalReason}` : t("Waiting for MOTEXA to review the licence", "بانتظار مراجعة موتكسا للرخصة")) : `${d.approval === "REJECTED" ? t("Licence rejected", "تم رفض الرخصة") : t("Suspended", "موقوف")}${d.approvalReason ? `: ${d.approvalReason}` : ""}`)
    : d.status === "NO_TRUCK" ? t("No truck ready to work", "لا توجد شاحنة جاهزة للعمل") : null;
  const truckChip = (x: Truck): { tone: Tone; label: string } =>
    x.verification !== "APPROVED" ? { tone: "warning", label: x.verification === "PENDING" ? t("Awaiting approval", "بانتظار الاعتماد") : t("Rejected", "مرفوضة") } : x.operational === "AVAILABLE" ? chip("FREE") : x.operational === "BUSY" ? chip("BUSY") : chip("OFFLINE");
  const ownerDrives = !!drivers?.some((d) => d.isOwner);
  const approved = (trucks ?? []).filter((x) => x.verification === "APPROVED");
  const done = () => { setWizard(null); void state.reload(); };
  const rank = (d: CompanyDriver) => (d.status === "UNAPPROVED" || d.status === "NO_TRUCK" ? 0 : d.status === "BUSY" ? 1 : d.status === "FREE" ? 2 : 3);
  const driverRows = [...(drivers ?? [])].sort((a, b) => rank(a) - rank(b));
  const truckRows = [...(trucks ?? [])].sort((a, b) => Number(a.verification === "APPROVED") - Number(b.verification === "APPROVED") || Number(!a.expiredDocuments?.length) - Number(!b.expiredDocuments?.length));
  const above = part === "drivers"
    ? <View style={{ gap: 8 }}>
        <ManageEntry icon="person-add-outline" title={t("Add driver", "إضافة سائق")} onPress={() => setWizard({ kind: "driver" })} />
        {drivers && !ownerDrives ? <ManageEntry icon="car-outline" title={t("I drive too", "أنا أقود أيضًا")} sub={t("Take jobs yourself, without a new login", "استلم المهام بنفسك دون حساب جديد")} onPress={() => setWizard({ kind: "driver", self: true })} /> : null}
      </View>
    : <ManageEntry icon="add-circle-outline" title={t("Add truck", "إضافة شاحنة")} onPress={() => setWizard({ kind: "truck" })} />;
  return (
    <>
      <ManagePage<CompanyDriver | Truck> title={t("Fleet", "الأسطول")} back={!tabRoot} tabBar={tabRoot}
        line={drivers && trucks ? t(`${drivers.length} drivers · ${trucks.length} trucks`, `${drivers.length} سائقين · ${trucks.length} شاحنات`) : undefined}
        tabs={{ value: part, onChange: (k) => setPart(k as Part), options: [{ key: "drivers", label: t("Drivers", "السائقون"), count: drivers?.length }, { key: "trucks", label: t("Trucks", "الشاحنات"), count: trucks?.length }] }}
        above={above}
        items={part === "drivers" ? driverRows : truckRows} keyOf={(x) => x.id}
        renderItem={(x) => {
          if (part === "drivers") {
            const d = x as CompanyDriver, c = chip(d.status);
            return <ManageRow title={d.isOwner ? `${d.name} (${t("you", "أنت")})` : d.name} leading={<Avatar uri={publicImageUrl(d.photoUri)} name={d.name} />}
              sub={[reason(d), d.job ? `${t("On a job", "في مهمة")}: ${d.job.customerFirstName}` : null, d.truck ? `${type[d.truck.type]} · ${d.truck.plate}` : t("No truck linked", "لا توجد شاحنة")].filter(Boolean).join(" · ")}
              status={c} onPress={d.job ? () => router.push({ pathname: "/provider/tow/dispatch/[id]", params: { id: d.job!.id } }) : undefined}
              actions={companyDriverActions(t, d, { reload: state.reload, edit: () => setWizard({ kind: "driver", driver: d }) })} />;
          }
          const tr = x as Truck;
          return <ManageRow title={`${type[tr.type]} · ${tr.plate}`} leading={<Avatar uri={publicImageUrl(tr.photoUri)} name={tr.plate} wide />}
            sub={[tr.expiredDocuments?.length ? t("A document expired: no new jobs", "انتهى مستند: لا مهام جديدة") : null, tr.verification === "REJECTED" ? tr.rejectionReason : null, `${tr.make} ${tr.model}`, tr.maxWeightKg ? `${tr.maxWeightKg} ${t("kg", "كغ")}` : null].filter(Boolean).join(" · ")}
            status={truckChip(tr)} onPress={() => router.push({ pathname: "/provider/tow/[id]", params: { id: tr.id } })}
            actions={companyTruckActions(t, tr, { reload: state.reload, edit: () => setWizard({ kind: "truck", truck: tr }) })} />;
        }}
        loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
        empty={{ text: part === "drivers" ? t("No drivers yet. Add your first driver.", "لا يوجد سائقون بعد. أضف سائقك الأول.") : t("No trucks yet. Add your first truck.", "لا توجد شاحنات بعد. أضف شاحنتك الأولى.") }}
        onRefresh={() => void state.reload()} refreshing={false} detailHint={t("Tap a truck to open it.", "اضغط على شاحنة لفتحها.")} />
      {wizard?.kind === "truck" ? <TruckWizard truck={wizard.truck} onClose={() => setWizard(null)} onSaved={done} /> : null}
      {wizard?.kind === "driver" ? <DriverWizard driver={wizard.driver} self={wizard.self} trucks={approved} onClose={() => setWizard(null)} onSaved={done} /> : null}
    </>
  );
}
