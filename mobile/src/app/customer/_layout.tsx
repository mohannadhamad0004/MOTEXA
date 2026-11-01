import { RoleGate } from "../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { GarageFonts } from "../../components/garage";
import { SessionUser } from "../../features/shared/session";
import { MyCarSheet } from "../../features/catalog/VehiclePicker";

// Customer area. UX gate only: every /catalog endpoint is also protected on the server. GarageFonts loads the customer type once.
export default function CustomerLayout() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "CUSTOMER"}>
      <GarageFonts>
        <Stack screenOptions={{ headerShown: false }} />
        {/* the one "Your car" sheet: Home, Parts, Profile and product pages open it with openMyCarPicker() */}
        <MyCarSheet />
      </GarageFonts>
    </RoleGate>
  );
}
