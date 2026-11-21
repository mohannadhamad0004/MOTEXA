import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { EmptyState, ErrorState, GarageHero, GaragePage, GButton, GText, Note, SkeletonRows } from "../../../components/garage";
import { Point } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useSessionUser } from "../../../core/session/session";
import { LocationProblem, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import { DriverCard } from "../../../features/tow/DriverCard";
import { NearbyDriver, nearbyDrivers } from "../../../features/tow/dispatchService";
import { gType, useGarageTheme } from "../../../theme/garage";

/**
 * "Choose a driver": FREE drivers of approved companies, nearest first. A driver's pin is his truck's base (rounded to ~110 m),
 * never a live position (MOTEXA does not track idle trucks). Your own position is read only when you tap the button.
 */
export default function ChooseDriver() {
  const { t, isArabic } = useL();
  const { align } = useGarageTheme();
  const user = useSessionUser();
  const loc = useCurrentLocation("tow-request", user.id);
  const [me, setMe] = useState<Point | null>(null);
  const [list, setList] = useState<NearbyDriver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setList(await nearbyDrivers(me));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [me]);
  useEffect(() => {
    void load();
  }, [load]);
  const km = (n: number) => (n < 1 ? t("under 1 km away", "على بعد أقل من كم") : t(`about ${n < 10 ? n.toFixed(1) : Math.round(n)} km away`, `على بعد نحو ${n < 10 ? n.toFixed(1) : Math.round(n)} كم`));

  return (
    <GaragePage
      onRefresh={load}
      hero={<GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/customer/tow"))} title={t("Choose a driver", "اختر سائقًا")} line={list ? t(`${list.length} free drivers`, `${list.length} سائقين متاحين`) : undefined} />}
    >
      {loc.dialog}
      <GButton
        variant="secondary"
        icon="locate-outline"
        label={me ? t("Location on: sorted by distance", "الموقع مفعّل: الترتيب حسب المسافة") : loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my location to sort by distance", "استخدم موقعي للترتيب حسب المسافة")}
        disabled={loc.locating}
        onPress={async () => {
          const p = await loc.locate();
          if (p) setMe(p);
        }}
      />
      <LocationProblem loc={loc} />
      <View style={{ marginTop: 12, gap: 12 }}>
        {error && !list ? <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
        {!list && !error ? <SkeletonRows count={3} /> : null}
        {list && !list.length ? <EmptyState photo="empty.search" text={t("No driver is free right now. Try “Nearest available” or a company.", "لا يوجد سائق متاح الآن. جرّب «الأقرب المتاح» أو اختر شركة.")} /> : null}
        {list?.map((d) => (
          <DriverCard
            key={d.id}
            d={d}
            extra={d.distanceKm !== null ? km(d.distanceKm) : null}
            onPress={() => router.push({ pathname: "/customer/towrequest/new", params: { companyId: d.company.id, driverId: d.id } })}
          />
        ))}
        {list?.length ? <GText soft style={[gType.tiny, align]}>{t("Distance is from the driver's truck base to you, in a straight line. Drivers are not tracked while idle.", "المسافة من موقع شاحنة السائق إليك بخط مستقيم. لا يتم تتبع السائقين وهم غير مشغولين.")}</GText> : null}
      </View>
      <Note icon="lock-closed-outline">{t("Phone numbers are never shown. You chat with the driver inside MOTEXA after he accepts.", "لا تُعرض أرقام الهواتف أبدًا. تتحدث مع السائق داخل موتكسا بعد قبوله.")}</Note>
    </GaragePage>
  );
}
