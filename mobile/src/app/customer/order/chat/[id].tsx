import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { useL } from "../../../../core/hooks/useL";
import { customerOrders } from "../../../../features/orders/ordersService";
import { ChatScreen } from "../../../../features/provider/Chat";

// The order chat, customer side (same bubbles as the provider chat): agree on delivery time / place with the shop.
export default function CustomerOrderChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const load = useCallback(() => customerOrders.messages(id), [id]);
  return (
    <ChatScreen
      title={t("Order chat", "محادثة الطلب")}
      subtitle={t("With the shop. Do not share card details here.", "مع المتجر. لا تشارك بيانات البطاقة هنا.")}
      mine="ADMIN"
      names={{ me: t("You", "أنت"), other: t("Shop", "المتجر") }}
      load={load}
      markRead={() => customerOrders.read(id)}
      send={(body) => customerOrders.send(id, body)}
      attachments={false}
    />
  );
}
