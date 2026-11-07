import { router, useLocalSearchParams } from "expo-router";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { customerTowRequests } from "../../../features/requests/requestsService";
import { TowChat } from "../../../features/tow/TowChat";

export default function CustomerTowChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const job = useLoad(() => customerTowRequests.get(id), [id]);
  return <TowChat base={`/requests/tow/${id}`} other={job.data?.driver?.name ?? t("Driver", "السائق")} onBack={() => (router.canGoBack() ? router.back() : router.replace({ pathname: "/customer/towrequest/[id]", params: { id } }))} />;
}
