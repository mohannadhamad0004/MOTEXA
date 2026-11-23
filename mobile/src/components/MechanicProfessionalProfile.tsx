import {useState} from 'react';
import {View,Platform} from 'react-native';
import {Image} from 'expo-image';
import MechanicProfileSections from './MechanicProfileSections';
import {Ionicons} from '@expo/vector-icons';
import MechanicProfileIdentity from './MechanicProfileIdentity';
import * as Clipboard from 'expo-clipboard';
import {Text,HeroReveal,useReducedMotion} from './MotexaVisual';
import Pressable from './MotionPressable';
import {MechanicNote,useMechanicTheme} from './MechanicUI';
import MechanicDocuments from './MechanicDocuments';
import {mechanicSpecializations,type MechanicProfile} from './mechanic-api';

type Section='overview'|'services'|'documents';
export default function MechanicProfessionalProfile({profile}:{profile:MechanicProfile}){
 const m=useMechanicTheme(),t=m.t,reduced=useReducedMotion();
 const [section,setSection]=useState<Section>('overview');
 const [copied,setCopied]=useState(''),[error,setError]=useState('');
 const modes=[profile.offersWorkshop,profile.offersOnSite,profile.offersOnline].filter(Boolean);
 const small={fontSize:11,lineHeight:22,color:m.muted,textAlign:m.align};
 const title={fontSize:18,lineHeight:30,fontWeight:'600' as const,color:m.ink,textAlign:m.align};
 const body={fontSize:13,lineHeight:25,color:m.ink,textAlign:m.align};
 async function copy(value:string,name:string){
  setError('');setCopied('');
  try{if(Platform.OS==='web'){if(!globalThis.navigator?.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(value);}else{const ok=await Clipboard.setStringAsync(value);if(ok===false)throw Error();}setCopied(name);}
  catch{setError(t('Could not copy. You can select the text below.','تعذّر النسخ. يمكنك تحديد النص أدناه.'));}
 }
 const tabs:{key:Section;label:string;icon:keyof typeof Ionicons.glyphMap}[]=[
  {key:'overview',label:t('Overview','نبذة'),icon:'person-outline'},
  {key:'services',label:t('Services','الخدمات'),icon:'construct-outline'},
  {key:'documents',label:t('Documents','الوثائق'),icon:'documents-outline'},
 ];
 return <View style={{gap:21}}>
  <MechanicProfileIdentity profile={profile} onServices={()=>{setSection('services');setError('');setCopied('');}}/>
  <MechanicProfileSections items={tabs} value={section} onChange={key=>{setSection(key as Section);setError('');setCopied('');}}/>
  <HeroReveal key={section} style={{gap:21}}>
   {section==='overview'&&<>
    <View style={{gap:10}}><Text style={title}>{t('About my work','عن خبرتي')}</Text><Text selectable style={{...body,color:m.muted}}>{profile.experienceSummary||t('No professional summary added.','لم تُضف نبذة مهنية.')}</Text></View>
    <View style={{gap:12}}><Text style={title}>{t('Specialties','التخصصات')}</Text><View style={{flexDirection:m.row,flexWrap:'wrap',gap:8}}>{profile.specializations.map(key=>{const s=mechanicSpecializations.find(s=>s[0]===key);return <View key={key} style={{flexDirection:m.row,alignItems:'center',gap:6,borderWidth:1,borderColor:m.border,paddingHorizontal:12,paddingVertical:8,borderRadius:14,backgroundColor:m.surface}}><Ionicons name="checkmark" size={13} color={m.muted}/><Text style={{...small,color:m.ink}}>{s?t(s[1],s[2]):key}</Text></View>})}</View></View>
    <View style={{gap:5,paddingTop:19,borderTopWidth:1,borderColor:m.border}}><Text style={title}>{t('Contact details','بيانات التواصل')}</Text>{[{icon:'mail-outline' as const,label:t('Email','البريد الإلكتروني'),value:profile.user.email,copyLabel:t('Copy email','نسخ البريد الإلكتروني')},{icon:'call-outline' as const,label:t('Phone','رقم الهاتف'),value:profile.phoneNumber,copyLabel:t('Copy phone number','نسخ رقم الهاتف')}].map(item=><View key={item.label} style={{flexDirection:m.row,alignItems:'center',gap:11,paddingVertical:11}}><View style={{width:37,height:37,borderRadius:13,backgroundColor:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name={item.icon} size={18} color={m.muted}/></View><View style={{flex:1,gap:2}}><Text style={small}>{item.label}</Text><Text selectable style={{...body,fontSize:12}}>{item.value||'—'}</Text></View>{!!item.value&&<Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={item.copyLabel} onPress={()=>void copy(item.value,item.label)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={copied===item.label?'checkmark-circle':'copy-outline'} size={18} color={m.muted}/></Pressable>}</View>)}</View>
    {!!copied&&<Text accessibilityLiveRegion="polite" style={small}>{copied+' · '+t('Copied','تم النسخ')}</Text>}
    {!!error&&<MechanicNote error>{error}</MechanicNote>}
   </>}
   {section==='services'&&<>
    <View style={{gap:5}}><Text style={title}>{t('How I help','كيف أقدّم خدماتي')}</Text><Text style={small}>{t('Service information from your professional profile.','بيانات الخدمة المسجّلة في ملفك المهني.')}</Text></View>
    {[{enabled:profile.offersWorkshop,icon:'storefront-outline' as const,label:t('Workshop','ورشة'),name:profile.workshopName,detail:profile.workshopAddress,photo:require('../../assets/images/mechanic-tim-mossholder.jpg')},{enabled:profile.offersOnSite,icon:'navigate-outline' as const,label:t('Mobile mechanic','ميكانيكي متنقل'),name:profile.city,detail:profile.coverageAreas.join('، '),photo:require('../../assets/images/department-tools-isabela.jpg')},{enabled:profile.offersOnline,icon:'chatbubbles-outline' as const,label:t('Online consultation','استشارات أونلاين'),name:profile.phoneNumber,detail:profile.city,photo:require('../../assets/images/mechanic-workshop-maxim-hopman.jpg')}].filter(service=>service.enabled).map(service=><View key={service.icon} style={{gap:16,paddingBottom:19,borderBottomWidth:1,borderColor:m.border}}><Image accessible={false} source={service.photo} style={{width:'100%',height:180,borderRadius:24}} contentFit="cover" cachePolicy="memory-disk" transition={reduced?0:220}/><View style={{gap:9}}><View style={{flexDirection:m.row,gap:7,alignItems:'center'}}><Ionicons name={service.icon} size={19} color={m.muted}/><Text style={title}>{service.label}</Text></View><Text selectable style={body}>{service.name||profile.city}</Text><Text selectable style={small}>{service.detail||'—'}</Text></View></View>)}
    {!modes.length&&<MechanicNote>{t('No service mode selected.','لم يتم تحديد طريقة خدمة.')}</MechanicNote>}
   </>}
   {section==='documents'&&<>
    <View style={{flexDirection:m.row,alignItems:'center',gap:10}}><View style={{width:44,height:44,borderRadius:15,backgroundColor:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name="lock-closed-outline" size={20} color={m.muted}/></View><View style={{flex:1,gap:3}}><Text style={title}>{t('Private documents','الوثائق الخاصة')}</Text><Text style={small}>{profile.documents.length+' '+t('files in your verification record','ملفات ضمن سجل اعتمادك')}</Text></View></View>
    <MechanicDocuments documents={profile.documents}/>
   </>}
  </HeroReveal>
 </View>;
}
