import { Stack } from "expo-router";
import { View } from "react-native";
import { ToastHost } from "../../components/ItemActionsMenu";
import { RoleGate } from "../../components/layout/RoleGate";
import { ApprovedGate } from "../../features/provider/ApprovedGate";
import { isGarageOwner } from "../../features/shared/session";

// Garage owner area. Client-side UX gate only: every /garage/me endpoint checks the role and the garage's approval again.
// Until MOTEXA approves the garage, the owner lands on his application (provider onboarding).
export default function GarageLayout() {
  return (
    <RoleGate allow={isGarageOwner}>
      <ApprovedGate>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
          <ToastHost />
        </View>
      </ApprovedGate>
    </RoleGate>
  );
}
