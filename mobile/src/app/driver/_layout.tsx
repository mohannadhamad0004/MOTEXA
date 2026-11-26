import { Stack } from "expo-router";
import { GarageFonts } from "../../components/garage";
import { RoleGate } from "../../components/layout/RoleGate";
import { isTowDriver } from "../../features/shared/session";
import { OnDutySharing } from "../../features/shared/onDuty";
import { driverApi } from "../../features/tow/dispatchService";

// Tow drivers (and company owners who also drive). UX gate only: every /driver endpoint checks the TowDriver link on the server.
// While the driver is Online his position goes to his company and the tow admins about every 60 s (foreground only).
const online = async () => { const r = await driverApi.me(); return !r.driver.offline && r.driver.approval === "APPROVED"; };
export default function DriverLayout() {
  return (
    <RoleGate allow={isTowDriver}>
      <GarageFonts>
        <OnDutySharing status={online} send={driverApi.dutyPing} />
        <Stack screenOptions={{ headerShown: false }} />
      </GarageFonts>
    </RoleGate>
  );
}
