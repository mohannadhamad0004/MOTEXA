import { Stack } from "expo-router";
import { RoleGate } from "../../../components/layout/RoleGate";
import { useAppearance } from "../../../components/Appearance";
import { isPartsProvider, isTowProvider } from "../../../features/shared/session";

// Client-side UX gate only; every endpoint enforces the same rule. Open to tow and parts providers in any application status.
export default function ProviderOnboardingLayout() {
  const { dark } = useAppearance();
  return (
    <RoleGate allow={(u) => isTowProvider(u) || isPartsProvider(u)}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: dark ? "#211B17" : "#FFF9EF" } }} />
    </RoleGate>
  );
}
