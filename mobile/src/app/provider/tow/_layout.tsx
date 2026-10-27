import { RoleGate } from "../../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { ApprovedGate } from "../../../features/provider/ApprovedGate";
import { isTowProvider } from "../../../features/shared/session";

// Client-side UX gate only; backend endpoints must enforce the same rule.
export default function ProviderTowLayout() {
  return (
    <RoleGate allow={isTowProvider}>
      <ApprovedGate>
        <Stack screenOptions={{ headerShown: false }} />
      </ApprovedGate>
    </RoleGate>
  );
}
