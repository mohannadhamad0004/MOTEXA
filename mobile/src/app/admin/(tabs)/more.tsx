import CurvedPhotoHero from '../../../components/CurvedPhotoHero';
import React,{useState} from 'react';
import {Image,ImageBackground,Modal,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import * as SecureStore from '../../../components/SessionStore';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppearance} from '../../../components/Appearance';
import {CanvasFill} from '../../../components/BrandSurfaces';
import {Text} from '../../../components/MotexaVisual';
import {EditorialTitle} from '../../../components/PremiumUI';
import BrandWordmark from '../../../components/BrandWordmark';
import LanguageSwitch from '../../../components/LanguageSwitch';
import MotexaDialog from '../../../components/MotexaDialog';
import {WorkspacePhotography} from '../../../components/WorkspacePhotography';
import {useLanguage} from '../../../i18n/LanguageContext';

export default function MoreScreen(){
 const {dark}=useAppearance();const {isArabic:ar}=useLanguage();const insets=useSafeAreaInsets();
 const [logoutVisible,setLogoutVisible]=useState(false),[loggingOut,setLoggingOut]=useState(false);
 const [sheet,setSheet]=useState<'settings'|'help'|null>(null),[expanded,setExpanded]=useState<number|null>(0);
 const t=(en:string,arabic:string)=>ar?arabic:en;
 const ink=dark?'#FFF1DF':'#432D1E',muted=dark?'#D8BE9B':'#80664E',surface=dark?'#3A2A20':'#FFF9EF',border=dark?'#896544':'#E4CBAA';
 const row=ar?'row-reverse' as const:'row' as const,align=ar?'right' as const:'left' as const;
 const confirmLogout=async()=>{if(loggingOut)return;try{setLoggingOut(true);await SecureStore.deleteItemAsync('motexa_access_token');setLogoutVisible(false);router.dismissAll();router.replace('/');}catch{setLogoutVisible(false);}finally{setLoggingOut(false);}};
 const items:[string,string,keyof typeof Ionicons.glyphMap,()=>void,number|null][]=[
  [t('My Profile','الملف الشخصي'),t('Your account details and access','بيانات حسابك وصلاحيات الوصول'),'person-outline',()=>router.push('/admin/profile'),0],
  [t('Admin Management','إدارة الأدمن'),t('Department accounts and invitations','حسابات الأقسام ودعوات الأدمن'),'people-outline',()=>router.push('/admin/admin-management'),1],
  [t('Settings','الإعدادات'),t('Language, appearance and preferences','اللغة والمظهر والتفضيلات'),'settings-outline',()=>setSheet('settings'),null],
  [t('Help & Support','المساعدة والدعم'),t('Guidance for your MOTEXA workspace','إرشادات استخدام مساحة MOTEXA'),'help-circle-outline',()=>setSheet('help'),null],
  [t('Sign Out','تسجيل الخروج'),t('Sign out of your current account','الخروج من حسابك الحالي'),'log-out-outline',()=>setLogoutVisible(true),null],
 ];
 const faq=[
  [t('How do I invite an administrator?','كيف أدعو أدمن جديدًا؟'),t('Open Admin Management, choose Invite administrator, then enter the name, email and department. The recipient completes email verification and chooses a password.','افتح إدارة الأدمن ثم دعوة أدمن، وأدخل الاسم والبريد والقسم. يكمل المستلم التحقق من بريده وإنشاء كلمة المرور.')],
  [t('How do I recover a password?','كيف أستعيد كلمة المرور؟'),t('On Sign in, choose Forgot password. Use the registered email to receive a code, verify it, then choose a new password.','من صفحة تسجيل الدخول اختر نسيت كلمة المرور. استخدم البريد المسجّل لاستلام الرمز، ثم تحقق منه وأنشئ كلمة مرور جديدة.')],
  [t('How do I pause an admin account?','كيف أعلّق حساب أدمن؟'),t('Open the account in Admin Management, then choose Suspend account and confirm. You can reactivate it later.','افتح الحساب من إدارة الأدمن، واختر تعليق الحساب ثم أكّد العملية. يمكنك إعادة تفعيله لاحقًا.')],
 ];
 return <View style={{flex:1}}><CanvasFill/><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{width:'100%',maxWidth:680,alignSelf:'center',paddingBottom:20}}>
  <View style={[s.header,{paddingTop:insets.top+9,flexDirection:'row',direction:'ltr'}]}><BrandWordmark style={{flex:1}}/><LanguageSwitch light compact unified/></View>
  <CurvedPhotoHero eyebrow={t('MOTEXA / SUPER ADMIN','MOTEXA / المسؤول الأعلى')} title={t('Your\nworkspace','مساحتك\nالإدارية')} caption={t('Super Admin','المسؤول الأعلى')} description={t('Manage your account and workspace','إدارة حسابك ومساحة عملك')}/>
  <View style={s.body}><View style={[s.section,{flexDirection:row}]}><Text style={{fontSize:10,lineHeight:20,letterSpacing:ar?0:1.7,color:ink,fontWeight:'600'}}>{t('SYSTEM MANAGEMENT','إدارة النظام')}</Text><View style={{height:1,flex:1,backgroundColor:border}}/></View>
  <View style={[s.group,{backgroundColor:surface,borderColor:dark?'#61472F':'#F3E3CA'}]}>{items.map(([label,description,icon,onPress,photo],index)=><Pressable key={icon} accessibilityRole="button" onPress={onPress} style={({pressed})=>[s.menuItem,{flexDirection:row,backgroundColor:'transparent',borderColor:dark?'#61472F':'#EADBC7',borderBottomWidth:index===items.length-1?0:1,opacity:pressed?.78:1}]}>
   <View style={[s.icon,{backgroundColor:index===4?(dark?'#56372A':'#F7E3D4'):(dark?'#59402B':'#F2DCC0')}]}><Ionicons name={icon} size={23} color={index===4?(dark?'#F1B8A0':'#A24930'):muted}/></View>
   <View style={{flex:1,minWidth:0}}><Text style={{fontSize:15,lineHeight:23,fontWeight:'600',color:index===4?(dark?'#F1B8A0':'#A24930'):ink,textAlign:align}}>{label}</Text><Text style={{fontSize:10,lineHeight:17,color:muted,marginTop:3,textAlign:align}}>{description}</Text></View>
   {false&&photo===0&&<Image source={require('../../../../assets/images/motexa-profile-membership.png')} accessible={false} resizeMode="cover" style={s.thumb}/>}
   {false&&photo===1&&<WorkspacePhotography index={0} style={{width:54,height:62,borderRadius:12}}/>}
   <Ionicons name={ar?'chevron-back':'chevron-forward'} size={18} color={muted}/>
  </Pressable>)}</View></View>
  
 </ScrollView>
 <Modal visible={sheet!==null} transparent animationType="slide" onRequestClose={()=>setSheet(null)}><View style={s.overlay}><View accessibilityViewIsModal style={[s.sheet,{backgroundColor:surface,borderColor:border,paddingBottom:Math.max(insets.bottom,20)}]}><CanvasFill/><View style={[s.sheetHead,{flexDirection:row}]}><BrandWordmark style={{flex:1}}/><Pressable accessibilityRole="button" accessibilityLabel={t('Close','إغلاق')} onPress={()=>setSheet(null)} style={s.close}><Ionicons name="close-outline" size={25} color={ink}/></Pressable></View><ScrollView showsVerticalScrollIndicator={false}>
  <EditorialTitle accent style={{fontSize:28,lineHeight:39,color:ink,textAlign:align}}>{sheet==='settings'?t('Make it yours','تفضيلاتك'):t('Help & Support','المساعدة والدعم')}</EditorialTitle>
  {sheet==='settings'?<><Text style={{fontSize:13,lineHeight:23,color:muted,textAlign:align,marginTop:10,marginBottom:23}}>{t('Choose your language and appearance. Changes apply throughout MOTEXA.','اختر اللغة والمظهر. تُطبّق التغييرات على جميع واجهات MOTEXA.')}</Text><View style={{alignItems:'center',padding:15,borderWidth:1,borderColor:border,borderRadius:26}}><LanguageSwitch compact light unified/></View><Text style={{fontSize:11,lineHeight:20,color:muted,textAlign:align,marginTop:17}}>{t('The device icon follows your system appearance.','أيقونة الجهاز تستخدم المظهر المحدد في إعدادات جهازك.')}</Text></>:<><Text style={{fontSize:12,lineHeight:21,color:muted,textAlign:align,marginTop:9,marginBottom:18}}>{t('Quick answers for your administration workspace.','إجابات سريعة لاستخدام مساحة الإدارة.')}</Text>{faq.map(([question,answer],index)=><View key={question} style={{borderWidth:1,borderColor:border,borderRadius:23,marginBottom:10,overflow:'hidden'}}><Pressable accessibilityRole="button" accessibilityState={{expanded:expanded===index}} onPress={()=>setExpanded(expanded===index?null:index)} style={{padding:15,flexDirection:row,alignItems:'center',gap:10,minHeight:52}}><Text style={{flex:1,fontSize:13,lineHeight:22,color:ink,textAlign:align}}>{question}</Text><Ionicons name={expanded===index?'chevron-up':'chevron-down'} size={18} color={muted}/></Pressable>{expanded===index&&<Text style={{fontSize:12,lineHeight:23,color:muted,paddingHorizontal:15,paddingBottom:16,textAlign:align}}>{answer}</Text>}</View>)}</>}
 </ScrollView></View></View></Modal>
 <MotexaDialog icon="log-out-outline" visible={logoutVisible} type="warning" title={t('Sign Out?','تسجيل الخروج؟')} message={t('Sign out of your account? You can sign in again at any time.','هل تريد تسجيل الخروج من حسابك؟ يمكنك العودة في أي وقت.')} confirmText={t('Sign Out','تسجيل الخروج')} cancelText={t('Cancel','إلغاء')} loading={loggingOut} onConfirm={confirmLogout} onCancel={()=>setLogoutVisible(false)}/>
 </View>;
}
const s=StyleSheet.create({header:{paddingHorizontal:19,paddingBottom:14,alignItems:'center',gap:12,flexWrap:'wrap'},hero:{height:205,padding:23,justifyContent:'center'},identity:{marginTop:-18,borderTopLeftRadius:60,borderTopRightRadius:22,paddingHorizontal:23,paddingTop:17,paddingBottom:18,gap:13,alignItems:'center'},avatar:{width:63,height:63,borderRadius:32,borderWidth:1,alignItems:'center',justifyContent:'center',marginTop:-25},body:{paddingHorizontal:17,paddingTop:9,zIndex:1},section:{alignItems:'center',gap:12,marginBottom:15},group:{borderWidth:1,borderRadius:29,padding:8,gap:0},menuItem:{borderWidth:0,borderRadius:0,minHeight:84,padding:13,gap:10,alignItems:'center'},icon:{width:41,height:41,borderRadius:21,alignItems:'center',justifyContent:'center'},thumb:{width:54,height:62,borderRadius:12},footerImage:{width:'100%',height:150,marginTop:-10},overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(31,21,14,.48)'},sheet:{maxHeight:'84%',minHeight:300,borderTopLeftRadius:31,borderTopRightRadius:31,padding:22,borderWidth:1,overflow:'hidden'},sheetHead:{alignItems:'center',gap:12,marginBottom:17},close:{width:42,height:42,alignItems:'center',justifyContent:'center'}});

