import type {ReactNode} from 'react';
import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text,HeroReveal} from './MotexaVisual';
import BrandMonogram from './BrandMonogram';
import {useMechanicTheme} from './MechanicUI';

export function ReviewQuestionSurface({children,selected=false}:{children:ReactNode;selected?:boolean}){
 const m=useMechanicTheme();return <View style={{borderRadius:23,borderWidth:1,borderColor:selected?(m.dark?'#D0A878':'#A87949'):m.border,backgroundColor:selected?m.soft:m.surface,overflow:'hidden'}}><View pointerEvents="none" style={{height:3,backgroundColor:selected?(m.dark?'#D0A878':'#A87949'):m.border}}/><View style={{padding:16,gap:12}}>{children}</View></View>;
}
export function ReviewCheckpoint({label,complete}:{label:string;complete:boolean}){
 const m=useMechanicTheme();return <View style={{flexDirection:m.row,alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderColor:m.border}}><View style={{width:31,height:31,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:complete?(m.dark?'#3F5037':'#E4ECD9'):m.soft}}><Ionicons name={complete?'checkmark':'time-outline'} size={17} color={complete?(m.dark?'#D5E5BF':'#527044'):m.muted}/></View><Text style={{flex:1,fontSize:12,lineHeight:23,color:m.ink,textAlign:m.align}}>{label}</Text><Text style={{fontSize:10,lineHeight:20,color:m.muted}}>{complete?m.t('Complete','مكتمل'):m.t('Pending','بانتظار')}</Text></View>;
}
export function ReviewMessage({sender,body,time,mine}:{sender:string;body:string;time:string;mine:boolean}){
 const m=useMechanicTheme();return <View style={{alignSelf:mine?(m.ar?'flex-start':'flex-end'):(m.ar?'flex-end':'flex-start'),maxWidth:'94%',padding:15,borderRadius:22,borderBottomLeftRadius:mine?22:6,borderBottomRightRadius:mine?6:22,gap:6,backgroundColor:mine?(m.dark?'#715137':'#573822'):m.soft}}><Text style={{fontSize:11,lineHeight:20,color:mine?'#E6D2B7':m.muted,textAlign:m.align}}>{sender}</Text><Text selectable style={{fontSize:14,lineHeight:25,color:mine?'#FFF6E8':m.ink,textAlign:m.align}}>{body}</Text><Text style={{fontSize:10,lineHeight:20,color:mine?'#E6D2B7':m.muted,textAlign:m.align}}>{time}</Text></View>;
}
export function ReviewEmpty({title,description,icon='chatbubbles-outline'}:{title:string;description:string;icon?:keyof typeof Ionicons.glyphMap}){
 const m=useMechanicTheme();return <HeroReveal style={{paddingVertical:22,gap:10,overflow:'hidden'}}><BrandMonogram size={140} style={{right:-20,top:0,opacity:.035}}/><View style={{width:44,height:48,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:m.soft}}><Ionicons name={icon} size={24} color={m.muted}/></View><Text style={{fontSize:18,lineHeight:29,color:m.ink,fontWeight:'600',textAlign:m.align}}>{title}</Text><Text style={{fontSize:12,lineHeight:24,color:m.muted,textAlign:m.align}}>{description}</Text></HeroReveal>;
}
