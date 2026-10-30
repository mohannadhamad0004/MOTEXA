// Product gallery: swipeable real photos with dots (dots only with 2+ photos), tap opens a full-screen viewer with pinch zoom
// (double tap resets). Photos are shown whole (contain on a neutral studio background), never stretched or mirrored.
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PHOTO_BG } from "../../features/catalog/PartPhoto";
import { gShape, useGarageTheme } from "../../theme/garage";
import { IconButton } from "./primitives";
import { GIcon } from "./text";

function Zoomable({ uri, width, height }: { uri: string; width: number; height: number }) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(4, Math.max(1, saved.value * e.scale));
    })
    .onEnd(() => {
      saved.value = scale.value;
      if (scale.value <= 1) {
        x.value = withTiming(0);
        y.value = withTiming(0);
      }
    });
  const pan = Gesture.Pan()
    .minPointers(1)
    .onStart(() => {
      sx.value = x.value;
      sy.value = y.value;
    })
    .onUpdate((e) => {
      if (scale.value > 1) {
        x.value = sx.value + e.translationX;
        y.value = sy.value + e.translationY;
      }
    });
  const reset = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(scale.value > 1 ? 1 : 2);
      saved.value = scale.value > 1 ? 1 : 2;
      x.value = withTiming(0);
      y.value = withTiming(0);
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, reset)}>
      <Animated.View style={[{ width, height }, style]}>
        <Image source={{ uri }} contentFit="contain" style={{ width, height }} />
      </Animated.View>
    </GestureDetector>
  );
}

export function Gallery({ uris, label, onFail, onPhoto }: { uris: string[]; label: string; onFail?: () => void; onPhoto?: (e: { width: number; height: number }) => void }) {
  const { g } = useGarageTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => w && setIndex(Math.round(e.nativeEvent.contentOffset.x / w));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ borderRadius: gShape.cardLg, overflow: "hidden", backgroundColor: PHOTO_BG }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} scrollEnabled={uris.length > 1}>
        {uris.map((u) => (
          <Pressable key={u} accessibilityRole="imagebutton" accessibilityLabel={label} accessibilityHint="Opens the photo full screen" onPress={() => setOpen(true)} style={{ width: w || 1, aspectRatio: 1 }}>
            <Image source={{ uri: u }} contentFit="contain" style={{ width: "100%", height: "100%" }} transition={200} onError={onFail} onLoad={(e) => onPhoto?.(e.source)} />
          </Pressable>
        ))}
      </ScrollView>
      {uris.length > 1 ? (
        <View style={{ position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {uris.map((u, i) => (
            <View key={u} style={{ width: i === index ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? g.accent : "rgba(43,31,24,0.25)" }} />
          ))}
        </View>
      ) : null}
      <View style={{ position: "absolute", bottom: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center" }} pointerEvents="none">
        <GIcon name="expand-outline" size={16} color="#2B1F18" />
      </View>
      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0E0907" }}>
          <ScrollView horizontal pagingEnabled contentOffset={{ x: index * screenW, y: 0 }} showsHorizontalScrollIndicator={false}>
            {uris.map((u) => (
              <View key={u} style={{ width: screenW, height: screenH, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <Zoomable uri={u} width={screenW} height={screenH * 0.8} />
              </View>
            ))}
          </ScrollView>
          <View style={{ position: "absolute", top: insets.top + 12, right: 16 }}>
            <IconButton icon="close" label="Close" onPress={() => setOpen(false)} />
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

