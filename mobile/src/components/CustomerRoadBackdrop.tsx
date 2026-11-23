import {useEffect,useState} from 'react';
import {Animated,AppState,Easing,StyleSheet,View} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {useReducedMotion} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import BrandMonogram from './BrandMonogram';
import {LinearGradient} from 'expo-linear-gradient';

/** Real automotive photography and right-to-left road traces, with no illustrated cars. */
export default function CustomerRoadBackdrop({paused=false}:{paused?:boolean}){
 const m=useMechanicTheme(),reduced=useReducedMotion(),[active,setActive]=useState(AppState.currentState!=='background'),[road]=useState(()=>new Animated.Value(0)),[photo]=useState(()=>new Animated.Value(0));
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>setActive(s==='active'));return()=>sub.remove();},[]);
 useEffect(()=>{if(paused||reduced||!active)return;const a=Animated.loop(Animated.timing(road,{toValue:1,duration:2400,easing:Easing.linear,useNativeDriver:true,isInteraction:false})),b=Animated.loop(Animated.sequence([Animated.timing(photo,{toValue:1,duration:17000,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),Animated.timing(photo,{toValue:0,duration:17000,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false})]));a.start();b.start();return()=>{a.stop();b.stop();};},[paused,reduced,active,road,photo]);
 const ink=m.dark?'#D8BC91':'#A57B48';
 return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill,{overflow:'hidden',backgroundColor:m.canvas}]}>
  <LinearGradient colors={m.dark?['#271B1344','#130E0B00','#130E0B']:['#FFF9EF00','#EBD6BE55']} start={{x:1,y:0}} end={{x:0,y:.8}} style={{position:'absolute',inset:0}}/><BrandMonogram size={330} style={{top:150,left:-90,opacity:.015}}/>
  {[.2,.65].map((top,index)=><View key={top} style={{position:'absolute',top:top*100+'%' as `${number}%`,left:-90,right:-90,height:95,transform:[{rotate:'-10deg'}],opacity:m.dark?.025:.025,borderTopWidth:1,borderBottomWidth:1,borderColor:ink}}><Animated.View testID={index===0?'customer-road-lines':undefined} style={{position:'absolute',left:-140,right:-140,top:46,transform:[{translateX:road.interpolate({inputRange:[0,1],outputRange:[0,-90]})}]}}><Svg width="100%" height="3"><Path d={Array.from({length:24},(_,i)=>`M${i*90} 1 h44`).join(' ')} stroke={ink} strokeWidth="2"/></Svg></Animated.View></View>)}
 </View>;
}
