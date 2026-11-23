import {View} from 'react-native';
import {useEffect,useState} from 'react';
import {useFonts} from 'expo-font';
import {LinearGradient} from 'expo-linear-gradient';
import Animated,{useSharedValue,useAnimatedStyle,withTiming,cancelAnimation,Easing} from 'react-native-reanimated';
import Pressable from './MotionPressable';
import {Text,useReducedMotion} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

/** Numbers indicate position, never approval or completion. Navigation is gated by the caller. */
export default function MechanicJourneySteps({current,onSelect,disabled=false,canSelect}:{current:number;onSelect?:(step:number)=>void;disabled?:boolean;canSelect?:(step:number)=>boolean}){
 const m=useMechanicTheme(),reduced=useReducedMotion();
 const [width,setWidth]=useState(0);
 const [ready]=useFonts({MotexaStepScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaStepArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});
 const progress=useSharedValue(current),marker=useSharedValue(0);
 useEffect(()=>{progress.value=withTiming(current,{duration:reduced?0:340});return()=>cancelAnimation(progress);},[current,reduced,progress]);
 useEffect(()=>{marker.value=withTiming((m.ar?5-current:current-1)*Math.max(0,(width-44)/4),{duration:reduced?0:340,easing:Easing.out(Easing.cubic)});return()=>cancelAnimation(marker);},[current,m.ar,width,reduced,marker]);
 const progressStyle=useAnimatedStyle(()=>({width:((progress.value-1)/4*100)+'%' as `${number}%`}));
 const markerStyle=useAnimatedStyle(()=>({transform:[{translateX:marker.value}]}));
 const names=[m.t('Account','الحساب'),m.t('Professional profile','الملف المهني'),m.t('Service options','طرق تقديم الخدمة'),m.t('Your documents','وثائق التحقق'),m.t('Review and submit','المراجعة والإرسال')];
 return <View style={{gap:14,paddingVertical:7}}>
  <View style={{flexDirection:m.row,alignItems:'center',gap:12}}>
   <View style={{flex:1,gap:2}}><Text style={{fontSize:9,lineHeight:18,letterSpacing:m.ar?0:1.3,color:m.muted,textAlign:m.align}}>{m.t('YOUR NEXT CHAPTER','خطوتك نحو الاعتماد')}</Text><Text accessibilityLiveRegion="polite" style={{fontFamily:ready?(m.ar?'MotexaStepArabic':'MotexaStepScript'):undefined,fontSize:m.ar?22:29,lineHeight:m.ar?35:38,color:m.ink,textAlign:m.align}}>{names[current-1]}</Text></View>
   <View accessible accessibilityLabel={m.t('Step ','الخطوة ')+current+m.t(' of 5',' من 5')} style={{flexDirection:m.row,alignItems:'baseline',gap:4,borderStartWidth:1,borderColor:m.border,paddingStart:12}}><Text style={{fontSize:27,lineHeight:36,color:m.ink,fontWeight:'500'}}>{'0'+current}</Text><Text style={{fontSize:10,lineHeight:20,color:m.muted}}>/ 05</Text></View>
  </View>
  <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{flexDirection:m.row,alignItems:'center',paddingVertical:3}}>
   {width>0&&<Animated.View accessible={false} pointerEvents="none" style={[{position:'absolute',left:0,top:3,width:44,height:44,borderRadius:22,borderWidth:1,borderColor:m.dark?'#D2AD7D':'#B98A55',backgroundColor:m.soft},markerStyle]}/>}
   {names.map((name,index)=>{const n=index+1,active=n===current,enabled=!!onSelect&&!disabled&&(canSelect?.(n)??true);const circle=<View style={{width:34,height:34,borderRadius:17,overflow:'hidden',borderWidth:active?0:1,borderColor:m.border,backgroundColor:active?'#65442C':m.surface,alignItems:'center',justifyContent:'center'}}>{active&&<LinearGradient pointerEvents="none" colors={m.dark?['#B68A58','#78522F']:['#986B40','#513421']} style={{position:'absolute',inset:0}}/>}<Text style={{fontSize:13,lineHeight:23,fontWeight:active?'600':'400',color:active?'#FFF5E6':m.muted}}>{n}</Text></View>;return <View key={name} style={{flex:n===5?undefined:1,flexDirection:m.row,alignItems:'center'}}>{onSelect?<Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Step ','الخطوة ')+n+': '+name} accessibilityState={{selected:active,disabled:!enabled}} aria-current={active?'step':undefined} disabled={!enabled} onPress={()=>onSelect(n)} style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',opacity:!enabled&&!active?.45:1}}>{circle}</Pressable>:<View accessible accessibilityLabel={m.t('Step ','الخطوة ')+n+': '+name} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}>{circle}</View>}{n<5&&<View pointerEvents="none" style={{flex:1,height:1,backgroundColor:m.border,marginHorizontal:2}}/>}</View>;})}
  </View>
  <View accessible={false} pointerEvents="none" style={{height:2,borderRadius:2,overflow:'hidden',backgroundColor:m.soft,alignItems:m.ar?'flex-end':'flex-start'}}><Animated.View style={[{height:2,borderRadius:2,backgroundColor:m.muted},progressStyle]}/></View>
 </View>;
}
