import CurvedPhotoHero from '../../components/CurvedPhotoHero';
import BrandWordmark from '../../components/BrandWordmark';
import {EditorialTitle,SectionCaption} from '../../components/PremiumUI';
import {LoadingState} from "../../components/LoadingState";
import MotexaDialog from "../../components/MotexaDialog";
import {LinearGradient} from "expo-linear-gradient";
import {useBrandPalette} from "../../components/BrandSurfaces";
import {useCallback,useState} from 'react';
import {Alert,ActivityIndicator,RefreshControl,ScrollView,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import * as SecureStore from '../../components/SessionStore';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Heading,Text,HeroReveal} from '../../components/MotexaVisual';
import {CanvasFill,PanelFill} from '../../components/BrandSurfaces';
import {useAppearance} from '../../components/Appearance';
import {useLanguage} from '../../i18n/LanguageContext';
import LanguageSwitch from '../../components/LanguageSwitch';
import Button from '../../components/InteractiveButton';
type Account={fullName:string;email:string;role:string;status:string;adminPermissions?:({permission:string}|string)[]};
export default function ProfileScreen(){
 const brandPalette=useBrandPalette();
 const [logoutVisible,setLogoutVisible]=useState(false),[loggingOut,setLoggingOut]=useState(false);
 const {dark}=useAppearance(),{isArabic}=useLanguage(),insets=useSafeAreaInsets();
 const [account,setAccount]=useState<Account|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const t=(en:string,ar:string)=>isArabic?ar:en;const ink=dark?'#FFF0DC':'#38281D',muted=dark?'#CDB698':'#735B46';const direction={flexDirection:isArabic?'row-reverse' as const:'row' as const};
 const load=useCallback(async(signal:AbortSignal)=>{setLoading(true);setError('');try{const token=await SecureStore.getItemAsync('motexa_access_token'),base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');if(!token||!base)throw Error('session');const response=await fetch(`${base}/api/auth/me`,{headers:{Authorization:`Bearer ${token}`},signal});if(response.status===401)throw Error('session');if(!response.ok)throw Error('load');const data=await response.json();if(!data.success||!data.user)throw Error('load');setAccount(data.user);}catch(e){if(!signal.aborted)setError(e instanceof Error&&e.message==='session'?'session':'load');}finally{if(!signal.aborted)setLoading(false);}},[]);
 useFocusEffect(useCallback(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]));
 const role=account?.role==='SUPER_ADMIN'?t('Super Admin','المشرف العام'):t('Administrator','مسؤول');
 const permissionLabels:Record<string,string>={MANAGE_MECHANICS:t('Mechanics management','إدارة الميكانيكيين'),MANAGE_SPARE_PARTS:t('Spare parts management','إدارة قطع الغيار'),MANAGE_TOWING:t('Towing management','إدارة السحب')};
 const confirmLogout=async()=>{if(loggingOut)return;try{setLoggingOut(true);await SecureStore.deleteItemAsync('motexa_access_token');setLogoutVisible(false);router.dismissAll();router.replace('/');}catch{setLogoutVisible(false);Alert.alert(t('Unable to sign out','تعذّر تسجيل الخروج'),t('Please try again.','يرجى المحاولة مجددًا.'));}finally{setLoggingOut(false);}};
 const surface=dark?'#352A22':'#FFFAF1',border=dark?'#6B523D':'#E3CEAF',soft=dark?'#493729':'#F1DEC3';
 const statusLabels:Record<string,string>={ACTIVE:t('Active','مفعّل'),PENDING:t('Pending','قيد الانتظار'),SUSPENDED:t('Suspended','معلّق'),REJECTED:t('Rejected','مرفوض')};
 const fields=account?[{label:t('Full name','الاسم الكامل'),value:account.fullName,icon:'person-outline' as const},{label:t('Email address','البريد الإلكتروني'),value:account.email,icon:'mail-outline' as const},{label:t('Account role','دور الحساب'),value:role,icon:'shield-outline' as const}]:[];
 return <View style={{flex:1}}><CanvasFill/>
 <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load(new AbortController().signal)}/>} contentContainerStyle={{paddingTop:insets.top+7,paddingHorizontal:18,paddingBottom:insets.bottom+36,maxWidth:700,width:'100%',alignSelf:'center'}}>
  <View style={{flexDirection:'row',direction:'ltr',alignItems:'center',gap:8,marginBottom:10}}>
   <Button accessibilityRole="button" accessibilityLabel={t('Back','رجوع')} onPress={()=>router.back()} style={{width:34,height:40,borderRadius:20,backgroundColor:'transparent',alignItems:'center',justifyContent:'center'}}><Ionicons name={isArabic?'arrow-forward':'arrow-back'} size={20} color={ink}/></Button>
   <BrandWordmark size={18} style={{flex:1}}/><LanguageSwitch compact unified/>
   
  </View>
  <View style={{marginHorizontal:-18,marginBottom:18}}><CurvedPhotoHero eyebrow="MOTEXA / ACCOUNT" title={t('My profile','ملفي الشخصي')} caption={account?.fullName||t('Your account','حسابك')} description={t('Your account details and access','بيانات حسابك وصلاحيات الوصول')}/></View>
  {loading?<LoadingState rows={2} label={t("Loading your account…","جارٍ تحميل حسابك…")}/>:error?<View style={{padding:24,borderRadius:28,backgroundColor:surface,gap:12}}><Ionicons name="alert-circle-outline" size={28} color={muted}/><Heading style={{color:ink,fontSize:20,lineHeight:28}}>{t('Let’s reconnect','لنُعِد الاتصال')}</Heading><Text style={{color:muted,lineHeight:24}}>{error==='session'?t('Your session expired. Sign out and sign in again.','انتهت الجلسة. سجّل الخروج ثم ادخل مجددًا.'):t('Pull down to load your account again.','اسحب لأسفل لإعادة تحميل حسابك.')}</Text></View>:account&&<>
   <View style={{backgroundColor:surface,borderRadius:25,borderWidth:1,borderColor:border,padding:20,marginBottom:24,gap:13}}>
    <View style={[direction,{alignItems:'center',justifyContent:'space-between',gap:10}]}><Text style={{color:ink,fontSize:15,fontWeight:'600'}}>{role}</Text><View style={{borderRadius:20,paddingHorizontal:12,paddingVertical:6,backgroundColor:account.status==='ACTIVE'?(dark?'#314635':'#E6EFE2'):soft}}><Text style={{fontSize:11,color:account.status==='ACTIVE'?(dark?'#CBE7CE':'#315F39'):muted}}>{statusLabels[account.status]||account.status}</Text></View></View>
    <View style={[direction,{alignItems:'center',gap:10}]}><Ionicons name="mail-outline" size={18} color={muted}/><Text selectable style={{flex:1,fontSize:13,lineHeight:23,color:muted,writingDirection:'ltr',textAlign:isArabic?'right':'left'}}>{account.email}</Text></View>
   </View>
   <SectionCaption index='01' title={t('ACCOUNT INFORMATION','معلومات الحساب')}/><View style={{height:14}}/>
   <View style={{backgroundColor:surface,borderRadius:25,paddingHorizontal:20,borderWidth:1,borderColor:border,marginBottom:22,shadowColor:'#765133',shadowOffset:{width:0,height:4},shadowRadius:12,shadowOpacity:dark?0.12:0.05,elevation:2}}>
    {fields.filter(f=>f.icon!=='mail-outline').map((field,index)=><View key={field.icon} style={[direction,{paddingVertical:17,gap:12,alignItems:'center',borderTopWidth:index?1:0,borderTopColor:border}]}><View style={{width:36,height:36,borderRadius:12,backgroundColor:soft,alignItems:'center',justifyContent:'center'}}><Ionicons name={field.icon} size={18} color={muted}/></View><View style={{flex:1,gap:5}}><Text style={{fontSize:11,color:muted,textAlign:isArabic?'right':'left'}}>{field.label}</Text><Text selectable style={{fontSize:14,lineHeight:23,color:ink,textAlign:isArabic?'right':'left'}}>{field.value}</Text></View></View>)}
   </View>
   <SectionCaption index='02' title={t('ACCESS & PERMISSIONS','الوصول والصلاحيات')}/><View style={{height:14}}/>
   <View style={{backgroundColor:surface,borderRadius:25,padding:20,borderWidth:1,borderColor:border}}>
    <View style={[direction,{alignItems:'center',gap:10,marginBottom:12}]}><Ionicons name="shield-checkmark-outline" size={22} color={muted}/><Text style={{fontSize:15,fontWeight:'600',color:ink}}>{t('Workspace access','صلاحيات مساحة العمل')}</Text></View>
    <Text style={{color:muted,fontSize:13,lineHeight:24,textAlign:isArabic?'right':'left'}}>{account.role==='SUPER_ADMIN'?t('Administrator accounts, invitations, and platform oversight.','إدارة حسابات أدمن الأقسام والدعوات والإشراف على المنصة.'):t('Your assigned department permissions.','الصلاحيات المسندة إليك ضمن قسمك.')}</Text>
    {account.role!=='SUPER_ADMIN'&&<View style={{gap:8,marginTop:14}}>{account.adminPermissions?.length?account.adminPermissions.map(item=>{const p=typeof item==='string'?{permission:item}:item;return <View key={p.permission} style={[direction,{backgroundColor:soft,borderRadius:14,padding:12,gap:8,alignItems:'center'}]}><Ionicons name="checkmark" size={17} color={muted}/><Text style={{color:ink,fontSize:13,flex:1}}>{permissionLabels[p.permission]||p.permission}</Text></View>}):<Text style={{color:muted,fontSize:13}}>{t('No department permissions assigned.','لم تُسند صلاحيات قسم لهذا الحساب.')}</Text>}</View>}
   </View>
   <View style={[direction,{alignItems:'center',justifyContent:'center',gap:7,marginTop:24}]}><Ionicons name="lock-closed-outline" size={13} color={muted}/><Text style={{color:muted,fontSize:11}}>{t('Your personal MOTEXA workspace','مساحتك الشخصية في MOTEXA')}</Text></View>
  </>}
 <Button accessibilityRole="button" disabled={loggingOut} onPress={()=>setLogoutVisible(true)} style={{marginTop:22,minHeight:50,borderRadius:25,borderWidth:1,borderColor:dark?'#896044':'#D4AF8A',backgroundColor:dark?'#493126':'#F4E2D1',flexDirection:isArabic?'row-reverse':'row',alignItems:'center',justifyContent:'center',gap:9,opacity:loggingOut?0.6:1}}><Ionicons name="log-out-outline" size={21} color={dark?'#EDC1A2':'#864B31'}/><Text style={{fontSize:14,fontWeight:'600',color:dark?'#EDC1A2':'#864B31'}}>{t('Sign out','تسجيل الخروج')}</Text></Button>
 </ScrollView>
 <MotexaDialog icon="log-out-outline" visible={logoutVisible} type="warning" title={t('Sign out?','تسجيل الخروج؟')} message={t('You can sign in again whenever you’re ready.','يمكنك العودة وتسجيل الدخول في أي وقت.')} confirmText={t('Sign out','تسجيل الخروج')} cancelText={t('Stay here','البقاء هنا')} loading={loggingOut} onConfirm={confirmLogout} onCancel={()=>{if(!loggingOut)setLogoutVisible(false);}}/>
 </View>;
}

