import React from 'react';
import {Platform,StyleSheet,View,type StyleProp,type TextStyle} from 'react-native';
import {useFonts} from 'expo-font';
import {useAppearance} from './Appearance';
import {Text} from './MotexaVisual';

/** The approved MOTEXA signature: one editorial wordmark in every language and theme. */
export default function BrandWordmark({style,light=false,size=21,rule=true}:{style?:StyleProp<TextStyle>;light?:boolean;size?:number;rule?:boolean}){
 const {dark}=useAppearance();const [ready]=useFonts({MotexaBrand:require('../../assets/fonts/GFSDidot-Regular.ttf')});
 const layout=StyleSheet.flatten(style)||{};const color=light?'#FFF3E2':dark?'#FFF1DF':'#342318';
 return <View accessible accessibilityLabel="MOTEXA" style={{flexDirection:'row',alignItems:'center',gap:11,minWidth:0,flexShrink:1,flex:layout.flex,alignSelf:layout.alignSelf,marginTop:layout.marginTop,marginBottom:layout.marginBottom,paddingVertical:3}}>
  <Text style={{fontFamily:ready?'MotexaBrand':Platform.OS==='ios'?'Georgia':'serif',fontWeight:'normal',fontSize:size,lineHeight:size+9,letterSpacing:2.7,color,writingDirection:'ltr'}}>MOTEXA</Text>
  {rule&&<View accessible={false} style={{height:1,flex:1,minWidth:10,maxWidth:150,backgroundColor:light?'#DBC09A':dark?'#B68C5D':'#A97B4F'}}/>}
 </View>;
}
