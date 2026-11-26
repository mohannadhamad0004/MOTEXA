// One customer question = Inbox thread: the messages with the customer, the message box at the bottom; "Close this question" in ⋮
// (asks first). A closed question shows a note instead of the message box.
import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { StatusChip } from "../../../../components/garage";
import { ThreadPage } from "../../../../components/manage/Thread";
import { useL } from "../../../../core/hooks/useL";
import type { Message } from "../../../../features/provider/api";
import { inquiryStatus } from "../../../../features/requests/inquiryStatus";
import { shopInquiries, type ShopInquiry } from "../../../../features/requests/requestsService";

/** the inquiry's messages in the thread's shape: the shop is "PROVIDER", the customer the other side */
const asMessages = (q: ShopInquiry): Message[] => (q.messages ?? []).map((m) => ({ id: m.id, from: m.mine ? "PROVIDER" : "ADMIN", author: "", body: m.body, at: m.createdAt, attachments: [] }));

export default function ShopInquiryThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const [q, setQ] = useState<ShopInquiry | null>(null);
  const load = useCallback(async () => { const x = await shopInquiries.get(id); setQ(x); return { messages: asMessages(x), unread: 0 }; }, [id]);
  const send = useCallback(async (body: string) => { const x = await shopInquiries.reply(id, body); setQ(x); return asMessages(x); }, [id]);
  const markRead = useCallback(async () => undefined, []);
  return (
    <ThreadPage title={q?.product.name ?? t("Customer question", "سؤال عميل")} mine="PROVIDER" attachments={false}
      line={q ? [q.customerName, t(`Quantity ${q.quantity}`, `الكمية ${q.quantity}`), q.product.partNumber].filter(Boolean).join(" · ") : undefined}
      badge={q ? <StatusChip {...inquiryStatus(q.status, t)} /> : undefined}
      names={{ me: t("You", "أنت"), other: q?.customerName ?? t("Customer", "العميل") }} load={load} markRead={markRead} send={send}
      closed={q?.status === "CLOSED" ? t("This question is closed.", "هذا السؤال مغلق.") : undefined}
      actions={q && q.status !== "CLOSED" ? [{ key: "close", label: t("Close this question", "إغلاق هذا السؤال"), icon: "lock-closed-outline", destructive: true,
        confirm: { title: t("Close this question?", "إغلاق هذا السؤال؟"), confirmLabel: t("Yes, close it", "نعم، أغلقه") },
        run: () => shopInquiries.close(id).then(setQ), success: t("Question closed.", "تم إغلاق السؤال.") }] : undefined} />
  );
}
