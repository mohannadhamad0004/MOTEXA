import { Stack } from "expo-router";
import { isTowProvider } from "../../../features/shared/session";
import { RoleGate } from "../../../features/shared/ui";

// Client-side UX gate only; backend endpoints must enforce the same rule.
export default function ProviderTowLayout() {
  return (
    <RoleGate allow={isTowProvider}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
