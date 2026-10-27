import { useLocalSearchParams } from "expo-router";
import ProviderRegister from "../../features/provider/Register";

// Public screen (no sign-in): /provider/register?kind=TOW|PARTS
export default function ProviderRegisterRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <ProviderRegister kind={kind === "PARTS" ? "PARTS" : "TOW"} />;
}
