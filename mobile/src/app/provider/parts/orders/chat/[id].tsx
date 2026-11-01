import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { useL } from "../../../../../core/hooks/useL";
import { shopOrders } from "../../../../../features/orders/ordersService";
import { ChatScreen } from "../../../../../features/provider/Chat";

// The order chat, shop side (the provider chat bubbles): agree on the delivery time / place with the customer.
export default function ShopOrderChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const load = useCallback(() => shopOrders.messages(id), [id]);
  return (
    <ChatScreen
      title={t("Order chat", "محادثة الطلب")}
      subtitle={t("With the customer", "مع الزبون")}
      mine="PROVIDER"
      names={{ me: t("You", "أنت"), other: t("Customer", "الزبون") }}
      load={load}
      markRead={() => shopOrders.read(id)}
      send={(body) => shopOrders.send(id, body)}
      attachments={false}
    />
  );
}
