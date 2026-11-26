// Shop business info = Form: the public address, hours and map point; Save is the one primary in the footer. The verified identity
// (name, brand, branch, city) changes through the application review, so it is shown as facts only.
import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Field, GButton, Note } from "../../../components/garage";
import { useDiscardGuard } from "../../../components/manage/Form";
import { Block, Facts, Loaded, Page } from "../../../components/manage/Page";
import { normalizeNumberText } from "../../../core/constants/numbers";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { portalApi } from "../../provider/portal/api";
import type { ShopProfile } from "../../provider/portal/types";

const go = (p: string) => router.push(p as Href);

function ProfileForm({ shop, onSaved }: { shop: ShopProfile; onSaved: () => void }) {
  const { t } = useL();
  const init = { address: shop.address ?? "", hours: shop.workingHours ?? "", lat: shop.baseLat?.toString() ?? "", lng: shop.baseLng?.toString() ?? "" };
  const [f, setF] = useState(init), [saved, setSaved] = useState(init), [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const guard = useDiscardGuard(dirty && !busy);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: k === "lat" || k === "lng" ? normalizeNumberText(v) : v }));
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await portalApi.updateProfile({ address: f.address, workingHours: f.hours, baseLat: f.lat.trim() ? Number(f.lat) : null, baseLng: f.lng.trim() ? Number(f.lng) : null });
      setSaved(f); setMsg({ ok: true, text: t("Profile saved.", "تم حفظ الملف.") }); onSaved();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };
  return (
    <Page title={t("Shop info", "معلومات المتجر")} line={shop.name}
      actions={[{ key: "preview", label: t("Preview as customer", "معاينة كعميل"), icon: "eye-outline", run: () => go("/provider/parts/preview") }, { key: "media", label: t("Photos and videos", "الصور والفيديو"), icon: "images-outline", run: () => go("/provider/parts/media") }]}
      footer={<GButton icon="checkmark" label={t("Save", "حفظ")} busy={busy} disabled={busy || !dirty} onPress={() => void save()} />}>
      <Block title={t("Verified identity", "الهوية الموثقة")}>
        <Facts rows={[[t("Name", "الاسم"), shop.name], [t("Brand", "العلامة"), shop.brandName], [t("Branch", "الفرع"), shop.branchName], [t("City", "المدينة"), shop.city]]} />
      </Block>
      <Note icon="shield-checkmark-outline">{t("Verified identity changes follow the existing application review process.", "تتبع تغييرات الهوية الموثقة إجراءات مراجعة الطلب الحالية.")}</Note>
      <Block title={t("Public business information", "معلومات النشاط العامة")}>
        <View style={{ gap: 12, paddingVertical: 10 }}>
          <Field label={t("Address", "العنوان")} value={f.address} onChangeText={set("address")} />
          <Field label={t("Working hours", "ساعات العمل")} value={f.hours} onChangeText={set("hours")} />
          <Field label={t("Latitude", "خط العرض")} value={f.lat} onChangeText={set("lat")} keyboardType="decimal-pad" />
          <Field label={t("Longitude", "خط الطول")} value={f.lng} onChangeText={set("lng")} keyboardType="decimal-pad" />
        </View>
      </Block>
      {msg ? <Note tone={msg.ok ? "success" : "danger"}>{msg.text}</Note> : null}
      {guard.sheet}
    </Page>
  );
}

export default function ProfilePage() {
  const { t } = useL();
  const state = useLoad(() => portalApi.profile(), []);
  if (!state.data) return <Page title={t("Shop info", "معلومات المتجر")}><Loaded state={state}>{() => null}</Loaded></Page>;
  return <ProfileForm key={state.data.id} shop={state.data} onSaved={() => void state.reload()} />;
}
