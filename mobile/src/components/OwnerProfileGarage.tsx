import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import {ownerFuel} from './OwnerVehicleCard';
import OwnerMakeBadge from './OwnerMakeBadge';
import Pressable from './MotionPressable';
import type {OwnerVehicle} from './OwnerTypes';
export default function OwnerProfileGarage({vehicle,onOpen}:{vehicle?:OwnerVehicle;onOpen:()=>void}){const m=useMechanicTheme();return <Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Open my cars','فتح سياراتي')} onPress={onOpen} style={{padding:18,borderWidth:1,borderColor:m.border,borderRadius:25,backgroundColor:m.surface,gap:14}}><View style={{flexDirection:m.row,alignItems:'center',gap:9}}><Ionicons name="car-sport-outline" size={19} color={m.bronze}/><Text style={{flex:1,fontSize:11,letterSpacing:m.ar?0:1.2,color:m.bronze,textAlign:m.align}}>{m.t('YOUR SELECTED CAR','سيارتك المختارة')}</Text><Ionicons name={m.ar?'chevron-back':'chevron-forward'} size={17} color={m.bronze}/></View>{vehicle?<View style={{flexDirection:m.row,alignItems:'center',gap:12}}><OwnerMakeBadge make={vehicle.make} size={44}/><View style={{flex:1,gap:5}}><Text style={{fontSize:18,lineHeight:28,fontWeight:'600',color:m.ink,textAlign:m.align}}>{vehicle.make+' '+vehicle.model}</Text><Text style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{vehicle.year+' / '+m.t(...(ownerFuel[vehicle.fuel]||['Vehicle','مركبة']))}</Text></View></View>:<Text style={{fontSize:14,lineHeight:25,color:m.muted,textAlign:m.align}}>{m.t('Add your first car to complete your garage.','أضف سيارتك الأولى لإكمال سياراتك.')}</Text>}</Pressable>;}
