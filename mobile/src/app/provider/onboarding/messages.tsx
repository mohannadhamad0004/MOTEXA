import { useCallback } from "react";
import { ChatScreen } from "../../../features/provider/Chat";
import { onboarding } from "../../../features/provider/api";
import { useDT } from "../../../features/department/ui";

export default function ProviderMessagesRoute() {
  const d = useDT();
  const load = useCallback(() => onboarding.messages(), []);
  return <ChatScreen title="MOTEXA" subtitle={d.t("Your conversation with the MOTEXA team", "محادثتك مع فريق MOTEXA")} mine="PROVIDER" names={{ me: d.t("You", "أنت"), other: "MOTEXA" }} load={load} markRead={onboarding.markRead} send={onboarding.send} />;
}
