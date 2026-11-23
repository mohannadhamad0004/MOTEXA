import {useState} from 'react';
import {Linking} from 'react-native';
import {useMechanicTheme} from './MechanicUI';
import {OwnerButton,OwnerSurface} from './OwnerControls';
import {Text} from './MotexaVisual';
import WorkshopMap from './WorkshopMap';
export default function WorkshopDestination({latitude,longitude}:{latitude?:number|null;longitude?:number|null}){const m=useMechanicTheme(),[open,setOpen]=useState(false);return <OwnerSurface><Text style={{fontSize:17,lineHeight:28,color:m.ink,fontWeight:'600',textAlign:m.align}}>{m.t('The workshop. On your map.','الورشة، على خريطتك.')}</Text>{latitude==null||longitude==null?<Text style={{fontSize:13,lineHeight:24,color:m.muted,textAlign:m.align}}>{m.t('The workshop has not saved a map pin yet. Confirm the exact location before travelling.','الورشة لم تحفظ نقطة على الخريطة بعد. تأكّد من الموقع الدقيق قبل الانطلاق.')}</Text>:<><OwnerButton secondary label={open?m.t('Hide workshop map','إخفاء خريطة الورشة'):m.t('View workshop map','عرض خريطة الورشة')} onPress={()=>setOpen(v=>!v)}/>{open&&<WorkshopMap destination={{latitude,longitude}}/>}<OwnerButton secondary label={m.t('Open workshop directions','فتح اتجاهات الورشة')} onPress={()=>void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`)}/></>}</OwnerSurface>;}
