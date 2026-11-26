import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { ThreadPage } from "../../../../../components/manage/Thread";
import { useL } from "../../../../../core/hooks/useL";
import { shopOrders } from "../../../../../features/orders/ordersService";

// The order chat, shop side (Inbox thread): agree on the delivery time / place with the customer. Text only.
export default function ShopOrderChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const load = useCallback(() => shopOrders.messages(id), [id]);
  const markRead = useCallback(() => shopOrders.read(id), [id]);
  const send = useCallback((body: string) => shopOrders.send(id, body), [id]);
  return <ThreadPage title={t("Order chat", "محادثة الطلب")} line={t("With the customer", "مع الزبون")} mine="PROVIDER"
    names={{ me: t("You", "أنت"), other: t("Customer", "الزبون") }} load={load} markRead={markRead} send={send} attachments={false} />;
}
