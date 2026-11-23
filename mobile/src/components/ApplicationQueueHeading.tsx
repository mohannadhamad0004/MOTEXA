import {View} from 'react-native';
import {useFonts} from 'expo-font';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import Pressable from './MotionPressable';
import {useMechanicTheme} from './MechanicUI';

export default function ApplicationQueueHeading({hasResults,onBank}:{hasResults:boolean;onBank:()=>void}){
 const m=useMechanicTheme();const[ready]=useFonts({MotexaQueueScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaQueueArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});
 return <View style={{flexDirection:m.row,alignItems:'center',gap:10,paddingTop:0,paddingBottom:0}}><View style={{flex:1,gap:0}}><Text accessibilityRole="header" style={{fontFamily:ready?(m.ar?'MotexaQueueArabic':'MotexaQueueScript'):undefined,fontSize:m.ar?26:34,lineHeight:43,color:m.ink,textAlign:m.align,flexShrink:1}}>{m.t('The review desk.','مكتب المراجعة.')}</Text>{hasResults&&<Text style={{fontSize:10,lineHeight:19,color:m.muted,textAlign:m.align}}>{m.t('Latest applications','أحدث الطلبات')}</Text>}</View><Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Question bank','بنك الأسئلة')} accessibilityHint={m.t('Open saved questions and assessment tools','فتح الأسئلة المحفوظة وأدوات التقييم')} onPress={onBank} style={({pressed})=>({minHeight:48,flexDirection:m.row,gap:7,alignItems:'center',paddingVertical:7,paddingHorizontal:11,borderWidth:1,borderColor:m.border,borderRadius:19,backgroundColor:m.soft,opacity:pressed?.8:1,transform:[{scale:pressed?.98:1}]})}><Ionicons name="book-outline" size={19} color={m.muted}/><Text style={{fontSize:11,lineHeight:21,fontWeight:'600',color:m.ink}}>{m.t('Question bank','بنك الأسئلة')}</Text></Pressable></View>;
}
