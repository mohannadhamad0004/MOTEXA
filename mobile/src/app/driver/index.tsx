import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Card, EmptyState, ErrorState, GarageHero,  GButton, GIcon, GText, ListRow, Note, Section, SkeletonRows, StatusChip, Tap, Toggle, Tone } from "../../components/garage";
import { ProviderLayout as GaragePage } from "../../components/layout/ProviderLayout";
import { useL } from "../../core/hooks/useL";
import { DriverMe, TowJob, driverApi } from "../../features/tow/dispatchService";
import { fmtDateTime, useTowStatusLabels } from "../../features/requests/requestBits";
import { towTone } from "../../features/requests/garageBits";
import { signOut } from "../../features/shared/session";
import { useTruckLabels } from "../../features/tow/truckBits";
import { gShape, gType, useGarageTheme } from "../../theme/garage";

const WAITING = ["REQUESTED"];
const ACTIVE = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];

/** The driver's home: online / offline, his truck, new jobs to answer, the active job, recent jobs. Refreshed every 15 s. */
export default function DriverHome() {
  const { g, shadow, row, align } = useGarageTheme();
  const { t } = useL();
  const L = useTowStatusLabels();
  const { type } = useTruckLabels();
  const [data, setData] = useState<{ driver: DriverMe; jobs: TowJob[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await driverApi.me());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
      const h = setInterval(load, 15_000);
      return () => clearInterval(h);
    }, [load])
  );
  const toggle = async (online: boolean) => {
    setBusy(true);
    try {
      await driverApi.setOffline(!online);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const d = data?.driver;
  const statusTone: Record<string, Tone> = { FREE: "success", BUSY: "accent", OFFLINE: "neutral", NO_TRUCK: "warning" };
  const statusLabel: Record<string, string> = { FREE: t("Free", "متاح"), BUSY: t("Busy", "مشغول"), OFFLINE: t("Offline", "غير متصل"), NO_TRUCK: t("No truck ready", "لا شاحنة جاهزة") };
  const row_ = (j: TowJob) => (
    <Tap key={j.id} label={`${j.customer.firstName}, ${L[j.status]}`} onPress={() => router.push({ pathname: "/driver/job/[id]", params: { id: j.id } })} style={[{ padding: 14, borderRadius: gShape.card, backgroundColor: g.card, gap: 6 }, shadow(1)]}>
      <View style={[row, { alignItems: "center", gap: 8 }]}>
        <GIcon name="car-outline" size={18} />
        <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flex: 1 }, align]}>{`${j.customer.firstName} · ${j.vehicle.make} ${j.vehicle.model}`}</GText>
        <GIcon name="chevron-forward" size={16} color={g.soft} flip />
      </View>
      <GText soft numberOfLines={2} style={[gType.caption, align]}>{j.pickupAddress}</GText>
      <View style={[row, { alignItems: "center", justifyContent: "space-between" }]}>
        <StatusChip tone={towTone(j.status)} label={j.status === "EN_ROUTE" && j.arrivedAt ? L.ARRIVED : L[j.status]} />
        <GText soft style={[gType.tiny, { writingDirection: "ltr" }]}>{fmtDateTime(j.updatedAt)}</GText>
      </View>
    </Tap>
  );
  const waiting = (data?.jobs ?? []).filter((j) => WAITING.includes(j.status));
  const active = (data?.jobs ?? []).filter((j) => ACTIVE.includes(j.status));
  const past = (data?.jobs ?? []).filter((j) => !WAITING.includes(j.status) && !ACTIVE.includes(j.status));

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero variant="main" title={d ? d.name : t("My jobs", "مهامي")} line={d ? d.company : undefined} action={{ icon: "log-out-outline", label: t("Sign out", "تسجيل الخروج"), onPress: () => void signOut() }}>
          {d ? <StatusChip tone={statusTone[d.status]} label={statusLabel[d.status]} /> : null}
        </GarageHero>
      }
    >
      {error && !data ? <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!data && !error ? <SkeletonRows count={3} /> : null}
      {d ? (
        <>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
          <Card>
            <Toggle label={t("Online", "متصل")} sub={d.status === "BUSY" ? t("You are on a job", "أنت في مهمة") : t("Customers can choose you when you are free", "يمكن للزبائن اختيارك عندما تكون متاحًا")} value={!d.offline} onChange={(v) => !busy && void toggle(v)} />
            <ListRow divider icon="car-outline" title={d.truck ? `${type[d.truck.type]} · ${d.truck.make} ${d.truck.model}` : t("No truck linked", "لا توجد شاحنة مرتبطة")} sub={d.truck ? d.truck.plate : t("Ask your company to link one", "اطلب من شركتك ربط شاحنة")} />
          </Card>
          {waiting.length ? (
            <Section title={t("New jobs", "مهام جديدة")}>
              <View style={{ gap: 10 }}>{waiting.map(row_)}</View>
            </Section>
          ) : null}
          <Section title={t("Active job", "المهمة الحالية")}>
            {active.length ? <View style={{ gap: 10 }}>{active.map(row_)}</View> : <EmptyState photo="empty.requests" text={t("No active job.", "لا توجد مهمة حالية.")} />}
          </Section>
          {past.length ? (
            <Section title={t("Recent", "الأخيرة")}>
              <View style={{ gap: 10 }}>{past.map(row_)}</View>
            </Section>
          ) : null}
          <GButton variant="ghost" icon="log-out-outline" label={t("Sign out", "تسجيل الخروج")} onPress={() => void signOut()} style={{ marginTop: 20 }} />
        </>
      ) : null}
    </GaragePage>
  );
}
