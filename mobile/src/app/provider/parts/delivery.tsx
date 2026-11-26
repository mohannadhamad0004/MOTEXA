// Delivery settings = Form: deliver or pickup only, the fee and where; Save is the one primary in the footer.
import { useState } from "react";
import { View } from "react-native";
import { Field, GButton, Note, Toggle } from "../../../components/garage";
import { useDiscardGuard } from "../../../components/manage/Form";
import { Loaded, Page } from "../../../components/manage/Page";
import { normalizeNumberText } from "../../../core/constants/numbers";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { shopOrders, type DeliverySettings } from "../../../features/orders/ordersService";

function DeliveryForm({ initial }: { initial: DeliverySettings }) {
  const { t } = useL();
  const init = { enabled: initial.enabled, fee: initial.fee === null ? "" : String(initial.fee), area: initial.areaNote ?? "" };
  const [f, setF] = useState(init), [saved, setSaved] = useState(init), [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const guard = useDiscardGuard(dirty && !busy);
  const feeOk = f.fee.trim() === "" || /^\d+(\.\d{1,2})?$/.test(f.fee.trim());
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await shopOrders.saveDelivery({ enabled: f.enabled, fee: f.fee.trim() === "" ? null : Number(f.fee.trim()), areaNote: f.area.trim() || null }); setSaved(f); setMsg({ ok: true, text: t("Saved.", "تم الحفظ.") }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };
  return (
    <Page title={t("Delivery", "التوصيل")} line={t("You deliver the orders yourself", "توصل الطلبات بنفسك")}
      footer={<GButton icon="checkmark" label={t("Save", "حفظ")} busy={busy} disabled={busy || !feeOk || !dirty} onPress={() => void save()} />}>
      <Toggle label={t("I deliver orders", "أوصل الطلبات")} sub={f.enabled ? t("Customers can choose delivery", "يمكن للزبائن اختيار التوصيل") : t("Pickup only", "الاستلام فقط")} value={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} />
      {f.enabled ? (
        <View style={{ gap: 12 }}>
          <Field label={t("Delivery fee (₪), empty = agreed with the customer", "رسوم التوصيل (₪)، فارغ = بالاتفاق مع الزبون")} value={f.fee} onChangeText={(v) => setF({ ...f, fee: normalizeNumberText(v) })} keyboardType="decimal-pad" error={feeOk ? undefined : t("A number, e.g. 10 or 7.5", "رقم، مثل 10 أو 7.5")} />
          <Field label={t("Where you deliver", "أين توصل")} value={f.area} onChangeText={(v) => setF({ ...f, area: v })} maxLength={300} multiline />
        </View>
      ) : null}
      <Note>{t("Payment is cash only: on delivery, or at the shop for pickup.", "الدفع نقدًا فقط: عند التوصيل، أو في المتجر عند الاستلام.")}</Note>
      {msg ? <Note tone={msg.ok ? "success" : "danger"}>{msg.text}</Note> : null}
      {guard.sheet}
    </Page>
  );
}

export default function ShopDeliverySettings() {
  const { t } = useL();
  const state = useLoad(() => shopOrders.delivery(), []);
  if (!state.data) return <Page title={t("Delivery", "التوصيل")}><Loaded state={state}>{() => null}</Loaded></Page>;
  return <DeliveryForm initial={state.data} />;
}
