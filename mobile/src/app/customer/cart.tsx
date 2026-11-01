import { router } from "expo-router";
import { View } from "react-native";
import { Card, EmptyState, GarageHero, GaragePage, GButton, GText, IconButton, StickyActionBar } from "../../components/garage";
import { formatPrice } from "../../core/constants/money";
import { useL } from "../../core/hooks/useL";
import { PartPhoto } from "../../features/catalog/PartPhoto";
import { cartCount, cartSubtotal, removeLine, setQuantity, useCart } from "../../features/orders/cart";
import { QtyStepper } from "../../features/orders/orderBits";
import { gType, useGarageTheme } from "../../theme/garage";

/** The cart (one shop): lines with quantity, the subtotal, then checkout. Prices are a preview: the server prices the order. */
export default function CustomerCart() {
  const { row, align } = useGarageTheme();
  const { t } = useL();
  const cart = useCart();
  const back = () => (router.canGoBack() ? router.back() : router.navigate("/customer/parts"));

  return (
    <GaragePage
      hero={<GarageHero variant="detail" onBack={back} title={t("Your cart", "سلتك")} line={cart ? `${cart.shopName} · ${cartCount(cart)} ${cartCount(cart) === 1 ? t("item", "قطعة") : t("items", "قطع")}` : undefined} />}
      bottom={
        cart ? (
          <StickyActionBar note={t("Cash only: you pay at the shop or when the order is delivered.", "الدفع نقدًا فقط: تدفع في المتجر أو عند التوصيل.")}>
            <View style={{ justifyContent: "center", paddingHorizontal: 4 }}>
              <GText soft style={gType.caption}>{t("Subtotal", "المجموع الفرعي")}</GText>
              <GText style={[gType.title, { writingDirection: "ltr" }]}>{formatPrice(cartSubtotal(cart))}</GText>
            </View>
            <GButton flex icon="arrow-forward" label={t("Checkout", "إتمام الطلب")} onPress={() => router.push("/customer/checkout")} />
          </StickyActionBar>
        ) : undefined
      }
    >
      {!cart ? (
        <EmptyState photo="empty.search" text={t("Your cart is empty.", "سلتك فارغة.")} action={{ label: t("Browse parts", "تصفح القطع"), onPress: () => router.navigate("/customer/parts") }} />
      ) : (
        <View style={{ gap: 12 }}>
          {cart.lines.map((l) => (
            <Card key={l.productId} pad={12}>
              <View style={[row, { gap: 12 }]}>
                <View style={{ width: 72 }}>
                  <PartPhoto uri={l.imageUri} style={{ borderRadius: 12 }} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <GText numberOfLines={2} style={[gType.label, { fontWeight: "800" }, align]}>{l.name}</GText>
                  <GText soft style={[gType.caption, align, { writingDirection: "ltr" }]}>{`${l.partNumber} · ${formatPrice(l.price)}`}</GText>
                  <View style={[row, { alignItems: "center", justifyContent: "space-between", marginTop: 6 }]}>
                    <QtyStepper value={l.quantity} max={l.max} onChange={(n) => setQuantity(l.productId, n)} />
                    <IconButton icon="trash-outline" label={t("Remove", "إزالة")} onPress={() => removeLine(l.productId)} />
                  </View>
                  {l.quantity >= l.max ? <GText soft style={[gType.tiny, align]}>{t("That is all the shop has right now.", "هذا كل ما لدى المتجر حاليًا.")}</GText> : null}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </GaragePage>
  );
}
