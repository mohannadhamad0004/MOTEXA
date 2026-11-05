import { type Href, router } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { View } from "react-native";
import { Card, GarageHero, GaragePage, GButton, GText, Note } from "../../components/garage";
import MotexaDialog from "../../components/MotexaDialog";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { submissionApi } from "../../features/vehicle3d/api";
import { GarageCarLabel } from "../../features/catalog/GarageSheets";
import type { GarageCar } from "../../features/catalog/catalogService";
import { activateCar, canAddGarageCar, deleteGarageCar, garageError, openAddGarageCar, openEditGarageCar, refreshGarage, useGarage } from "../../features/catalog/myCar";
import { gType, useGarageTheme } from "../../theme/garage";

export default function MyGarage() {
  const { garageCars, loaded, loading, busy, error } = useGarage();
  const { t } = useL();
  const privateModels=useLoad(()=>submissionApi.list(),[]);
  const { g, row, align } = useGarageTheme();
  const [deleting, setDeleting] = useState<GarageCar | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { void refreshGarage(); }, []));
  const change = async (work: () => Promise<unknown>) => {
    setErr(null);
    try { await work(); setDeleting(null); }
    catch (e) { setErr(garageError(e, t)); setDeleting(null); }
  };
  return <GaragePage refreshing={loading && loaded} onRefresh={() => void refreshGarage()} hero={<GarageHero variant="detail" backLabel={t("Back", "رجوع")} onBack={() => router.canGoBack() ? router.back() : router.navigate("/customer/profile")} title={t("My Garage", "كراجي")} line={t("One active car, everywhere on MOTEXA.", "سيارة نشطة واحدة في كل أنحاء موتكسا.")} />}>
    <View style={{ gap: 14 }}>
      <GButton variant="secondary" label={t("Request my car / track requests", "طلب إضافة سيارتي / متابعة الطلبات")} onPress={()=>router.push("/customer/vehicle-requests" as Href)}/>
      {err || error ? <Note tone="danger">{err ?? t("Could not refresh your Garage. Your last saved view is shown.", "تعذّر تحديث كراجك. تظهر آخر قائمة محفوظة.")}</Note> : null}
      {error ? <GButton variant="secondary" label={t("Retry", "إعادة المحاولة")} onPress={() => void refreshGarage()} /> : null}
      <View style={[row, { gap: 6 }]}><GText soft style={[gType.caption, { writingDirection: "ltr" }]}>{`${garageCars.length} / 10`}</GText><GText soft style={gType.caption}>{t("saved cars", "سيارات محفوظة")}</GText></View>
      {!loaded ? <GText>{t("Loading Garage…", "جارٍ تحميل الكراج…")}</GText> : !garageCars.length && !error ? <Card><GText style={[gType.title, align]}>{t("Your Garage starts here", "كراجك يبدأ هنا")}</GText><GText soft style={[gType.bodySm, align, { marginTop: 8 }]}>{t("Save a car for matching parts and faster requests. You can also keep browsing without one.", "احفظ سيارة للقطع المناسبة والطلبات الأسرع. يمكنك أيضًا متابعة التصفح دون سيارة.")}</GText></Card> : null}
      {[...garageCars].sort((a, b) => Number(b.isActive) - Number(a.isActive)).map(car => <Card key={car.id} style={car.isActive ? { borderWidth: 1, borderColor: g.accent } : undefined}>
        <GarageCarLabel car={car} />
        <GButton variant="secondary" label={privateModels.data?.some(s=>s.garageCarId===car.id&&s.hasModel)?t("View my 3D car","عرض سيارتي ثلاثية الأبعاد"):t("Create my 3D car", "إنشاء سيارتي ثلاثية الأبعاد")} style={{ marginTop: 12 }} onPress={() => router.push(`/customer/vehicle3d/${car.id}` as Href)} />
        {car.isActive ? <GText style={[gType.caption, align, { marginTop: 10, color: g.accentText, fontWeight: "800" }]}>{t("★ Active car", "★ السيارة النشطة")}</GText> : <GButton variant="secondary" label={t("Set active", "تعيين كنشطة")} disabled={busy || loading || !!error} onPress={() => void change(() => activateCar(car.id))} style={{ marginTop: 12 }} />}
        <View style={[row, { gap: 12, marginTop: 8 }]}>
          <GButton flex variant="ghost" icon="create-outline" label={t("Edit", "تعديل")} disabled={busy || loading || !!error} onPress={() => openEditGarageCar(car.id)} />
          <GButton flex variant="danger" icon="trash-outline" label={t("Delete", "حذف")} disabled={busy || loading || !!error} onPress={() => setDeleting(car)} />
        </View>
      </Card>)}
      {canAddGarageCar(garageCars) ? <GButton icon="add" label={t("Add car", "إضافة سيارة")} disabled={busy || loading || !loaded || !!error} onPress={() => openAddGarageCar()} /> : <Note>{t("You've reached the 10-car Garage limit.", "وصلت إلى الحد الأقصى للكراج: 10 سيارات.")}</Note>}
    </View>
    <MotexaDialog visible={!!deleting} type="warning" icon="trash-outline" title={t("Delete car?", "حذف السيارة؟")} message={deleting ? `${deleting.make} ${deleting.model} ${deleting.year}. ${deleting.isActive && garageCars.length > 1 ? t("Another saved car will become active.", "ستصبح سيارة محفوظة أخرى نشطة.") : t("This removes the car from your Garage.", "سيؤدي هذا إلى إزالة السيارة من كراجك.")}` : ""} confirmText={t("Delete", "حذف")} cancelText={t("Cancel", "إلغاء")} loading={busy} onCancel={() => { if (!busy) setDeleting(null); }} onConfirm={() => { if (deleting) void change(() => deleteGarageCar(deleting.id)); }} />
  </GaragePage>;
}
