import {View,Image} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Text,HeroReveal} from './MotexaVisual';
import {OwnerEditorial} from './CustomerType';
import {useMechanicTheme} from './MechanicUI';
import {OwnerButton} from './OwnerControls';

export default function OwnerServicePortal({service,onBack,onMechanic}:{service:'ai'|'parts'|'towing';onBack:()=>void;onMechanic:()=>void}){
 const m=useMechanicTheme(),ai=service==='ai',parts=service==='parts';
 const title=ai?m.t('A little intelligence.\nA clearer road.','فهم أذكى.\nوطريق أوضح.'):parts?m.t('The right part.\nFor your drive.','القطعة المناسبة.\nلسيارتك.'):m.t('A way forward.\nWhen you need it.','مساعدة بتوصلك.\nوقت ما تحتاجها.');
 const topics=ai?[['Understand the symptoms','فهم أعراض العطل'],['Prepare for your mechanic','الاستعداد لزيارة الميكانيكي'],['Make an informed next move','خطوة جاية عن معرفة']]:parts?[['Match your vehicle','توافق مع سيارتك'],['Explore part categories','استعراض فئات القطع'],['Keep your car details ready','بيانات سيارتك بمكان واحد']]:[['Roadside assistance','المساعدة على الطريق'],['Vehicle recovery','نقل السيارة'],['A clear destination','وجهة واضحة']];
 return <View style={{gap:23,paddingBottom:25}}><HeroReveal style={{marginHorizontal:-18,height:390,overflow:'hidden'}}><Image accessible={false} source={ai?require('../../assets/images/owner-service-ai-v10.jpg'):parts?require('../../assets/images/owner-service-parts-v10.jpg'):require('../../assets/images/owner-service-towing-v10.jpg')} resizeMode="cover" style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:ai?1:.85}}/><LinearGradient colors={[m.canvas,m.canvas+'44',m.canvas]} locations={[0,.5,1]} style={{position:'absolute',inset:0}}/>

  <View style={{padding:22,flex:1,justifyContent:'space-between'}}><View style={{gap:9}}><Text style={{fontSize:11,letterSpacing:2,color:m.bronze}}>MOTEXA / {ai?'INTELLIGENCE':parts?'PARTS':'ROADSIDE'}</Text><Text style={{fontSize:11,color:m.muted,textAlign:m.align}}>{m.t('In preparation · Not available yet','قيد التحضير · غير متاحة حاليًا')}</Text></View><OwnerEditorial style={{fontSize:m.ar?28:39,lineHeight:m.ar?45:48}}>{title}</OwnerEditorial></View>
 </HeroReveal><View style={{gap:12}}><Text style={{fontSize:11,letterSpacing:m.ar?0:1.5,color:m.bronze,textAlign:m.align}}>{m.t('A LOOK AT WHAT COMES NEXT','نظرة على المرحلة الجاية')}</Text>{topics.map(([en,ar],i)=><View key={en} style={{minHeight:57,flexDirection:m.row,alignItems:'center',gap:13,borderBottomWidth:1,borderColor:m.border}}><Text style={{fontSize:12,color:m.bronze}}>{'0'+(i+1)}</Text><Text style={{flex:1,fontSize:15,lineHeight:25,color:m.ink,textAlign:m.align}}>{m.t(en,ar)}</Text><Ionicons name={ai?'sparkles-outline':parts?'cog-outline':'navigate-outline'} size={18} color={m.muted}/></View>)}</View><Text style={{fontSize:13,lineHeight:26,color:m.muted,textAlign:m.align}}>{m.t('This service is being prepared for the next stage. It is not available for requests yet. You can contact an approved mechanic now.','هذه الخدمة قيد التحضير للمرحلة الجاية، وغير متاحة للطلب حاليًا. بتقدر تطلب ميكانيكي معتمد الآن.')}</Text><OwnerButton label={m.t('Find a mechanic','ابحث عن ميكانيكي')} onPress={onMechanic}/><OwnerButton secondary label={m.t('Back to home','العودة للرئيسية')} onPress={onBack}/></View>;
}
