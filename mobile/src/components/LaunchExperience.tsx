import AnimatedIntroCopy from "./AnimatedIntroCopy";
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Platform, ScrollView, StatusBar, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { useAppearance } from './Appearance';
import { Text, useReducedMotion } from './MotexaVisual';
import { EditorialTitle } from './PremiumUI';
import BrandHeader from './BrandHeader';
import BrandMonogram from './BrandMonogram';
import Pressable from './MotionPressable';
import { palette } from './DesignTokens';

const chapters = [
  { label:['THE WORLD AROUND YOUR CAR','عالمٌ يلتقي حول سيارتك'], title:['Your car.','سيارتك.'], accent:['A world of care.','عالمٌ من العناية.'], body:['From everyday care to the unexpected. Car owners and automotive expertise, connected in one community.','من العناية اليومية إلى مفاجآت الطريق؛ مجتمعٌ يجمع أصحاب السيارات بأهل الخبرة، حول كل رحلة.'], icon:'car-sport-outline' as const },
  { label:['PEOPLE MAKE THE DIFFERENCE','الخبرة تبدأ بالإنسان'], title:['Behind every journey.','وراء كل رحلة.'], accent:['People who care.','أشخاصٌ يهتمّون.'], body:['At the workshop, on-site or through an online consultation. Discover the people behind automotive care.','في الورشة، عند سيارتك، أو باستشارة أونلاين؛ تعرّف إلى أهل الخبرة وراء العناية بسيارتك.'], icon:'people-outline' as const },
  { label:['A MORE CONNECTED AUTOMOTIVE WORLD','رؤية تجمع تفاصيل العناية'], title:['Every detail.','كل تفصيل.'], accent:['Part of the journey.','جزءٌ من الرحلة.'], body:['Mechanics, spare parts and towing. One automotive vision, bringing each part of the journey closer.','ميكانيكيون، قطع غيار، وأصحاب ونشات؛ رؤيةٌ تجمع تفاصيل عالم السيارات في تجربة واحدة.'], icon:'compass-outline' as const },
  { label:['YOUR PLACE IN MOTEXA','مكانك في MOTEXA'], title:['Your role.','دورك.'], accent:['Our next chapter.','بداية حكايتنا.'], body:['Choose your role and find your place in the MOTEXA automotive community.','اختر دورك وابدأ تجربتك ضمن مجتمع MOTEXA للعناية بالسيارات.'], icon:'arrow-forward-outline' as const },
];

/** Public introduction only. Authentication and role authorization remain in their existing routes. */
export default function LaunchExperience() {
  const { dark } = useAppearance();
  const { isArabic: ar } = useLanguage();
  const reduced = useReducedMotion();
  const [launchFontsReady] = useFonts({
    MotexaLaunchScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),
    MotexaLaunchEnglish:require('../../assets/fonts/Manrope-Regular.ttf'),
    MotexaLaunchMonogram:require('../../assets/fonts/GFSDidot-Regular.ttf'),
    MotexaLaunchArabic:require('../../assets/fonts/Tajawal-Regular.ttf'),
    MotexaLaunchArabicMedium:require('../../assets/fonts/Tajawal-Medium.ttf'),
    MotexaLaunchArabicBold:require('../../assets/fonts/Tajawal-Bold.ttf'),
  });
  const transitioning=useRef(false);
  const titleFont=launchFontsReady?(ar?'MotexaLaunchArabicBold':'MotexaLaunchScript'):undefined;
  const bodyFont=launchFontsReady?(ar?'MotexaLaunchArabic':'MotexaLaunchEnglish'):undefined;
  const insets = useSafeAreaInsets();

  const [viewport, setViewport] = useState({width:390,height:844});
  const {width,height} = viewport;
  const [step, setStep] = useState(0);
  const [entrance] = useState(() => new Animated.Value(1));
  const [drift] = useState(() => new Animated.Value(0));
  const [motionPaused,setMotionPaused]=useState(false);
  const [copy] = useState(() => new Animated.Value(1));
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const frameWidth = Math.min(width, 520);
  const compact = height < 740 || width < 360;
  const row = ar ? 'row-reverse' as const : 'row' as const;
  const align = ar ? 'right' as const : 'left' as const;
  const ink = dark ? palette.inkDark : palette.ink;
  const muted = dark ? palette.mutedDark : palette.muted;
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const chapter = chapters[step];
  const textIndex = ar ? 1 : 0;
  const enter = () => router.replace('/choose-role');

  useEffect(() => {
    if (reduced || !photoReady) { entrance.setValue(1); return; }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, { toValue:1, duration:3200, easing:Easing.out(Easing.cubic), useNativeDriver:true, isInteraction:false });
    animation.start();
    return () => animation.stop();
  }, [entrance, reduced, photoReady, step]);
  useEffect(()=>{
    if(reduced||!photoReady){drift.setValue(0);return;}
    if(motionPaused)return;
    const animation=Animated.loop(Animated.sequence([
      Animated.timing(drift,{toValue:1,duration:7000,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),
      Animated.timing(drift,{toValue:0,duration:7000,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),
    ]));
    if(AppState.currentState==='active'||AppState.currentState===null)animation.start();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')animation.start();else animation.stop();});
    return ()=>{animation.stop();subscription.remove();};
  },[drift,motionPaused,photoReady,reduced]);
  useEffect(() => {
    transitioning.current=false;
    if (reduced) { copy.setValue(1); return; }
    copy.setValue(0);
    const animation = Animated.timing(copy, {toValue:1,duration:440,easing:Easing.out(Easing.cubic),useNativeDriver:true,isInteraction:false});
    animation.start();
    return () => animation.stop();
  }, [copy, reduced, step]);

  const changeStep=(next:number)=>{
    if(next===step||transitioning.current)return;
    if(reduced){setStep(next);return;}
    transitioning.current=true;
    Animated.timing(copy,{toValue:0,duration:130,easing:Easing.in(Easing.cubic),useNativeDriver:true,isInteraction:false}).start(({finished})=>{
      if(finished)setStep(next);
      else transitioning.current=false;
    });
  };

  const paper = dark ? '#30231B' : '#FFF9EF';
  const heroHeight = Math.min(440, Math.max(260, frameWidth * .96));
  const [photoWidth, setPhotoWidth] = useState(366);
  const imageHeight = photoWidth * 1.5;
  const touchStart = useRef<{x:number;y:number}|null>(null);
  return <LinearGradient onLayout={event=>{const {width,height}=event.nativeEvent.layout;if(width>0&&height>0)setViewport(current=>current.width===width&&current.height===height?current:{width,height});}} colors={dark?palette.canvasDark:palette.canvas} style={s.root}>
    <StatusBar barStyle="light-content" backgroundColor="#30231B"/>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{flexGrow:1}}>
      <View style={[s.frame,{minHeight:height,maxWidth:520}]}>
        <LinearGradient colors={['#30231B','#493225',paper]} style={{paddingTop:insets.top}}>
          <BrandHeader light caption={tr('Considered in every detail','عناية بكل تفصيل')}/>
          <View testID={photoReady?'launch-photo-ready':photoFailed?'launch-photo-error':'launch-photo-loading'} onLayout={event=>{const next=event.nativeEvent.layout.width;if(next>0)setPhotoWidth(next);}} style={[s.photograph,{height:heroHeight}]}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{transform:[{scale:reduced?1:entrance.interpolate({inputRange:[0,1],outputRange:[1.09,1.045]})},{translateX:entrance.interpolate({inputRange:[0,1],outputRange:[ar?8:-8,0]})},{translateX:reduced?0:drift.interpolate({inputRange:[0,1],outputRange:[-4,4]})},{translateY:reduced?0:drift.interpolate({inputRange:[0,1],outputRange:[2,-2]})},{rotate:reduced?'0deg':drift.interpolate({inputRange:[0,1],outputRange:['-0.35deg','0.35deg']})}]}]}>
              {photoFailed?<View style={[StyleSheet.absoluteFill,{backgroundColor:'#503A29',alignItems:'center',justifyContent:'center'}]}><Ionicons name="car-sport-outline" size={70} color="#DAB180"/></View>:<Image accessible={false} source={require('../../assets/images/automotive-viktor-theo.jpg')} onLoad={()=>setPhotoReady(true)} onError={()=>setPhotoFailed(true)} resizeMode="cover" style={{position:'absolute',width:photoWidth,height:imageHeight,top:heroHeight*.49-imageHeight*.69,left:0}}/>}
            </Animated.View>
            <LinearGradient pointerEvents="none" colors={['#30231B3D','#30231B00','#30231B24']} locations={[0,.4,1]} style={StyleSheet.absoluteFill}/>
            <View testID="launch-swipe-surface" onTouchStart={event=>{const point=event.nativeEvent.touches?.[0]??event.nativeEvent;touchStart.current={x:point.pageX,y:point.pageY};}} onTouchCancel={()=>{touchStart.current=null;}} onTouchEnd={event=>{const start=touchStart.current;touchStart.current=null;if(!start)return;const point=event.nativeEvent.changedTouches?.[0]??event.nativeEvent;const dx=point.pageX-start.x,dy=point.pageY-start.y;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.8)changeStep(Math.max(0,Math.min(3,step+((ar?dx:-dx)>0?1:-1))));}} style={[StyleSheet.absoluteFill,Platform.OS==="web"&&({touchAction:"pan-y"} as ViewStyle)]}/>
            <View style={[s.photoTop,{flexDirection:row}]}>
              <Pressable accessibilityRole="button" accessibilityLabel={tr('Skip introduction','تخطّي المقدمة')} onPress={enter} style={[s.photoControl,{flexDirection:row}]}><Text style={{fontSize:12,color:'#FFF1DF'}}>{tr('Skip','تخطّي')}</Text><Ionicons name={ar?'arrow-back':'arrow-forward'} size={15} color="#FFF1DF"/></Pressable>
              <View style={{flexDirection:row,alignItems:'center',gap:6}}><Text style={s.photoLabel}>MOTEXA / {String(step+1).padStart(2,'0')}</Text>{!reduced&&<Pressable accessibilityRole="button" accessibilityLabel={motionPaused?tr('Resume photo motion','تشغيل حركة الصورة'):tr('Pause photo motion','إيقاف حركة الصورة')} onPress={()=>{entrance.stopAnimation();setMotionPaused(value=>!value);}} style={{width:44,height:44,borderRadius:22,backgroundColor:'#30231B80',alignItems:'center',justifyContent:'center'}}><Ionicons name={motionPaused?'play-outline':'pause-outline'} size={18} color="#FFF1DF"/></Pressable>}</View>
            </View>
            <View pointerEvents="none" style={[s.photoSignature,{flexDirection:row}]}><View style={s.signatureIcon}><Ionicons name={chapter.icon} size={20} color="#F5DABC"/></View><Text style={{fontSize:12,lineHeight:23,color:'#FFF1DF'}}>{tr('Driven by care.','شغفٌ بالعناية.')}</Text></View>
            <Svg pointerEvents="none" width="100%" height={96} viewBox="0 0 390 100" preserveAspectRatio="none" style={{position:'absolute',bottom:-1,left:0}}><Path d="M0 96 C142 104 270 57 390 0 L390 20 C268 76 142 107 0 100 Z" fill={dark?'#9B6D454D':'#BD87514D'}/><Path d="M0 98 C140 105 267 74 390 18 L390 100 L0 100 Z" fill={paper}/><Path d="M0 98 C140 105 267 74 390 18" fill="none" stroke={dark?'#A97B4F66':'#F1D5B5'} strokeWidth={1.2}/></Svg>
          </View>
        </LinearGradient>

        <View style={[s.editorial,{backgroundColor:paper,paddingHorizontal:compact?24:30}]}>
          <BrandMonogram size={280} style={{left:-40,top:22}}/>
          <View style={{flexDirection:row,alignItems:'center',gap:9,marginBottom:13}}>
            <View style={{width:22,height:1,backgroundColor:dark?'#BD9469':'#A97B4F'}}/>
            <Text style={{flex:1,fontSize:10,lineHeight:20,color:muted,textAlign:align}}>{chapter.label[textIndex]}</Text>
            <Text style={{fontSize:10,color:muted}}>{String(step+1).padStart(2,'0')} — 04</Text>
          </View>
          <Animated.View accessibilityLiveRegion="polite" style={{opacity:copy,transform:[{translateY:copy.interpolate({inputRange:[0,1],outputRange:[6,0]})},{translateX:copy.interpolate({inputRange:[0,1],outputRange:[ar?-12:12,0]})}]}}>
            <EditorialTitle accent={false} accessibilityRole="header" style={{fontFamily:titleFont,fontSize:ar?(compact?32:37):(compact?40:46),lineHeight:ar?47:59,fontWeight:ar?'600':'normal',color:ink,textAlign:align}}>{chapter.title[textIndex]}</EditorialTitle>
            <EditorialTitle accent={false} style={{fontFamily:titleFont,fontSize:ar?(compact?33:38):(compact?40:46),lineHeight:ar?48:59,fontWeight:ar?'600':'normal',color:dark?'#E0B581':'#A66D3C',textAlign:align}}>{chapter.accent[textIndex]}</EditorialTitle>
            <AnimatedIntroCopy key={step+"-"+ar} text={chapter.body[textIndex]} arabic={ar} fontFamily={bodyFont} color={muted}/>
          </Animated.View>
        </View>

        <View style={[s.footer,{backgroundColor:paper,paddingHorizontal:compact?24:30,paddingBottom:Math.max(insets.bottom+12,20)}]}>
          <View style={{flexDirection:row,justifyContent:'space-between',gap:6,marginBottom:8}}>
            {([{icon:'construct-outline',en:'Mechanics',ar:'ميكانيكيون'},{icon:'cube-outline',en:'Spare parts',ar:'قطع غيار'},{icon:'car-outline',en:'Towing',ar:'ونشات'}] as const).map(service=><View key={service.en} style={{flex:1,minHeight:36,flexDirection:row,alignItems:'center',justifyContent:'center',gap:5,borderWidth:1,borderColor:dark?'#80604466':'#DCC3A288',borderRadius:18,paddingHorizontal:6,paddingVertical:6}}><Ionicons name={service.icon} size={13} color={muted}/><Text style={{fontSize:10,lineHeight:18,color:muted,flexShrink:1}}>{tr(service.en,service.ar)}</Text></View>)}
          </View>
          <View style={{flexDirection:row,alignItems:'center',gap:14}}>
            <View accessibilityRole="tablist" accessibilityLabel={tr('Introduction slides','شرائح المقدمة')} style={{flex:1,flexDirection:row,gap:5}}>
              {chapters.map((item,index)=><Pressable key={item.label[0]} accessibilityRole="tab" accessibilityLabel={tr('Slide '+(index+1),'الشريحة '+(index+1))} accessibilityState={{selected:step===index}} aria-selected={step===index} onPress={()=>changeStep(index)} style={{flex:1,minHeight:44,justifyContent:'center'}}><View style={{height:3,borderRadius:2,backgroundColor:index===step?(dark?'#E0B581':'#A16D41'):(dark?'#6B513C':'#E6D5BE')}}/></Pressable>)}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={step===3?tr('Get started','ابدأ الآن'):tr('Next','التالي')} onPress={()=>step===3?enter():changeStep(Math.min(step+1,3))} style={({pressed})=>({width:48,height:48,borderRadius:24,backgroundColor:dark?'#E0B581':'#573822',alignItems:'center',justifyContent:'center',opacity:pressed?.78:1})}><Ionicons name={step===3?'checkmark':ar?'arrow-back':'arrow-forward'} size={23} color={dark?'#30231B':'#FFF1DF'}/></Pressable>
          </View>
          <View style={{flexDirection:row,alignItems:'center',justifyContent:'space-between',marginTop:8,gap:10}}><Text style={{fontSize:10,lineHeight:20,color:muted}}>{tr('Your car. Your community.','سيارتك. مجتمعك.')}</Text><Text style={{fontSize:10,lineHeight:20,color:muted}}>M / 01</Text></View>
        </View>
      </View>
    </ScrollView>
  </LinearGradient>;
}
const s=StyleSheet.create({
  root:{flex:1},frame:{width:'100%',alignSelf:'center'},
  header:{minHeight:72,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:7},
  utility:{minWidth:40,minHeight:44,borderRadius:22,borderWidth:1,borderColor:'#C99E6C66',alignItems:'center',justifyContent:'center'},
  photograph:{marginHorizontal:12,borderTopLeftRadius:38,borderTopRightRadius:38,overflow:'hidden',backgroundColor:'#493225'},
  photoTop:{position:'absolute',top:12,left:12,right:12,alignItems:'center',justifyContent:'space-between',gap:10},
  photoControl:{minHeight:44,paddingHorizontal:12,borderRadius:22,backgroundColor:'#30231B7A',alignItems:'center',gap:6},
  photoLabel:{fontSize:10,lineHeight:20,color:'#FFF1DF',paddingHorizontal:12,paddingVertical:9,borderRadius:22,backgroundColor:'#30231B80'},
  photoSignature:{position:'absolute',bottom:30,left:18,alignItems:'center',gap:9},
  signatureIcon:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:'#E5C49B77',alignItems:'center',justifyContent:'center',backgroundColor:'#30231B66'},
  editorial:{paddingTop:4,paddingBottom:16,overflow:'hidden'},footer:{flexGrow:1,justifyContent:'flex-end',paddingTop:8},
});
