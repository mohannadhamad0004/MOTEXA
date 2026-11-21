import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Card, Chip, EmptyState, ErrorState, GButton, GText, ListRow, Note, SkeletonRows, StatusChip, Tone } from "../../components/garage";
import { ItemRow } from "../../components/ItemActionsMenu";
import { companyDriverActions, companyTruckActions } from "../tow/provider/companyActions";
import { ProviderLayout } from "../../components/layout/ProviderLayout";
import { publicImageUrl } from "../../core/constants/files";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { DriverWizard } from "../fleet/DriverWizard";
import { TruckWizard } from "../fleet/TruckWizard";
import { CompanyDriver, DriverStatus, companyDispatch } from "../tow/dispatchService";
import { Truck, towFleetService } from "../tow/towService";
import { useTruckLabels } from "../tow/truckBits";
import { asActor, useSessionUser } from "../shared/session";

type Part = "drivers" | "trucks";
type Wizard = null | { kind: "truck"; truck?: Truck } | { kind: "driver"; driver?: CompanyDriver; self?: boolean };

/**
 * Fleet: Drivers and Trucks as cards with ONE status chip each (Free / Busy / Offline), one "+ Add" button for the open list, and
 * short step forms (progress dots) to add or edit. Truck details, documents and removal (with a confirmation) are one tap away.
 */
export function FleetTab() {
  const { t } = useL();
  const user = useSessionUser();
  const { type } = useTruckLabels();
  const { g, row, align } = useGarageTheme();
  const [part, setPart] = useState<Part>("drivers");
  const [trucks, setTrucks] = useState<Truck[] | null>(null);
  const [drivers, setDrivers] = useState<CompanyDriver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState<Wizard>(null);
  const load = useCallback(async () => {
    try {
      const [f, d] = await Promise.all([towFleetService.getMyFleet(asActor(user)), companyDispatch.drivers()]);
      setTrucks(f.trucks);
      setDrivers(d);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      void load();
      const h = setInterval(load, 15_000);
      return () => clearInterval(h);
    }, [load])
  );

  // one chip: Free / Busy / Offline (everything that cannot work right now reads Offline, with the reason on the card)
  const chip = (s: DriverStatus): { tone: Tone; label: string } =>
    s === "FREE" ? { tone: "success", label: t("Free", "متاح") } : s === "BUSY" ? { tone: "accent", label: t("Busy", "مشغول") } : { tone: "neutral", label: t("Offline", "غير متصل") };
  const reason = (d: CompanyDriver) =>
    d.status === "UNAPPROVED" ? (d.approval === "PENDING" ? (d.approvalReason ? `${t("MOTEXA asked for changes", "طلبت موتكسا تعديلات")}: ${d.approvalReason}. ${t("Edit the driver's licence to resubmit.", "عدّل رخصة السائق لإعادة الإرسال.")}` : t("Waiting for MOTEXA to review the licence.", "بانتظار مراجعة موتكسا للرخصة.")) : `${d.approval === "REJECTED" ? t("Licence rejected", "تم رفض الرخصة") : t("Suspended", "موقوف")}${d.approvalReason ? `: ${d.approvalReason}` : ""}`) : d.status === "NO_TRUCK" ? t("No truck ready to work.", "لا توجد شاحنة جاهزة للعمل.") : null;
  const truckChip = (x: Truck): { tone: Tone; label: string } =>
    x.verification !== "APPROVED" ? { tone: "warning", label: x.verification === "PENDING" ? t("Awaiting approval", "بانتظار الاعتماد") : t("Rejected", "مرفوضة") } : x.operational === "AVAILABLE" ? chip("FREE") : x.operational === "BUSY" ? chip("BUSY") : chip("OFFLINE");
  const ownerDrives = !!drivers?.some((d) => d.isOwner);
  const approved = (trucks ?? []).filter((x) => x.verification === "APPROVED");
  const done = () => {
    setWizard(null);
    void load();
  };
  return (
    <>
      <ProviderLayout title={t("Fleet", "الأسطول")} subtitle={drivers && trucks ? t(`${drivers.length} drivers · ${trucks.length} trucks`, `${drivers.length} سائقين · ${trucks.length} شاحنات`) : undefined} onRefresh={load}>
        <View style={[row, { gap: 8, marginBottom: 12 }]}>
          <Chip label={t("Drivers", "السائقون")} count={drivers?.length} on={part === "drivers"} onPress={() => setPart("drivers")} />
          <Chip label={t("Trucks", "الشاحنات")} count={trucks?.length} on={part === "trucks"} onPress={() => setPart("trucks")} />
        </View>
        <GButton
          icon="add"
          label={part === "drivers" ? t("Add driver", "إضافة سائق") : t("Add truck", "إضافة شاحنة")}
          onPress={() => setWizard(part === "drivers" ? { kind: "driver" } : { kind: "truck" })}
        />
        {part === "drivers" && drivers && !ownerDrives ? (
          <View style={{ marginTop: 8 }}>
            <GButton variant="ghost" icon="car-outline" label={t("I drive too", "أنا أقود أيضًا")} onPress={() => setWizard({ kind: "driver", self: true })} />
          </View>
        ) : null}
        {error && !trucks ? <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
        {!trucks && !error ? <View style={{ marginTop: 12 }}><SkeletonRows count={3} /></View> : null}
        {error && trucks ? <View style={{ marginTop: 12 }}><Note tone="danger" icon="alert-circle-outline">{error}</Note></View> : null}

        <View style={{ gap: 12, marginTop: 14 }}>
          {part === "drivers" && drivers && !drivers.length ? <EmptyState photo="empty.requests" text={t("No drivers yet. Add your first driver.", "لا يوجد سائقون بعد. أضف سائقك الأول.")} /> : null}
          {part === "drivers" ? drivers?.map((d) => {
            const c = chip(d.status);
            const why = reason(d);
            const photo = publicImageUrl(d.photoUri);
            return (
              <ItemRow key={d.id} title={d.name} subtitle={d.truck ? d.truck.plate : undefined} actions={companyDriverActions(t, d, { reload: load, edit: () => setWizard({ kind: "driver", driver: d }) })}>
                <View style={[row, { alignItems: "center", gap: 12 }]}>
                  {photo ? <Image source={{ uri: photo }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: g.tint }} contentFit="cover" /> : <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}><GText style={[gType.title, { color: g.accentText }]}>{d.name.trim().charAt(0).toUpperCase()}</GText></View>}
                  <View style={{ flex: 1 }}>
                    <GText numberOfLines={1} style={[gType.title, align]}>{d.isOwner ? `${d.name} (${t("you", "أنت")})` : d.name}</GText>
                    <GText soft numberOfLines={1} style={[gType.caption, align]}>{d.truck ? `${type[d.truck.type]} · ${d.truck.plate}` : t("No truck linked", "لا توجد شاحنة")}</GText>
                  </View>
                  <StatusChip tone={c.tone} label={c.label} />
                </View>
                {why ? <View style={{ marginTop: 8 }}><Note tone={d.approval === "PENDING" ? "neutral" : "danger"} icon="shield-checkmark-outline">{why}</Note></View> : null}
                {d.job ? <ListRow divider icon="navigate-outline" title={`${t("On a job", "في مهمة")}: ${d.job.customerFirstName}`} onPress={() => router.push({ pathname: "/provider/tow/dispatch/[id]", params: { id: d.job!.id } })} /> : null}
              </ItemRow>
            );
          }) : null}

          {part === "trucks" && trucks && !trucks.length ? <EmptyState photo="empty.requests" text={t("No trucks yet. Add your first truck.", "لا توجد شاحنات بعد. أضف شاحنتك الأولى.")} /> : null}
          {part === "trucks" ? trucks?.map((x) => {
            const c = truckChip(x);
            const photo = publicImageUrl(x.photoUri);
            return (
              <ItemRow key={x.id} title={`${type[x.type]} · ${x.plate}`} onPress={() => router.push({ pathname: "/provider/tow/[id]", params: { id: x.id } })} actions={companyTruckActions(t, x, { reload: load, edit: () => setWizard({ kind: "truck", truck: x }) })}>
                <View style={[row, { alignItems: "center", gap: 12 }]}>
                  {photo ? <Image source={{ uri: photo }} style={{ width: 72, height: 54, borderRadius: gShape.small, backgroundColor: g.tint }} contentFit="cover" /> : <View style={{ width: 72, height: 54, borderRadius: gShape.small, backgroundColor: g.tint }} />}
                  <View style={{ flex: 1 }}>
                    <GText numberOfLines={1} style={[gType.title, align]}>{`${type[x.type]} · ${x.plate}`}</GText>
                    <GText soft numberOfLines={1} style={[gType.caption, align]}>{`${x.make} ${x.model}${x.maxWeightKg ? ` · ${x.maxWeightKg} ${t("kg", "كغ")}` : ""}`}</GText>
                  </View>
                  <StatusChip tone={c.tone} label={c.label} />
                </View>
                {x.expiredDocuments?.length ? <View style={{ marginTop: 8 }}><Note tone="danger" icon="alert-circle-outline">{t("A document expired: no new jobs until it is renewed.", "انتهت صلاحية مستند: لا مهام جديدة حتى يُجدَّد.")}</Note></View> : null}
              </ItemRow>
            );
          }) : null}
        </View>
      </ProviderLayout>
      {wizard?.kind === "truck" ? <TruckWizard truck={wizard.truck} onClose={() => setWizard(null)} onSaved={done} /> : null}
      {wizard?.kind === "driver" ? <DriverWizard driver={wizard.driver} self={wizard.self} trucks={approved} onClose={() => setWizard(null)} onSaved={done} /> : null}
    </>
  );
}
