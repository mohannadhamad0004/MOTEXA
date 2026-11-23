import {useEffect} from 'react';
import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Animated,{useSharedValue,useAnimatedStyle,withTiming,cancelAnimation} from 'react-native-reanimated';
import Pressable from './MotionPressable';
import {Text,useReducedMotion} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

/** Automotive-inspired geometry; the readable label and selection marker stay stationary. */
export default function MechanicExpertiseWheel({label,icon,selected,disabled,onPress}:{label:string;icon:keyof typeof Ionicons.glyphMap;selected:boolean;disabled:boolean;onPress:()=>void}){
 const m=useMechanicTheme(),reduced=useReducedMotion(),turn=useSharedValue(0);
 useEffect(()=>{turn.value=withTiming(selected?1:0,{duration:reduced?0:320});return()=>cancelAnimation(turn);},[selected,reduced,turn]);
 const rim=useAnimatedStyle(()=>({transform:[{rotate:(turn.value*22)+'deg'},{scale:1+turn.value*.035}]}));
 const bronze=m.dark?'#D7B080':'#986B40';
 return <Pressable focusVisibleOnly accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked:selected,disabled}} aria-checked={selected} disabled={disabled} onPress={onPress} style={{flexBasis:'46%',flexGrow:1,minWidth:0,minHeight:147,paddingVertical:12,paddingHorizontal:3,alignItems:'center',gap:12,opacity:disabled?.5:1,borderRadius:24}}>
  <View style={{width:88,height:88,alignItems:'center',justifyContent:'center'}}>
   <Animated.View pointerEvents="none" style={[{position:'absolute',inset:2,borderRadius:44,borderWidth:2,borderColor:selected?bronze:m.border,backgroundColor:selected?m.soft:m.surface,alignItems:'center',justifyContent:'center'},rim]}>
    <View style={{position:'absolute',inset:5,borderRadius:40,borderWidth:1,borderStyle:'dashed',borderColor:selected?bronze:m.border}}/>
    {[0,45,90,135].map(angle=><View key={angle} style={{position:'absolute',width:1,height:58,backgroundColor:selected?bronze:m.border,opacity:.45,transform:[{rotate:angle+'deg'}]}}/>)}
   </Animated.View>
   <View style={{width:47,height:47,borderRadius:24,borderWidth:1,borderColor:selected?bronze:m.border,backgroundColor:m.surface,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={23} color={selected?bronze:m.muted}/></View>
   {selected&&<View style={{position:'absolute',bottom:0,right:0,width:23,height:23,borderRadius:12,backgroundColor:bronze,borderWidth:2,borderColor:m.surface,alignItems:'center',justifyContent:'center'}}><Ionicons name="checkmark" size={13} color={m.dark?'#35291F':'#FFF8ED'}/></View>}
  </View>
  <Text style={{fontSize:12,lineHeight:22,fontWeight:selected?'600':'400',textAlign:'center',color:m.ink}}>{label}</Text>
 </Pressable>;
}
