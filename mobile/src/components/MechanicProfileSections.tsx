import {useEffect,useState} from 'react';
import {Animated,Easing,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import {Text,useReducedMotion} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

type Item={key:string;label:string;icon:keyof typeof Ionicons.glyphMap};
/** A single native-driven underline keeps the profile navigation calm and clear. */
export default function MechanicProfileSections({items,value,onChange}:{items:Item[];value:string;onChange:(key:string)=>void}){
 const m=useMechanicTheme(),reduced=useReducedMotion();
 const [width,setWidth]=useState(0),[position]=useState(()=>new Animated.Value(0));
 const index=Math.max(0,items.findIndex(item=>item.key===value));
 const visualIndex=m.ar?items.length-1-index:index;
 useEffect(()=>{
  if(!width||!items.length)return;
  const target=visualIndex*width/items.length+10;
  if(reduced){position.setValue(target);return;}
  const animation=Animated.timing(position,{toValue:target,duration:220,easing:Easing.out(Easing.cubic),useNativeDriver:true});
  animation.start();return()=>animation.stop();
 },[width,visualIndex,items.length,position,reduced]);
 return <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{borderBottomWidth:1,borderColor:m.border}}>
  <View style={{flexDirection:m.row}}>{items.map(item=>{const active=item.key===value;return <Pressable focusVisibleOnly key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected:active}} aria-selected={active} onPress={()=>onChange(item.key)} style={{flex:1,minHeight:51,flexDirection:m.row,alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:3}}><Ionicons name={item.icon} size={16} color={active?m.ink:m.muted}/><Text style={{fontSize:12,lineHeight:23,color:active?m.ink:m.muted,fontWeight:active?'600':'400'}}>{item.label}</Text></Pressable>})}</View>
  {width>0&&<Animated.View accessible={false} pointerEvents="none" style={{position:'absolute',left:0,bottom:-1,height:2,width:Math.max(0,width/items.length-20),borderRadius:2,backgroundColor:m.ink,transform:[{translateX:position}]}}/>}
 </View>;
}
