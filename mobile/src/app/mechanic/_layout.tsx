import { RoleGate } from "../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { SessionUser, isApplicant } from "../../features/shared/session";
import { useSessionUser } from "../../core/session/session";
import { OnDutySharing } from "../../features/shared/onDuty";
import { mechanicDuty } from "../../features/mechanics/mechanicsService";

// Mechanic area (service requests). UX gate only: every /mechanic API route is also protected on the server.
// A customer with a mechanic application (Work with MOTEXA) opens it here (/mechanic = the application) until approval.
// A GARAGE mechanic who is Online shares his position with his garage and the mechanics admins about every 60 s (foreground only);
// an independent mechanic has no Online switch (he shares his location only during an active on-site job, from the job screen).
const online = async () => { const d = await mechanicDuty.get(); return !!d && !d.offline && d.approval === "APPROVED"; };
function Duty() {
  return useSessionUser().role === "MECHANIC" ? <OnDutySharing status={online} send={mechanicDuty.ping} /> : null;
}
export default function MechanicLayout() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "MECHANIC" || isApplicant(u, ["MECHANIC"])}>
      <Duty />
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
