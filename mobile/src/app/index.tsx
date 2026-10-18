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
 const {isArabic, toggleLanguage}=useLanguage(); const insets=useSafeAreaInsets();const {width,height,fontScale}=useWindowDimensions();
 const [step,setStep]=useState(0), [reduced,setReduced]=useState(true);const reveal=useRef(new Animated.Value(1)).current;
 const story=stories[step];const frameWidth=Math.min(width,560);const photoHeight=Math.min(Math.max(height*.46,260),440);const short=height<740;
 useEffect(()=>{let active=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduced(value)}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{active=false;sub.remove()}},[]);
 useEffect(()=>{if(reduced){reveal.setValue(1);return;}reveal.setValue(0);const animation=Animated.timing(reveal,{toValue:1,duration:420,useNativeDriver:true,isInteraction:false});animation.start();return()=>{animation.stop();reveal.setValue(1)}},[step,reduced,reveal]);
 const enter=()=>router.replace('/choose-role');
 return <LinearGradient colors={['#8C6947','#CBB18B','#E8D8BE']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.outer}>
 <StatusBar barStyle="light-content" backgroundColor="#2B2018"/>
 <View style={[s.frame,{maxWidth:560}]}>
  <ScrollView style={{flex:1}} contentContainerStyle={{flexGrow:1}} showsVerticalScrollIndicator={false}>
   <View style={{height:photoHeight,overflow:'hidden',backgroundColor:'#2A2018'}}>
    <Animated.View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,height:frameWidth*1.5,transform:[{scale:reveal.interpolate({inputRange:[0,1],outputRange:[1.025,1]})}]}}><Image accessible={false} source={require('../../assets/images/motexa-mercedes-onboarding.png')} resizeMode="cover" style={{width:'100%',height:'100%'}}/></Animated.View>
    <LinearGradient pointerEvents="none" colors={['#17120E80','transparent','#3C2B184D']} locations={[0,.4,1]} style={StyleSheet.absoluteFill}/>
    <View style={[s.header,{paddingTop:insets.top+16,flexDirection:isArabic?'row-reverse':'row'}]}>
     <View style={s.brandRow}><Ionicons name="car-sport-outline" size={20} color="#E4BF88"/><Text style={s.brand}>MOTEXA</Text></View>
     <View style={{flexDirection:'row',gap:10}}><Pressable accessibilityRole="button" accessibilityLabel={isArabic?'Switch to English':'التبديل إلى العربية'} onPress={toggleLanguage} style={({pressed,hovered})=>[s.headerButton,{opacity:pressed?.7:hovered?.85:1}]}><Text style={s.headerText}>{isArabic?'EN':'عربي'}</Text></Pressable><Pressable accessibilityRole="button" onPress={enter} style={({pressed,hovered})=>[s.headerButton,{opacity:pressed?.7:hovered?.85:1}]}><Text style={s.headerText}>{isArabic?'تخطّي':'Skip'}</Text></Pressable></View>
    </View>
    <View style={[s.photoCaption,{flexDirection:isArabic?'row-reverse':'row'}]}><View style={s.captionRule}/><Text style={s.photoLabel}>THE ART OF AUTOMOTIVE CARE</Text><Text style={s.photoCount}>{String(step+1).padStart(2,'0')} / 04</Text></View>
   </View>
   <LinearGradient colors={['#F8EFDF','#ECDCC3']} start={{x:0,y:0}} end={{x:1,y:1}} style={[s.storyPanel,{paddingTop:short?24:30,paddingHorizontal:width<360?24:30,flex:1}]}>
    <Animated.View accessibilityLiveRegion="polite" style={{opacity:reveal,transform:[{translateY:reveal.interpolate({inputRange:[0,1],outputRange:[12,0]})}]}}>
     <View style={{flexDirection:isArabic?'row-reverse':'row',alignItems:'center',gap:9,marginBottom:short?14:20}}><View style={s.labelMark}/><Text style={s.label}>{isArabic?story.labelAr:story.label}</Text></View>
     {isArabic?<><Text style={[s.arTitle,{fontSize:short?34:39,lineHeight:short?52:59}]}>{story.leadAr}</Text><Text style={[s.arTitle,{color:'#80532D',fontSize:short?34:39,lineHeight:short?52:59}]}>{story.accentAr}</Text></>:<DisplayText accessibilityRole="header" style={[s.title,{fontSize:short?42:48,lineHeight:short?50:57,fontFamily:Platform.OS==='ios'?'Georgia':Platform.OS==='android'?'serif':'Georgia, serif'}]}>{story.lead}{'\n'}<DisplayText style={{color:'#80532D'}}>{story.accent}</DisplayText></DisplayText>}
     <Text style={[s.description,{textAlign:isArabic?'right':'left',marginTop:short?16:22}]}>{isArabic?story.bodyAr:story.body}</Text>
    </Animated.View>
    <View style={[s.storyBottom,{marginTop:fontScale>1.2?25:18}]}><View style={s.storyRule}/><Text style={s.storySignature}>{isArabic?'اهتمام بكل تفصيل.':'CONSIDERED IN EVERY DETAIL'}</Text></View>
   </LinearGradient>
  </ScrollView>
  <View style={[s.controls,{paddingBottom:Math.max(insets.bottom,18),flexDirection:isArabic?'row-reverse':'row'}]}>
   <View accessibilityRole="tablist" accessibilityLabel={isArabic?'شرائح المقدمة':'Introduction slides'} style={{flexDirection:isArabic?'row-reverse':'row'}}>{stories.map((item,index)=><Pressable key={item.label} accessibilityRole="tab" accessibilityState={{selected:index===step}} accessibilityLabel={isArabic?'الشريحة '+(index+1):'Slide '+(index+1)} onPress={()=>setStep(index)} style={s.dotButton}><View style={{height:4,width:index===step?25:6,borderRadius:4,backgroundColor:index===step?'#80532D':'#BAA587'}}/></Pressable>)}</View>
   <Pressable accessibilityRole="button" onPress={()=>step===stories.length-1?enter():setStep(current=>Math.min(current+1,stories.length-1))} style={({pressed,hovered})=>[s.next,{opacity:pressed?.8:hovered?.9:1,flexDirection:isArabic?'row-reverse':'row'}]}><Text style={s.nextText}>{step===stories.length-1?(isArabic?'ابدأ الآن':'Get started'):(isArabic?'التالي':'Next')}</Text><Ionicons name={isArabic?'arrow-back':'arrow-forward'} size={20} color="#FFF8ED"/></Pressable>
  </View>
 </View>
 </LinearGradient>;
}
const s=StyleSheet.create({
 outer:{flex:1,alignItems:'center'},frame:{width:'100%',flex:1,backgroundColor:'#F2E5CF'},header:{paddingHorizontal:24,justifyContent:'space-between',alignItems:'center'},brandRow:{flexDirection:'row',alignItems:'center',gap:8},brand:{color:'#FFF5E5',fontSize:15,fontWeight:'800',letterSpacing:3},headerButton:{minHeight:42,paddingHorizontal:13,justifyContent:'center',borderRadius:22,backgroundColor:'#1C160FCC',borderWidth:1,borderColor:'#D6AC734D'},headerText:{color:'#FFF3E0',fontSize:12,fontWeight:'600'},photoCaption:{position:'absolute',bottom:39,left:26,right:26,alignItems:'center',gap:9},captionRule:{width:23,height:1,backgroundColor:'#DDB783'},photoLabel:{color:'#F5DEC0',fontSize:7,letterSpacing:1.8,flex:1},photoCount:{color:'#EACDA4',fontSize:10,letterSpacing:2},storyPanel:{marginTop:-20,borderTopLeftRadius:30,borderTopRightRadius:30,paddingBottom:12},labelMark:{width:5,height:5,backgroundColor:'#95652F',transform:[{rotate:'45deg'}]},label:{color:'#765335',fontSize:9,fontWeight:'800',letterSpacing:1.6},title:{color:'#30251D',fontWeight:'400',letterSpacing:-1},arTitle:{color:'#30251D',fontWeight:'600',textAlign:'right'},description:{color:'#62513D',fontSize:15,lineHeight:26,maxWidth:410},storyBottom:{flexDirection:'row',gap:10,alignItems:'center'},storyRule:{width:22,height:1,backgroundColor:'#BA9667'},storySignature:{color:'#765D40',fontSize:7,letterSpacing:1.4},controls:{paddingTop:13,paddingHorizontal:25,alignItems:'center',justifyContent:'space-between',backgroundColor:'#ECDCC3',gap:12},dotButton:{width:32,minHeight:44,alignItems:'center',justifyContent:'center'},next:{minHeight:54,paddingHorizontal:23,borderRadius:29,backgroundColor:'#634329',gap:12,alignItems:'center',justifyContent:'center'},nextText:{color:'#FFF8ED',fontSize:14,fontWeight:'700'}
});
