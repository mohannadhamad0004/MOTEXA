import {useEffect, useState} from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Svg, {Path, Defs, LinearGradient, Stop} from 'react-native-svg';
import Animated, {useSharedValue, useAnimatedStyle, useAnimatedProps, withTiming} from 'react-native-reanimated';
import {Text, useReducedMotion} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

const AnimatedPath=Animated.createAnimatedComponent(Path);
type Item={key:string; icon:keyof typeof Ionicons.glyphMap; label:string};
/** Shared navigation presentation; routing and permissions remain with its caller. */
export default function FloatingRoleTabs({items, selected, onSelect,onLongPress,tabSemantics=false}:{items:Item[];selected:string;onSelect:(key:string)=>void;onLongPress?:(key:string)=>void;tabSemantics?:boolean}) {
 const m=useMechanicTheme(), reduced=useReducedMotion();
 const [width,setWidth]=useState(0);
 const index=Math.max(0,items.findIndex(item=>item.key===selected));
 const visualIndex=m.ar?items.length-1-index:index;
 const center=useSharedValue(0);
 useEffect(()=>{if(width)center.value=withTiming((visualIndex+.5)*width/items.length,{duration:reduced?0:280});},[width,visualIndex,items.length,reduced,center]);
 const shape=useAnimatedProps(()=>{
  const x=center.value, y=15, r=Math.min(26,width/items.length/2-12);
  return {d:`M 30 ${y} H ${x-r-12} C ${x-r-4} ${y} ${x-r-4} 46 ${x} 46 C ${x+r+4} 46 ${x+r+4} ${y} ${x+r+12} ${y} H ${width-30} Q ${width} ${y} ${width} 48 V 52 Q ${width} 76 ${width-30} 76 H 30 Q 0 76 0 52 V 48 Q 0 ${y} 30 ${y} Z`};
 });
 const bubble=useAnimatedStyle(()=>({transform:[{translateX:center.value-22}]}));
 return <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{height:80,width:'100%'}}>
  {width>0&&<>
   <Svg pointerEvents="none" width={width} height={80} style={StyleSheet.absoluteFill}>
    <Defs><LinearGradient id="motexa-tab-glass" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={m.dark?'#2B1C16':'#FFFCF5'} stopOpacity={.96}/><Stop offset="1" stopColor={m.dark?'#211611':'#F2E3CB'} stopOpacity={.94}/></LinearGradient></Defs>
    <AnimatedPath animatedProps={shape} fill="url(#motexa-tab-glass)" stroke={m.dark?'#D6B68B66':'#FFFFFF'} strokeWidth={1.2}/>
   </Svg>
   <Animated.View accessible={false} pointerEvents="none" style={[{position:'absolute',top:0,left:0,width:44,height:44,borderRadius:22,backgroundColor:m.dark?'#E0A36F':'#C99B68',borderWidth:1.5,borderColor:m.dark?'#E0A36F':'#FFF1DC',alignItems:'center',justifyContent:'center',boxShadow:'0px 3px 10px rgba(72,43,25,0.18)'},bubble]}><Ionicons name={items[index].icon} size={22} color={m.dark?'#241A12':'#362519'}/></Animated.View>
  </>}
  <View style={{flexDirection:m.row,height:80}}>{items.map((item,i)=><Pressable key={item.key} accessibilityRole={tabSemantics?"tab":"button"} accessibilityLabel={item.label} accessibilityState={{selected:i===index}} aria-selected={tabSemantics?i===index:undefined} onPress={()=>onSelect(item.key)} onLongPress={()=>onLongPress?.(item.key)} style={({pressed})=>({flex:1,minHeight:56,alignItems:'center',justifyContent:'flex-end',paddingBottom:8,gap:3,opacity:pressed?.65:1})}>
   {i===index?<View accessible={false} pointerEvents="none" style={{height:20,width:20}}/>:<Ionicons accessible={false} name={item.icon} size={20} color={m.dark?'#BFA99B':m.muted}/>}
   <Text numberOfLines={1} adjustsFontSizeToFit style={{fontSize:10,lineHeight:17,fontWeight:i===index?'700':'500',color:i===index?m.ink:m.muted,paddingHorizontal:2}}>{item.label}</Text>
  </Pressable>)}</View>
 </View>;
}
