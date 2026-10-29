import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CanvasFill } from "../../components/BrandSurfaces";
import MechanicRegistration from "../../components/MechanicRegistration";
import MechanicApplication from "../../components/MechanicApplication";
export default function MechanicPreview() {
  const { stage } = useLocalSearchParams<{ stage?: string }>(),
    [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const value = Number(stage),
    current = Number.isInteger(value) && value >= 1 && value <= 5 ? value : 2;
  const choose = (step: number) => router.setParams({ stage: String(step) });
  if (!ready)
    return (
      <View style={{ flex: 1 }}>
        <CanvasFill />
      </View>
    );
  return current === 1 ? (
    <MechanicRegistration previewOnly onPreviewStep={choose} />
  ) : (
    <MechanicApplication
      previewOnly
      initialStep={current - 2}
      onPreviewStep={choose}
    />
  );
}
