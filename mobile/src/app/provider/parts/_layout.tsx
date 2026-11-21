import { RoleGate } from "../../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { View } from "react-native";
import { ToastHost } from "../../../components/ItemActionsMenu";
import { ApprovedGate } from "../../../features/provider/ApprovedGate";
import { isPartsProvider } from "../../../features/shared/session";

// Client-side UX gate only; backend endpoints must enforce the same rule.
export default function ProviderPartsLayout() {
  return (
    <RoleGate allow={isPartsProvider}>
      <ApprovedGate>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
          <ToastHost />
        </View>
      </ApprovedGate>
    </RoleGate>
  );
}
