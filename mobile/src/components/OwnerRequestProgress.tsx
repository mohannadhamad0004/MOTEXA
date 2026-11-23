import {useEffect} from 'react';
import {View} from 'react-native';
import Animated,{useSharedValue,useAnimatedStyle,withTiming,ReduceMotion} from 'react-native-reanimated';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

/** This is service-state progress, not a map, ETA or simulated GPS journey. */
export default function OwnerRequestProgress({status}:{status:string}){
 const m=useMechanicTheme(),stage=['NEW','ACCEPTED','IN_PROGRESS','COMPLETED'].indexOf(status),progress=useSharedValue(Math.max(0,stage)/3);
 useEffect(()=>{progress.set(withTiming(Math.max(0,stage)/3,{duration:360,reduceMotion:ReduceMotion.System}));},[stage,progress]);
 const line=useAnimatedStyle(()=>({width:`${progress.value*100}%`}));
 const steps=[{en:'Sent',ar:'أُرسل',icon:'paper-plane-outline'},{en:'Accepted',ar:'مقبول',icon:'checkmark-outline'},{en:'In service',ar:'قيد العمل',icon:'build-outline'},{en:'Complete',ar:'مكتمل',icon:'flag-outline'}] as const;
 if(stage<0)return <View style={{flexDirection:m.row,alignItems:'center',gap:10,paddingVertical:14,borderTopWidth:1,borderColor:m.border}}><Ionicons name={status==='DECLINED'?'close-circle-outline':'ban-outline'} size={25} color={m.muted}/><Text style={{flex:1,fontSize:13,lineHeight:25,color:m.muted,textAlign:m.align}}>{m.t(status==='DECLINED'?'The mechanic declined this request.':'This request was cancelled.',status==='DECLINED'?'الميكانيكي اعتذر عن هذا الطلب.':'تم إلغاء هذا الطلب.')}</Text></View>;
 return <View accessible accessibilityLabel={m.t('Request progress: ','تقدم الطلب: ')+m.t(['Sent','Accepted','In progress','Completed'][stage],['أُرسل','مقبول','قيد التنفيذ','مكتمل'][stage])} style={{paddingVertical:18,gap:21,borderTopWidth:1,borderBottomWidth:1,borderColor:m.border}}>
  <View style={{flexDirection:m.row,alignItems:'center',gap:12}}><Ionicons name={steps[stage].icon} size={28} color={m.bronze}/><View style={{flex:1,gap:3}}><Text style={{fontSize:10,lineHeight:19,letterSpacing:m.ar?0:1.4,color:m.muted,textAlign:m.align}}>{m.t('SERVICE PROGRESS','تقدّم الخدمة')}</Text><Text style={{fontSize:23,lineHeight:32,fontWeight:'600',color:m.ink,textAlign:m.align}}>{m.t(steps[stage].en,steps[stage].ar)}</Text></View><Text style={{fontSize:23,color:m.bronze,fontWeight:'600'}}>{'0'+(stage+1)}<Text style={{fontSize:12,color:m.muted}}> / 04</Text></Text></View>
  <View style={{gap:9}}><View style={{height:17,marginHorizontal:9,justifyContent:'center'}}><View style={{height:2,backgroundColor:m.border}}/><Animated.View style={[{position:'absolute',height:2,start:0,backgroundColor:m.bronze},line]}/><View style={{position:'absolute',left:0,right:0,flexDirection:m.row,justifyContent:'space-between'}}>{steps.map((s,i)=><View key={s.en} style={{width:14,height:14,borderRadius:7,borderWidth:i===stage?3:1,borderColor:i<=stage?m.bronze:m.border,backgroundColor:i<stage?m.bronze:m.canvas}}/>)}</View></View><View style={{flexDirection:m.row,gap:5}}>{steps.map((s,i)=><Text key={s.en} numberOfLines={1} adjustsFontSizeToFit style={{flex:1,fontSize:11,lineHeight:23,textAlign:'center',color:i===stage?m.ink:m.muted,fontWeight:i===stage?'600':'400'}}>{m.t(s.en,s.ar)}</Text>)}</View></View>
 </View>;
}
