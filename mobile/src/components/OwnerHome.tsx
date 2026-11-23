import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import OwnerAutomotiveHome from './OwnerAutomotiveHome';
import Pressable from './MotionPressable';
import type {OwnerVehicle,OwnerRequest} from './OwnerTypes';

type Props={name:string;vehicle?:OwnerVehicle;vehicles?:OwnerVehicle[];requests:OwnerRequest[];paused:boolean;busy?:boolean;onVehicleDetails?:()=>void;onToggleMotion:()=>void;onServices:()=>void;onGarage:()=>void;onRequests:()=>void;onMechanic?:()=>void;onSelectVehicle?:(v:OwnerVehicle)=>Promise<void>;onService?:(key:'parts'|'towing'|'ai')=>void};
export default function OwnerHome(p:Props){
 const m=useMechanicTheme(),active=p.requests.filter(r=>['NEW','ACCEPTED','IN_PROGRESS'].includes(r.status));
 return <View testID="owner-immersive-home" style={{gap:23,paddingBottom:18}}>
  <View style={{flexDirection:m.row,alignItems:'center',gap:12,minHeight:45}}><Text style={{flex:1,fontSize:10,lineHeight:20,letterSpacing:m.ar?0:1.5,color:m.bronze,textAlign:m.align}}>{m.t('YOUR AUTOMOTIVE WORLD','عالمك للعناية بالسيارة')}</Text><Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Open my requests','فتح طلباتي')} onPress={p.onRequests} style={{minWidth:46,minHeight:46,flexDirection:m.row,alignItems:'center',justifyContent:'center',gap:5}}><Ionicons name="notifications-outline" size={20} color={m.ink}/>{!!active.length&&<Text style={{fontSize:12,color:m.bronze}}>{active.length}</Text>}</Pressable></View>
  <OwnerAutomotiveHome onRequests={p.onRequests} paused={p.paused} onMechanic={p.onMechanic||p.onServices} onService={p.onService}/>
 </View>;
}
