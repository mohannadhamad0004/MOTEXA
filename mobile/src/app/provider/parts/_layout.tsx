import { RoleGate } from "../../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { isPartsProvider } from "../../../features/shared/session";

// Client-side UX gate only; backend endpoints must enforce the same rule.
export default function ProviderPartsLayout() {
  return (
    <RoleGate allow={isPartsProvider}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
