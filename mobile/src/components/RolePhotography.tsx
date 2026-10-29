import { useState } from "react";
import { Image, View, type ViewStyle } from "react-native";
export function RolePhotography({
  index,
  style,
}: {
  index: number;
  style?: ViewStyle;
}) {
  const [frame, setFrame] = useState({ width: 90, height: 92 });
  const photoWidth = (frame.height * 10) / 3;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setFrame((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height },
        );
      }}
      style={[{ overflow: "hidden", backgroundColor: "#795236" }, style]}
    >
      <Image
        source={require("../../assets/images/motexa-role-atlas.png")}
        resizeMode="stretch"
        style={{
          position: "absolute",
          width: photoWidth,
          height: frame.height * 5,
          left: (frame.width - photoWidth) / 2,
          top: -index * frame.height,
        }}
      />
    </View>
  );
}
