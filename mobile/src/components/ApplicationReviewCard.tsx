import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import {Text,HeroReveal} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import {WorkspaceAvatar,WorkspaceBadge} from './MechanicWorkspaceUI';
import type {ApplicationSummary} from './mechanic-workflow-api';

export default function ApplicationReviewCard({profile,status,statusLabel,specialties,date,disabled,onReview,delay=0}:{profile:ApplicationSummary;status:string;statusLabel:string;specialties:string;date:string;disabled:boolean;onReview:()=>void;delay?:number}){
 const m=useMechanicTheme();
 const test=profile.tests?.find(test=>test.submissionVersion===profile.submissionVersion);
 const tone=status==='VERIFIED'?'green':status==='REJECTED'?'red':status==='SUSPENDED'?'grey':status==='NEW'?'blue':'bronze';
 const services=[profile.offersWorkshop?m.t('Workshop','ورشة'):'',profile.offersOnSite?m.t('Mobile','متنقّل'):'',profile.offersOnline?m.t('Online','أونلاين'):''].filter(Boolean);
 return <HeroReveal delay={delay} style={{borderRadius:29,overflow:'hidden',borderWidth:1,borderColor:m.border,backgroundColor:m.surface}}>
  <Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Open mechanic profile: ','فتح ملف الميكانيكي: ')+profile.user.fullName} disabled={disabled} onPress={onReview} style={({pressed})=>({padding:17,gap:13,opacity:pressed?.8:1})}>
   <View style={{flexDirection:m.row,alignItems:'center',gap:10}}><WorkspaceAvatar name={profile.user.fullName}/><View style={{flex:1,gap:2}}><Text style={{fontSize:16,lineHeight:27,fontWeight:'600',color:m.ink,textAlign:m.align}}>{profile.user.fullName}</Text><Text style={{fontSize:11,lineHeight:21,color:m.muted,textAlign:m.align}}>{specialties}</Text></View></View>
   <View style={{flexDirection:m.row,alignItems:'center',gap:8,flexWrap:'wrap'}}><WorkspaceBadge label={statusLabel} tone={tone}/><Text style={{fontSize:10,lineHeight:20,color:m.muted}}>{profile.city}{profile.yearsOfExperience!==null?' · '+profile.yearsOfExperience+' '+m.t('years','سنوات'):''}</Text></View>
   <View style={{borderTopWidth:1,borderBottomWidth:1,borderColor:m.border,paddingVertical:12,flexDirection:m.row,gap:10}}>{[
    {icon:'documents-outline' as const,title:m.t('Documents','الوثائق'),value:(profile.documents?.length??0)+' '+m.t('uploaded','مرفوعة')},
    {icon:'clipboard-outline' as const,title:m.t('Assessment','التقييم'),value:test?.reviewedAt?m.t('Reviewed','تمت المراجعة'):test?.submittedAt?m.t('Submitted','مرسل'):test?m.t('Awaiting answers','بانتظار الإجابة'):m.t('Not assigned','غير مُرسل')},
   ].map(item=><View key={item.title} style={{flex:1,gap:4}}><View style={{flexDirection:m.row,alignItems:'center',gap:6}}><Ionicons name={item.icon} size={15} color={m.muted}/><Text style={{fontSize:11,lineHeight:21,color:m.muted,textAlign:m.align}}>{item.title}</Text></View><Text style={{fontSize:12,lineHeight:22,color:m.ink,fontWeight:'600',textAlign:m.align}}>{item.value}</Text></View>)}</View>
   <View style={{flexDirection:m.row,alignItems:'center',gap:9,flexWrap:'wrap'}}><Ionicons name="construct-outline" size={14} color={m.muted}/><Text style={{fontSize:11,lineHeight:20,color:m.muted,flex:1,textAlign:m.align}}>{services.join(' · ')}</Text><Text style={{fontSize:9,lineHeight:18,color:m.muted}}>{date}</Text></View>
  </Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel={m.t('Review request','مراجعة الطلب')} disabled={disabled} onPress={onReview} style={({pressed})=>({minHeight:51,paddingHorizontal:17,paddingVertical:10,backgroundColor:m.soft,flexDirection:m.row,gap:10,alignItems:'center',borderTopWidth:1,borderColor:m.border,opacity:disabled?.5:pressed?.7:1})}><Text style={{fontSize:9,lineHeight:18,color:m.muted}}>{'MX-'+profile.id.slice(0,8).toUpperCase()}</Text><Text style={{flex:1,fontSize:13,lineHeight:23,color:m.ink,fontWeight:'600',textAlign:m.ar?'left':'right'}}>{m.t('Review request','مراجعة الطلب')}</Text><Ionicons name={m.ar?'arrow-back':'arrow-forward'} size={18} color={m.muted}/></Pressable>
 </HeroReveal>;
}
