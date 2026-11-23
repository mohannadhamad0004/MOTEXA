import {View} from 'react-native';
import {Image} from 'expo-image';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Text,HeroReveal} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import {OwnerBookingRail} from './OwnerDesign';
import {OwnerEditorial} from './CustomerType';
import {OwnerTag} from './OwnerControls';
import Pressable from './MotionPressable';
const options=[
 {key:'WORKSHOP',icon:'storefront-outline',en:'Visit a workshop',ar:'أروح للورشة',eyebrowEn:'THE WORKSHOP EXPERIENCE',eyebrowAr:'العناية في مكانها',titleEn:'Your visit. Expert care.',titleAr:'أنت تزور الورشة، والخبرة بانتظارك.',descEn:'Choose an approved workshop. Send your request, then follow the road after acceptance.',descAr:'اختَر ورشة معتمدة وأرسل طلبك. بعد القبول، تابع طريقك حتى الوصول.',detailEn:'Approved workshops · GPS journey',detailAr:'ورش معتمدة · رحلتك على الخريطة',image:require('../../assets/images/owner-workshop-engine-fring-6870298.jpg')},
 {key:'ON_SITE',icon:'navigate-outline',en:'A mechanic comes to me',ar:'الميكانيكي يجي لعندي',eyebrowEn:'CARE AT YOUR DOOR',eyebrowAr:'الخبرة أقرب إليك',titleEn:'A mechanic, at your location.',titleAr:'الميكانيكي يصل إلى سيارتك.',descEn:'Tell us where your car needs attention. Request a professional who offers mobile service.',descAr:'حدّد موقع سيارتك واحتياجها، واطلب مختصًا يقدّم الخدمة في موقعك.',detailEn:'Your location · Mobile specialists',detailAr:'موقعك · ميكانيكيون متنقلون',image:require('../../assets/images/owner-mobile-jumpstart-daniel-5572270.jpg')},
 {key:'ONLINE',icon:'chatbubbles-outline',en:'An online consultation',ar:'استشارة أونلاين',eyebrowEn:'EXPERT ADVICE, CONNECTED',eyebrowAr:'فهم أوضح لخطوتك القادمة',titleEn:'Expert advice, from a distance.',titleAr:'استشارة عن بُعد، لخطوة أوضح.',descEn:'Share the symptoms. Request a clearer next step from an approved mechanic.',descAr:'شارك أعراض المشكلة، واطلب إرشادًا من ميكانيكي معتمد.',detailEn:'Describe symptoms · Request advice',detailAr:'وصف الأعراض · طلب استشارة',image:require('../../assets/images/owner-online-phone-podrez-8986142.jpg')},
] as const;
export default function CustomerServiceModes({vehicle,onChoose}:{vehicle?:string;initialMode?:string;paused:boolean;onChoose:(mode:string)=>void}){
 const m=useMechanicTheme();
 return <View testID="owner-service-modes" style={{gap:24,paddingBottom:28}}>
  <OwnerBookingRail step={1}/>
  <View style={{gap:9}}><Text style={{fontSize:10,letterSpacing:m.ar?0:2,color:m.bronze,textAlign:m.align}}>{m.t('MOTEXA / EXPERT CARE','MOTEXA / عناية من أهل الخبرة')}</Text><OwnerEditorial style={{fontSize:m.ar?29:43,lineHeight:m.ar?46:53}}>{m.t('Expert care.\nYour way.','خبرة تليق بسيارتك.\nبالطريقة التي تناسبك.')}</OwnerEditorial><Text style={{fontSize:13,lineHeight:25,color:m.muted,textAlign:m.align}}>{m.t('One car. Three ways to find the right expertise.','سيارتك واحدة، وطرق العناية بها على اختيارك.')}</Text>{!!vehicle&&<View style={{alignItems:m.ar?'flex-end':'flex-start',paddingTop:3,gap:6}}><Text style={{fontSize:10,lineHeight:19,color:m.muted}}>{m.t('YOUR VEHICLE FOR THIS REQUEST','سيارتك لهذا الطلب')}</Text><OwnerTag icon="car-sport-outline" label={vehicle}/></View>}</View>
  {options.map((v,i)=><HeroReveal key={v.key} delay={i*45}>
   <Pressable testID={'choose-service-'+v.key.toLowerCase()} accessibilityRole="button" accessibilityLabel={m.t(v.en,v.ar)} accessibilityHint={m.t(v.descEn,v.descAr)} onPress={()=>onChoose(v.key)} style={({pressed})=>({opacity:pressed?.87:1})}>
    <View style={{height:210,borderRadius:26,overflow:'hidden',backgroundColor:m.soft}}><Image accessible={false} source={v.image} contentFit="cover" contentPosition={v.key==='ONLINE'?{top:'10%',left:'50%'}:'center'} transition={0} style={{width:'100%',height:'100%'}}/><LinearGradient pointerEvents="none" colors={['#17100C00','#17100C90']} locations={[.4,1]} style={{position:'absolute',inset:0}}/><View style={{position:'absolute',top:14,left:15,right:15,flexDirection:m.row,justifyContent:'space-between',alignItems:'center'}}><View style={{flexDirection:m.row,gap:7,alignItems:'center',backgroundColor:'#FFF9EFE8',borderRadius:20,paddingHorizontal:11,paddingVertical:6}}><Ionicons name={v.icon} size={15} color="#64492F"/><Text style={{fontSize:10,lineHeight:18,color:'#64492F'}}>{m.t(v.en,v.ar)}</Text></View><Text style={{fontSize:11,letterSpacing:1.4,color:'#FFF9EF'}}>{'0'+(i+1)}</Text></View></View>
    <View style={{marginTop:-18,marginHorizontal:9,borderRadius:22,borderWidth:1,borderColor:m.dark?'#B89A7360':'#FFFFFF',backgroundColor:m.dark?'#2B2019':'#FFFAF2',padding:18,gap:7,boxShadow:'0px 6px 18px #20150C10'}}>
     <Text style={{fontSize:9,lineHeight:18,letterSpacing:m.ar?0:1.3,color:m.bronze,textAlign:m.align}}>{m.t(v.eyebrowEn,v.eyebrowAr)}</Text><Text style={{fontSize:m.ar?21:23,lineHeight:34,fontWeight:'600',color:m.ink,textAlign:m.align}}>{m.t(v.titleEn,v.titleAr)}</Text><Text style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{m.t(v.descEn,v.descAr)}</Text>
     <View style={{marginTop:7,paddingTop:11,borderTopWidth:1,borderColor:m.border,flexDirection:m.row,alignItems:'center',justifyContent:'space-between',gap:10}}><Text style={{fontSize:10,lineHeight:20,color:m.muted,flex:1,textAlign:m.align}}>{m.t(v.detailEn,v.detailAr)}</Text><View style={{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:m.border,alignItems:'center',justifyContent:'center'}}><Ionicons name={m.ar?'arrow-back':'arrow-forward'} size={17} color={m.bronze}/></View></View>
    </View>
   </Pressable>
  </HeroReveal>)}
 </View>;
}
