import { Stack } from "expo-router";
import { RoleGate } from "../../../components/layout/RoleGate";
import { useAppearance } from "../../../components/Appearance";
import { isApplicant, isGarageOwner, isPartsProvider, isTowProvider } from "../../../features/shared/session";

// Client-side UX gate only; every endpoint enforces the same rule. Open to tow / parts providers and garage owners in any application
// status, and to a customer whose tow / parts / garage application (Work with MOTEXA) is in progress.
export default function ProviderOnboardingLayout() {
  const { dark } = useAppearance();
  return (
    <RoleGate allow={(u) => isTowProvider(u) || isPartsProvider(u) || isGarageOwner(u) || isApplicant(u, ["TOW", "PARTS", "GARAGE"])}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: dark ? "#211B17" : "#FFF9EF" } }} />
    </RoleGate>
  );
}
