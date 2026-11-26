// The driver's chat with the customer of one job = Inbox thread (the only way to talk: no phone numbers are shared). Re-read every 4 s
// while open; closed when the job is over.
import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ThreadPage } from "../../../components/manage/Thread";
import { useL } from "../../../core/hooks/useL";
import type { Message } from "../../../features/provider/api";
import { jobChat } from "../../../features/tow/dispatchService";

type Chat = Awaited<ReturnType<typeof jobChat.list>>;
/** the job chat in the thread's shape: the driver is "PROVIDER", the customer the other side */
const asMessages = (c: Chat): Message[] => c.messages.map((m) => ({ id: m.id, from: m.mine ? "PROVIDER" : "ADMIN", author: "", body: m.body, at: m.at, attachments: [] }));

export default function DriverJobChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const base = `/driver/jobs/${id}`;
  const [open, setOpen] = useState(true);
  const load = useCallback(async () => { const c = await jobChat.list(base); setOpen(c.canPost); return { messages: asMessages(c), unread: 0 }; }, [base]);
  const send = useCallback(async (body: string) => { await jobChat.send(base, body); return asMessages(await jobChat.list(base)); }, [base]);
  const markRead = useCallback(async () => undefined, []);
  return <ThreadPage title={t("Chat", "المحادثة")} line={t("With the customer", "مع الزبون")} mine="PROVIDER" attachments={false} pollMs={4000}
    names={{ me: t("You", "أنت"), other: t("Customer", "الزبون") }} load={load} markRead={markRead} send={send}
    closed={open ? undefined : t("The chat is closed: the job is over.", "المحادثة مغلقة: انتهت المهمة.")} />;
}
