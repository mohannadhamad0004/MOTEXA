import {useCallback,useState} from 'react';
import {View,Image,useWindowDimensions} from 'react-native';
import Animated,{useSharedValue,useAnimatedStyle,withTiming,runOnJS} from 'react-native-reanimated';
import {Gesture,GestureDetector,GestureHandlerRootView} from 'react-native-gesture-handler';
import {Text,useReducedMotion} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import {OwnerVehicleArt} from './OwnerVehicleCard';
import {ownerVehicleCabin} from './OwnerHomeShowcase';
import Pressable from './MotionPressable';
import type {OwnerVehicle} from './OwnerTypes';

/** Two editorial views with gesture-driven crossfade, never a generated view of a private upload. */
export default function OwnerVehiclePresentation({vehicle}:{vehicle:OwnerVehicle}){
 const m=useMechanicTheme(),{width}=useWindowDimensions(),reduced=useReducedMotion(),[inside,setInside]=useState(false),progress=useSharedValue(0),start=useSharedValue(0),cabin=ownerVehicleCabin(vehicle),uploaded=!!(vehicle.photoUpdatedAt||vehicle.photoDataUri),canExplore=!!cabin&&!uploaded;
 const select=useCallback((next:boolean)=>{setInside(next);progress.set(withTiming(next?1:0,{duration:reduced?0:330}));},[progress,reduced]);
 const direction=m.ar?-1:1;
 const pan=Gesture.Pan().enabled(canExplore).activeOffsetX([-18,18]).failOffsetY([-14,14]).onBegin(()=>{start.set(progress.get());}).onUpdate(e=>{if(!reduced)progress.set(Math.max(0,Math.min(1,start.get()-e.translationX*direction/Math.min(width,520))));}).onEnd(e=>{const delta=e.translationX*direction;runOnJS(select)(Math.abs(delta)>45?delta<0:start.value>.5);}).onFinalize((_e,success)=>{if(!success)progress.set(withTiming(start.get(),{duration:reduced?0:180}));});
 const exterior=useAnimatedStyle(()=>({opacity:1-progress.value,transform:reduced?[]:[{scale:1+progress.value*.06}]}));
 const interior=useAnimatedStyle(()=>({opacity:progress.value,transform:reduced?[]:[{scale:1.06-progress.value*.06}]}));
 return <View style={{gap:12}}>
  {canExplore&&<View accessibilityRole="tablist" style={{flexDirection:m.row,gap:18}}>{[{v:false,en:'Exterior',ar:'خارجي'},{v:true,en:'Interior',ar:'داخلي'}].map(v=><Pressable focusVisibleOnly key={v.en} accessibilityRole="tab" accessibilityLabel={m.t(v.en,v.ar)} accessibilityState={{selected:inside===v.v}} aria-selected={inside===v.v} onPress={()=>select(v.v)} style={{minHeight:46,minWidth:90,paddingHorizontal:10,alignItems:'center',justifyContent:'center',borderBottomWidth:2,borderColor:inside===v.v?m.bronze:'transparent'}}><Text style={{fontSize:14,color:inside===v.v?m.ink:m.muted,fontWeight:inside===v.v?'600':'400'}}>{m.t(v.en,v.ar)}</Text></Pressable>)}</View>}
  {canExplore?<GestureHandlerRootView style={{height:300,overflow:'hidden'}}><GestureDetector gesture={pan} touchAction="pan-y"><Animated.View testID="owner-vehicle-explorer" style={{height:300}}>
   <Animated.View pointerEvents="none" testID="owner-garage-exterior" style={[{position:'absolute',inset:0},exterior]}><OwnerVehicleArt vehicle={vehicle} detail/></Animated.View>
   <Animated.View pointerEvents="none" testID="owner-garage-interior" style={[{position:'absolute',inset:0},interior]}><Image accessible={false} source={cabin!} resizeMode="cover" style={{width:'100%',height:'100%'}}/><Text style={{position:'absolute',bottom:10,left:12,right:12,fontSize:11,lineHeight:21,color:'#FFF1E0',backgroundColor:'#17120FCC',padding:7}}>{m.t('Illustrative interior · not your uploaded car photo','صورة داخلية توضيحية، وليست صورة سيارتك المرفوعة')}</Text></Animated.View>
  </Animated.View></GestureDetector></GestureHandlerRootView>:<OwnerVehicleArt vehicle={vehicle} detail/>}
  {canExplore&&<Text style={{fontSize:11,lineHeight:21,color:m.muted,textAlign:m.align}}>{m.t('Swipe sideways or use the view controls.','اسحب يمين أو يسار، أو اختَر طريقة العرض.')}</Text>}
 </View>;
}
