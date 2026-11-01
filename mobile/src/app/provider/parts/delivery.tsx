import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Card, ErrorState, Field, GarageHero, GaragePage, GButton, Note, SkeletonBlock, Toggle } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { shopOrders } from "../../../features/orders/ordersService";
import { gShape } from "../../../theme/garage";

/** Delivery settings: on / off, the fee (empty = agreed with each customer in the chat) and where the owner delivers. */
export default function ShopDeliverySettings() {
  const { t } = useL();
  const state = useLoad(() => shopOrders.delivery(), []);
  const [enabled, setEnabled] = useState(false);
  const [fee, setFee] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!state.data) return;
    setEnabled(state.data.enabled);
    setFee(state.data.fee === null ? "" : String(state.data.fee));
    setArea(state.data.areaNote ?? "");
  }, [state.data]);
  const feeOk = fee.trim() === "" || /^\d+(\.\d{1,2})?$/.test(fee.trim());
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await shopOrders.saveDelivery({ enabled, fee: fee.trim() === "" ? null : Number(fee.trim()), areaNote: area.trim() || null });
      setMsg({ ok: true, text: t("Saved.", "تم الحفظ.") });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <GaragePage hero={<GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/provider/parts/orders"))} title={t("Delivery", "التوصيل")} line={t("You deliver the orders yourself", "توصل الطلبات بنفسك")} />}>
      {state.error && !state.data ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!state.data && !state.error ? <SkeletonBlock height={200} radius={gShape.card} /> : null}
      {state.data ? (
        <View style={{ gap: 12 }}>
          <Card>
            <Toggle label={t("I deliver orders", "أوصل الطلبات")} sub={enabled ? t("Customers can choose delivery", "يمكن للزبائن اختيار التوصيل") : t("Pickup only", "الاستلام فقط")} value={enabled} onChange={setEnabled} />
          </Card>
          {enabled ? (
            <Card>
              <Field label={t("Delivery fee (₪), empty = agreed with the customer", "رسوم التوصيل (₪)، فارغ = بالاتفاق مع الزبون")} value={fee} onChangeText={setFee} keyboardType="decimal-pad" error={feeOk ? undefined : t("A number, e.g. 10 or 7.5", "رقم، مثل 10 أو 7.5")} />
              <Field label={t("Where you deliver", "أين توصل")} value={area} onChangeText={setArea} placeholder={t("e.g. Nablus and nearby villages", "مثل: نابلس والقرى المجاورة")} maxLength={300} multiline />
            </Card>
          ) : null}
          <Note>{t("Payment is cash only: on delivery, or at the shop for pickup.", "الدفع نقدًا فقط: عند التوصيل، أو في المتجر عند الاستلام.")}</Note>
          {msg ? <Note tone={msg.ok ? "success" : "danger"} icon={msg.ok ? "checkmark-circle-outline" : "alert-circle-outline"}>{msg.text}</Note> : null}
          <GButton label={t("Save", "حفظ")} busy={busy} disabled={!feeOk} onPress={() => void save()} />
        </View>
      ) : null}
    </GaragePage>
  );
}
