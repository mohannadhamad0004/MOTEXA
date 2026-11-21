import { RoleGate } from "../../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { canManageTow } from "../../../features/shared/session";

// Client-side UX gate only; backend endpoints must enforce the same rule.
export default function AdminTowLayout() {
  return (
    <RoleGate allow={canManageTow}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
