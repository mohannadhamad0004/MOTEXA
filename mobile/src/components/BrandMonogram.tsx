import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFonts } from 'expo-font';
import { useAppearance } from './Appearance';

/** A decorative printed M, kept out of touch handling and the accessibility tree. */
export default function BrandMonogram({size=260,style}:{size?:number;style?:StyleProp<ViewStyle>}) {
  const {dark}=useAppearance();
  const [ready]=useFonts({MotexaBrand:require('../../assets/fonts/GFSDidot-Regular.ttf')});
  if(!ready)return null;
  return <View testID="brand-monogram" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{position:'absolute',left:-28,top:90,opacity:dark?.045:.06},style]}><Text allowFontScaling={false} style={{fontFamily:'MotexaBrand',fontSize:size,lineHeight:size*1.15,color:dark?'#E0A36F':'#9C714F',writingDirection:'ltr'}}>M</Text></View>;
}
