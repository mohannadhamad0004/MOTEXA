import { RoleGate } from "../../components/layout/RoleGate";
import { Stack } from "expo-router";
import { GarageFonts } from "../../components/garage";
import { SessionUser } from "../../features/shared/session";
import { MyCarSheet } from "../../features/catalog/VehiclePicker";
import { GarageSelectionSheet } from "../../features/catalog/GarageSheets";
import { closeMyCarPicker, garageStore, useGarage } from "../../features/catalog/myCar";
import { useEffect } from "react";
import { View } from "react-native";
import { GText } from "../../components/garage";
import { useL } from "../../core/hooks/useL";

function CustomerGarage() {
  const { loaded } = useGarage();
  const { t } = useL();
  useEffect(() => () => { closeMyCarPicker(); garageStore.reset(null); }, []);
  // Read the account's active car before request forms snapshot their initial values.
  // Failed hydration still releases navigation: adding a car is never required.
  if (!loaded) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><GText>{t("Loading Garage…", "جارٍ تحميل الكراج…")}</GText></View>;
  return <><Stack screenOptions={{ headerShown: false }} /><MyCarSheet /><GarageSelectionSheet /></>;
}

// Customer area. UX gate only: every /catalog endpoint is also protected on the server. GarageFonts loads the customer type once.
export default function CustomerLayout() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "CUSTOMER"}>
      <GarageFonts>
        <CustomerGarage />
      </GarageFonts>
    </RoleGate>
  );
}
