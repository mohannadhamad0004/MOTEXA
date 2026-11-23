import type {ReactNode} from 'react';
import {View} from 'react-native';
import {Image} from 'expo-image';
import {useFonts} from 'expo-font';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import BrandMonogram from './BrandMonogram';
import {Text,HeroReveal} from './MotexaVisual';
import {WorkspaceBadge} from './MechanicWorkspaceUI';
import {useMechanicTheme} from './MechanicUI';
import type {MechanicProfile} from './mechanic-api';

/** Focused review composition. Photography is decorative, never a mechanic's identity. */
export default function MechanicReviewStudio({profile,statusLabel,specialties,section,reviewedCount,requiredCount,testState,onSection,onPosition,children}:{profile:MechanicProfile;statusLabel:string;specialties:string[];section:string;reviewedCount:number;requiredCount:number;testState:string;onSection:(section:string)=>void;onPosition:(section:string,y:number)=>void;children:ReactNode}){
 const m=useMechanicTheme();
 const[ready]=useFonts({MotexaReviewScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaReviewArabic:require('../../assets/fonts/Tajawal-Medium.ttf'),MotexaReviewSerif:require('../../assets/fonts/GFSDidot-Regular.ttf')});
 const steps=[{key:'documents',label:m.t('Documents','الوثائق'),icon:'documents-outline' as const,detail:reviewedCount+'/'+requiredCount+' '+m.t('reviewed','تمت مراجعتها')},{key:'test',label:m.t('Assessment','التقييم'),icon:'clipboard-outline' as const,detail:testState},{key:'decision',label:m.t('Decision','القرار'),icon:'shield-checkmark-outline' as const,detail:statusLabel}];
 const secondary=[{key:'profile',label:m.t('Full profile','كل البيانات'),icon:'person-outline' as const},{key:'conversation',label:m.t('Conversation','المحادثة'),icon:'chatbubbles-outline' as const},{key:'history',label:m.t('History','السجل'),icon:'time-outline' as const}];
 const tone=profile.verificationStatus==='VERIFIED'?'green':profile.verificationStatus==='REJECTED'?'red':profile.verificationStatus==='SUSPENDED'?'grey':'bronze';
 const current=steps.find(step=>step.key===section);
 return <View style={{paddingHorizontal:3}}>
  <View style={{position:'relative',paddingHorizontal:5,paddingTop:7,paddingBottom:18,overflow:'hidden'}}>
   <BrandMonogram size={290} style={{top:65,left:m.ar?undefined:-35,right:m.ar?-35:undefined,opacity:.045}}/>
   <Text style={{fontSize:9,lineHeight:20,letterSpacing:m.ar?0:1.4,color:m.muted,textAlign:m.align}}>{m.t('MOTEXA / PROFESSIONAL REVIEW','MOTEXA / المراجعة المهنية')}</Text>
   <Text accessibilityRole="header" style={{fontFamily:ready?(m.ar?'MotexaReviewArabic':'MotexaReviewScript'):undefined,fontSize:m.ar?28:39,lineHeight:m.ar?43:52,color:m.ink,textAlign:m.align,marginTop:3,marginBottom:16}}>{m.t('Expertise, in perspective.','خبرة تستحق نظرة أقرب.')}</Text>
   <View style={{flexDirection:m.row,alignItems:'center',gap:13}}>
    <View style={{flex:1,minWidth:0,gap:7}}><View style={{flexDirection:m.row}}><WorkspaceBadge label={statusLabel} tone={tone}/></View><Text selectable style={{fontFamily:ready?(m.ar?'MotexaReviewArabic':'MotexaReviewSerif'):undefined,fontSize:m.ar?25:27,lineHeight:37,color:m.ink,textAlign:m.align}}>{profile.user.fullName}</Text><Text style={{fontSize:12,lineHeight:23,color:m.ink,textAlign:m.align}}>{specialties.join(' · ')||m.t('Specialty not provided','التخصص غير محدد')}</Text><Text style={{fontSize:11,lineHeight:22,color:m.muted,textAlign:m.align}}>{[profile.city,profile.yearsOfExperience!==null?profile.yearsOfExperience+' '+m.t('years experience','سنوات خبرة'):null].filter(Boolean).join(' · ')}</Text></View>
    <View pointerEvents="none" accessible={false} style={{width:83,height:137,borderTopLeftRadius:45,borderTopRightRadius:45,borderBottomLeftRadius:m.ar?10:45,borderBottomRightRadius:m.ar?45:10,overflow:'hidden',backgroundColor:m.soft}}><Image source={require('../../assets/images/department-tools-isabela.jpg')} contentFit="cover" contentPosition="center" style={{width:'100%',height:'100%'}}/><View style={{position:'absolute',inset:0,backgroundColor:m.dark?'#36251C30':'#8F623710'}}/></View>
   </View>
   <View style={{borderTopWidth:1,borderColor:m.border,marginTop:18,paddingTop:13,gap:5}}><View style={{flexDirection:m.row,alignItems:'center',gap:7}}><Ionicons name="mail-outline" size={15} color={m.muted}/><Text selectable style={{flex:1,fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{profile.user.email}</Text></View><Text style={{fontSize:10,lineHeight:20,color:m.muted,textAlign:m.align}}>{m.t('Submission ','نسخة الطلب ')+profile.submissionVersion+' · MX-'+profile.id.slice(0,8).toUpperCase()}</Text></View>
  </View>
  <View accessibilityRole="tablist" style={{flexDirection:m.row,gap:5,marginBottom:16}}>{steps.map((step,index)=><Pressable focusVisibleOnly key={step.key} accessibilityRole="tab" accessibilityLabel={step.label} accessibilityHint={step.detail} accessibilityState={{selected:section===step.key}} aria-selected={section===step.key} onPress={()=>onSection(step.key)} style={{flex:1,minHeight:76,paddingHorizontal:4,paddingVertical:9,gap:7,borderBottomWidth:section===step.key?2:1,borderColor:section===step.key?(m.dark?'#D1AD7D':'#946438'):m.border,alignItems:'center'}}><View style={{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:section===step.key?m.ink:m.soft}}><Text style={{fontSize:12,color:section===step.key?m.surface:m.muted}}>{index+1}</Text></View><Text style={{fontSize:12,lineHeight:22,fontWeight:'600',color:section===step.key?m.ink:m.muted,textAlign:'center'}}>{step.label}</Text></Pressable>)}</View>
  <View onLayout={e=>onPosition(section,e.nativeEvent.layout.y)} style={{borderWidth:1,borderColor:m.border,borderRadius:25,overflow:'hidden',backgroundColor:m.surface}}>
   <View style={{paddingHorizontal:18,paddingVertical:14,borderBottomWidth:1,borderColor:m.border,flexDirection:m.row,alignItems:'center',gap:10}}><Ionicons name={current?.icon||secondary.find(item=>item.key===section)?.icon||'person-outline'} size={20} color={m.muted}/><View style={{flex:1}}><Text style={{fontSize:14,lineHeight:25,fontWeight:'600',color:m.ink,textAlign:m.align}}>{current?.label||secondary.find(item=>item.key===section)?.label}</Text>{current&&<Text style={{fontSize:11,lineHeight:21,color:m.muted,textAlign:m.align}}>{current.detail}</Text>}</View></View>
   <HeroReveal key={section}>{children}</HeroReveal>
  </View>
  <View style={{flexDirection:m.row,flexWrap:'wrap',justifyContent:'space-between',gap:3,marginTop:9}}>{secondary.map(item=><Pressable focusVisibleOnly key={item.key} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{selected:section===item.key}} onPress={()=>onSection(item.key)} style={{minHeight:48,paddingHorizontal:5,flexDirection:m.row,alignItems:'center',gap:5,borderBottomWidth:section===item.key?1:0,borderColor:m.border}}><Ionicons name={item.icon} size={16} color={m.muted}/><Text style={{fontSize:11,lineHeight:22,color:section===item.key?m.ink:m.muted,fontWeight:section===item.key?'600':'400'}}>{item.label}</Text></Pressable>)}</View>
 </View>;
}
