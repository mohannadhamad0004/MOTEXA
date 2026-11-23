import {View} from 'react-native';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import {ownerFuel} from './OwnerVehicleCard';
import type {OwnerVehicle} from './OwnerTypes';
export default function OwnerVehicleFacts({vehicle:v}:{vehicle:OwnerVehicle}){const m=useMechanicTheme();return <View style={{gap:10}}><Text style={{fontSize:10,letterSpacing:m.ar?0:1.4,color:m.bronze,textAlign:m.align}}>{m.t('VEHICLE INFORMATION','معلومات السيارة')}</Text><View style={{flexDirection:m.row,flexWrap:'wrap',gap:7}}>{[{label:m.t('Make','الشركة'),value:v.make},{label:m.t('Model','الموديل'),value:v.model},{label:m.t('Year','السنة'),value:String(v.year)},{label:m.t('Fuel','الوقود'),value:m.t(...(ownerFuel[v.fuel]||['Vehicle','مركبة']))}].map(f=><View key={f.label} style={{width:'48%',gap:4,paddingVertical:8,paddingHorizontal:11,borderRadius:13,borderWidth:1,borderColor:m.border,backgroundColor:m.surface+'99'}}><Text style={{fontSize:11,color:m.muted,textAlign:m.align}}>{f.label}</Text><Text numberOfLines={2} style={{fontSize:13,lineHeight:22,fontWeight:'600',color:m.ink,textAlign:m.align}}>{f.value}</Text></View>)}</View></View>;}
