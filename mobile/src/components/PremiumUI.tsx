import React,{useEffect,useRef} from 'react';
import {Animated,Platform,StyleSheet,View,type TextProps} from 'react-native';
import {useFonts} from 'expo-font';
import {Text,useReducedMotion} from './MotexaVisual';
import {useAppearance} from './Appearance';
import {useLanguage} from '../i18n/LanguageContext';
export function EditorialTitle({style,children,accent=true,...props}:TextProps & {accent?:boolean}){
 const [ready]=useFonts({MotexaEditorial:require('../../assets/fonts/GFSDidot-Regular.ttf')});
 const {dark}=useAppearance();const {isArabic}=useLanguage();
 return <Text {...props} style={[{color:dark?'#FFF1DF':'#432D1E',fontSize:28,lineHeight:38,fontWeight:'600',textAlign:isArabic?'right':'left'},style,accent&&!isArabic&&{fontFamily:ready?'MotexaEditorial':Platform.OS==='ios'?'Georgia':'serif',fontWeight:'normal'}]}>{children}</Text>;
}
export function SectionCaption({index,title,trailing}:{index?:string;title:string;trailing?:string}){
 const {dark}=useAppearance();const {isArabic}=useLanguage();const muted=dark?'#C9A77E':'#8A6545';
 return <View style={{flexDirection:isArabic?'row-reverse':'row',alignItems:'center',gap:10,paddingBottom:12,borderBottomWidth:1,borderBottomColor:dark?'#705238':'#D8BC98'}}>{!!index&&<Text style={{fontSize:10,color:muted}}>{index}</Text>}<Text style={{flex:1,fontSize:10,lineHeight:20,letterSpacing:isArabic?0:1.5,color:muted,textAlign:isArabic?'right':'left'}}>{title}</Text>{!!trailing&&<Text style={{fontSize:8,lineHeight:18,color:muted}}>{trailing}</Text>}</View>;
}
export function CommandDial({value,label,index=0}:{value:string;label:string;index?:number}){
 const {dark}=useAppearance();const reduced=useReducedMotion();const rotation=useRef(new Animated.Value(0)).current;
 useEffect(()=>{if(reduced){rotation.setValue(index*110);return;}const a=Animated.spring(rotation,{toValue:index*110,damping:19,stiffness:100,mass:1,useNativeDriver:true,isInteraction:false});a.start();return()=>a.stop();},[index,reduced,rotation]);
 const line=dark?'#735239':'#D8B995',accent=dark?'#E0B67F':'#A7754A';
 return <View accessible accessibilityLabel={label+': '+value} style={{width:236,height:236,alignItems:'center',justifyContent:'center'}}>
  <View style={[StyleSheet.absoluteFill,{borderWidth:1,borderColor:line,borderRadius:118}]}/>
  <View style={{position:'absolute',inset:9,borderWidth:1,borderColor:line,borderRadius:110}}/>
  <Animated.View pointerEvents="none" style={{position:'absolute',inset:18,borderWidth:5,borderColor:dark?'#473326':'#E8D1B3',borderTopColor:accent,borderRightColor:accent,borderRadius:100,transform:[{rotate:rotation.interpolate({inputRange:[0,360],outputRange:['0deg','360deg']})}]}}/>
  <Text style={{fontSize:9,lineHeight:19,color:dark?'#D6BA96':'#806044',textAlign:'center',maxWidth:150}}>{label}</Text>
  <EditorialTitle style={{fontSize:70,lineHeight:88,textAlign:'center'}}>{value}</EditorialTitle>
  <View style={{width:22,height:2,backgroundColor:accent,marginTop:4}}/>
 </View>;
}
