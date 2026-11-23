import type {ReactNode} from 'react';
import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text,HeroReveal} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

/** A consistent numbered card header anchors every stage in the same journey. */
export default function MechanicStageSurface({stage,children}:{stage:number;children:ReactNode}){
 const m=useMechanicTheme();const framed=true;const names=[m.t('ACCOUNT DETAILS','بيانات الحساب'),m.t('PROFESSIONAL IDENTITY','الهوية المهنية'),m.t('SERVICE PATHWAY','مسار تقديم الخدمة'),m.t('PRIVATE CREDENTIALS','الوثائق الخاصة'),m.t('APPLICATION DOSSIER','ملف طلب الاعتماد')];
 return <View style={{marginBottom:19,borderRadius:framed?29:0,borderWidth:framed?1:0,borderColor:m.border,backgroundColor:framed?m.surface:'transparent',overflow:'hidden'}}>
  <View style={{flexDirection:m.row,alignItems:'center',gap:12,paddingVertical:13,paddingHorizontal:framed?18:0,marginBottom:framed?0:11,borderBottomWidth:framed?1:0,borderColor:m.border,backgroundColor:framed?m.soft:'transparent'}}><Text style={{fontSize:10,lineHeight:22,letterSpacing:m.ar?0:1.6,color:m.muted,textAlign:m.align}}>{names[stage-1]}</Text><View style={{height:1,flex:1,backgroundColor:m.border}}/><Text style={{fontSize:11,lineHeight:22,color:m.muted}}>{'0'+stage}</Text></View>
  <HeroReveal key={stage} style={{gap:20,padding:framed?18:0}}>{children}</HeroReveal>
  <View style={{flexDirection:m.row,alignItems:'center',gap:6,paddingVertical:15,paddingHorizontal:framed?18:0,marginTop:framed?0:16,borderTopWidth:1,borderColor:m.border}}><Ionicons name="lock-closed-outline" size={13} color={m.muted}/><Text style={{fontSize:10,lineHeight:21,color:m.muted,textAlign:m.align,flex:1}}>{m.t('Your professional information stays private.','معلوماتك المهنية تبقى خاصة.')}</Text></View>
 </View>;
}
