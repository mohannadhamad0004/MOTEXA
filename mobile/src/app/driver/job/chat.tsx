import { router, useLocalSearchParams } from "expo-router";
import { useL } from "../../../core/hooks/useL";
import { TowChat } from "../../../features/tow/TowChat";

export default function DriverJobChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  return <TowChat base={`/driver/jobs/${id}`} other={t("Customer", "الزبون")} onBack={() => (router.canGoBack() ? router.back() : router.replace({ pathname: "/driver/job/[id]", params: { id } }))} />;
}
