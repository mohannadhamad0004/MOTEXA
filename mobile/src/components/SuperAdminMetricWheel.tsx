import {useEffect,type ReactNode} from 'react';
import {View} from 'react-native';
import Svg,{Circle,Defs,LinearGradient,RadialGradient,Stop,Path,G} from 'react-native-svg';
import {Ionicons} from '@expo/vector-icons';
import Animated,{useSharedValue,useAnimatedStyle,withTiming,cancelAnimation,Easing} from 'react-native-reanimated';
import {Text,useReducedMotion} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

/** Read-only metric: rim motion never changes the live value or suggests a percentage. */
export default function SuperAdminMetricWheel({label,value,icon,size,numberFont,center,decorative=false}:{label:string;value:string;icon:keyof typeof Ionicons.glyphMap;size:number;numberFont?:string;center?:ReactNode;decorative?:boolean}){
 const m=useMechanicTheme(),reduced=useReducedMotion(),turn=useSharedValue(0);
 useEffect(()=>{turn.value=reduced?0:-18;turn.value=withTiming(0,{duration:reduced?0:650,easing:Easing.out(Easing.cubic)});return()=>cancelAnimation(turn);},[value,reduced,turn]);
 const motion=useAnimatedStyle(()=>({transform:[{rotate:turn.value+'deg'}]}));
 const hub=size*.43;

 return <View accessible={!decorative} accessibilityLabel={decorative?undefined:label+': '+value} style={{alignItems:'center',gap:10,paddingVertical:10}}>
  <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
   <Animated.View pointerEvents="none" style={[{position:'absolute',inset:0},motion]}>
    <Svg width={size} height={size} viewBox="0 0 100 100">
     <Defs>
      <LinearGradient id="tire" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#AAA59C"/><Stop offset=".3" stopColor="#716E68"/><Stop offset=".7" stopColor="#575650"/><Stop offset="1" stopColor="#918B81"/></LinearGradient>
      <LinearGradient id="alloy" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#F7F4EF"/><Stop offset=".35" stopColor="#BDBAB3"/><Stop offset=".55" stopColor="#EEEAE2"/><Stop offset="1" stopColor="#8C8981"/></LinearGradient>
      <RadialGradient id="barrel"><Stop offset="0" stopColor="#A29D93"/><Stop offset="1" stopColor="#5B5953"/></RadialGradient>
     </Defs>
     <Circle cx="50" cy="50" r="47" fill="url(#tire)" stroke="#A69B8C" strokeWidth=".7"/>
     <Circle cx="50" cy="50" r="44" fill="none" stroke="#BCB7AD" strokeOpacity=".45" strokeWidth=".5"/>
     {Array.from({length:28},(_,i)=><Path key={i} d="M49 4 L47.8 8" stroke="#464640" strokeOpacity=".36" strokeWidth=".65" transform={'rotate('+(i*360/28)+' 50 50)'}/>)}
     <Circle cx="50" cy="50" r="37.5" fill="url(#barrel)" stroke="url(#alloy)" strokeWidth="3"/>
     <Circle cx="50" cy="50" r="32" fill="none" stroke="#C5BFB3" strokeOpacity=".4" strokeWidth=".5"/>
     {[0,72,144,216,288].map(angle=><G key={angle} transform={'rotate('+angle+' 50 50)'}><Path d="M44 47 L42 20 L46 15 L49 40 L51 40 L54 15 L58 20 L56 47 Z" fill="url(#alloy)" stroke="#D8D1C5" strokeWidth=".5"/><Path d="M46 19 L48 37 M54 19 L52 37" fill="none" stroke="#FFF9ED" strokeOpacity=".65" strokeWidth=".5"/></G>)}
     <Circle cx="50" cy="50" r="23" fill="url(#alloy)" stroke="#E5DDD0" strokeWidth=".6"/>
    </Svg>
   </Animated.View>
   <View style={{width:hub,height:hub,borderRadius:hub/2,borderWidth:1,borderColor:m.dark?'#AC9F8B':'#D4C3AB',backgroundColor:m.surface,alignItems:'center',justifyContent:'center',boxShadow:m.dark?undefined:'0px 2px 4px rgba(115,80,44,0.05)'}}>{center??(<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.45} style={{fontFamily:numberFont,fontSize:size*.255,lineHeight:size*.34,color:m.ink,textAlign:'center',writingDirection:'ltr',maxWidth:hub-10}}>{value}</Text>)}</View>
  </View>
  <View style={{flexDirection:m.row,alignItems:'center',justifyContent:'center',gap:5,maxWidth:'100%'}}>{!center&&<Ionicons name={icon} size={13} color={m.muted}/>}<Text style={{flexShrink:1,fontSize:12,lineHeight:22,fontWeight:'500',textAlign:'center',color:m.ink}}>{label}</Text></View>
 </View>;
}
