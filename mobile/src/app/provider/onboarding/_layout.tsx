import { Stack } from "expo-router";
import { RoleGate } from "../../../components/layout/RoleGate";
import { useAppearance } from "../../../components/Appearance";
import { isApplicant, isPartsProvider, isTowProvider } from "../../../features/shared/session";

// Client-side UX gate only; every endpoint enforces the same rule. Open to tow and parts providers in any application status,
// and to a customer whose tow / parts application (Work with MOTEXA) is in progress.
export default function ProviderOnboardingLayout() {
  const { dark } = useAppearance();
  return (
    <RoleGate allow={(u) => isTowProvider(u) || isPartsProvider(u) || isApplicant(u, ["TOW", "PARTS"])}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: dark ? "#211B17" : "#FFF9EF" } }} />
    </RoleGate>
  );
}
