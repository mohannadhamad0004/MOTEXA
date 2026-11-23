import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import {Text,HeroReveal} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
type Status=readonly[string,string,string];

export default function ApplicationStatusOptions({items,selected,onSelect}:{items:readonly Status[];selected:string;onSelect:(value:string)=>void}){
 const m=useMechanicTheme();
 const decisions=['VERIFIED','REJECTED','SUSPENDED'];
 const groups=[{title:m.t('Review journey','رحلة المراجعة'),rows:items.filter(([key])=>key!=='ALL'&&!decisions.includes(key))},{title:m.t('Decisions & access','القرارات والوصول'),rows:items.filter(([key])=>decisions.includes(key))}];
 const icons:Record<string,keyof typeof Ionicons.glyphMap>={ALL:'layers-outline',NEW:'sparkles-outline',AWAITING_TEST:'clipboard-outline',READY:'flag-outline',PENDING:'document-text-outline',NEEDS_COMPLETION:'time-outline',VERIFIED:'checkmark-circle-outline',REJECTED:'close-circle-outline',SUSPENDED:'pause-circle-outline'};
 const tile=([key,en,ar]:Status,full:boolean)=>{const active=key===selected;return <Pressable focusVisibleOnly key={key} accessibilityRole="button" accessibilityLabel={m.t(en,ar)} accessibilityState={{selected:active}} onPress={()=>onSelect(key)} style={({pressed})=>({width:full?'100%':'48%',flexGrow:full?0:1,minHeight:61,paddingHorizontal:11,paddingVertical:10,borderRadius:19,borderWidth:1,borderColor:active?(m.dark?'#BE9665':'#BC9466'):m.border,backgroundColor:active?m.soft:m.surface,flexDirection:m.row,alignItems:'center',gap:8,opacity:pressed?.7:1})}><Ionicons name={icons[key]} size={19} color={m.muted}/><Text style={{flex:1,minWidth:0,fontSize:m.ar?13:12,lineHeight:22,fontWeight:active?'600':'400',color:m.ink,textAlign:m.align}}>{m.t(en,ar)}</Text>{active&&<Ionicons name="checkmark-circle" size={18} color={m.muted}/>}</Pressable>;};
 const all=items.find(([key])=>key==='ALL');
 return <HeroReveal style={{gap:12}}><Text style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{m.t('Focus your workspace on the right files.','ركّز مساحة العمل على الملفات المطلوبة.')}</Text>{all&&tile(all,true)}{groups.map(group=><View key={group.title} style={{gap:8}}><Text accessibilityRole="header" style={{fontSize:11,lineHeight:21,fontWeight:'600',color:m.muted,textAlign:m.align}}>{group.title}</Text><View style={{flexDirection:m.row,flexWrap:'wrap',gap:8}}>{group.rows.map((item,index)=>tile(item,group.rows.length%2===1&&index===group.rows.length-1))}</View></View>)}</HeroReveal>;
}
