import { useState } from "react";
import { GarageHero, GaragePage, GText, Note } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { GarageThread } from "../requests/garageBits";
import { jobChat } from "./dispatchService";

/**
 * In-app chat of one tow job (the only way to talk: no phone numbers are shared with customers). Polled every 4 s while open.
 * `base` = "/requests/tow/:id" (customer) or "/driver/jobs/:id" (driver); `other` = the name shown on the other side's bubbles.
 */
export function TowChat({ base, other, onBack }: { base: string; other: string; onBack: () => void }) {
  const { t } = useL();
  const state = useLoad(() => jobChat.list(base), [base], 4000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async (body: string) => {
    setBusy(true);
    setErr(null);
    try {
      await jobChat.send(base, body);
      await state.reload();
      return true;
    } catch (e: any) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const d = state.data;
  return (
    <GaragePage hero={<GarageHero variant="detail" onBack={onBack} title={t("Chat", "المحادثة")} line={other} />}>
      {state.error && !d ? <Note tone="danger" icon="alert-circle-outline">{state.error}</Note> : null}
      {d && !d.messages.length ? <GText soft style={{ marginBottom: 12 }}>{t("No messages yet. Say hello.", "لا توجد رسائل بعد. ابدأ بالتحية.")}</GText> : null}
      {d ? (
        <GarageThread
          messages={d.messages.map((m) => ({ id: m.id, from: m.from === "CUSTOMER" ? "CUSTOMER" : "SHOP", mine: m.mine, body: m.body, createdAt: m.at }))}
          canReply={d.canPost}
          busy={busy}
          error={err}
          onSend={send}
          otherName={other}
          closedText={d.canPost ? undefined : t("The chat is closed: the job is over.", "المحادثة مغلقة: انتهت المهمة.")}
        />
      ) : null}
    </GaragePage>
  );
}
