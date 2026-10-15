import { Stack } from "expo-router";
import { isPartsProvider } from "../../../features/shared/session";
import { RoleGate } from "../../../features/shared/ui";

// Client-side UX gate only; backend endpoints must enforce the same rule.
export default function ProviderPartsLayout() {
  return (
    <RoleGate allow={isPartsProvider}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
