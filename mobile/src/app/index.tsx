import BrandWordmark from '../components/BrandWordmark';
import {useFonts} from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text as DisplayText, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/MotexaVisual';
import { useLanguage } from '../i18n/LanguageContext';

const stories = [
 { label:'WELCOME TO MOTEXA', labelAr:'مرحبًا بك في MOTEXA', lead:'Your car.', accent:'Our priority.', leadAr:'سيارتك.', accentAr:'أولويتنا.', body:'A more considered way to care for your car. Designed around you.', bodyAr:'تجربة عناية بسيارتك، صُمّمت لتكون أقرب إليك.' },
 { label:'CARE, CONNECTED', labelAr:'عناية أقرب إليك', lead:'Every journey.', accent:'Better connected.', leadAr:'في كل رحلة.', accentAr:'ابقَ على تواصل.', body:'Your automotive world, brought together in one thoughtful experience.', bodyAr:'عالم خدمات السيارات في تجربة واحدة، بتفاصيل مدروسة.' },
 { label:'MADE FOR YOU', labelAr:'صُمّمت من أجلك', lead:'Less searching.', accent:'More living.', leadAr:'بحث أقل.', accentAr:'وقت أكثر لك.', body:'A clearer, simpler starting point for your automotive needs.', bodyAr:'بداية أوضح وأسهل للوصول إلى احتياجات سيارتك.' },
 { label:'YOUR NEXT CHAPTER', labelAr:'بداية رحلتك', lead:'Drive with', accent:'confidence.', leadAr:'انطلق.', accentAr:'بكل ثقة.', body:'Welcome to MOTEXA. Choose your role and make the experience yours.', bodyAr:'أهلًا بك في MOTEXA. اختر دورك وابدأ تجربتك.' },
];

export default function Index() {
 const [editorialReady]=useFonts({MotexaEditorial:require('../../assets/fonts/GFSDidot-Regular.ttf')});
 const {isArabic, toggleLanguage}=useLanguage(); const insets=useSafeAreaInsets();const {fontScale}=useWindowDimensions(); const [screenSize,setScreenSize]=useState({width:390,height:844}); const {width,height}=screenSize;
 const [step,setStep]=useState(0), [reduced,setReduced]=useState(true);const reveal=useRef(new Animated.Value(1)).current;
 const story=stories[step];const frameWidth=Math.min(width,560);const photoHeight=Math.min(Math.max(height*.46,260),440);const short=height<740;
 useEffect(()=>{let active=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduced(value)}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{active=false;sub.remove()}},[]);
 useEffect(()=>{if(reduced){reveal.setValue(1);return;}reveal.setValue(0);const animation=Animated.timing(reveal,{toValue:1,duration:420,useNativeDriver:true,isInteraction:false});animation.start();return()=>{animation.stop();reveal.setValue(1)}},[step,reduced,reveal]);
 const enter=()=>router.replace('/choose-role');
 return <View style={{flex:1,backgroundColor:'#2D1D12',alignItems:'center'}}><StatusBar barStyle="light-content" backgroundColor="#2D1D12"/>
 <View onLayout={event=>{const {width,height}=event.nativeEvent.layout;if(width>0&&height>0)setScreenSize(previous=>previous.width===width&&previous.height===height?previous:{width,height});}} style={{width:'100%',maxWidth:560,flex:1,overflow:'hidden'}}>
  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{transform:[{scale:reveal.interpolate({inputRange:[0,1],outputRange:[1.025,1]})}]}]}><Image accessible={false} source={require('../../assets/images/motexa-mercedes-coastal.png')} resizeMode="cover" style={{width:'100%',height:frameWidth*1.5}}/></Animated.View>
  <LinearGradient pointerEvents="none" colors={['#25160C22','transparent','#24160BC2','#24160BF2']} locations={[0,.4,.78,1]} style={StyleSheet.absoluteFill}/>
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{minHeight:height,flexGrow:1,paddingTop:insets.top+16,paddingBottom:Math.max(insets.bottom,18),paddingHorizontal:27}}>
   <View style={{flexDirection:isArabic?'row-reverse':'row',alignItems:'center',justifyContent:'space-between',gap:10}}><BrandWordmark style={{fontSize:16,lineHeight:27,letterSpacing:5,color:'#FFF4E4'}} light /><View style={{flexDirection:'row',gap:8}}><Pressable accessibilityRole="button" accessibilityLabel={isArabic?'Switch to English':'التبديل إلى العربية'} onPress={toggleLanguage} style={{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:12,color:'#FFF3E0'}}>{isArabic?'EN':'عربي'}</Text></Pressable><Pressable accessibilityRole="button" onPress={enter} style={{minHeight:44,paddingHorizontal:5,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:12,color:'#FFF3E0'}}>{isArabic?'تخطّي':'Skip'}</Text></Pressable></View></View>
   <View style={{flex:1,minHeight:fontScale>1.2?210:Math.max(210,height*.43)}}/>
   <Animated.View accessibilityLiveRegion="polite" style={{opacity:reveal,transform:[{translateY:reveal.interpolate({inputRange:[0,1],outputRange:[10,0]})}]}}>
    <Text style={{fontSize:9,lineHeight:18,letterSpacing:2,color:'#E6C397',marginBottom:14,textAlign:isArabic?'right':'left'}}>{String(step+1).padStart(2,'0')} / 04</Text>
    <Text style={{fontSize:9,lineHeight:18,letterSpacing:isArabic?0:1.4,color:'#E6C397',marginBottom:10,textAlign:isArabic?'right':'left'}}>{isArabic?story.labelAr:story.label}</Text>
    {isArabic?<><Text accessibilityRole="header" style={{color:'#FFF5E5',fontSize:37,lineHeight:55,textAlign:'right'}}>{story.leadAr}</Text><Text style={{color:'#E3BF8B',fontSize:37,lineHeight:55,textAlign:'right'}}>{story.accentAr}</Text></>:<DisplayText accessibilityRole="header" style={{fontFamily:editorialReady?'MotexaEditorial':Platform.OS==='ios'?'Georgia':'serif',fontSize:43,lineHeight:53,color:'#FFF6E8'}}>{story.lead+'\n'}<DisplayText style={{color:'#E3BF8B'}}>{story.accent}</DisplayText></DisplayText>}
    <Text style={{fontSize:13,lineHeight:24,color:'#EBDAC3',marginTop:17,maxWidth:330,textAlign:isArabic?'right':'left'}}>{isArabic?story.bodyAr:story.body}</Text><Text style={{fontSize:7,lineHeight:16,letterSpacing:isArabic?0:1.3,color:'#D3B38A',marginTop:13,textAlign:isArabic?'right':'left'}}>{isArabic?'اهتمام بكل تفصيل.':'CONSIDERED IN EVERY DETAIL'}</Text>
   </Animated.View>
   <View style={{flexDirection:isArabic?'row-reverse':'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:28}}><View accessibilityRole="tablist" accessibilityLabel={isArabic?'شرائح المقدمة':'Introduction slides'} style={{flexDirection:isArabic?'row-reverse':'row'}}>{stories.map((item,index)=><Pressable key={item.label} accessibilityRole="tab" accessibilityState={{selected:index===step}} accessibilityLabel={isArabic?'الشريحة '+(index+1):'Slide '+(index+1)} onPress={()=>setStep(index)} style={{minWidth:29,minHeight:44,alignItems:'center',justifyContent:'center'}}><View style={{height:4,width:index===step?25:6,borderRadius:3,backgroundColor:index===step?'#E8BF86':'#A18462'}}/></Pressable>)}</View><Pressable accessibilityRole="button" accessibilityLabel={step===stories.length-1?(isArabic?'ابدأ الآن':'Get started'):(isArabic?'التالي':'Next')} onPress={()=>step===stories.length-1?enter():setStep(current=>Math.min(current+1,stories.length-1))} style={({pressed})=>({width:58,height:58,borderRadius:29,alignItems:'center',justifyContent:'center',backgroundColor:'#C99B67',opacity:pressed?.78:1})}><Ionicons name={isArabic?'arrow-back':'arrow-forward'} size={25} color="#FFF7E9"/></Pressable></View>
  </ScrollView>
 </View></View>;
}
