import {useEffect,useRef,useState} from 'react';
import {Image,Platform,ScrollView,View,useWindowDimensions} from 'react-native';
import Animated,{Extrapolation,interpolate,runOnJS,useAnimatedProps,useAnimatedReaction,useAnimatedScrollHandler,useAnimatedStyle,useDerivedValue,useSharedValue} from 'react-native-reanimated';
import Svg,{ClipPath,Defs,Image as SvgImage,Path} from 'react-native-svg';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import CustomerType,{OwnerEditorial} from '../components/CustomerType';
import {Text,useReducedMotion} from '../components/MotexaVisual';
import {useMechanicTheme} from '../components/MechanicUI';
import Pressable from '../components/MotionPressable';
import CustomerServiceModes from '../components/CustomerServiceModes';
import OwnerServicePortal from '../components/OwnerServicePortal';

const AnimatedPath=Animated.createAnimatedComponent(Path);
const serviceImages=[require('../../assets/images/owner-service-mechanic-v10.jpg'),require('../../assets/images/owner-service-parts-v10.jpg'),require('../../assets/images/owner-service-towing-v10.jpg'),require('../../assets/images/mechanic-diagnostics-fatih.jpg')];
export default function MotionProof(){return <CustomerType><Experience/></CustomerType>;}
function Experience(){
 const m=useMechanicTheme(),insets=useSafeAreaInsets(),native=useWindowDimensions(),[web,setWeb]=useState({width:390,height:844}),reduced=useReducedMotion(),[motion,setMotion]=useState(false),[service,setService]=useState(0),[stage,setStage]=useState(0),[panel,setPanel]=useState<'mechanic'|'parts'|'towing'|'ai'|null>(null),ref=useRef<ScrollView>(null);
 useEffect(()=>{if(Platform.OS!=='web')return;const resize=()=>setWeb({width:window.innerWidth,height:window.innerHeight});resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 const size=Platform.OS==='web'?web:native,w=Math.min(size.width||390,560),h=size.height||844,travel=h*1.65,stopped=reduced&&!motion;
 const scroll=useSharedValue(0),p=useDerivedValue(()=>Math.max(0,Math.min(1,scroll.value/travel))),handler=useAnimatedScrollHandler(e=>{scroll.value=e.contentOffset.y;});
 useAnimatedReaction(()=>p.value>.77?2:p.value>.35?1:0,(v,old)=>{if(v!==old)runOnJS(setStage)(v);});
 const pin=useAnimatedStyle(()=>({transform:[{translateY:Math.max(0,Math.min(travel,scroll.value))}]}));
 const outside=useAnimatedStyle(()=>({transform:[{scale:stopped?1:interpolate(p.value,[0,.2,.63],[1,1.09,1.42],Extrapolation.CLAMP)},{translateX:stopped?0:interpolate(p.value,[0,.63],[0,-w*.13],Extrapolation.CLAMP)}]}));
 const cabin=useAnimatedStyle(()=>({transform:[{scale:stopped?1:interpolate(p.value,[.25,.64],[1.22,1],Extrapolation.CLAMP)},{translateX:stopped?0:interpolate(p.value,[.25,.64],[w*.1,0],Extrapolation.CLAMP)}]}));
 const mask=useAnimatedProps(()=>{const t=interpolate(p.value,[.24,.64],[0,1],Extrapolation.CLAMP),edge=w*(1-t),slope=w*.22*Math.sin(t*Math.PI);return{d:`M${edge+slope},0 L${w+2},0 L${w+2},${h+2} L${edge-slope},${h+2} Z`};});
 const workshopMask=useAnimatedProps(()=>{const t=interpolate(p.value,[.72,.96],[0,1],Extrapolation.CLAMP),y=h*(1-t),tilt=h*.13*Math.sin(t*Math.PI);return{d:`M0,${y+tilt} L${w},${y-tilt} L${w},${h+1} L0,${h+1} Z`};});
 const exteriorCopy=useAnimatedStyle(()=>({transform:[{translateY:stopped?0:interpolate(p.value,[.08,.28],[0,-190],Extrapolation.CLAMP)}]}));
 const interiorCopy=useAnimatedStyle(()=>({transform:[{translateY:interpolate(p.value,[.35,.57,.69,.8],[200,0,0,-220],Extrapolation.CLAMP)}]}));
 const serviceCopy=useAnimatedStyle(()=>({transform:[{translateY:interpolate(p.value,[.77,.97],[190,0],Extrapolation.CLAMP)}]}));
 const line=useAnimatedProps(()=>({strokeDashoffset:interpolate(p.value,[.47,.67],[210,0],Extrapolation.CLAMP)}));
 const progress=useAnimatedStyle(()=>({width:`${p.value*100}%`}));
 const names=[m.t('Mechanics','الميكانيكيون'),m.t('Spare parts','قطع الغيار'),m.t('Roadside','مساعدة الطريق'),m.t('AI assistance','مساعدة ذكية')];
 const titles=[m.t('The right hands.\nFor your next mile.','أهل الخبرة.\nلطريقك الجاي.'),m.t('Every detail\nkeeps you moving.','كل قطعة\nبتكمّل طريقك.'),m.t('A way forward.\nWhen you need it.','مساعدة بطريقك.\nوقت ما تحتاجها.'),m.t('Understand more.\nChoose with clarity.','افهم سيارتك.\nواختَر بثقة.')];
 function open(){setPanel((['mechanic','parts','towing','ai'] as const)[service]);}
 function jump(){ref.current?.scrollTo({y:travel,animated:!stopped});}
 if(panel)return <View style={{height:h,backgroundColor:m.canvas,paddingTop:insets.top}}><ScrollView contentContainerStyle={{padding:22,paddingBottom:45}}><Pressable accessibilityRole="button" onPress={()=>setPanel(null)} style={{paddingVertical:18}}><Text>{m.t('← Back to the experience','العودة للتجربة ←')}</Text></Pressable>{panel==='mechanic'?<><Text style={{color:m.muted,fontSize:13,lineHeight:24}}>{m.t('Continue to your account after choosing a mode to select your vehicle and book.','اختَر طريقة الخدمة ثم تابع لحسابك لاختيار سيارتك والحجز.')}</Text><CustomerServiceModes paused onChoose={()=>router.push('/customer')}/></>:<OwnerServicePortal service={panel} onBack={()=>setPanel(null)} onMechanic={()=>setPanel('mechanic')}/>}</ScrollView></View>;
 return <View style={{height:h,backgroundColor:'#15110E',alignItems:'center',overflow:'hidden'}}><View style={{width:w,height:h}}><Animated.ScrollView ref={ref} testID="motion-proof-scroll" onScroll={handler} scrollEventThrottle={16} showsVerticalScrollIndicator={false} style={{height:h}} contentContainerStyle={{height:h+travel}}><Animated.View style={[{height:h,overflow:'hidden'},pin]}>
  <Animated.View testID="motion-proof-exterior" style={[{position:'absolute',inset:0},outside]}><Image accessible={false} source={require('../../assets/images/owner-audi-workshop-v7.jpg')} resizeMode="cover" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/></Animated.View>
  <Animated.View pointerEvents="none" style={[{position:'absolute',inset:0},cabin]}><Svg width={w} height={h}><Defs><ClipPath id="proof-cabin"><AnimatedPath testID="motion-proof-mask" animatedProps={mask}/></ClipPath></Defs><SvgImage href={require('../../assets/images/owner-audi-interior-v6.png')} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath="url(#proof-cabin)"/></Svg></Animated.View>
  <Svg pointerEvents="none" width={w} height={h} style={{position:'absolute',inset:0}}><Defs><ClipPath id="proof-service"><AnimatedPath animatedProps={workshopMask}/></ClipPath></Defs><SvgImage href={serviceImages[service]} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath="url(#proof-service)"/></Svg>
  <LinearGradient pointerEvents="none" colors={['#15110EF0','#15110E12','#15110E00','#15110EF8','#15110E']} locations={[0,.34,.55,.84,1]} style={{position:'absolute',inset:0}}/>
  <View pointerEvents="none" style={{position:'absolute',top:insets.top+100,left:25,right:25,height:195,overflow:'hidden'}}>
   <Animated.View style={[{position:'absolute',inset:0,gap:12},exteriorCopy]}><Text style={{fontSize:10,letterSpacing:m.ar?0:2.5,color:'#DAB184',textAlign:m.align}}>MOTEXA / {m.t('YOUR AUTOMOTIVE WORLD','عالم سيارتك')}</Text><OwnerEditorial style={{fontSize:m.ar?38:46,lineHeight:m.ar?57:54,color:'#FFF2DF',textAlign:m.align}}>{m.t('Your car.\nOur world.','سيارتك.\nعالم نهتم فيه.')}</OwnerEditorial></Animated.View>
   <Animated.View style={[{position:'absolute',inset:0,gap:12},interiorCopy]}><Text style={{fontSize:10,letterSpacing:m.ar?0:2.5,color:'#DAB184',textAlign:m.align}}>{m.t('FROM THE DRIVER’S SEAT','من مقعد السائق')}</Text><OwnerEditorial style={{fontSize:m.ar?37:46,lineHeight:m.ar?55:54,color:'#FFF2DF',textAlign:m.align}}>{m.t('Care that\nunderstands you.','عناية بتفهمك.\nوبتفهم سيارتك.')}</OwnerEditorial></Animated.View>
  </View>
  {stage===1&&<Svg pointerEvents="none" width={w} height={h} style={{position:'absolute',inset:0}}><AnimatedPath d={`M${w*.30},${h*.54} L${w*.45},${h*.60} L${w*.80},${h*.60}`} fill="none" stroke="#DAB184" strokeWidth={1} strokeDasharray="210 210" animatedProps={line}/></Svg>}
  <View pointerEvents="none" style={{position:'absolute',left:25,right:25,bottom:220,height:160,overflow:'hidden'}}><Animated.View style={[{gap:8},serviceCopy]}><Text style={{fontSize:10,letterSpacing:2,color:'#E0B786',textAlign:m.align}}>{'0'+(service+1)+' / '+names[service]}</Text><Text style={{fontSize:m.ar?32:37,lineHeight:m.ar?47:42,color:'#FFF2DF',textAlign:m.align,fontWeight:'500'}}>{titles[service]}</Text><Text style={{fontSize:12,lineHeight:22,color:'#DAC5AC',textAlign:m.align}}>{service===0?m.t('Workshop visits · Mobile care · Online advice','زيارة ورشة · ميكانيكي لموقعك · استشارة أونلاين'):m.t('In preparation · Requests not available yet','قيد التحضير · الطلب غير متاح حاليًا')}</Text></Animated.View></View>
 </Animated.View></Animated.ScrollView>
 <View style={{position:'absolute',top:insets.top+24,left:25,right:25,flexDirection:m.row,justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:19,letterSpacing:4,color:'#FFF0D9'}}>MOTEXA</Text><Pressable accessibilityRole="button" accessibilityLabel="Open existing home" onPress={()=>router.push('/customer-preview')} style={{padding:10}}><Text style={{fontSize:12,color:'#DAB184'}}>{m.t('Home ↗','الرئيسية ↖')}</Text></Pressable></View>
 <View style={{position:'absolute',left:25,right:25,bottom:Math.max(24,insets.bottom+15),gap:14}}>
  {stage===2&&<View style={{flexDirection:m.row,flexWrap:'wrap',gap:8}}>{names.map((name,i)=><Pressable key={name} accessibilityRole="tab" accessibilityState={{selected:service===i}} aria-selected={service===i} onPress={()=>setService(i)} style={{paddingVertical:9,paddingHorizontal:7,borderBottomWidth:service===i?2:1,borderColor:service===i?'#DFB17D':'#80674C55'}}><Text style={{fontSize:11,color:service===i?'#FFE4BD':'#BBA58C'}}>{name}</Text></Pressable>)}</View>}
  <Pressable accessibilityRole="button" accessibilityLabel={stage===2?'Open selected service':'Discover services'} onPress={stage===2?open:jump} style={{minHeight:54,flexDirection:m.row,alignItems:'center',justifyContent:'space-between',borderTopWidth:1,borderBottomWidth:1,borderColor:'#CDA16C66'}}><Text style={{fontSize:14,color:'#F2CCA0'}}>{stage===2?m.t('Explore '+names[service],'استكشف '+names[service]):m.t('Discover what your car needs','اكتشف احتياجات سيارتك')}</Text><Text style={{fontSize:25,color:'#DAB184'}}>{m.ar?'↖':'↗'}</Text></Pressable>
  <View style={{height:2,backgroundColor:'#AB835533'}}><Animated.View testID="motion-proof-progress" style={[{height:2,backgroundColor:'#DAB184'},progress]}/></View>
  <Text testID="motion-proof-stage" style={{fontSize:10,color:'#AD9479',textAlign:'center'}}>{stage===0?m.t('01 / EXTERIOR · SCROLL TO EXPLORE','01 / من الخارج · اسحب لتكتشف'):stage===1?m.t('02 / COCKPIT · SCROLL BACK TO REVERSE','02 / المقصورة · ارجع لعكس الحركة'):m.t('03 / YOUR CAR’S NEXT CHAPTER','03 / المرحلة الجاية لسيارتك')}</Text>
  {reduced&&!motion&&<Pressable accessibilityRole="button" onPress={()=>setMotion(true)}><Text style={{fontSize:11,color:'#DAB184',textAlign:'center'}}>{m.t('Reduced motion · Enable depth effects','تقليل الحركة · تشغيل تأثيرات العمق')}</Text></Pressable>}
 </View></View></View>;
}


