import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Card, ErrorState, Field, GarageHero, GaragePage, GButton, GIcon, GText, ListRow, Note, Section, SkeletonBlock, StickyActionBar, Tap } from "../../components/garage";
import { cityCentre, cityLabel } from "../../core/constants/cities";
import { Point, locationMemory } from "../../core/constants/geo";
import { formatPrice } from "../../core/constants/money";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { catalogService } from "../../features/catalog/catalogService";
import { cartSubtotal, clearCart, useCart } from "../../features/orders/cart";
import { Fulfilment, customerOrders } from "../../features/orders/ordersService";
import { MAPS_AVAILABLE, PinMap } from "../../features/shared/maps";
import { LocationProblem, useCurrentLocation } from "../../features/shared/useCurrentLocation";
import { gShape, gType, useGarageTheme } from "../../theme/garage";

/**
 * Checkout for the one-shop cart: pickup (shop, area, hours, "View on map" with the in-app route) or delivery (a pin on our map
 * + a note), cash payment (card is "coming soon"), the delivery fee or "agreed with the shop", review, place order.
 */
export default function CustomerCheckout() {
  const { g, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const cart = useCart();
  const shop = useLoad(() => (cart ? catalogService.getShop(cart.shopId) : Promise.resolve(null)), [cart?.shopId]);
  const s = shop.data?.shop ?? null;
  const delivers = !!s?.delivery?.enabled;
  const [mode, setMode] = useState<Fulfilment>("PICKUP");
  const [pin, setPin] = useState<Point | null>(locationMemory.current);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const loc = useCurrentLocation("directions");
  const back = () => (router.canGoBack() ? router.back() : router.navigate("/customer/cart"));

  // the pin starts at your known position, else at the shop's city centre
  useEffect(() => {
    if (!pin && s) setPin(cityCentre(s.city) ?? (s.baseLat !== null && s.baseLng !== null ? { lat: s.baseLat, lng: s.baseLng } : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.id]);
  const useMine = async () => {
    const p = await loc.locate();
    if (p) setPin(p);
  };

  if (!cart) {
    return (
      <GaragePage hero={<GarageHero variant="detail" onBack={back} title={t("Checkout", "إتمام الطلب")} />}>
        <Note>{t("Your cart is empty.", "سلتك فارغة.")}</Note>
      </GaragePage>
    );
  }

  const subtotal = cartSubtotal(cart);
  const fee = mode === "DELIVERY" ? (s?.delivery?.fee ?? null) : null;
  const total = subtotal + (fee ?? 0);
  const canPlace = !!s && (mode === "PICKUP" || (delivers && !!pin));
  const place = async () => {
    if (!s) return;
    setBusy(true);
    setErr(null);
    try {
      const o = await customerOrders.place({
        shopId: cart.shopId,
        items: cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        fulfilment: mode,
        ...(mode === "DELIVERY" && pin ? { deliveryLat: pin.lat, deliveryLng: pin.lng, deliveryNote: note.trim() || undefined } : {}),
      });
      clearCart();
      router.replace({ pathname: "/customer/order/[id]", params: { id: o.id } });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const option = (key: Fulfilment, icon: "storefront-outline" | "bicycle-outline", title: string, sub: string, disabled = false) => {
    const on = mode === key;
    return (
      <Tap key={key} label={title} disabled={disabled} onPress={() => setMode(key)} style={[{ flex: 1, minHeight: 96, padding: 14, borderRadius: gShape.card, borderWidth: 1.5, borderColor: on ? g.accent : g.line, backgroundColor: on ? g.tint : g.card, opacity: disabled ? 0.5 : 1, gap: 6 }]}>
        <View style={[row, { alignItems: "center", gap: 8 }]}>
          <GIcon name={icon} size={20} />
          <GIcon name={on ? "radio-button-on" : "radio-button-off"} size={18} color={on ? g.accent : g.soft} />
        </View>
        <GText style={[gType.label, { fontWeight: "800" }, align]}>{title}</GText>
        <GText soft style={[gType.caption, align]}>{sub}</GText>
      </Tap>
    );
  };

  return (
    <GaragePage
      hero={<GarageHero variant="detail" onBack={back} title={t("Checkout", "إتمام الطلب")} line={cart.shopName} />}
      bottom={
        <StickyActionBar note={err ?? undefined}>
          <View style={{ justifyContent: "center", paddingHorizontal: 4 }}>
            <GText soft style={gType.caption}>{t("Total", "الإجمالي")}</GText>
            <GText style={[gType.title, { writingDirection: "ltr" }]}>{formatPrice(total)}</GText>
          </View>
          <GButton flex icon="checkmark" label={t("Place order", "إرسال الطلب")} busy={busy} disabled={!canPlace} onPress={() => void place()} />
        </StickyActionBar>
      }
    >
      {shop.error && !s ? <ErrorState text={shop.error} onRetry={shop.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!s && !shop.error ? <SkeletonBlock height={120} radius={gShape.card} /> : null}

      {s ? (
        <>
          <Section title={t("How do you get it?", "كيف تستلم طلبك؟")} style={{ marginTop: 4 }}>
            <View style={[row, { gap: 10 }]}>
              {option("PICKUP", "storefront-outline", t("Pick up from shop", "الاستلام من المتجر"), t("Pay at the shop", "الدفع في المتجر"))}
              {option("DELIVERY", "bicycle-outline", t("Delivery", "توصيل"), delivers ? t("The owner delivers", "يوصله صاحب المتجر") : t("This shop does not deliver", "هذا المتجر لا يوصل"), !delivers)}
            </View>
          </Section>

          {mode === "PICKUP" ? (
            <Card style={{ marginTop: 14 }} pad={12}>
              <ListRow icon="storefront-outline" title={(isArabic && s.nameAr) || s.name} sub={[cityLabel(s.city, isArabic), s.address].filter(Boolean).join(" · ")} />
              {s.workingHours ? <ListRow divider icon="time-outline" title={t("Opening hours", "ساعات العمل")} sub={s.workingHours} /> : null}
              {s.baseLat !== null ? <ListRow divider icon="map-outline" title={t("View on map", "عرض على الخريطة")} sub={t("With the route from where you are", "مع الطريق من موقعك")} onPress={() => router.push({ pathname: "/customer/parts/map", params: { focus: s.id } })} /> : null}
            </Card>
          ) : (
            <Section title={t("Where should it be delivered?", "أين نوصل الطلب؟")}>
              {s.delivery?.areaNote ? <Note icon="bicycle-outline">{`${t("The shop delivers to", "يوصل المتجر إلى")}: ${s.delivery.areaNote}`}</Note> : null}
              {MAPS_AVAILABLE && pin ? (
                <View style={{ borderRadius: gShape.card, overflow: "hidden", marginTop: 10 }}>
                  <PinMap point={pin} onChange={setPin} height={240} />
                </View>
              ) : null}
              <GText soft style={[gType.caption, align, { marginTop: 6 }]}>{t("Drag the pin or tap the map to set the exact place.", "اسحب الدبوس أو اضغط على الخريطة لتحديد المكان بدقة.")}</GText>
              <GButton variant="secondary" icon="navigate-outline" label={loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my location", "استخدم موقعي")} busy={loc.locating} onPress={() => void useMine()} style={{ marginTop: 10 }} />
              <LocationProblem loc={loc} />
              {loc.dialog}
              <View style={{ marginTop: 12 }}>
                <Field label={t("Note for the driver (optional)", "ملاحظة للتوصيل (اختياري)")} value={note} onChangeText={setNote} placeholder={t("Building, floor, landmark", "المبنى، الطابق، علامة مميزة")} maxLength={300} multiline />
              </View>
            </Section>
          )}

          <Section title={t("Payment", "الدفع")}>
            <Card pad={12}>
              <ListRow icon="cash-outline" title={mode === "DELIVERY" ? t("Cash on delivery", "الدفع نقدًا عند التوصيل") : t("Pay at the shop", "الدفع في المتجر")} end={<GIcon name="radio-button-on" size={18} color={g.accent} />} />
              <ListRow divider icon="card-outline" title={t("Card", "البطاقة")} sub={t("Coming soon", "قريبًا")} end={<GIcon name="radio-button-off" size={18} color={g.line} />} />
            </Card>
          </Section>

          <Section title={t("Review", "المراجعة")}>
            <Card>
              {cart.lines.map((l) => (
                <View key={l.productId} style={[row, { gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: g.line }]}>
                  <GText numberOfLines={2} style={[gType.bodySm, align, { flex: 1 }]}>{`${l.quantity} × ${l.name}`}</GText>
                  <GText style={[gType.bodySm, { fontWeight: "800", writingDirection: "ltr" }]}>{formatPrice(l.price * l.quantity)}</GText>
                </View>
              ))}
              <View style={[row, { justifyContent: "space-between", marginTop: 8 }]}>
                <GText soft style={gType.bodySm}>{t("Subtotal", "المجموع الفرعي")}</GText>
                <GText style={[gType.bodySm, { fontWeight: "800", writingDirection: "ltr" }]}>{formatPrice(subtotal)}</GText>
              </View>
              {mode === "DELIVERY" ? (
                <View style={[row, { justifyContent: "space-between", marginTop: 6 }]}>
                  <GText soft style={gType.bodySm}>{t("Delivery", "التوصيل")}</GText>
                  <GText style={[gType.bodySm, { fontWeight: "800", writingDirection: "ltr" }]}>{fee === null ? t("Agreed with the shop", "بالاتفاق مع المتجر") : formatPrice(fee)}</GText>
                </View>
              ) : null}
              <GText soft style={[gType.caption, align, { marginTop: 10 }]}>
                {t("The shop confirms prices and stock when it accepts. You can cancel until then, and agree on the time in the order chat.", "يؤكد المتجر الأسعار والمخزون عند القبول. يمكنك الإلغاء حتى ذلك الحين، والاتفاق على الوقت في محادثة الطلب.")}
              </GText>
            </Card>
          </Section>
        </>
      ) : null}
    </GaragePage>
  );
}
