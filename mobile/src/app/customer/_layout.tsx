import { RoleGate } from "../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { SessionUser } from "../../features/shared/session";

// Customer area. UX gate only: every /catalog endpoint is also protected on the server.
export default function CustomerLayout() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "CUSTOMER"}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
