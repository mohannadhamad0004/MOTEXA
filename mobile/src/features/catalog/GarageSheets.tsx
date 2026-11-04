import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GButton, GIcon, GText, Note, Sheet, Tap } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import type { GarageCar } from "./catalogService";
import { activateCar, canAddGarageCar, closeMyCarPicker, garageError, openAddGarageCar, refreshGarage, useGarage, useGaragePicker } from "./myCar";

export function GarageCarLabel({ car }: { car: GarageCar }) {
  const { g, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  return <View style={[row, { gap: 12, alignItems: "center", flex: 1, minWidth: 0 }]}>
    <View accessibilityLabel={t("Car colour", "لون السيارة")} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: car.color ?? "#C0C0C0", borderWidth: 1, borderColor: g.line }} />
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <GText style={[gType.label, align, { fontWeight: "800" }]}>{`${car.make} ${car.model} ${car.year}`}</GText>
      {car.nickname ? <GText soft style={[gType.bodySm, align]}>{car.nickname}</GText> : null}
      {car.generation ? <GText soft style={[gType.caption, align]}>{isArabic ? car.generation.nameAr : car.generation.nameEn}</GText> : null}
    </View>
  </View>;
}

export function GarageSelectionSheet() {
  const picker = useGaragePicker();
  const { garageCars, activeCar, busy, loaded, loading, error } = useGarage();
  const { t } = useL();
  const { g, row } = useGarageTheme();
  const [err, setErr] = useState<string | null>(null);
  const open = picker?.mode === "select";
  useEffect(() => { if (open) { setErr(null); void refreshGarage(); } }, [open]);
  const select = async (id: string) => {
    setErr(null);
    try { await activateCar(id); closeMyCarPicker(); }
    catch (e) { setErr(garageError(e, t)); }
  };
  return <Sheet visible={open} onClose={() => { if (!busy) closeMyCarPicker(); }} closeLabel={t("Close", "إغلاق")} title={t("Choose a car", "اختر سيارة")}>
    <View style={{ gap: 12 }}>
      {(err || error) ? <Note tone="danger">{err ?? t("Could not refresh your Garage. Try again.", "تعذّر تحديث كراجك. حاول مجددًا.")}</Note> : null}
      {error ? <GButton variant="secondary" label={t("Retry", "إعادة المحاولة")} onPress={() => void refreshGarage()} /> : null}
      {!garageCars.length ? <GText soft>{loading || !loaded ? t("Loading Garage…", "جارٍ تحميل الكراج…") : t("Save your first car, or keep browsing without one.", "احفظ سيارتك الأولى، أو تابع التصفح دون سيارة.")}</GText> : null}
      {[...garageCars].sort((a, b) => Number(b.isActive) - Number(a.isActive)).map(car => <Tap key={car.id} label={`${car.make} ${car.model} ${car.year}${car.isActive ? t(", active", "، نشطة") : ""}`} disabled={busy || loading || !!error} onPress={() => void select(car.id)} style={[row, { gap: 8, alignItems: "center", padding: 14, borderRadius: gShape.card, backgroundColor: car.isActive ? g.tint : g.card, borderWidth: 1, borderColor: car.isActive ? g.accent : g.line }]}>
        <GarageCarLabel car={car} />
        {car.id === activeCar?.id ? <GIcon name="checkmark-circle" size={22} /> : null}
      </Tap>)}
      {canAddGarageCar(garageCars) ? <GButton variant="secondary" icon="add" label={t("Add another car", "إضافة سيارة أخرى")} disabled={busy || loading || !loaded || !!error} onPress={() => openAddGarageCar()} /> : <Note>{t("You've reached the 10-car Garage limit.", "وصلت إلى الحد الأقصى للكراج: 10 سيارات.")}</Note>}
      <GButton variant="ghost" icon="car-sport-outline" label={t("Manage My Garage", "إدارة كراجي")} disabled={busy} onPress={() => { closeMyCarPicker(); router.push("/customer/garage" as never); }} />
    </View>
  </Sheet>;
}
