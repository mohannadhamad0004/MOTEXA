import { RoleGate } from "../../../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { canManageMechanics } from "../../../../features/shared/session";

// Client-side UX gate only; the /api/mechanic-review endpoints enforce the same rule on the server.
export default function MechanicApplicationsLayout() {
  return (
    <RoleGate allow={canManageMechanics}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
