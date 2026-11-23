import {View} from 'react-native';
import {Image} from 'expo-image';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import Pressable from './MotionPressable';
import {Text,HeroReveal,useReducedMotion} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import {useMechanicFonts} from './MechanicType';
import type {MechanicProfile} from './mechanic-api';

export default function MechanicProfileIdentity({profile,onServices}:{profile:MechanicProfile;onServices:()=>void}){
 const m=useMechanicTheme(),t=m.t,reduced=useReducedMotion(),fonts=useMechanicFonts();
 const arabicName=/[\u0600-\u06ff]/.test(profile.user.fullName);
 const approved=profile.verificationStatus==='VERIFIED'&&profile.canReceiveServices&&profile.user.status==='ACTIVE';
 const service=profile.offersWorkshop?t('Workshop','ورشة'):profile.offersOnSite?t('Mobile mechanic','ميكانيكي متنقل'):t('Online consultation','استشارات أونلاين');
 return <View style={{gap:20}}>
  <HeroReveal style={{flexDirection:m.row,gap:19,alignItems:'center'}}>
   <View style={{flex:1.15,gap:13}}>
    <Text style={{fontSize:10,lineHeight:22,letterSpacing:m.ar?0:1.4,color:m.muted,textAlign:m.align}}>{t('PROFESSIONAL PROFILE','الملف المهني')}</Text>
    <Text accessibilityRole="header" style={{fontFamily:fonts?(arabicName?'MechanicArabicBold':'MechanicEditorial'):undefined,fontSize:arabicName?27:34,lineHeight:arabicName?42:43,color:m.ink,textAlign:m.align}}>{profile.user.fullName}</Text>
    <View style={{flexDirection:m.row,alignItems:'center',gap:5,flexWrap:'wrap'}}><Ionicons name={approved?'shield-checkmark':'time-outline'} size={14} color={m.muted}/><Text style={{fontSize:10,lineHeight:23,color:m.muted}}>{approved?t('Verified professional','ميكانيكي معتمد'):t('Verification in progress','الاعتماد قيد المتابعة')}</Text></View>
    <View style={{gap:3}}><Text style={{fontSize:12,lineHeight:24,color:m.ink,textAlign:m.align}}>{profile.city}</Text><Text style={{fontSize:10,lineHeight:22,color:m.muted,textAlign:m.align}}>{service}</Text></View>
   </View>
   <View style={{flex:1,height:219,borderTopLeftRadius:45,borderTopRightRadius:12,borderBottomRightRadius:45,borderBottomLeftRadius:12,backgroundColor:m.soft,overflow:'hidden'}}>
    <Image source={profile.offersOnline?require('../../assets/images/mechanic-workshop-maxim-hopman.jpg'):require('../../assets/images/mechanic-tim-mossholder.jpg')} contentFit="cover" transition={reduced?0:220} style={{width:'100%',height:'100%'}}/>
    <LinearGradient pointerEvents="none" colors={['#20170E00','#20170E66']} style={{position:'absolute',inset:0}}/>
    <Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={t('View service details','عرض تفاصيل الخدمة')} onPress={onServices} style={{position:'absolute',bottom:16,left:15,width:43,height:43,borderRadius:22,backgroundColor:'#FFF5E7EE',alignItems:'center',justifyContent:'center'}}><Ionicons name={m.ar?'arrow-back':'arrow-forward'} size={20} color="#432D1E"/></Pressable>
   </View>
  </HeroReveal>
  <View style={{flexDirection:m.row,paddingVertical:17,borderTopWidth:1,borderBottomWidth:1,borderColor:m.border}}>{[{value:profile.yearsOfExperience===null?'—':String(profile.yearsOfExperience),label:t('Years of experience','سنوات الخبرة')},{value:String(profile.specializations.length),label:t('Specialties','التخصصات')},{value:String(profile.documents.length),label:t('Documents','الوثائق')}].map((metric,i)=><View key={metric.label} style={{flex:1,gap:4,alignItems:'center',borderLeftWidth:!m.ar&&i?1:0,borderRightWidth:m.ar&&i?1:0,borderColor:m.border}}><Text style={{fontFamily:fonts&&!m.ar?'MechanicEditorial':undefined,fontSize:29,lineHeight:37,color:m.ink}}>{metric.value}</Text><Text style={{fontSize:10,lineHeight:22,color:m.muted,textAlign:'center'}}>{metric.label}</Text></View>)}</View>
  {!!profile.workshopName&&profile.offersWorkshop&&<View style={{flexDirection:m.row,gap:10,alignItems:'center'}}><Ionicons name="storefront-outline" size={21} color={m.muted}/><View style={{flex:1,gap:3}}><Text style={{fontSize:15,lineHeight:28,color:m.ink,fontWeight:'600',textAlign:m.align}}>{profile.workshopName}</Text><Text style={{fontSize:11,lineHeight:23,color:m.muted,textAlign:m.align}}>{profile.workshopAddress||profile.city}</Text></View></View>}
 </View>;
}
