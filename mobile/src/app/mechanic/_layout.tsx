import { RoleGate } from "../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { SessionUser, isApplicant } from "../../features/shared/session";

// Mechanic area (service requests). UX gate only: every /mechanic API route is also protected on the server.
// A customer with a mechanic application (Work with MOTEXA) opens it here (/mechanic = the application) until approval.
export default function MechanicLayout() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "MECHANIC" || isApplicant(u, ["MECHANIC"])}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
