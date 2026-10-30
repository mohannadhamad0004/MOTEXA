import { RoleGate } from "../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { GarageFonts } from "../../components/garage";
import { SessionUser } from "../../features/shared/session";

// Customer area. UX gate only: every /catalog endpoint is also protected on the server. GarageFonts loads the customer type once.
export default function CustomerLayout() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "CUSTOMER"}>
      <GarageFonts>
        <Stack screenOptions={{ headerShown: false }} />
      </GarageFonts>
    </RoleGate>
  );
}
