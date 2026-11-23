import {useCallback,useRef,useState} from 'react';
import {View,Image,useWindowDimensions} from 'react-native';
import Animated,{useSharedValue,useAnimatedStyle,useAnimatedReaction,interpolate,Extrapolation,runOnJS} from 'react-native-reanimated';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text,useReducedMotion} from './MotexaVisual';
import {OwnerEditorial} from './CustomerType';
import {useMechanicTheme} from './MechanicUI';
import {useOwnerMotion} from './OwnerMotion';
import Pressable from './MotionPressable';

/** Editorial exterior → cabin → workshop. These images are not a customer's uploaded vehicle. */
export default function OwnerCinematicIntro({name,paused,onGarage,onMechanic,onServices}:{name:string;paused:boolean;onGarage:()=>void;onMechanic:()=>void;onServices:()=>void;onRequestMotion?:()=>void;onService?:(service:'parts'|'towing'|'ai')=>void}){
 const m=useMechanicTheme(),{height:screenHeight,width}=useWindowDimensions(),insets=useSafeAreaInsets(),{scroll}=useOwnerMotion(),reduced=useReducedMotion(),root=useRef<View>(null),origin=useSharedValue(0),[scene,setScene]=useState(0);
 const height=Math.max(480,Math.min(650,screenHeight-insets.top-insets.bottom-190)),travel=height*.9,stopped=paused||reduced;
 const measure=useCallback(()=>{root.current?.measureInWindow((_x,y)=>{origin.set(Math.max(0,y+scroll.get()-insets.top));});},[origin,scroll,insets.top]);
 useAnimatedReaction(()=>stopped?0:Math.max(0,Math.min(1,(scroll.value-origin.value)/travel)),(p,old)=>{const next=p<.36?0:p<.72?1:2,previous=old==null?-1:old<.36?0:old<.72?1:2;if(next!==previous)runOnJS(setScene)(next);},[stopped,travel]);
 const pin=useAnimatedStyle(()=>({transform:[{translateY:stopped?0:Math.max(0,Math.min(travel,scroll.value-origin.value))}]}));
 const outside=useAnimatedStyle(()=>{const p=stopped?0:Math.max(0,Math.min(1,(scroll.value-origin.value)/travel));return {opacity:interpolate(p,[0,.27,.5],[1,1,0],Extrapolation.CLAMP),transform:[{scale:interpolate(p,[0,.5],[1,1.3],Extrapolation.CLAMP)},{translateX:interpolate(p,[0,.5],[0,-24],Extrapolation.CLAMP)}]};});
 const cabin=useAnimatedStyle(()=>{const p=stopped?0:Math.max(0,Math.min(1,(scroll.value-origin.value)/travel));return {opacity:interpolate(p,[.24,.46,.64,.84],[0,1,1,0],Extrapolation.CLAMP),transform:[{scale:interpolate(p,[.24,.7],[1.16,1],Extrapolation.CLAMP)},{translateX:interpolate(p,[.24,.7],[20,0],Extrapolation.CLAMP)}]};});
 const workshop=useAnimatedStyle(()=>{const p=stopped?0:Math.max(0,Math.min(1,(scroll.value-origin.value)/travel));return {opacity:interpolate(p,[.62,.84,1],[0,1,1],Extrapolation.CLAMP),transform:[{scale:interpolate(p,[.62,1],[1.1,1],Extrapolation.CLAMP)}]};});
 const welcomeCopy=useAnimatedStyle(()=>({opacity:stopped?1:interpolate((scroll.value-origin.value)/travel,[0,.24,.36],[1,1,0],Extrapolation.CLAMP),transform:[{translateY:stopped?0:interpolate((scroll.value-origin.value)/travel,[0,.36],[0,-24],Extrapolation.CLAMP)}]}));
 const cabinCopy=useAnimatedStyle(()=>({opacity:stopped?0:interpolate((scroll.value-origin.value)/travel,[.32,.43,.62,.74],[0,1,1,0],Extrapolation.CLAMP)}));
 const workshopCopy=useAnimatedStyle(()=>({opacity:stopped?0:interpolate((scroll.value-origin.value)/travel,[.7,.84],[0,1],Extrapolation.CLAMP)}));
 const progress=useAnimatedStyle(()=>({width:`${stopped?0:Math.max(0,Math.min(100,(scroll.value-origin.value)/travel*100))}%`}));
 const copyStyle={position:'absolute' as const,top:26,left:24,right:24,gap:9};
 return <View ref={root} onLayout={measure} testID="owner-cinematic-intro" style={{height:height+(stopped?0:travel),marginHorizontal:-18,backgroundColor:'#17120F'}}>
  <Animated.View style={[{height,overflow:'hidden',backgroundColor:'#17120F'},pin]}>
   <Animated.View testID="owner-scene-exterior" pointerEvents="none" style={[{position:'absolute',top:0,left:0,right:0,bottom:122},outside]}><Image accessible={false} source={require('../../assets/images/owner-audi-workshop-v7.jpg')} resizeMode="cover" style={{width:'100%',height:'100%'}}/></Animated.View>
   <Animated.View testID="owner-scene-interior" pointerEvents="none" style={[{position:'absolute',top:0,left:0,right:0,bottom:122},cabin]}><Image accessible={false} source={require('../../assets/images/owner-audi-interior-v6.png')} resizeMode="cover" style={{width:'100%',height:'100%'}}/></Animated.View>
   <Animated.View testID="owner-scene-workshop" pointerEvents="none" style={[{position:'absolute',top:0,left:0,right:0,bottom:122},workshop]}><Image accessible={false} source={require('../../assets/images/owner-service-mechanic-v10.jpg')} resizeMode="cover" style={{width:'100%',height:'100%'}}/></Animated.View>
   <LinearGradient pointerEvents="none" colors={['#17120FD9','#17120F28','#17120F00','#17120FF5']} locations={[0,.36,.62,1]} style={{position:'absolute',inset:0}}/>
   <View style={{position:'absolute',top:0,left:24,right:24,height:1,backgroundColor:'#E3B58022'}}/>
   <Animated.View accessibilityElementsHidden={scene!==0} importantForAccessibility={scene===0?'auto':'no-hide-descendants'} style={[copyStyle,welcomeCopy]}><Text style={{fontSize:10,lineHeight:20,letterSpacing:m.ar?0:1.7,color:'#DDB487',textAlign:m.align}}>{m.t('THE MOTEXA EXPERIENCE','عالم MOTEXA')}</Text><OwnerEditorial style={{fontSize:m.ar?32:width<360?42:49,lineHeight:m.ar?49:57,color:'#FFF1DF'}}>{m.t('Every mile.\nTaken care of.','كل طريق.\nوعناية بترافقك.')}</OwnerEditorial><Text style={{fontSize:13,lineHeight:23,color:'#DFCDB8',textAlign:m.align}}>{m.t('Welcome, ','أهلًا، ')+name.split(' ')[0]+m.t('. Your car has a place here.','. هون المكان اللي يهتم بسيارتك.')}</Text></Animated.View>
   <Animated.View accessibilityElementsHidden={scene!==1} importantForAccessibility={scene===1?'auto':'no-hide-descendants'} style={[copyStyle,cabinCopy]}><Text style={{fontSize:10,lineHeight:20,letterSpacing:m.ar?0:1.5,color:'#DDB487',textAlign:m.align}}>{m.t('YOUR CAR. YOUR SPACE.','سيارتك. ومساحتك الخاصة.')}</Text><OwnerEditorial style={{fontSize:m.ar?31:46,lineHeight:m.ar?47:55,color:'#FFF1DF'}}>{m.t('Every detail,\nconnected.','كل تفصيلة،\nبمكان واحد.')}</OwnerEditorial><Text style={{maxWidth:285,fontSize:14,lineHeight:25,color:'#DFCDB8',textAlign:m.align}}>{m.t('Your own photos, saved vehicle details and a garage ready for every service.','صور سيارتك ومعلوماتها، وكراج جاهز لكل طلب خدمة.')}</Text></Animated.View>
   <Animated.View accessibilityElementsHidden={scene!==2} importantForAccessibility={scene===2?'auto':'no-hide-descendants'} style={[copyStyle,workshopCopy]}><Text style={{fontSize:10,lineHeight:20,letterSpacing:m.ar?0:1.5,color:'#DDB487',textAlign:m.align}}>{m.t('CARE, ON YOUR TERMS','العناية بالطريقة اللي بتناسبك')}</Text><OwnerEditorial style={{fontSize:m.ar?31:46,lineHeight:m.ar?47:55,color:'#FFF1DF'}}>{m.t('The right hands.\nThe next step.','المختص المناسب.\nوالخطوة الجاية.')}</OwnerEditorial><Text style={{maxWidth:280,fontSize:14,lineHeight:25,color:'#DFCDB8',textAlign:m.align}}>{m.t('Find approved mechanics. Send your request. Follow your workshop journey.','اختَر ميكانيكي معتمد، ابعث طلبك، وتابع رحلتك للورشة.')}</Text></Animated.View>
   <View style={{position:'absolute',bottom:14,left:24,right:24,gap:5}}>
    <Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={scene===1?m.t('Open My cars','فتح سياراتي'):m.t('Explore mechanic services','استعراض خدمات الميكانيكي')} onPress={scene===1?onGarage:onMechanic} style={({pressed})=>({minHeight:48,paddingHorizontal:0,borderBottomWidth:1,borderColor:'#D1A16C66',backgroundColor:pressed?'#37271A':'transparent',flexDirection:m.row,alignItems:'center',justifyContent:'space-between',gap:10})}><Text style={{fontSize:14,fontWeight:'600',color:'#E6BC8A'}}>{scene===1?m.t('Open My cars','افتح سياراتي'):m.t('Find your specialist','اختَر المختص')}</Text><Ionicons name={m.ar?'arrow-back':'arrow-forward'} size={22} color="#E6BC8A"/></Pressable>
    <Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Skip introduction and view services','تخطي المقدمة وعرض الخدمات')} onPress={onServices} style={{minHeight:38,flexDirection:m.row,alignItems:'center',justifyContent:'center',gap:9}}><Ionicons name="chevron-down" size={16} color="#E2C6A3"/><Text style={{fontSize:12,color:'#E2C6A3'}}>{m.t('Discover all services','اكتشف كل الخدمات')}</Text></Pressable>
    <View style={{height:2,backgroundColor:'#DAB78A30',overflow:'hidden'}}><Animated.View testID="owner-story-progress" style={[{height:2,backgroundColor:'#DAB78A'},progress]}/></View>
    <Text style={{fontSize:9,lineHeight:16,color:'#C8AC8D',textAlign:m.align}}>{m.t('MOTEXA · Illustrative vehicle imagery','MOTEXA · صور سيارات توضيحية')}</Text>
   </View>
  </Animated.View>
 </View>;
}


