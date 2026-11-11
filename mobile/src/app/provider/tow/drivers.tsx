import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image } from "expo-image";
import { View } from "react-native";
import { PickedPhoto, photoErrorText, pickPhoto } from "../../../core/hooks/pickPhoto";
import { publicImageUrl } from "../../../core/constants/files";
import { Card, Chip, EmptyState, ErrorState, Field, GarageHero,  GButton, GText, ListRow, Note, Section, Sheet, SkeletonRows, StatusChip, Toggle, Tone } from "../../../components/garage";
import { ProviderLayout as GaragePage } from "../../../components/layout/ProviderLayout";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { CompanyDriver, companyDispatch, liveLabel } from "../../../features/tow/dispatchService";
import { asActor, useSessionUser } from "../../../features/shared/session";
import { towFleetService } from "../../../features/tow/towService";
import { useTruckLabels } from "../../../features/tow/truckBits";
import { useTowStatusLabels } from "../../../features/requests/requestBits";
import { gType, useGarageTheme } from "../../../theme/garage";

/**
 * The company's drivers: FREE / BUSY / OFFLINE (BUSY is automatic), their truck and current job, an offline switch, a truck
 * picker, and "Add a driver" (a login the owner creates: name, email, phone, password, truck) or "I drive too" (no new login).
 */
export default function CompanyDrivers() {
  const { row, align } = useGarageTheme();
  const { t } = useL();
  const user = useSessionUser();
  const { type } = useTruckLabels();
  const L = useTowStatusLabels();
  const [list, setList] = useState<CompanyDriver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fleet = useLoad(() => towFleetService.getMyFleet(asActor(user)), [user.id]);
  const trucks = (fleet.data?.trucks ?? []).filter((x) => x.verification === "APPROVED");
  const load = useCallback(async () => {
    try {
      setList(await companyDispatch.drivers());
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

  type Form = { self: boolean; fullName: string; email: string; phone: string; licenceNumber: string; photo: PickedPhoto | null; licence: PickedPhoto | null; truckId: string | null };
  const blank = (self: boolean): Form => ({ self, fullName: "", email: "", phone: "", licenceNumber: "", photo: null, licence: null, truckId: null });
  const [form, setForm] = useState<Form | null>(null);
  const pick = async (key: "photo" | "licence") => {
    setFormErr(null);
    try {
      const p = await pickPhoto();
      if (p) setForm((f) => (f ? { ...f, [key]: p } : f));
    } catch (e) {
      setFormErr(photoErrorText(e, t));
    }
  };
  const save = () => {
    if (!form) return;
    if (!form.self && form.fullName.trim().length < 3) return setFormErr(t("Enter the driver's full name.", "أدخل الاسم الكامل للسائق."));
    if (!form.self && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setFormErr(t("Enter a valid email: the driver gets his sign-in code there.", "أدخل بريدًا صحيحًا: سيصل إليه رمز الدخول."));
    if (form.phone.trim().length < 8) return setFormErr(t("Enter the driver's phone.", "أدخل هاتف السائق."));
    if (form.licenceNumber.trim().length < 4) return setFormErr(t("Enter the licence number.", "أدخل رقم الرخصة."));
    if (!form.licence) return setFormErr(t("Add a photo of the driving licence.", "أضف صورة رخصة القيادة."));
    void run(
      () =>
        companyDispatch.addDriver({
          self: form.self,
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          licenceNumber: form.licenceNumber.trim(),
          licencePhoto: { dataBase64: form.licence!.base64, name: "licence.jpg" },
          ...(form.photo ? { photo: { dataBase64: form.photo.base64, name: "driver.jpg" } } : {}),
          truckId: form.truckId,
        }),
      () => setForm(null)
    );
  };
  const [truckFor, setTruckFor] = useState<CompanyDriver | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setFormErr(null);
    try {
      await fn();
      after?.();
      await load();
    } catch (e: any) {
      setFormErr(e.message);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const tone: Record<string, Tone> = { FREE: "success", BUSY: "accent", OFFLINE: "neutral", NO_TRUCK: "warning", UNAPPROVED: "warning" };
  const label: Record<string, string> = { FREE: t("Free", "متاح"), BUSY: t("Busy", "مشغول"), OFFLINE: t("Offline", "غير متصل"), NO_TRUCK: t("No truck ready", "لا شاحنة جاهزة"), UNAPPROVED: t("Licence not approved", "الرخصة غير معتمدة") };
  const approvalText = (d: CompanyDriver) => d.approval === "PENDING" ? (d.approvalReason ? `${t("MOTEXA asked for changes", "طلبت موتكسا تعديلات")}: ${d.approvalReason}. ${t("Edit the driver's licence to resubmit.", "عدّل رخصة السائق لإعادة الإرسال.")}` : t("Waiting for the licence review by MOTEXA.", "بانتظار مراجعة رخصة السائق من موتكسا.")) : d.approval === "REJECTED" ? `${t("Licence rejected", "تم رفض الرخصة")}${d.approvalReason ? `: ${d.approvalReason}` : ""}` : d.approval === "SUSPENDED" ? `${t("Suspended by MOTEXA", "أوقفه موتكسا")}${d.approvalReason ? `: ${d.approvalReason}` : ""}` : null;
  const ownerDrives = !!list?.some((d) => d.isOwner);

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/provider/tow"))}
          title={t("Drivers", "السائقون")}
          line={list ? t(`${list.filter((d) => d.status === "FREE").length} free · ${list.filter((d) => d.status === "BUSY").length} busy`, `${list.filter((d) => d.status === "FREE").length} متاح · ${list.filter((d) => d.status === "BUSY").length} مشغول`) : undefined}
        />
      }
    >
      {error && !list ? <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!list && !error ? <SkeletonRows count={3} /> : null}
      {list ? (
        <>
          <View style={[row, { gap: 10 }]}>
            <GButton flex icon="person-add-outline" label={t("Add a driver", "إضافة سائق")} onPress={() => { setFormErr(null); setForm(blank(false)); }} />
            {!ownerDrives ? <GButton flex variant="secondary" icon="car-outline" label={t("I drive too", "أنا أقود أيضًا")} onPress={() => { setFormErr(null); setForm(blank(true)); }} /> : null}
          </View>
          <View style={{ marginTop: 8 }}><GButton variant="ghost" icon="stats-chart-outline" label={t("Statistics", "الإحصائيات")} onPress={() => router.push("/provider/tow/stats")} /></View>
          <Note>{t("Only free drivers can be chosen by customers. Busy is set automatically from accept until the job ends.", "يمكن للزبائن اختيار السائقين المتاحين فقط. يُضبط «مشغول» تلقائيًا من القبول حتى انتهاء المهمة.")}</Note>
          {!list.length ? (
            <EmptyState photo="empty.requests" text={t("No drivers yet. Add your first driver.", "لا يوجد سائقون بعد. أضف سائقك الأول.")} />
          ) : (
            <View style={{ gap: 12, marginTop: 12 }}>
              {list.map((d) => (
                <Card key={d.id}>
                  <View style={[row, { alignItems: "center", gap: 8 }]}>
                    {publicImageUrl(d.photoUri) ? <Image source={{ uri: publicImageUrl(d.photoUri)! }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" /> : null}
                    <GText style={[gType.title, { flex: 1 }, align]}>{d.isOwner ? `${d.name} (${t("you", "أنت")})` : d.name}</GText>
                    <StatusChip tone={tone[d.status]} label={label[d.status]} />
                  </View>
                  <GText soft style={[gType.caption, align, { writingDirection: "ltr" }]}>{`${d.phone} · ${d.email}`}</GText>
                  {approvalText(d) ? <Note tone={d.approval === "PENDING" ? "neutral" : "danger"} icon="shield-checkmark-outline">{approvalText(d)!}</Note> : null}
                  {!d.isOwner ? <GButton variant="ghost" icon="mail-outline" label={t("Send sign-in code again", "إرسال رمز الدخول مرة أخرى")} disabled={busy} onPress={() => void run(() => companyDispatch.invite(d.id))} /> : null}
                  <ListRow icon="car-outline" title={d.truck ? `${type[d.truck.type]} · ${d.truck.plate}` : t("No truck linked", "لا توجد شاحنة")} sub={t("Change truck", "تغيير الشاحنة")} onPress={() => setTruckFor(d)} />
                  {d.job ? (
                    <ListRow divider icon="navigate-outline" title={`${t("Job", "مهمة")}: ${d.job.customerFirstName}`} sub={`${L[d.job.status]} · ${liveLabel(d.live, t)}`} onPress={() => router.push({ pathname: "/provider/tow/dispatch/[id]", params: { id: d.job!.id } })} />
                  ) : null}
                  <Toggle label={t("Online", "متصل")} value={!d.offline} onChange={(v) => !busy && void run(() => companyDispatch.updateDriver(d.id, { offline: !v }))} />
                </Card>
              ))}
            </View>
          )}
        </>
      ) : null}

      <Sheet
        visible={!!form}
        onClose={() => setForm(null)}
        closeLabel={t("Close", "إغلاق")}
        title={form?.self ? t("I drive too", "أنا أقود أيضًا") : t("Add a driver", "إضافة سائق")}
        tall
        footer={<GButton label={t("Save", "حفظ")} busy={busy} onPress={save} />}
      >
        {form ? (
          <View>
            {!form.self ? (
              <>
                <Field label={t("Full name", "الاسم الكامل")} value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} maxLength={80} />
                <Field label={t("Email (the driver signs in with it)", "البريد الإلكتروني (يسجّل السائق الدخول به)")} value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" maxLength={120} />
                <GText soft style={[gType.caption, align, { marginBottom: 10 }]}>{t("We email the driver a code to set his own password. Nothing is shared with him until you save.", "نرسل للسائق رمزًا بالبريد ليعيّن كلمة مروره بنفسه.")}</GText>
              </>
            ) : null}
            <Field label={t("Phone (private, never shown to customers)", "الهاتف (خاص، لا يظهر للزبائن)")} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" maxLength={24} />
            <Field label={t("Driving licence number", "رقم رخصة القيادة")} value={form.licenceNumber} onChangeText={(v) => setForm({ ...form, licenceNumber: v })} autoCapitalize="characters" maxLength={40} />
            <GText soft style={[gType.caption, align, { marginBottom: 6 }]}>{t("The licence photo is private: only you and MOTEXA's review team see it.", "صورة الرخصة خاصة: لا يراها إلا أنت وفريق المراجعة في موتكسا.")}</GText>
            <View style={[row, { gap: 10, marginBottom: 12 }]}>
              <View style={{ flex: 1, gap: 6 }}>
                {form.licence ? <Image source={{ uri: form.licence.uri }} style={{ height: 90, borderRadius: 12 }} contentFit="cover" accessibilityLabel={t("Licence photo", "صورة الرخصة")} /> : null}
                <GButton variant="secondary" icon="card-outline" label={form.licence ? t("Change licence photo", "تغيير صورة الرخصة") : t("Licence photo", "صورة الرخصة")} onPress={() => void pick("licence")} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                {form.photo ? <Image source={{ uri: form.photo.uri }} style={{ height: 90, borderRadius: 12 }} contentFit="cover" accessibilityLabel={t("Driver photo", "صورة السائق")} /> : null}
                <GButton variant="secondary" icon="person-circle-outline" label={form.photo ? t("Change driver photo", "تغيير صورة السائق") : t("Driver photo", "صورة السائق")} onPress={() => void pick("photo")} />
              </View>
            </View>
            <GText style={[gType.label, align, { marginBottom: 8 }]}>{t("Truck", "الشاحنة")}</GText>
            <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
              <Chip label={t("None", "بدون")} on={!form.truckId} onPress={() => setForm({ ...form, truckId: null })} />
              {trucks.map((tr) => (
                <Chip key={tr.id} label={`${tr.plate} · ${type[tr.type]}`} on={form.truckId === tr.id} onPress={() => setForm({ ...form, truckId: tr.id })} />
              ))}
            </View>
            {formErr ? <View style={{ marginTop: 12 }}><Note tone="danger" icon="alert-circle-outline">{formErr}</Note></View> : null}
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={!!truckFor} onClose={() => setTruckFor(null)} closeLabel={t("Close", "إغلاق")} title={t("Truck for", "شاحنة") + (truckFor ? ` ${truckFor.name}` : "")}>
        {truckFor ? (
          <View style={{ gap: 8 }}>
            <Section title={t("Approved trucks", "الشاحنات المعتمدة")} style={{ marginTop: 0 }}>
              <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
                <Chip label={t("None", "بدون")} on={!truckFor.truck} onPress={() => void run(() => companyDispatch.updateDriver(truckFor.id, { truckId: null }), () => setTruckFor(null))} />
                {trucks.map((tr) => (
                  <Chip key={tr.id} label={`${tr.plate} · ${type[tr.type]}`} on={truckFor.truck?.id === tr.id} onPress={() => void run(() => companyDispatch.updateDriver(truckFor.id, { truckId: tr.id }), () => setTruckFor(null))} />
                ))}
              </View>
            </Section>
            {formErr ? <Note tone="danger" icon="alert-circle-outline">{formErr}</Note> : null}
          </View>
        ) : null}
      </Sheet>
    </GaragePage>
  );
}
