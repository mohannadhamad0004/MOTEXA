import { RoleGate } from "../../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { canManageParts } from "../../../features/shared/session";

// Client-side UX gate only; backend endpoints must enforce the same rule.
export default function AdminShopsLayout() {
  return (
    <RoleGate allow={canManageParts}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
