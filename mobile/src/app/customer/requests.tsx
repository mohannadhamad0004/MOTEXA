import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Badge, Card, EmptyState, ErrorState, GarageHero, GaragePage, GText, Photo, SkeletonRows, StatusChip, Tabs, Tap, Tone } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useMechanicStatusLabels } from "../../features/mechanics/mechanicBits";
import { customerMechanicRequests } from "../../features/mechanics/mechanicsService";
import { inquiryTone, mechTone, towTone } from "../../features/requests/garageBits";
import { fmtDateTime, useTowStatusLabels } from "../../features/requests/requestBits";
import { customerInquiries, customerTowRequests } from "../../features/requests/requestsService";
import { customerOrders } from "../../features/orders/ordersService";
import { orderTone, useOrderLabels } from "../../features/orders/orderBits";
import { formatPrice } from "../../core/constants/money";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import type { PhotoKey } from "../../theme/photos";

type Row = { key: string; photo: PhotoKey; title: string; sub: string; status: string; tone: Tone; at: string; href: string; active: boolean; fresh: boolean; badge?: string };

// "My requests": parts orders, part questions, tow requests and mechanic service requests in one list, split into Active and Past.
export default function MyRequests() {
  const { g, shadow, row, align } = useGarageTheme();
  const { t } = useL();
  const [tab, setTab] = useState<"ACTIVE" | "PAST">("ACTIVE");
  const questions = useLoad(() => customerInquiries.list(), []);
  const tows = useLoad(() => customerTowRequests.list(), []);
  const mechs = useLoad(() => customerMechanicRequests.list(), []);
  const orders = useLoad(() => customerOrders.list(), []);
  const orderLabel = useOrderLabels();
  const towLabel = useTowStatusLabels();
  const mechLabel = useMechanicStatusLabels();
  const askLabel = { OPEN: t("Open", "مفتوح"), ANSWERED: t("Answered", "تم الرد"), CLOSED: t("Closed", "مغلق") };

  const rows: Row[] = [
    ...(orders.data ?? []).map((o) => ({
      key: "o" + o.id,
      photo: "service.parts" as PhotoKey,
      title: `${t("Order", "طلب")} · ${o.shop.name}`,
      sub: `${o.items.reduce((n, i) => n + i.quantity, 0)} ${t("items", "قطع")} · ${formatPrice(o.total)} · ${orderLabel.fulfilment[o.fulfilment]}`,
      status: orderLabel.status[o.status],
      tone: orderTone(o.status),
      at: o.updatedAt,
      href: `/customer/order/${o.id}`,
      active: !["PICKED_UP", "DELIVERED", "CANCELLED", "REJECTED"].includes(o.status),
      fresh: o.unread > 0,
      badge: o.unread ? `${o.unread} ${t("new", "جديدة")}` : undefined,
    })),
    ...(questions.data ?? []).map((q) => ({
      key: "q" + q.id,
      photo: "service.parts" as PhotoKey,
      title: q.product.name,
      sub: q.lastMessage ? `${q.shop.name} · ${q.lastMessage}` : q.shop.name,
      status: askLabel[q.status],
      tone: inquiryTone(q.status),
      at: q.updatedAt,
      href: `/customer/inquiry/${q.id}`,
      active: q.status !== "CLOSED",
      // the shop answered last: a reply the customer has not acted on
      fresh: q.status === "ANSWERED",
    })),
    ...(tows.data ?? []).map((r) => ({
      key: "t" + r.id,
      photo: "service.tow" as PhotoKey,
      title: r.company.name,
      sub: `${r.vehicle.make} ${r.vehicle.model} · ${r.pickupAddress}`,
      status: towLabel[r.status],
      tone: towTone(r.status),
      at: r.updatedAt,
      href: `/customer/towrequest/${r.id}`,
      active: ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(r.status),
      fresh: false,
    })),
    ...(mechs.data ?? []).map((r) => ({
      key: "m" + r.id,
      photo: "service.mechanics" as PhotoKey,
      title: r.mechanic.name,
      sub: `${r.vehicle.make} ${r.vehicle.model} · ${r.problemDescription}`,
      status: mechLabel[r.status],
      tone: mechTone(r.status),
      at: r.updatedAt,
      href: `/customer/mechanicrequest/${r.id}`,
      active: ["REQUESTED", "ACCEPTED", "IN_PROGRESS"].includes(r.status),
      fresh: false,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const loading = (questions.loading && !questions.data) || (tows.loading && !tows.data) || (mechs.loading && !mechs.data) || (orders.loading && !orders.data);
  const error = questions.error || tows.error || mechs.error || orders.error;
  const active = rows.filter((r) => r.active);
  const past = rows.filter((r) => !r.active);
  const shown = tab === "ACTIVE" ? active : past;
  const reload = () => Promise.allSettled([questions.reload(), tows.reload(), mechs.reload(), orders.reload()]);

  return (
    <GaragePage
      onRefresh={reload}
      refreshing={(questions.loading || tows.loading || mechs.loading) && !loading}
      hero={
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/customer"))}
          title={t("My requests", "طلباتي")}
          line={loading ? undefined : t(`${active.length} active · ${past.length} past`, `${active.length} نشطة · ${past.length} سابقة`)}
        />
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { key: "ACTIVE", label: t("Active", "النشطة"), count: active.length },
          { key: "PAST", label: t("Past", "السابقة"), count: past.length },
        ]}
      />
      <View style={{ marginTop: 16, gap: 12 }}>
        {loading ? (
          <SkeletonRows count={4} />
        ) : error && !rows.length ? (
          <ErrorState text={error} onRetry={reload} retryLabel={t("Retry", "إعادة المحاولة")} />
        ) : !shown.length ? (
          <EmptyState
            photo="empty.requests"
            text={tab === "ACTIVE" ? t("No active requests. Ask a shop, call a tow or book a mechanic.", "لا توجد طلبات نشطة. اسأل متجرًا أو اطلب سحبًا أو احجز ميكانيكيًا.") : t("No past requests yet.", "لا توجد طلبات سابقة بعد.")}
            action={tab === "ACTIVE" ? { label: t("Find parts", "ابحث عن قطع"), onPress: () => router.navigate("/customer/parts") } : undefined}
          />
        ) : (
          shown.map((r) => (
            <Tap key={r.key} label={`${r.title}, ${r.status}`} onPress={() => router.push(r.href as never)} style={[row, { alignItems: "center", gap: 12, padding: 10, borderRadius: gShape.card, backgroundColor: g.card }, shadow(1)]}>
              <Photo k={r.photo} radius={14} style={{ width: 60, height: 60 }} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={[row, { alignItems: "center", gap: 6 }]}>
                  <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flexShrink: 1 }, align]}>{r.title}</GText>
                  {r.fresh ? <Badge label={r.badge ?? t("New reply", "رد جديد")} tone="accent" /> : null}
                </View>
                <GText soft numberOfLines={1} style={[gType.caption, align]}>{r.sub}</GText>
                <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 8 }]}>
                  <StatusChip tone={r.tone} label={r.status} />
                  <GText soft style={[gType.tiny, { writingDirection: "ltr" }]}>{fmtDateTime(r.at)}</GText>
                </View>
              </View>
            </Tap>
          ))
        )}
        {error && rows.length ? <Card soft><GText style={[gType.caption, { color: g.danger }, align]}>{t("Some requests could not be refreshed. Pull down to try again.", "تعذّر تحديث بعض الطلبات. اسحب للأسفل للمحاولة مجددًا.")}</GText></Card> : null}
      </View>
    </GaragePage>
  );
}
