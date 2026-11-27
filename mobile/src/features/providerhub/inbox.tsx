// Messages of the provider roles (tow company, parts shop, garage owner) = Inbox (docs/guide/10-ui-system.md): the thread with the MOTEXA team and, for a parts shop, each
// order's chat with its customer; unread first. A row opens the thread (ThreadPage, message box at the bottom).
import { router, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { FilterChips, ManagePage } from "../../components/manage/ManagePage";
import { ThreadPage, ThreadRow } from "../../components/manage/Thread";
import { formatPrice } from "../../core/constants/money";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { shopOrders, type ShopOrder } from "../orders/ordersService";
import { onboarding } from "../provider/api";
import type { ProviderArea } from "../provider/portal/types";

type Row = { id: string; name: string; last: string; at: string | null; unread: number; to: string };
const pick = (text: string, ar: boolean) => (text.split("||")[ar && text.includes("||") ? 1 : 0] ?? "").trim();

export function ProviderInbox({ area }: { area: ProviderArea | "garage" }) {
  const { t, isArabic } = useL();
  const motexa = useLoad(() => onboarding.messages(), [], 15000);
  // the shop's order chats: new and active orders, and finished ones with unread messages
  const orders = useLoad(async () => {
    if (area !== "parts") return [] as ShopOrder[];
    const [n, a, d] = await Promise.all([shopOrders.list("new"), shopOrders.list("active"), shopOrders.list("done")]);
    return [...n.orders, ...a.orders, ...d.orders.filter((o) => o.unread > 0)];
  }, [area], 15000);
  const [q, setQ] = useState(""), [show, setShow] = useState<"ALL" | "UNREAD">("ALL");
  const last = motexa.data?.messages[motexa.data.messages.length - 1];
  const all: Row[] = [
    ...(motexa.data ? [{ id: "motexa", name: t("MOTEXA team", "فريق موتكسا"), last: last ? `${last.from === "PROVIDER" ? t("You: ", "أنت: ") : ""}${pick(last.body, isArabic)}` : t("Write to us any time.", "راسلنا في أي وقت."), at: last?.at ?? null, unread: motexa.data.unread, to: area === "garage" ? "/garage/motexa" : `/provider/${area}/motexa` }] : []),
    ...(orders.data ?? []).map((o) => ({ id: o.id, name: `${o.customer.firstName} · ${t("order", "طلب")} ${o.id.slice(0, 6).toUpperCase()}`,
      last: `${o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")} · ${formatPrice(o.total)}`, at: o.updatedAt, unread: o.unread, to: `/provider/parts/orders/chat/${o.id}` })),
  ];
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = all.filter((r) => words.every((w) => `${r.name} ${r.last}`.toLowerCase().includes(w)));
  const rows = found.filter((r) => show === "ALL" || r.unread > 0).sort((x, y) => Number(y.unread > 0) - Number(x.unread > 0) || String(y.at ?? "").localeCompare(String(x.at ?? "")));
  const unread = all.filter((r) => r.unread > 0).length;
  const reload = () => { void motexa.reload(); void orders.reload(); };
  return (
    <ManagePage title={t("Messages", "الرسائل")} line={motexa.data ? t(`${unread} unread conversations`, `${unread} محادثات غير مقروءة`) : undefined} back={false} tabBar
      search={area === "parts" ? { value: q, onChange: setQ, placeholder: t("Search a name or a part", "ابحث عن اسم أو قطعة") } : undefined}
      filters={<FilterChips value={show} onChange={setShow} filters={[{ key: "ALL", label: t("All", "الكل"), count: found.length }, { key: "UNREAD", label: t("Unread", "غير مقروءة"), count: found.filter((r) => r.unread > 0).length }]} />}
      items={rows} keyOf={(r) => r.id} rowHeight={72}
      renderItem={(r) => <ThreadRow name={r.name} last={r.last} at={r.at} unread={r.unread} onPress={() => router.push(r.to as Href)} />}
      loading={!motexa.data && !motexa.error} error={motexa.error ?? orders.error} onRetry={reload}
      empty={{ text: q || show !== "ALL" ? t("No conversation matches.", "لا توجد محادثة مطابقة.") : t("No conversations yet.", "لا توجد محادثات بعد.") }}
      onRefresh={reload} refreshing={false} detailHint={t("Tap a conversation to open it.", "اضغط على محادثة لفتحها.")} />
  );
}

/** The provider's (or applicant's) thread with the MOTEXA team. */
export function MotexaThread() {
  const { t } = useL();
  const load = useCallback(() => onboarding.messages(), []);
  return <ThreadPage title={t("MOTEXA team", "فريق موتكسا")} line={t("Your conversation with the MOTEXA team", "محادثتك مع فريق MOTEXA")} mine="PROVIDER"
    names={{ me: t("You", "أنت"), other: "MOTEXA" }} load={load} markRead={onboarding.markRead} send={onboarding.send} />;
}
