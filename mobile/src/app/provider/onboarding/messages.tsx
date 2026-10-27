import { MechanicPage, useMechanicTheme } from "../../../components/MechanicUI";
import { onboarding } from "../../../features/provider/api";
import { ThreadView } from "../../../features/provider/Thread";

const load = () => onboarding.messages().then((r) => r.messages);

export default function ProviderMessagesRoute() {
  const m = useMechanicTheme();
  return (
    <MechanicPage back title={m.t("Messages", "الرسائل")} subtitle={m.t("Your conversation with the MOTEXA team.", "محادثتك مع فريق MOTEXA.")}>
      <ThreadView mine="PROVIDER" load={load} markRead={onboarding.markRead} send={onboarding.send} />
    </MechanicPage>
  );
}
