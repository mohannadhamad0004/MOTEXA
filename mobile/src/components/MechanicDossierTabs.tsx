import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

export default function MechanicDossierTabs({value,onChange}:{value:string;onChange:(key:string)=>void}){
 const m=useMechanicTheme();
 const items=[{key:'profile',label:m.t('Overview','الملف'),icon:'person-outline' as const},{key:'documents',label:m.t('Documents','الوثائق'),icon:'documents-outline' as const},{key:'test',label:m.t('Professional test','الاختبار'),icon:'clipboard-outline' as const},{key:'conversation',label:m.t('Conversation','المحادثة'),icon:'chatbubbles-outline' as const},{key:'decision',label:m.t('Decision','القرار'),icon:'shield-checkmark-outline' as const},{key:'history',label:m.t('History','السجل'),icon:'time-outline' as const}];
 return <View style={{flexDirection:m.row,flexWrap:'wrap',gap:7,marginBottom:16}}>{items.map(item=><Pressable focusVisibleOnly key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected:value===item.key}} aria-selected={value===item.key} onPress={()=>onChange(item.key)} style={({pressed})=>({width:'30%',flexGrow:1,minHeight:49,minWidth:0,paddingHorizontal:9,paddingVertical:9,borderRadius:17,borderWidth:1,borderColor:value===item.key?(m.dark?'#B4936A':'#BD986E'):m.border,backgroundColor:value===item.key?m.soft:m.surface,flexDirection:m.row,gap:6,alignItems:'center',justifyContent:'center',opacity:pressed?.7:1})}><Ionicons name={item.icon} size={16} color={m.muted}/><Text style={{fontSize:11,lineHeight:20,fontWeight:value===item.key?'600':'400',color:m.ink,flexShrink:1,textAlign:'center'}}>{item.label}</Text></Pressable>)}</View>;
}
