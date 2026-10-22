import { RoleGate } from "../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { SessionUser } from "../../features/shared/session";

// Mechanic area (service requests). UX gate only: every /mechanic API route is also protected on the server.
export default function MechanicLayout() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "MECHANIC"}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
