import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip } from "../../components/garage";
import { InTabs } from "../../components/layout/ProviderLayout";
import { useL } from "../../core/hooks/useL";
import { useGarageTheme } from "../../theme/garage";
import Drivers from "../../app/provider/tow/drivers";
import Trucks from "../../app/provider/tow/trucks";

/** Fleet = the existing Trucks and Drivers screens behind one switch. */
export function FleetTab() {
  const { t } = useL();
  const { row, g } = useGarageTheme();
  const insets = useSafeAreaInsets();
  const [part, setPart] = useState<"trucks" | "drivers">("trucks");
  return (
    <View style={{ flex: 1, backgroundColor: g.page }}>
      <View style={[row, { gap: 8, paddingHorizontal: 18, paddingTop: insets.top + 8 }]}>
        <Chip label={t("Trucks", "الشاحنات")} on={part === "trucks"} onPress={() => setPart("trucks")} />
        <Chip label={t("Drivers", "السائقون")} on={part === "drivers"} onPress={() => setPart("drivers")} />
      </View>
      <InTabs.Provider value={2}>{part === "trucks" ? <Trucks /> : <Drivers />}</InTabs.Provider>
    </View>
  );
}
