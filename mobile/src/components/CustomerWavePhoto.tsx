import {useEffect,useState,type ReactNode} from 'react';
import {Animated,Easing,View,type ImageSourcePropType} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {LinearGradient} from 'expo-linear-gradient';
import {useReducedMotion} from './MotexaVisual';

export default function CustomerWavePhoto({source,height=230,fill,paused=false,children}:{source:ImageSourcePropType;height?:number;fill:string;paused?:boolean;children?:ReactNode}){
 const reduced=useReducedMotion(),[wave]=useState(()=>new Animated.Value(0));
 useEffect(()=>{if(reduced||paused)return;const a=Animated.loop(Animated.sequence([Animated.timing(wave,{toValue:1,duration:6600,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),Animated.timing(wave,{toValue:0,duration:6600,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false})]));a.start();return()=>a.stop();},[wave,reduced,paused]);
 return <View style={{height,overflow:'hidden',borderTopLeftRadius:42,borderTopRightRadius:18,borderBottomRightRadius:38,backgroundColor:'#252823'}}>
  <Animated.Image testID="customer-wave-photo" source={source} resizeMode="cover" accessible={false} style={{position:'absolute',left:'-7%',top:'-6%',width:'114%',height:'112%',transform:[{translateX:wave.interpolate({inputRange:[0,1],outputRange:[13,-13]})},{scale:wave.interpolate({inputRange:[0,1],outputRange:[1,1.045]})},{rotate:wave.interpolate({inputRange:[0,1],outputRange:['-.25deg','.25deg']})}]}}/>
  <LinearGradient colors={children?['#12191591','#12191508','#121915E8']:['#17201505','#1720154D']} locations={children?[0,.4,1]:undefined} style={{position:'absolute',inset:0}}/>
  {children}
  <Animated.View pointerEvents="none" style={{position:'absolute',left:'-10%',width:'120%',height:49,bottom:-1,transform:[{translateX:wave.interpolate({inputRange:[0,1],outputRange:[-15,15]})}]}}><Svg width="100%" height="50" viewBox="0 0 640 50" preserveAspectRatio="none"><Path d="M0 19 C120 -5 175 46 304 23 S506 -6 640 20 V50 H0 Z" fill={fill}/></Svg></Animated.View>
 </View>;
}
