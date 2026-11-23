import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BrandWordmark from './BrandWordmark';
import Pressable from './MotionPressable';
import { Text } from './MotexaVisual';
import { useAppearance } from './Appearance';
import { useLanguage } from '../i18n/LanguageContext';

export default function BrandHeader({onBack,backLabel,light=false,caption,backDisabled=false,brandRule=true}:{onBack?:()=>void;backLabel?:string;light?:boolean;caption?:string;backDisabled?:boolean;brandRule?:boolean}) {
  const {fontScale,width}=useWindowDimensions();
  const {dark,setMode}=useAppearance();
  const {isArabic,toggleLanguage}=useLanguage();
  const color=light||dark?'#FFF5EA':'#664226';
  const control=[styles.control,{borderColor:light||dark?'#9B785266':'#DCC5A6'}];
  return <View style={[styles.header,{flexWrap:fontScale>1.5?"wrap":"nowrap"}]}>
    <View style={[styles.brand,{minWidth:Math.min(125*fontScale,width*.36)}]}><BrandWordmark light={light} size={width<360?20:22} rule={brandRule} style={brandRule?{flex:1}:undefined}/>{caption?<Text style={[styles.caption,{color}]}>{caption}</Text>:null}</View>
    <View style={styles.controls}>
      {onBack?<Pressable accessibilityRole="button" accessibilityLabel={backLabel||(isArabic?'رجوع':'Back')} onPress={onBack} disabled={backDisabled} style={control}><Ionicons name={isArabic?'arrow-forward':'arrow-back'} size={20} color={color}/></Pressable>:null}
      <Pressable accessibilityRole="button" accessibilityLabel={isArabic?'Switch to English':'التبديل إلى العربية'} onPress={toggleLanguage} style={control}><Text style={{fontSize:11,color}}>{isArabic?'EN':'عربي'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={isArabic?(dark?'تفعيل المظهر الفاتح':'تفعيل المظهر الليلي'):(dark?'Use light appearance':'Use dark appearance')} onPress={()=>setMode(dark?'light':'dark')} style={control}><Ionicons name={dark?'sunny-outline':'moon-outline'} size={18} color={color}/></Pressable>

    </View>
  </View>;
}
const styles=StyleSheet.create({
  header:{width:'100%',paddingHorizontal:12,paddingBottom:4,minHeight:68,flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:4},
  brand:{flex:1,minWidth:0},
  caption:{fontSize:10,lineHeight:14,textAlign:'left'},
  controls:{flexDirection:'row',alignItems:'center',gap:4,marginLeft:'auto',flexShrink:0},
  control:{width:44,height:44,borderRadius:22,borderWidth:1,alignItems:'center',justifyContent:'center'},
});
