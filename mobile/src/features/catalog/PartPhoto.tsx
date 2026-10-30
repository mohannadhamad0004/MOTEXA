import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { View, ViewStyle } from "react-native";
import { Text } from "../../components/ui/Text";
import { isDevSeedTile } from "../../core/constants/files";

/** Clean light studio background for product photos, in both themes (photos are shot on white / light grey). */
export const PHOTO_BG = "#F4EFE8";

/**
 * A product's real photo on a neutral square: `scale-down` shows the whole picture (never cropped or stretched) and never
 * enlarges a small one. No photo, a failed load or a dev seed tile shows a plain MOTEXA tile (never an illustration) and
 * calls `onFail`, so a list can drop the product (customers only ever get products that have a real photo).
 */
export function PartPhoto({ uri, style, onFail }: { uri?: string | null; style?: ViewStyle; onFail?: () => void }) {
  const [bad, setBad] = useState(false);
  const show = !!uri && !bad;
  useEffect(() => {
    if (!uri) onFail?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);
  const fail = () => {
    setBad(true);
    onFail?.();
  };
  return (
    <View style={[{ width: "100%", aspectRatio: 1, borderRadius: 14, overflow: "hidden", backgroundColor: PHOTO_BG, alignItems: "center", justifyContent: "center", padding: 6 }, style]}>
      {show ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="scale-down"
          onError={fail}
          onLoad={(e) => isDevSeedTile(e.source.width, e.source.height) && fail()}
        />
      ) : (
        <Text accessibilityElementsHidden style={{ color: "#B9AFA3", fontSize: 30, fontWeight: "800" }}>M</Text>
      )}
    </View>
  );
}
