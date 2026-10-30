import { useEffect, useRef } from "react";
import { Animated, DimensionValue, Easing, View } from "react-native";
import { useReduced } from "../../motion";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { PhotoKey } from "../../theme/photos";
import { Photo } from "./Photo";
import { GButton } from "./primitives";
import { GText } from "./text";

/** Small photo slot + one line + one action. No drawings. */
export function EmptyState({ photo = "empty.search", text, action }: { photo?: PhotoKey; text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ alignItems: "center", gap: 14, paddingVertical: 24, paddingHorizontal: 12 }}>
      <Photo k={photo} radius={gShape.cardLg} style={{ width: 132, height: 132 }} />
      <GText soft style={[gType.body, { textAlign: "center" }]}>{text}</GText>
      {action ? <GButton variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

/** A line + Retry. */
export function ErrorState({ text, onRetry, retryLabel = "Retry" }: { text: string; onRetry: () => void; retryLabel?: string }) {
  const { g } = useGarageTheme();
  return (
    <View accessibilityRole="alert" style={{ alignItems: "center", gap: 12, paddingVertical: 20, paddingHorizontal: 12 }}>
      <GText style={[gType.bodySm, { textAlign: "center", color: g.danger }]}>{text}</GText>
      <GButton variant="secondary" icon="refresh-outline" label={retryLabel} onPress={onRetry} />
    </View>
  );
}

/** Soft pulse block; still with reduced motion. */
export function SkeletonBlock({ width = "100%", height = 16, radius = gShape.small }: { width?: DimensionValue; height?: number; radius?: number }) {
  const { g } = useGarageTheme();
  const reduced = useReduced();
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, v]);
  return <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: g.tint, opacity: v }} />;
}

/** Placeholder grid of product cards. */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  const { row } = useGarageTheme();
  return (
    <View accessibilityLabel="Loading" style={[row, { flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 }]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: "48%", gap: 8 }}>
          <SkeletonBlock height={150} radius={gShape.card} />
          <SkeletonBlock width="80%" height={14} />
          <SkeletonBlock width="45%" height={14} />
        </View>
      ))}
    </View>
  );
}

/** Placeholder list rows. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} height={72} radius={gShape.card} />
      ))}
    </View>
  );
}
