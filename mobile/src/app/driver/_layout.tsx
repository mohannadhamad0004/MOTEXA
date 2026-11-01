import { Stack } from "expo-router";
import { GarageFonts } from "../../components/garage";
import { RoleGate } from "../../components/layout/RoleGate";
import { isTowDriver } from "../../features/shared/session";

// Tow drivers (and company owners who also drive). UX gate only: every /driver endpoint checks the TowDriver link on the server.
export default function DriverLayout() {
  return (
    <RoleGate allow={isTowDriver}>
      <GarageFonts>
        <Stack screenOptions={{ headerShown: false }} />
      </GarageFonts>
    </RoleGate>
  );
}
