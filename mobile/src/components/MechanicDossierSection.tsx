import {View} from 'react-native';
import type {ReactNode} from 'react';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import {Text,HeroReveal} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

export default function MechanicDossierSection({section,label,summary,icon,expanded,onToggle,onPosition,children}:{section:string;label:string;summary:string;icon:keyof typeof Ionicons.glyphMap;expanded:boolean;onToggle:()=>void;onPosition:(section:string,y:number)=>void;children:ReactNode}){
 const m=useMechanicTheme();
 return <View onLayout={event=>onPosition(section,event.nativeEvent.layout.y)} style={{borderTopWidth:1,borderColor:m.border}}>
  <Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={label} accessibilityState={{expanded}} aria-expanded={expanded} onPress={onToggle} style={({pressed})=>({minHeight:77,paddingHorizontal:18,paddingVertical:13,flexDirection:m.row,alignItems:'center',gap:12,backgroundColor:expanded?m.soft:'transparent',opacity:pressed?.75:1})}><View style={{width:38,height:41,borderRadius:15,backgroundColor:expanded?m.surface:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={21} color={m.muted}/></View><View style={{flex:1,gap:2}}><Text style={{fontSize:15,lineHeight:26,fontWeight:'600',color:m.ink,textAlign:m.align}}>{label}</Text><Text style={{fontSize:11,lineHeight:21,color:m.muted,textAlign:m.align}}>{summary}</Text></View><Ionicons name={expanded?'remove-outline':'add-outline'} size={21} color={m.muted}/></Pressable>
  {expanded&&<HeroReveal>{children}</HeroReveal>}
 </View>;
}
