import {useEffect,useState} from 'react';
import {Animated,Easing,Image,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {Text,useReducedMotion} from './MotexaVisual';

const scenes={
 customer:{source:require('../../assets/images/porsche-alexandru-tabusca.jpg'),icon:'car-sport-outline',en:'Every journey starts with you.',ar:'كل رحلة تبدأ بك.'},
 mechanic:{source:require('../../assets/images/mechanic-tim-mossholder.jpg'),icon:'construct-outline',en:'Expertise that moves us forward.',ar:'خبرةٌ تمنح الرحلة ثقة.'},
 parts:{source:require('../../assets/images/ferrari-samuel-hagger.jpg'),icon:'cube-outline',en:'Every part has a purpose.',ar:'لكل قطعة، دورٌ في الرحلة.'},
 towing:{source:require('../../assets/images/towing-fr0ggy5.jpg'),icon:'car-outline',en:'A helping hand along the road.',ar:'عونٌ على امتداد الطريق.'},
} as const;
export default function RoleCinematicHero({role,ar,title,description,photographOnly=false}:{role:string|null;ar:boolean;title:string;description:string;photographOnly?:boolean}) {
 const reduced=useReducedMotion();const [reveal]=useState(()=>new Animated.Value(1));const [width,setWidth]=useState(0);
 const scene=scenes[role as keyof typeof scenes]??scenes.customer;
 useEffect(()=>{if(reduced){reveal.setValue(1);return;}reveal.setValue(0);const motion=Animated.timing(reveal,{toValue:1,duration:650,easing:Easing.out(Easing.cubic),useNativeDriver:true,isInteraction:false});motion.start();return()=>motion.stop();},[role,reveal,reduced]);
 return <View testID="role-hero-photograph" onLayout={e=>{const next=e.nativeEvent.layout.width;if(next>0)setWidth(current=>current===next?current:next);}} style={{height:photographOnly?260:300,borderTopLeftRadius:photographOnly?(ar?20:68):36,borderTopRightRadius:photographOnly?(ar?68:20):18,borderBottomLeftRadius:photographOnly?(ar?70:18):18,borderBottomRightRadius:photographOnly?(ar?18:70):36,overflow:'hidden',backgroundColor:'#30231B'}}>
  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{width:'100%',height:'100%',opacity:reveal.interpolate({inputRange:[0,1],outputRange:[.65,1]}),transform:[{scale:reveal.interpolate({inputRange:[0,1],outputRange:[1.045,1]})}]}]}>
   {width>0&&<Image key={role??'default'} accessible={false} source={scene.source} resizeMode="cover" style={!role||role==='customer'?{position:'absolute',width:width*1.2,height:width*1.5,left:-width*.1,top:(photographOnly?110:150)-width*1.5*.77}:{position:'absolute',width:'100%',height:'100%'}}/>}
  </Animated.View>
  <LinearGradient pointerEvents="none" colors={photographOnly?['#432D1E08','#432D1E00','#21171022','#211710E6']:['#21171033','#21171000','#21171022','#211710E6']} locations={[0,.35,.55,1]} style={StyleSheet.absoluteFill}/>
  {!photographOnly&&<View style={{position:'absolute',top:14,left:14,right:14,flexDirection:ar?'row-reverse':'row',justifyContent:'space-between',alignItems:'center'}}><View style={{width:36,height:36,borderRadius:18,backgroundColor:'#30231B88',borderWidth:1,borderColor:'#FFF1DF44',alignItems:'center',justifyContent:'center'}}><Ionicons name={scene.icon} size={18} color="#FFF1DF"/></View><Text style={{fontSize:10,letterSpacing:1.4,color:'#FFF1DF'}}>MOTEXA / YOUR WORLD</Text></View>}
  <View accessibilityLiveRegion="polite" style={{position:'absolute',left:18,right:18,bottom:18,gap:5}}><Text style={{fontSize:10,lineHeight:19,color:'#E5C49B',textAlign:ar?'right':'left'}}>{ar?scene.ar:scene.en}</Text><Text accessibilityRole="header" style={{fontSize:photographOnly?21:24,lineHeight:photographOnly?29:33,fontWeight:'600',color:'#FFF9EF',textAlign:ar?'right':'left'}}>{title}</Text><Text style={{fontSize:12,lineHeight:21,color:'#F0DFC9',textAlign:ar?'right':'left'}}>{description}</Text></View>
 </View>;
}
