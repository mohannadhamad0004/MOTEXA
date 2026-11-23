import {View,Image} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import {ownerFuel,ownerVehicleArt} from './OwnerVehicleCard';
import OwnerVehiclePhoto from './OwnerVehiclePhoto';
import OwnerReferenceCar from './OwnerReferenceCar';
import Pressable from './MotionPressable';
import type {OwnerVehicle} from './OwnerTypes';

/** Garage is vehicle management; the expanded automotive presentation lives in details. */
export default function OwnerGarageVehicle({vehicle:v,onSelect,onDetails,disabled}:{vehicle:OwnerVehicle;onSelect?:()=>void;onDetails:()=>void;disabled?:boolean}){
 const m=useMechanicTheme(),art=ownerVehicleArt(v),photo=!!(v.photoUpdatedAt||v.photoDataUri);
 return <View style={{borderTopWidth:1,borderColor:v.isActive?m.bronze:m.border,paddingVertical:17,gap:12,opacity:disabled?.6:1}}>
  <View style={{flexDirection:m.row,alignItems:'center',gap:13}}>
   <View style={{width:108,height:83,overflow:'hidden'}}>{photo?<OwnerVehiclePhoto key={v.id+'-'+v.photoUpdatedAt} vehicle={v} height={83}/>:art?.photographic?<OwnerReferenceCar make={v.make} source={art.source}/>:art?<Image accessible={false} source={art.source} resizeMode="contain" style={{width:'100%',height:'100%'}}/>:<View style={{flex:1,alignItems:'center',justifyContent:'center'}}><Ionicons name="car-sport-outline" size={37} color={m.bronze}/></View>}</View>
   <View style={{flex:1,gap:4,minWidth:0}}><Text style={{fontSize:11,color:m.bronze,textAlign:m.align}}>{v.make}</Text><Text style={{fontSize:20,lineHeight:28,fontWeight:'600',color:m.ink,textAlign:m.align}}>{v.model}</Text><Text style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{v.year+' · '+m.t(...(ownerFuel[v.fuel]||['Vehicle','مركبة']))}</Text></View>
   <Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('View vehicle details: ','تفاصيل السيارة: ')+v.make+' '+v.model} onPress={onDetails} disabled={disabled} style={{width:44,height:48,alignItems:'center',justifyContent:'center'}}><Ionicons name={m.ar?'arrow-back':'arrow-forward'} size={21} color={m.bronze}/></Pressable>
  </View>
  <View style={{flexDirection:m.row,alignItems:'center',gap:10}}><Ionicons name={v.isActive?'radio-button-on':'radio-button-off'} size={17} color={v.isActive?m.bronze:m.muted}/><Text style={{flex:1,fontSize:12,color:v.isActive?m.bronze:m.muted,textAlign:m.align}}>{m.t(v.isActive?'Selected for your next service':'Saved in your garage',v.isActive?'مختارة لطلب خدمتك القادم':'محفوظة بصفحة سياراتك')}</Text>{!v.isActive&&onSelect&&<Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Select vehicle: ','اختيار السيارة: ')+v.make+' '+v.model} onPress={onSelect} disabled={disabled} style={{minHeight:44,paddingHorizontal:16,justifyContent:'center',borderBottomWidth:1,borderColor:m.bronze}}><Text style={{fontSize:13,fontWeight:'600',color:m.ink}}>{m.t('Select','اختيار')}</Text></Pressable>}</View>
 </View>;
}
