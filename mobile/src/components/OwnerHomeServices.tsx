import {Image,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import Pressable from './MotionPressable';

/** Full-bleed service editorial. Real actions; future services retain their readiness notice. */
export default function OwnerHomeServices({onMechanic,onService}:{onMechanic:()=>void;onService?:(key:'parts'|'towing'|'ai')=>void;onServices:()=>void;motionEnabled?:boolean}){
 const m=useMechanicTheme();
 const services=[
  {key:'mechanic',en:'Expert care.\nYour way.',ar:'أهل الخبرة.\nعلى طريقتك.',nameEn:'MECHANICS',nameAr:'الميكانيكيون',image:require('../../assets/images/mechanic-workshop-cottonbro.jpg'),hintEn:'Workshop visits. Mobile care. Online advice.',hintAr:'زيارة ورشة. ميكانيكي لموقعك. استشارة أونلاين.',captionEn:'Explore mechanics',captionAr:'استكشف الميكانيكيين'},
  {key:'parts',en:'Small details.\nA better drive.',ar:'تفاصيل صغيرة.\nوفرق كبير.',nameEn:'SPARE PARTS',nameAr:'قطع الغيار',image:require('../../assets/images/owner-service-parts-v10.jpg'),hintEn:'The components that keep your world moving.',hintAr:'القطع اللي بتحافظ على سيارتك وطريقك.',captionEn:'Discover spare parts',captionAr:'اكتشف قطع الغيار'},
  {key:'towing',en:'A little help.\nA way forward.',ar:'مساعدة بطريقك.\nلتكمّل رحلتك.',nameEn:'ROADSIDE ASSISTANCE',nameAr:'مساعدة الطريق',image:require('../../assets/images/owner-service-towing-v10.jpg'),hintEn:'For the moments your journey needs support.',hintAr:'للحظات اللي بتحتاج فيها مساعدة على الطريق.',captionEn:'Discover roadside assistance',captionAr:'اكتشف مساعدة الطريق'},
  {key:'ai',en:'Know more.\nDrive with clarity.',ar:'افهم سيارتك.\nواختَر بثقة.',nameEn:'AI ASSISTANCE',nameAr:'المساعدة الذكية',image:require('../../assets/images/mechanic-diagnostics-fatih.jpg'),hintEn:'Preliminary guidance. A more informed next step.',hintAr:'إرشاد أولي يساعدك تفهم الخطوة الجاية.',captionEn:'Discover AI assistance',captionAr:'اكتشف المساعدة الذكية'},
 ] as const;
 return <View testID="owner-service-story" style={{marginHorizontal:-18,backgroundColor:'#17120F'}}>
  <View style={{paddingHorizontal:25,paddingTop:31,paddingBottom:26,gap:10}}><View style={{flexDirection:m.row,alignItems:'center',gap:12}}><View style={{width:28,height:1,backgroundColor:'#D2A06B'}}/><Text style={{fontSize:10,letterSpacing:m.ar?0:2,color:'#D6AA7C'}}>{m.t('BUILT AROUND YOUR CAR','مصمّم لسيارتك')}</Text></View><Text style={{fontSize:29,lineHeight:40,color:'#FFF0DE',textAlign:m.align,fontWeight:'600'}}>{m.t('What does your car need?','شو بتحتاج سيارتك؟')}</Text><Text style={{fontSize:13,lineHeight:23,color:'#C5B09A',textAlign:m.align}}>{m.t('The right support. For every chapter.','العناية المناسبة، بكل مرحلة من رحلتك.')}</Text></View>
  {services.map((s,i)=><Pressable key={s.key} focusVisibleOnly accessibilityRole="button" accessibilityLabel={s.key==='mechanic'?m.t('Explore mechanic services','استعراض خدمات الميكانيكي'):m.t('Explore '+(s.key==='parts'?'Car parts':s.key==='towing'?'Towing':'AI assistant'),'استعراض '+(s.key==='parts'?'قطع الغيار':s.key==='towing'?'الونش':'مساعد AI'))} accessibilityHint={s.key==='mechanic'?m.t('Choose workshop, mobile or online','اختيار ورشة أو ميكانيكي لموقعك أو استشارة'):m.t('View this upcoming service. Requests are not available yet.','استعراض خدمة قادمة. الطلب غير متاح حاليًا.')} onPress={()=>s.key==='mechanic'?onMechanic():onService?.(s.key)} style={({pressed})=>({minHeight:375,overflow:'hidden',backgroundColor:'#17120F',opacity:pressed?.87:1})}>
   <Image accessible={false} source={s.image} resizeMode="cover" style={{position:'absolute',top:0,left:0,right:0,width:'100%',height:285}}/>
   <LinearGradient pointerEvents="none" colors={['#17120F15','#17120F00','#17120F99','#17120F']} locations={[0,.32,.72,1]} style={{position:'absolute',top:0,left:0,right:0,height:290}}/>
   <View pointerEvents="none" style={{position:'absolute',top:19,left:25,right:25,flexDirection:m.row,alignItems:'center',justifyContent:'space-between'}}><Text style={{fontSize:11,color:'#FFE2BD',letterSpacing:2}}>{'0'+(i+1)+' / '+m.t(s.nameEn,s.nameAr)}</Text><View style={{height:1,width:44,backgroundColor:'#F0C59699'}}/></View>
   <View style={{paddingHorizontal:25,paddingTop:185,paddingBottom:27,gap:9}}><Text style={{fontSize:m.ar?30:34,lineHeight:m.ar?45:39,fontWeight:'600',color:'#FFF1DF',textAlign:m.align}}>{m.t(s.en,s.ar)}</Text><Text style={{fontSize:12,lineHeight:23,color:'#D2BDA5',textAlign:m.align}}>{m.t(s.hintEn,s.hintAr)}</Text><View style={{flexDirection:m.row,alignItems:'center',justifyContent:'space-between',gap:12,marginTop:8,minHeight:46,borderBottomWidth:1,borderColor:'#C59A6544',paddingBottom:12}}><View style={{flex:1,gap:4}}><Text style={{fontSize:13,color:'#E6B681',fontWeight:'600',textAlign:m.align}}>{m.t(s.captionEn,s.captionAr)}</Text>{s.key!=='mechanic'&&<Text style={{fontSize:10,color:'#B9A28A',textAlign:m.align}}>{m.t('In preparation · Requests not available','قيد التحضير · الطلب غير متاح')}</Text>}</View><Ionicons name={m.ar?'arrow-back':'arrow-forward'} size={23} color="#E6B681"/></View></View>
  </Pressable>)}
 </View>;
}
