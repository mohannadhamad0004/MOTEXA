import {useCallback,useEffect,useRef,useState} from 'react';
import {Image,Platform,View,useWindowDimensions} from 'react-native';
import Animated,{Extrapolation,interpolate,runOnJS,useAnimatedProps,useAnimatedReaction,useAnimatedStyle,useDerivedValue,useSharedValue} from 'react-native-reanimated';
import Svg,{ClipPath,Defs,Image as SvgImage,Path} from 'react-native-svg';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {OwnerEditorial} from './CustomerType';
import {Text,useReducedMotion} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import Pressable from './MotionPressable';
import {useOwnerMotion} from './OwnerMotion';

const AnimatedPath=Animated.createAnimatedComponent(Path);
const serviceImages=[require('../../assets/images/owner-service-mechanic-v10.jpg'),require('../../assets/images/owner-service-parts-v10.jpg'),require('../../assets/images/owner-service-towing-v10.jpg'),require('../../assets/images/mechanic-diagnostics-fatih.jpg')];
export default function OwnerCinematicHomeScene({onMechanic,onService,paused}:{onMechanic:()=>void;onService?:(key:'parts'|'towing'|'ai')=>void;paused:boolean}){
 const m=useMechanicTheme(),insets=useSafeAreaInsets(),native=useWindowDimensions(),[web,setWeb]=useState({width:390,height:844}),reduced=useReducedMotion(),[motion,setMotion]=useState(false),[service,setService]=useState(0),[stage,setStage]=useState(0),root=useRef<View>(null),origin=useSharedValue(0),{scroll,scrollTo}=useOwnerMotion();
 useEffect(()=>{if(Platform.OS!=='web')return;const resize=()=>setWeb({width:window.innerWidth,height:window.innerHeight});resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 const size=Platform.OS==='web'?web:native,w=Math.min(size.width||390,520),h=Math.max(500,Math.min(650,(size.height||844)-insets.top-insets.bottom-200)),travel=h*1.2,stopped=paused||(reduced&&!motion);
 const local=useDerivedValue(()=>Math.max(0,scroll.value-origin.value)),p=useDerivedValue(()=>Math.max(0,Math.min(1,local.value/travel)));
 const measure=useCallback(()=>root.current?.measureInWindow((_x,y)=>origin.set(Math.max(0,y+scroll.get()-insets.top))),[origin,scroll,insets.top]);
 useAnimatedReaction(()=>p.value>.77?2:p.value>.35?1:0,(v,old)=>{if(v!==old)runOnJS(setStage)(v);});
 const pin=useAnimatedStyle(()=>({transform:[{translateY:Math.max(0,Math.min(travel,local.value))}]}));
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
 function open(){if(service===0)onMechanic();else onService?.((['parts','towing','ai'] as const)[service-1]);}
 function jump(){scrollTo(origin.get()+travel,!stopped);}
 return <View ref={root} collapsable={false} onLayout={measure} testID="owner-cinematic-home" style={{height:h+travel,marginHorizontal:-18,backgroundColor:'#15110E'}}><Animated.View testID="owner-anchored-scene" style={[{height:h,overflow:'hidden'},pin]}>
  <Animated.View testID="motion-proof-exterior" style={[{position:'absolute',inset:0},outside]}><Image accessible={false} source={require('../../assets/images/owner-audi-workshop-v7.jpg')} resizeMode="cover" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/></Animated.View>
  <Animated.View pointerEvents="none" style={[{position:'absolute',inset:0},cabin]}><Svg width={w} height={h}><Defs><ClipPath id="proof-cabin"><AnimatedPath testID="motion-proof-mask" animatedProps={mask}/></ClipPath></Defs><SvgImage href={require('../../assets/images/owner-audi-interior-v6.png')} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath="url(#proof-cabin)"/></Svg></Animated.View>
  <Svg pointerEvents="none" width={w} height={h} style={{position:'absolute',inset:0}}><Defs><ClipPath id="proof-service"><AnimatedPath animatedProps={workshopMask}/></ClipPath></Defs><SvgImage href={serviceImages[service]} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath="url(#proof-service)"/></Svg>
  <LinearGradient pointerEvents="none" colors={['#15110EF0','#15110E12','#15110E00','#15110EF8','#15110E']} locations={[0,.34,.55,.84,1]} style={{position:'absolute',inset:0}}/>
  <View pointerEvents="none" style={{position:'absolute',top:25,left:25,right:25,height:195,overflow:'hidden'}}>
   <Animated.View style={[{position:'absolute',inset:0,gap:12},exteriorCopy]}><Text style={{fontSize:10,letterSpacing:m.ar?0:2.5,color:'#DAB184',textAlign:m.align}}>MOTEXA / {m.t('YOUR AUTOMOTIVE WORLD','عالم سيارتك')}</Text><OwnerEditorial style={{fontSize:m.ar?38:46,lineHeight:m.ar?57:54,color:'#FFF2DF',textAlign:m.align}}>{m.t('Your car.\nOur world.','سيارتك.\nعالم نهتم فيه.')}</OwnerEditorial></Animated.View>
   <Animated.View style={[{position:'absolute',inset:0,gap:12},interiorCopy]}><Text style={{fontSize:10,letterSpacing:m.ar?0:2.5,color:'#DAB184',textAlign:m.align}}>{m.t('FROM THE DRIVER’S SEAT','من مقعد السائق')}</Text><OwnerEditorial style={{fontSize:m.ar?37:46,lineHeight:m.ar?55:54,color:'#FFF2DF',textAlign:m.align}}>{m.t('Care that\nunderstands you.','عناية بتفهمك.\nوبتفهم سيارتك.')}</OwnerEditorial></Animated.View>
  </View>
  {stage===1&&<Svg pointerEvents="none" width={w} height={h} style={{position:'absolute',inset:0}}><AnimatedPath d={`M${w*.30},${h*.54} L${w*.45},${h*.60} L${w*.80},${h*.60}`} fill="none" stroke="#DAB184" strokeWidth={1} strokeDasharray="210 210" animatedProps={line}/></Svg>}
  <View pointerEvents="none" style={{position:'absolute',left:25,right:25,bottom:220,height:160,overflow:'hidden'}}><Animated.View style={[{gap:8},serviceCopy]}><Text style={{fontSize:10,letterSpacing:2,color:'#E0B786',textAlign:m.align}}>{'0'+(service+1)+' / '+names[service]}</Text><Text style={{fontSize:m.ar?32:37,lineHeight:m.ar?47:42,color:'#FFF2DF',textAlign:m.align,fontWeight:'500'}}>{titles[service]}</Text><Text style={{fontSize:12,lineHeight:22,color:'#DAC5AC',textAlign:m.align}}>{service===0?m.t('Workshop visits · Mobile care · Online advice','زيارة ورشة · ميكانيكي لموقعك · استشارة أونلاين'):m.t('In preparation · Requests not available yet','قيد التحضير · الطلب غير متاح حاليًا')}</Text></Animated.View></View>

 <View style={{position:'absolute',left:25,right:25,bottom:Math.max(24,insets.bottom+15),gap:14}}>
  {stage===2&&<View style={{flexDirection:m.row,flexWrap:'wrap',gap:8}}>{names.map((name,i)=><Pressable key={name} accessibilityRole="tab" accessibilityState={{selected:service===i}} aria-selected={service===i} onPress={()=>setService(i)} style={{paddingVertical:9,paddingHorizontal:7,borderBottomWidth:service===i?2:1,borderColor:service===i?'#DFB17D':'#80674C55'}}><Text style={{fontSize:11,color:service===i?'#FFE4BD':'#BBA58C'}}>{name}</Text></Pressable>)}</View>}
  <Pressable accessibilityRole="button" accessibilityLabel={stage===2?m.t('Open selected service','فتح الخدمة المختارة'):m.t('Find your specialist','اختيار المختص')} onPress={stage===2?open:onMechanic} style={{minHeight:54,flexDirection:m.row,alignItems:'center',justifyContent:'space-between',borderTopWidth:1,borderBottomWidth:1,borderColor:'#CDA16C66'}}><Text style={{fontSize:14,color:'#F2CCA0'}}>{stage===2?m.t('Explore '+names[service],'استكشف '+names[service]):m.t('Find your specialist','اختَر المختص')}</Text><Text style={{fontSize:25,color:'#DAB184'}}>{m.ar?'↖':'↗'}</Text></Pressable>
  {stage!==2&&<Pressable accessibilityRole="button" accessibilityLabel={m.t('Discover services','اكتشف الخدمات')} onPress={jump} style={{minHeight:35,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:12,color:'#DAB184'}}>{m.t('Explore all services ↓','استكشف كل الخدمات ↓')}</Text></Pressable>}
  <View style={{height:2,backgroundColor:'#AB835533'}}><Animated.View testID="motion-proof-progress" style={[{height:2,backgroundColor:'#DAB184'},progress]}/></View>
  <Text testID="motion-proof-stage" style={{fontSize:10,color:'#AD9479',textAlign:'center'}}>{stage===0?m.t('01 / EXTERIOR · SCROLL TO EXPLORE','01 / من الخارج · اسحب لتكتشف'):stage===1?m.t('02 / COCKPIT · SCROLL BACK TO REVERSE','02 / المقصورة · ارجع لعكس الحركة'):m.t('03 / YOUR CAR’S NEXT CHAPTER','03 / المرحلة الجاية لسيارتك')}</Text>
  {reduced&&!motion&&<Pressable accessibilityRole="button" onPress={()=>setMotion(true)}><Text style={{fontSize:11,color:'#DAB184',textAlign:'center'}}>{m.t('Reduced motion · Enable depth effects','تقليل الحركة · تشغيل تأثيرات العمق')}</Text></Pressable>}
 </View></Animated.View></View>;
}


