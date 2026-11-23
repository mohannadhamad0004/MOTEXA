import {useEffect} from 'react';
import Animated,{useSharedValue,useAnimatedStyle,withTiming,cancelAnimation,Easing} from 'react-native-reanimated';
import {View} from 'react-native';
import {Image} from 'expo-image';
import {useFonts} from 'expo-font';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {Text,useReducedMotion} from './MotexaVisual';
import BrandMonogram from './BrandMonogram';
import {useMechanicTheme} from './MechanicUI';
import MechanicJourneySteps from './MechanicJourneySteps';

/** The same editorial language across account creation and every application stage. */
export default function MechanicJourneyHeader({title,subtitle,current,photo=false,onStep,stepsDisabled=false,canSelectStep}:{title:string;subtitle?:string;current?:number;photo?:boolean;onStep?:(step:number)=>void;stepsDisabled?:boolean;canSelectStep?:(step:number)=>boolean}){
 const m=useMechanicTheme();const[ready]=useFonts({MotexaJourneyScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaJourneyArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});
 const stageImages=[require('../../assets/images/mechanic-craft-cottonbro.jpg'),require('../../assets/images/department-tools-isabela.jpg'),require('../../assets/images/mechanic-workshop-cottonbro.jpg'),require('../../assets/images/mechanic-documents-pavel.jpg'),require('../../assets/images/mechanic-diagnostics-fatih.jpg')];
 const captions=[m.t('A professional account. A trusted beginning.','حساب مهني. وبداية تستحق الثقة.'),m.t('Let your experience speak.','دع خبرتك تتحدث عنك.'),m.t('Your expertise, where people need it.','خبرتك، حيث يحتاجها الناس.'),m.t('Real credentials. Reviewed with care.','وثائق حقيقية. ومراجعة بعناية.'),m.t('Every detail, ready for review.','كل تفصيلة، جاهزة للمراجعة.')];
 const reduced=useReducedMotion(),scale=useSharedValue(1);
 useEffect(()=>{scale.value=reduced?1:1.045;scale.value=withTiming(1,{duration:reduced?0:850,easing:Easing.out(Easing.cubic)});return()=>cancelAnimation(scale);},[current,reduced,scale]);
 const photoMotion=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));
 return <View style={{marginTop:5,marginBottom:20}}>
  <View style={{overflow:'hidden',paddingTop:9,paddingBottom:14}}><BrandMonogram size={190} style={{top:10,left:m.ar?undefined:-29,right:m.ar?-29:undefined,opacity:.04}}/><View style={{flexDirection:m.row,alignItems:'center',gap:7}}><Ionicons name="construct-outline" size={13} color={m.muted}/><Text style={{fontSize:9,lineHeight:20,color:m.muted,letterSpacing:m.ar?0:1.5}}>{m.t('MOTEXA / YOUR PROFESSIONAL JOURNEY','MOTEXA / رحلتك المهنية')}</Text></View><Text accessibilityRole="header" style={{fontFamily:ready?(m.ar?'MotexaJourneyArabic':'MotexaJourneyScript'):undefined,fontSize:m.ar?29:40,lineHeight:m.ar?45:53,color:m.ink,textAlign:m.align,marginTop:8}}>{title}</Text>{!!subtitle&&<Text style={{fontSize:13,lineHeight:24,color:m.muted,textAlign:m.align,marginTop:5}}>{subtitle}</Text>}</View>
  {(photo||current!==undefined)&&<View style={{height:195,borderTopLeftRadius:35,borderTopRightRadius:18,borderBottomLeftRadius:18,borderBottomRightRadius:45,overflow:'hidden',marginBottom:0,backgroundColor:m.soft}}><Animated.View pointerEvents="none" style={[{position:'absolute',inset:0},photoMotion]}><Image accessible={false} source={stageImages[(current??3)-1]} contentFit="cover" contentPosition={current===5?{top:'73%',left:'50%'}:'center'} style={{width:'100%',height:'100%'}}/></Animated.View><LinearGradient pointerEvents="none" colors={['#24180F05','#24180FA8']} style={{position:'absolute',inset:0}}/><View style={{flex:1,justifyContent:'flex-end',padding:19,paddingBottom:43}}><Text style={{fontSize:12,lineHeight:23,color:'#FFF4E3',textAlign:m.align}}>{captions[(current??3)-1]}</Text></View></View>}
  {current!==undefined&&<View style={{marginHorizontal:9,marginTop:-23,paddingHorizontal:14,paddingTop:10,paddingBottom:9,borderRadius:23,borderWidth:1,borderColor:m.border,backgroundColor:m.surface,boxShadow:'0px 6px 18px rgba(50,32,19,0.06)'}}><MechanicJourneySteps current={current} onSelect={onStep} disabled={stepsDisabled} canSelect={canSelectStep}/></View>}
 </View>;
}
