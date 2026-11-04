// Shared pieces of the parts-order screens (customer, shop owner, parts admin): labels, tones, the status timeline, the money
// card, a quantity stepper, the order map and the owner's live location while he delivers.
import { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { Card, GIcon, GText, Tap, Timeline, TimelineStep, Tone } from "../../components/garage";
import { formatPrice } from "../../core/constants/money";
import { Point } from "../../core/constants/geo";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { fmtDateTime } from "../requests/requestBits";
import { MAPS_AVAILABLE, ServiceMap, ServicePin } from "../shared/maps";
import { RouteSummary, useRoute } from "../shared/useRoute";
import { useForegroundLocationWatch } from "../shared/useCurrentLocation";
import { Fulfilment, OrderStatus } from "./ordersService";

type AnyOrder = {
  status: OrderStatus;
  fulfilment: Fulfilment;
  subtotal: number;
  deliveryFee: number | null;
  total: number;
  items: { id: string; name: string; partNumber: string; unitPrice: number; quantity: number }[];
  timeline: Record<string, string | null>;
  rejectReason: string | null;
  cancelReason: string | null;
  cancelledBy: "CUSTOMER" | "SHOP" | null;
};

export function useOrderLabels() {
  const { t } = useL();
  const status: Record<OrderStatus, string> = {
    PLACED: t("Placed", "تم الإرسال"),
    ACCEPTED: t("Accepted", "مقبول"),
    PREPARING: t("Preparing", "قيد التجهيز"),
    READY_FOR_PICKUP: t("Ready for pickup", "جاهز للاستلام"),
    OUT_FOR_DELIVERY: t("Out for delivery", "في الطريق"),
    PICKED_UP: t("Picked up", "تم الاستلام"),
    DELIVERED: t("Delivered", "تم التوصيل"),
    CANCELLED: t("Cancelled", "ملغى"),
    REJECTED: t("Rejected", "مرفوض"),
  };
  const fulfilment: Record<Fulfilment, string> = { PICKUP: t("Pick up from the shop", "الاستلام من المتجر"), DELIVERY: t("Delivery", "توصيل") };
  const payment = { CASH_ON_DELIVERY: t("Cash on delivery", "الدفع نقدًا عند التوصيل"), PAY_AT_SHOP: t("Pay at the shop", "الدفع في المتجر") };
  return { status, fulfilment, payment };
}

export const orderTone = (s: OrderStatus): Tone =>
  (({ PLACED: "accent", ACCEPTED: "success", PREPARING: "success", READY_FOR_PICKUP: "success", OUT_FOR_DELIVERY: "success", PICKED_UP: "success", DELIVERED: "success", CANCELLED: "neutral", REJECTED: "danger" }) as const)[s];

/** PLACED -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP / OUT_FOR_DELIVERY -> PICKED_UP / DELIVERED; a stopped order ends in a red step. */
export function OrderTimeline({ o }: { o: AnyOrder }) {
  const { t } = useL();
  const L = useOrderLabels().status;
  const pickup = o.fulfilment === "PICKUP";
  const path: [OrderStatus, string | null][] = [
    ["PLACED", o.timeline.placedAt],
    ["ACCEPTED", o.timeline.acceptedAt],
    ["PREPARING", o.timeline.preparingAt],
    [pickup ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY", pickup ? o.timeline.readyAt : o.timeline.outAt],
    [pickup ? "PICKED_UP" : "DELIVERED", o.timeline.completedAt],
  ];
  const stopped = o.status === "CANCELLED" || o.status === "REJECTED";
  const reached = path.filter(([, at]) => at).length;
  const steps: TimelineStep[] = path.map(([s, at], i) => ({
    label: L[s],
    at: at ? fmtDateTime(at) : undefined,
    state: at ? (!stopped && i === reached - 1 && !["PICKED_UP", "DELIVERED"].includes(s) ? "current" : "done") : "todo",
  }));
  if (stopped) {
    const why = o.status === "REJECTED" ? o.rejectReason : o.cancelReason;
    const who = o.status === "CANCELLED" ? (o.cancelledBy === "CUSTOMER" ? t("by you", "من قبلك") : t("by the shop", "من المتجر")) : "";
    // a stopped order shows what really happened, then the stop
    return <Timeline steps={[...steps.slice(0, Math.max(1, reached)), { label: [L[o.status], who].filter(Boolean).join(" "), at: [fmtDateTime(o.timeline.cancelledAt ?? o.timeline.rejectedAt), why].filter(Boolean).join(" · "), state: "failed" }]} />;
  }
  return <Timeline steps={steps} />;
}

/** Lines, subtotal, delivery fee ("agreed with the shop" when the shop set none) and total. */
export function MoneyCard({ o }: { o: AnyOrder }) {
  const { g, row, align } = useGarageTheme();
  const { t } = useL();
  const line = (label: string, value: string, strong = false) => (
    <View style={[row, { justifyContent: "space-between", gap: 10, marginTop: 6 }]}>
      <GText soft={!strong} style={[strong ? gType.title : gType.bodySm, align, { flex: 1 }]}>{label}</GText>
      <GText style={[strong ? gType.title : gType.bodySm, { fontWeight: "800", color: strong ? g.accentText : g.ink, writingDirection: "ltr" }]}>{value}</GText>
    </View>
  );
  return (
    <Card>
      {o.items.map((i) => (
        <View key={i.id} style={[row, { gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: g.line }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <GText numberOfLines={2} style={[gType.label, align]}>{i.name}</GText>
            <GText soft style={[gType.caption, align, { writingDirection: "ltr" }]}>{`${i.partNumber} · ${i.quantity} × ${formatPrice(i.unitPrice)}`}</GText>
          </View>
          <GText style={[gType.label, { fontWeight: "800", writingDirection: "ltr" }]}>{formatPrice(i.unitPrice * i.quantity)}</GText>
        </View>
      ))}
      {line(t("Subtotal", "المجموع الفرعي"), formatPrice(o.subtotal))}
      {o.fulfilment === "DELIVERY" ? line(t("Delivery", "التوصيل"), o.deliveryFee === null ? t("Agreed with the shop", "بالاتفاق مع المتجر") : formatPrice(o.deliveryFee)) : null}
      {line(t("Total", "الإجمالي"), formatPrice(o.total), true)}
      {o.fulfilment === "DELIVERY" && o.deliveryFee === null ? <GText soft style={[gType.caption, align, { marginTop: 4 }]}>{t("The delivery fee is not included; agree on it in the chat.", "رسوم التوصيل غير مشمولة؛ اتفق عليها في المحادثة.")}</GText> : null}
    </Card>
  );
}

/** − n + with 44 px targets; numbers stay LTR. */
export function QtyStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const { g } = useGarageTheme();
  const { t } = useL();
  const btn = (icon: "remove" | "add", label: string, to: number, disabled: boolean) => (
    <Tap label={label} disabled={disabled} onPress={() => onChange(to)} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: g.tint, opacity: disabled ? 0.4 : 1 }}>
      <GIcon name={icon} size={20} />
    </Tap>
  );
  return (
    // always "− n +" left to right, like the numbers
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {btn("remove", t("Less", "أقل"), value - 1, value <= 1)}
      <GText style={[gType.title, { minWidth: 28, textAlign: "center" }]}>{String(value)}</GText>
      {btn("add", t("More", "أكثر"), value + 1, value >= max)}
    </View>
  );
}

/**
 * Our map for one order: the delivery pin (A), the shop, the owner's live point (customer / admin) or his own dot (owner), and
 * the road route from where he is (or the shop) to the customer, with distance + time. The route is refreshed only when the
 * start moves about 50 m, so GPS noise does not flood the router.
 */
export function OrderMap({ orderId, height, delivery, shop, courier, me, meFresh = true }: { orderId: string; height: number; delivery: Point | null; shop: Point | null; courier: Point | null; me?: Point | null; meFresh?: boolean }) {
  const { g, align } = useGarageTheme();
  const { t } = useL();
  const from = me ?? courier ?? shop;
  const { route, loading } = useRoute(delivery && from ? `order:${orderId}` : null, from, delivery, 50);
  const pins: ServicePin[] = [
    ...(shop ? [{ id: "shop", name: t("Shop", "المتجر"), lat: shop.lat, lng: shop.lng, kind: "shop" as const, dim: false, color: "#2F6B8A" }] : []),
    ...(courier && !me ? [{ id: "courier", name: t("The shop owner", "صاحب المتجر"), lat: courier.lat, lng: courier.lng, kind: "tow" as const, dim: false, color: "#B5541C" }] : []),
  ];
  const fit: [number, number][] = route?.coords ?? [...[delivery, from].filter((p): p is Point => !!p).map((p) => [p.lat, p.lng] as [number, number])];
  if (!MAPS_AVAILABLE)
    return (
      <Card soft>
        <GText soft style={[gType.bodySm, align]}>{t("The map is not available on this platform.", "الخريطة غير متاحة على هذه المنصة.")}</GText>
      </Card>
    );
  return (
    <View style={{ gap: 10 }}>
      <View style={{ height, borderRadius: gShape.card, overflow: "hidden", backgroundColor: g.tint }}>
        <ServiceMap
          height={height}
          pins={pins}
          selectedId={null}
          me={me ?? null}
          meFresh={meFresh}
          pickup={delivery}
          route={route ? { coords: route.coords, dashed: route.kind === "line", key: `order:${orderId}:${route.kind}` } : null}
          fit={fit}
          fitKey={`order:${orderId}:${route ? route.kind : "-"}:${pins.length}:${me ? 1 : 0}`}
          pad={{ top: 0, bottom: 0, left: 0, right: 0 }}
          onSelect={() => undefined}
          onBackground={() => undefined}
        />
      </View>
      {delivery && from ? <RouteSummary route={route} loading={loading} /> : null}
    </View>
  );
}

/**
 * The owner's position while his delivery screen is open and the order is OUT_FOR_DELIVERY: watched in the foreground only and
 * sent about every 10 s so the customer can follow. Stops when the screen loses focus or the order leaves that status.
 */
export function useShareLocation(key: string, sharing: boolean, send: (p: Point) => Promise<unknown>) {
  const sendRef = useRef(send);
  sendRef.current = send;
  const last = useRef(0);
  useEffect(() => { last.current = 0; }, [key, sharing]);
  const onFix = useCallback((fix: { point: Point }) => {
    const now = Date.now();
    if (now - last.current < 9_000) return;
    last.current = now;
    sendRef.current(fix.point).catch(() => undefined);
  }, []);
  const feed = useForegroundLocationWatch({
    enabled: sharing,
    restartKey: key,
    purpose: "active",
    requestIfUndetermined: true,
    onFix,
  });
  return {
    me: sharing ? feed.fix?.point ?? null : null,
    meFresh: feed.fresh,
    problem: feed.message,
    issue: feed.issue,
    canOpenSettings: feed.canOpenSettings,
    openSettings: feed.openSettings,
  };
}
