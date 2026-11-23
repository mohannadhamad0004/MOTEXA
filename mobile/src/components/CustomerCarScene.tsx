import {useEffect,useState} from 'react';
import {Animated,Easing,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {useReducedMotion} from './MotexaVisual';

/** Real decorative automotive photography with a slow pan; never a vehicle likeness claim. */
export default function CustomerCarScene({expanded=false,paused=false}:{expanded?:boolean;paused?:boolean}){
 const reduced=useReducedMotion(),[pan]=useState(()=>new Animated.Value(0));
 useEffect(()=>{if(reduced||paused)return;const a=Animated.loop(Animated.sequence([Animated.timing(pan,{toValue:1,duration:10500,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),Animated.timing(pan,{toValue:0,duration:10500,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false})]));a.start();return()=>a.stop();},[pan,reduced,paused]);
 return <View pointerEvents="none" accessible={false} style={{height:expanded?215:245,overflow:'hidden',borderRadius:24,backgroundColor:'#252623'}}><Animated.Image source={require('../../assets/images/audi-conor-samuel.jpg')} resizeMode="cover" style={{position:'absolute',width:'112%',height:'112%',left:'-6%',top:'-6%',transform:[{translateX:pan.interpolate({inputRange:[0,1],outputRange:[12,-12]})},{scale:pan.interpolate({inputRange:[0,1],outputRange:[1,1.06]})}]}}/><LinearGradient colors={['transparent','#171B1890']} style={{position:'absolute',inset:0}}/></View>;
}
