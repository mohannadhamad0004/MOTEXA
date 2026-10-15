import { Stack } from "expo-router";
import { SessionUser } from "../../features/shared/session";
import { RoleGate } from "../../features/shared/ui";

// Customer area. UX gate only: every /catalog endpoint is also protected on the server.
export default function CustomerLayout() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "CUSTOMER"}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
