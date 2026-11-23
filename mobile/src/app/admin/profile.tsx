import {useCallback,useRef,useState} from 'react';
import {Alert,Image,RefreshControl,ScrollView,StyleSheet,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import BrandHeader from '../../components/BrandHeader';
import BrandMonogram from '../../components/BrandMonogram';
import WorkspaceHeading from '../../components/WorkspaceHeading';
import Input from '../../components/PremiumTextInput';
import Pressable from '../../components/MotionPressable';
import SignOutAction from '../../components/SignOutAction';
import MotexaDialog from '../../components/MotexaDialog';
import {Text} from '../../components/MotexaVisual';
import {CanvasFill} from '../../components/BrandSurfaces';
import {useAppearance} from '../../components/Appearance';
import {useLanguage} from '../../i18n/LanguageContext';
import * as Session from '../../components/SessionStore';

type Account={fullName:string;email:string;role:string;status:string;adminPermissions?:({permission:string}|string)[]};
async function accountRequest(method:'GET'|'PATCH',signal:AbortSignal,fullName?:string){
 const token=await Session.getItemAsync('motexa_access_token'),base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');
 if(!token||!base)throw Error('session');
 const response=await fetch(base+'/api/auth/'+(method==='GET'?'me':'profile'),{method,signal,headers:{Authorization:'Bearer '+token,...(method==='PATCH'?{'Content-Type':'application/json'}:{})},...(method==='PATCH'?{body:JSON.stringify({fullName})}:{})});
 if(response.status===401||response.status===403)throw Error('session');
 if(!response.ok)throw Error('request');const data=await response.json();if(!data.success||!data.user)throw Error('request');return data.user as Account;
}
export default function ProfileScreen(){
 const {dark}=useAppearance(),{isArabic:ar}=useLanguage(),insets=useSafeAreaInsets();
 const [photoWidth,setPhotoWidth]=useState(0);
 const [account,setAccount]=useState<Account|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[editing,setEditing]=useState(false),[draft,setDraft]=useState(''),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[logout,setLogout]=useState(false),[loggingOut,setLoggingOut]=useState(false),[reload,setReload]=useState(0);
 const generation=useRef(0),saveController=useRef<AbortController|null>(null);
 const t=(en:string,arabic:string)=>ar?arabic:en,ink=dark?'#FFF1DF':'#432D1E',muted=dark?'#D8BE9B':'#80664E',surface=dark?'#392B21':'#FFF9EF',border=dark?'#806044':'#DFC7A7',soft=dark?'#60432C':'#EDD5B2',row=ar?'row-reverse' as const:'row' as const,align=ar?'right' as const:'left' as const;
 useFocusEffect(useCallback(()=>{
  const controller=new AbortController(),current=++generation.current;setLoading(true);setError('');setEditing(false);setNotice('');setSaving(false);
  const timeout=setTimeout(()=>controller.abort(),15000);
  void accountRequest('GET',controller.signal).then(user=>{if(current===generation.current)setAccount(user);}).catch(e=>{if(current===generation.current)setError(e instanceof Error?e.message:'request');}).finally(()=>{clearTimeout(timeout);if(current===generation.current)setLoading(false);});
  return()=>{generation.current++;controller.abort();saveController.current?.abort();};
 // Explicit refresh invalidates the account request.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[reload]));
 async function save(){
  if(saving)return;const name=draft.trim().replace(/\s+/g,' ');if(name.length<2||name.length>120){setNotice('invalid');return;}
  const current=generation.current,controller=new AbortController();saveController.current=controller;const timeout=setTimeout(()=>controller.abort(),15000);setSaving(true);setNotice('');
  try{const user=await accountRequest('PATCH',controller.signal,name);if(current===generation.current){setAccount(user);setEditing(false);setNotice('saved');}}
  catch(e){if(current===generation.current)setNotice(e instanceof Error&&e.message==='session'?'session':'failed');}
  finally{clearTimeout(timeout);if(current===generation.current)setSaving(false);}
 }
 async function confirmLogout(){if(loggingOut)return;setLoggingOut(true);try{await Session.deleteItemAsync('motexa_access_token');setLogout(false);router.dismissAll();router.replace('/');}catch{setLogout(false);Alert.alert(t('Unable to sign out','تعذّر تسجيل الخروج'),t('Please try again.','يرجى المحاولة مجددًا.'));}finally{setLoggingOut(false);}}
 const card={borderWidth:1,borderColor:border,borderRadius:27,backgroundColor:surface,padding:18,gap:12};
 const role=account?.role==='SUPER_ADMIN'?t('Super Admin','السوبر أدمن'):t('Administrator','أدمن قسم');
 const permissions:Record<string,string>={MANAGE_MECHANICS:t('Mechanics management','إدارة الميكانيكيين'),MANAGE_SPARE_PARTS:t('Spare parts management','إدارة قطع الغيار'),MANAGE_TOWING:t('Towing management','إدارة الونشات')};
 const initials=account?.fullName.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')??'M';
 return <View style={{flex:1}}><CanvasFill/><ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>{if(!saving)setReload(value=>value+1);}}/>} contentContainerStyle={{paddingTop:insets.top+2,paddingHorizontal:18,paddingBottom:insets.bottom+28,width:'100%',maxWidth:700,alignSelf:'center',gap:10}}>
  <BrandHeader onBack={()=>router.canGoBack()?router.back():router.replace('/admin')} backDisabled={saving}/>
  <View style={{marginTop:-13,marginBottom:-9}}><WorkspaceHeading eyebrow={t('MOTEXA / PERSONAL WORKSPACE','MOTEXA / المساحة الشخصية')} title={t('Your place in MOTEXA.','حسابك، بهويتك.')} description={t('Your identity, access and personal preferences.','هويتك وصلاحياتك وتفضيلاتك الشخصية.')}/></View>
  <View style={{borderRadius:31,borderWidth:1,borderColor:border,overflow:'hidden',backgroundColor:surface,marginBottom:5}}>
   <View onLayout={event=>setPhotoWidth(event.nativeEvent.layout.width)} style={{height:photoWidth?photoWidth*.65:185,overflow:'hidden',backgroundColor:'#39291E'}}>
    {photoWidth>0&&<Image accessible={false} source={require('../../../assets/images/profile-gclass-d-panyukov.jpg')} resizeMode="cover" style={{position:'absolute',width:'100%',height:photoWidth*1.25,top:-photoWidth*.48}}/>}
    <LinearGradient pointerEvents="none" colors={['#21171000','#21171000','#21171099']} locations={[0,.58,1]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',bottom:15,left:16,right:16,flexDirection:row,alignItems:'center',gap:8}}><Ionicons name="shield-checkmark-outline" size={17} color="#FFF1DF"/><Text style={{fontSize:11,lineHeight:21,color:'#FFF1DF'}}>{t('Your personal MOTEXA workspace','مساحتك الشخصية في MOTEXA')}</Text></View>
   </View>
   {!!account&&!loading&&!error&&<View style={{paddingHorizontal:18,paddingTop:16,paddingBottom:18,gap:12,overflow:'hidden'}}>
    <BrandMonogram size={190} style={{top:-38,left:undefined,right:-29,opacity:.035}}/>
    <View style={{flexDirection:row,alignItems:'center',gap:12}}><View style={{width:49,height:54,borderRadius:18,backgroundColor:soft,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:20,lineHeight:30,color:ink}}>{initials}</Text></View><View style={{flex:1,minWidth:0,gap:2}}><Text accessibilityRole="header" style={{fontSize:20,lineHeight:31,fontWeight:'600',color:ink,textAlign:align}}>{account.fullName}</Text><Text style={{fontSize:12,lineHeight:22,color:muted,textAlign:align}}>{role}</Text></View></View>
    <View style={{flexDirection:row,alignItems:'center',gap:7,paddingTop:10,borderTopWidth:1,borderColor:border}}><View style={{width:6,height:6,borderRadius:3,backgroundColor:account.status==='ACTIVE'?(dark?'#ACD8B3':'#35734A'):'#B16C50'}}/><Text style={{fontSize:11,lineHeight:21,color:muted}}>{account.status==='ACTIVE'?t('Active account','حساب مفعّل'):t('Account status: ','حالة الحساب: ')+account.status}</Text></View>
   </View>}
  </View>
  {loading?<Text accessibilityLiveRegion="polite" style={{color:muted,lineHeight:25}}>{t('Loading your account…','جارٍ تحميل حسابك…')}</Text>:error?<View style={card}><Ionicons name="alert-circle-outline" size={25} color={muted}/><Text style={{color:ink,lineHeight:24,textAlign:align}}>{error==='session'?t('Your session expired. Sign in again.','انتهت صلاحية الجلسة. سجّل الدخول مجددًا.'):t('Account could not be loaded.','تعذّر تحميل الحساب.')}</Text><Pressable accessibilityRole="button" onPress={()=>error==='session'?router.replace('/auth/login'):setReload(value=>value+1)} style={{minHeight:46,borderRadius:23,backgroundColor:soft,alignItems:'center',justifyContent:'center'}}><Text style={{color:ink}}>{error==='session'?t('Sign in','تسجيل الدخول'):t('Retry','إعادة المحاولة')}</Text></Pressable></View>:account&&<>
   <View style={card}>
    <View style={{flexDirection:row,alignItems:'center',gap:10,borderBottomWidth:1,borderColor:border,paddingBottom:9}}><View style={{width:35,height:35,borderRadius:13,backgroundColor:soft,alignItems:'center',justifyContent:'center'}}><Ionicons name="person-outline" size={18} color={muted}/></View><Text accessibilityRole="header" style={{flex:1,fontSize:16,lineHeight:27,fontWeight:'600',color:ink,textAlign:align}}>{t('Personal details','البيانات الشخصية')}</Text>{!editing&&<Pressable accessibilityRole="button" accessibilityLabel={t('Edit name','تعديل الاسم')} onPress={()=>{setDraft(account.fullName);setEditing(true);setNotice('');}} style={{minWidth:50,minHeight:44,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:soft}}><Ionicons name="create-outline" size={19} color={ink}/></Pressable>}</View>
    <Text style={{fontSize:11,lineHeight:21,color:muted,textAlign:align}}>{t('Full name','الاسم الكامل')}</Text>
    {editing?<><Input accessibilityLabel={t('Full name','الاسم الكامل')} value={draft} onChangeText={setDraft} editable={!saving} maxLength={120} style={{minHeight:53,borderWidth:1,borderColor:border,borderRadius:21,paddingHorizontal:13,fontSize:14,color:ink,textAlign:align}}/><View style={{flexDirection:row,gap:9}}><Pressable accessibilityRole="button" disabled={saving} onPress={()=>void save()} style={{flex:1,minHeight:48,borderRadius:23,backgroundColor:soft,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13,color:ink}}>{saving?t('Saving…','جارٍ الحفظ…'):t('Save name','حفظ الاسم')}</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={()=>{setEditing(false);setNotice('');}} style={{minWidth:75,minHeight:48,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13,color:muted}}>{t('Cancel','إلغاء')}</Text></Pressable></View></>:<Text style={{fontSize:15,lineHeight:25,color:ink,textAlign:align}}>{account.fullName}</Text>}
    {!!notice&&<Text accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:23,color:notice==='saved'?(dark?'#ACD8B3':'#28613D'):muted,textAlign:align}}>{notice==='saved'?t('Your name has been saved.','تم حفظ اسمك.'):notice==='invalid'?t('Use 2–120 characters.','استخدم من حرفين إلى 120 حرفًا.'):notice==='session'?t('Your session expired. Sign in again.','انتهت صلاحية الجلسة. سجّل الدخول مجددًا.'):t('Changes were not saved. Please retry.','لم يتم حفظ التغييرات. حاول مجددًا.')}</Text>}
    <View style={{borderTopWidth:1,borderColor:border,paddingTop:12,gap:5}}><Text style={{fontSize:11,lineHeight:21,color:muted,textAlign:align}}>{t('Email address · Read only','البريد الإلكتروني · للعرض فقط')}</Text><Text selectable style={{fontSize:13,lineHeight:24,color:ink,writingDirection:'ltr',textAlign:align}}>{account.email}</Text></View>
   </View>
   <View style={[card,{backgroundColor:dark?'#483224':'#F0DFC6'}]}><View style={{flexDirection:row,gap:10,alignItems:'center'}}><View style={{width:36,height:36,borderRadius:14,borderWidth:1,borderColor:border,alignItems:'center',justifyContent:'center'}}><Ionicons name="shield-checkmark-outline" size={20} color={muted}/></View><Text accessibilityRole="header" style={{fontSize:16,lineHeight:27,color:ink,fontWeight:'600'}}>{t('Assigned access','الصلاحيات المعيّنة')}</Text></View><Text style={{fontSize:12,lineHeight:24,color:muted,textAlign:align}}>{account.role==='SUPER_ADMIN'?t('Platform-wide administration and oversight.','إدارة وإشراف شاملان على المنصّة.'):(account.adminPermissions??[]).map(p=>{const key=typeof p==='string'?p:p.permission;return permissions[key]??key;}).join(' · ')||t('No department access assigned.','لا توجد صلاحيات قسم معيّنة.')}</Text><Text style={{fontSize:10,lineHeight:21,color:muted,textAlign:align}}>{t('Role and permissions cannot be changed from your profile.','لا يمكن تغيير الدور أو الصلاحيات من الملف الشخصي.')}</Text></View>
  </>}
  <SignOutAction disabled={saving||loggingOut} onPress={()=>setLogout(true)}/>
 </ScrollView><MotexaDialog icon="log-out-outline" visible={logout} type="warning" title={t('Sign out?','تسجيل الخروج؟')} message={t('You can sign in again whenever you’re ready.','يمكنك العودة وتسجيل الدخول في أي وقت.')} confirmText={t('Sign out','تسجيل الخروج')} cancelText={t('Stay here','البقاء هنا')} loading={loggingOut} onConfirm={confirmLogout} onCancel={()=>{if(!loggingOut)setLogout(false);}}/></View>;
}
