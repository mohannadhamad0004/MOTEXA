import {Image,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import Svg,{Path,Circle} from 'react-native-svg';
import {Text} from './MotexaVisual';
import {useAppearance} from './Appearance';
import {useLanguage} from '../i18n/LanguageContext';
import {EditorialTitle} from './PremiumUI';

/** A layered studio illustration, not an interactive 3D model or a saved customer vehicle. */
export default function OwnerEntryScene({garage=false}:{garage?:boolean}){
 const {dark}=useAppearance(),{isArabic:ar}=useLanguage();
 const t=(en:string,arabic:string)=>ar?arabic:en;
 return <View testID={garage?'owner-first-car-scene':'owner-account-scene'} style={{borderRadius:28,overflow:'hidden',borderWidth:1,borderColor:dark?'#735238':'#CDA77F',backgroundColor:'#241B15',marginVertical:10}}>
  <LinearGradient colors={['#3C2C20','#1B1511','#493727']} style={{paddingTop:garage?14:19}}>
   <View style={{paddingHorizontal:20,gap:7}}>
    <Text style={{color:'#DFB58B',fontSize:10,letterSpacing:ar?0:1.5,textAlign:ar?'right':'left'}}>{t(garage?'02 / YOUR PRIVATE GARAGE':'01 / THE OWNER EXPERIENCE',garage?'02 / كراجك الخاص':'01 / تجربة صاحب السيارة')}</Text>
    <EditorialTitle accessibilityRole="header" style={{color:'#FFF3E3',fontSize:garage?25:ar?27:31,lineHeight:garage?34:42,textAlign:ar?'right':'left'}}>{t(garage?'Every journey. Your car.':'Your journey starts here.',garage?'كل رحلة تبدأ بسيارتك.':'من هون بتبدأ رحلتك.')}</EditorialTitle>
    <Text style={{fontSize:13,lineHeight:22,color:'#D9C1A8',textAlign:ar?'right':'left'}}>{t(garage?'Add your car once. Keep every service connected.':'Create your account. Then make room for your car.',garage?'أضف سيارتك مرة، وخلي كل خدمة مرتبطة فيها.':'أنشئ حسابك، وبعد تسجيل الدخول بنجهّز سيارتك.')}</Text>
   </View>
   <View accessible={false} style={{height:garage?142:184,overflow:'hidden'}}>
    <Text numberOfLines={1} adjustsFontSizeToFit style={{position:'absolute',left:12,right:12,top:5,fontSize:66,lineHeight:82,fontWeight:'700',letterSpacing:-3,color:'#FFF2DE12',textAlign:'center'}}>YOUR DRIVE</Text>
    <Svg width="100%" height="100%" viewBox="0 0 390 184" preserveAspectRatio="none" style={{position:'absolute',inset:0}}><Path d="M-20 133 Q180 -27 414 106" stroke="#D2A47666" strokeWidth=".7" fill="none"/><Circle cx="65" cy="87" r="3" fill="#E8BD8B"/><Path d="M12 170 Q185 115 385 163" stroke="#D2A47644" strokeWidth=".7" fill="none"/></Svg>
    <View style={{position:'absolute',bottom:4,left:'10%',width:'80%',height:20,borderRadius:100,backgroundColor:'#08060488',transform:[{scaleY:.45}]}}/>
    <Image source={require('../../assets/images/owner-studio-m8-v2.png')} resizeMode="contain" style={{position:'absolute',width:'122%',height:garage?142:184,left:'-11%',bottom:garage?-5:-8}}/>
   </View>
   <View style={{paddingHorizontal:20,paddingVertical:13,borderTopWidth:1,borderTopColor:'#F4D0A31C',flexDirection:ar?'row-reverse':'row',gap:8,alignItems:'center'}}>
    <View style={{width:5,height:5,borderRadius:3,backgroundColor:'#E1AE7B'}}/><Text style={{fontSize:11,lineHeight:19,color:'#D5BA9C',flex:1,textAlign:ar?'right':'left'}}>{t(garage?'Make → Model & year → Fuel':'Account → Sign in → Your first car',garage?'الشركة ← الموديل والسنة ← الوقود':'الحساب ← تسجيل الدخول ← أول سيارة')}</Text>
   </View>
  </LinearGradient>
 </View>;
}
