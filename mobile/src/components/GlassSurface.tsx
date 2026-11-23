import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useAppearance } from './Appearance';

/** A warm glass surface with an opaque accessibility and platform fallback. */
export default function GlassSurface({style, children, ...props}: ViewProps) {
  const {dark} = useAppearance();
  const [opaque, setOpaque] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const preference = window.matchMedia('(prefers-reduced-transparency: reduce)');
      setOpaque(preference.matches);
      const change = () => setOpaque(preference.matches);
      preference.addEventListener('change', change);
      return () => preference.removeEventListener('change', change);
    }
    if (Platform.OS !== 'ios' || typeof AccessibilityInfo.isReduceTransparencyEnabled !== 'function') return;
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then(value => {if(mounted) setOpaque(value);}).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOpaque);
    return () => {mounted=false; subscription.remove();};
  }, []);
  const nativeGlass = !opaque && Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const webGlass = !opaque && Platform.OS === 'web';
  const surface: ViewStyle & {backdropFilter?:string; WebkitBackdropFilter?:string} = {
    backgroundColor: nativeGlass ? 'transparent' : dark ? (webGlass ? 'rgba(45,33,25,.88)' : '#30231B') : (webGlass ? 'rgba(255,249,239,.88)' : '#FFF9EF'),
    borderWidth: 1, borderColor: dark ? '#C9A77755' : '#FFFFFFCC',
    borderRadius: 26,
    ...(webGlass ? {backdropFilter:'blur(20px) saturate(125%)',WebkitBackdropFilter:'blur(20px) saturate(125%)'} : {}),
  };
  return <View {...props} style={[surface,style]}>
    {nativeGlass && <GlassView pointerEvents="none" colorScheme={dark?'dark':'light'} glassEffectStyle="regular" tintColor={dark?'#30231B66':'#FFF9EF66'} style={[StyleSheet.absoluteFill,{borderRadius:StyleSheet.flatten(style)?.borderRadius ?? 26}]}/>}
    {children}
  </View>;
}
