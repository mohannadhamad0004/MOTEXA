import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text as NativeText, TextProps, View, ViewProps } from 'react-native';
import { useFonts } from 'expo-font';

const FontsReady = createContext(false);
export function VisualProvider({ children }: { children: React.ReactNode }) {
  const [loaded] = useFonts({
    MotexaRegular: require('../../assets/fonts/Manrope-Regular.ttf'),
    MotexaMedium: require('../../assets/fonts/Manrope-SemiBold.ttf'),
    MotexaBold: require('../../assets/fonts/Manrope-Bold.ttf'),
    MotexaArabic: require('../../assets/fonts/Cairo-Regular.ttf'),
    MotexaArabicMedium: require('../../assets/fonts/Cairo-SemiBold.ttf'),
    MotexaArabicBold: require('../../assets/fonts/Cairo-Bold.ttf'),
  });
  // Font loading never hides the screen or delays interaction.
  return <FontsReady.Provider value={loaded}>{children}</FontsReady.Provider>;
}
function textContent(value: React.ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join('');
  if (React.isValidElement<{children?: React.ReactNode}>(value)) return textContent(value.props.children);
  return '';
}
export function Text({ style, children, ...props }: TextProps) {
  const ready = useContext(FontsReady);
  const flat = StyleSheet.flatten(style) || {};
  const arabic = /[\u0600-\u06ff]/.test(textContent(children));
  const weight = flat.fontWeight === 'bold' ? 700 : Number(flat.fontWeight || 400);
  const family = arabic
    ? weight >= 700 ? 'MotexaArabicBold' : weight >= 500 ? 'MotexaArabicMedium' : 'MotexaArabic'
    : weight >= 700 ? 'MotexaBold' : weight >= 500 ? 'MotexaMedium' : 'MotexaRegular';
  return <NativeText {...props} style={[style, ready && { fontFamily: family, fontWeight: 'normal' }, arabic && {letterSpacing: 0, writingDirection: "rtl", textAlign: flat.textAlign || "right"}]}>{children}</NativeText>;
}
function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if(active) setReduced(v); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}
export function HeroReveal({ children, style, ...props }: ViewProps) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false});
    animation.start();
    return () => { animation.stop(); progress.setValue(1); };
  }, [progress, reduced]);
  return <Animated.View {...props} style={[style, {opacity: progress, transform: [{translateY: progress.interpolate({inputRange: [0,1], outputRange: [12,0]})}]}]}>{children}</Animated.View>;
}
export function DecorativeHalo() {
  const reduced = useReducedMotion();
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if(reduced) { drift.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, {toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false}),
      Animated.timing(drift, {toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false}),
    ]));
    animation.start(); return () => animation.stop();
  }, [drift, reduced]);
  return <Animated.View pointerEvents="none" accessible={false} style={{position:'absolute', right:-120, top:35, width:280, height:280, borderRadius:140, borderWidth:1, borderColor:'#AA78452B', transform:[{translateY:drift.interpolate({inputRange:[0,1],outputRange:[0,12]})}]}}>
    <View style={{position:'absolute', inset:32, borderRadius:120, borderWidth:1, borderColor:'#AA78451C'}} />
  </Animated.View>;
}
