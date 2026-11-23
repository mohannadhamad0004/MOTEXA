import {useState,type ReactNode} from 'react';
import {Animated} from 'react-native';
import Pressable from './MotionPressable';
import {useReducedMotion} from './MotexaVisual';
/** Native-driver press feedback; reduced-motion keeps controls stationary. */
export default function MechanicActionTile({label,onPress,children}:{label:string;onPress:()=>void;children:ReactNode}){
 const [scale]=useState(()=>new Animated.Value(1));const reduced=useReducedMotion();
 const animate=(value:number)=>{if(reduced){scale.setValue(1);return;}Animated.spring(scale,{toValue:value,useNativeDriver:true,speed:30,bounciness:3}).start();};
 return <Animated.View style={{flex:1,transform:[{scale}]}}><Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={()=>animate(.97)} onPressOut={()=>animate(1)} style={{flex:1}}>{children}</Pressable></Animated.View>;
}
