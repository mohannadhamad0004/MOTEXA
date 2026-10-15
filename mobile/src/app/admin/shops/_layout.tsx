import { Stack } from "expo-router";
import { canManageParts } from "../../../features/shared/session";
import { RoleGate } from "../../../features/shared/ui";

// Client-side UX gate only; backend endpoints must enforce the same rule.
export default function AdminShopsLayout() {
  return (
    <RoleGate allow={canManageParts}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
