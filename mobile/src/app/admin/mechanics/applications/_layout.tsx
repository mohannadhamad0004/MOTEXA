import { Stack } from "expo-router";
import { canManageMechanics } from "../../../../features/shared/session";
import { RoleGate } from "../../../../features/shared/ui";

// Client-side UX gate only; the /api/mechanic-review endpoints enforce the same rule on the server.
export default function MechanicApplicationsLayout() {
  return (
    <RoleGate allow={canManageMechanics}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
