import {useCallback,useState} from "react";
import {ActivityIndicator,RefreshControl,ScrollView,StyleSheet,TextInput,View} from "react-native";
import {useFocusEffect} from "expo-router";
import * as SecureStore from "expo-secure-store";
import {Ionicons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Text} from "../../../components/MotexaVisual";
import {CanvasFill,PanelFill} from "../../../components/BrandSurfaces";
import {useAppearance} from "../../../components/Appearance";
import LanguageSwitch from "../../../components/LanguageSwitch";
import Button from "../../../components/InteractiveButton";
import {useLanguage} from "../../../i18n/LanguageContext";
type Provider={id:string;fullName:string;email:string;role:string;status:string;mechanicProfile:{verificationStatus:string}|null};
const categories=[{role:'ALL',en:'All',ar:'الكل'},{role:'MECHANIC',en:'Mechanics',ar:'الميكانيكيون'},{role:'PARTS_PROVIDER',en:'Parts',ar:'القطع'},{role:'TOW_PROVIDER',en:'Towing',ar:'السحب'}];
export default function ProvidersScreen(){
 const {dark}=useAppearance();const {isArabic}=useLanguage();const insets=useSafeAreaInsets();
 const [rows,setRows]=useState<Provider[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState(''),[category,setCategory]=useState('ALL');
 const text=(en:string,ar:string)=>isArabic?ar:en;
 const ink=dark?'#FFF1DE':'#35271D',muted=dark?'#CFB99D':'#735C45';
 const load=useCallback(async(signal:AbortSignal)=>{setLoading(true);setError('');try{
  const token=await SecureStore.getItemAsync('motexa_access_token');const base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');
  if(!token||!base)throw Error('session');
  const response=await fetch(`${base}/api/admin-management/providers`,{headers:{Authorization:`Bearer ${token}`},signal});
  if(response.status===401)throw Error('session');if(!response.ok)throw Error('load');
  const data=await response.json();if(!data.success||!Array.isArray(data.providers))throw Error('load');setRows(data.providers);
 }catch(e){if(!signal.aborted)setError(e instanceof Error&&e.message==='session'?'session':'load');}finally{if(!signal.aborted)setLoading(false);}},[]);
 useFocusEffect(useCallback(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]));
 const refresh=()=>{const controller=new AbortController();void load(controller.signal);};
 const filtered=rows.filter(p=>(category==='ALL'||p.role===category)&&`${p.fullName} ${p.email}`.toLowerCase().includes(search.trim().toLowerCase()));
 const direction={flexDirection:isArabic?'row-reverse' as const:'row' as const};
 const status=(s:string)=>({ACTIVE:text('Active','مفعّل'),PENDING:text('Pending','بانتظار المراجعة'),SUSPENDED:text('Suspended','معلّق'),REJECTED:text('Rejected','مرفوض'),VERIFIED:text('Verified','معتمد'),NEEDS_COMPLETION:text('Needs completion','يحتاج استكمال')}[s]||s);
 return <View style={{flex:1}}><CanvasFill/><ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh}/>} contentContainerStyle={{paddingHorizontal:20,paddingTop:insets.top+12,paddingBottom:130+insets.bottom,maxWidth:760,width:'100%',alignSelf:'center'}} keyboardShouldPersistTaps="handled">
  <View style={[direction,{justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:22}]}><Text style={{color:muted,letterSpacing:2,fontSize:12,fontWeight:'700'}}>MOTEXA</Text><LanguageSwitch compact/></View>
  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{color:ink,fontSize:30,lineHeight:42,fontWeight:'700',textAlign:isArabic?'right':'left'}}>{text('Providers','مزودو الخدمة')}</Text>
  <Text style={{color:muted,fontSize:14,lineHeight:23,marginTop:5,marginBottom:20,textAlign:isArabic?'right':'left'}}>{text('Your service network, in one place.','شبكة خدماتك، في مكان واحد.')}</Text>
  <View style={[styles.summary,direction]}><PanelFill kind="hero" radius={24}/>{[{en:'Providers',ar:'مزود خدمة',value:rows.length},{en:'Active accounts',ar:'حسابات مفعّلة',value:rows.filter(p=>p.status==='ACTIVE').length}].map(item=><View key={item.en} style={{flex:1,gap:5,alignItems:'center'}}><Text style={{color:'#FFF5E7',fontSize:28,fontWeight:'600'}}>{loading||error?'—':item.value}</Text><Text style={{color:'#DEC5A6',fontSize:12}}>{text(item.en,item.ar)}</Text></View>)}</View>
  <View style={[styles.search,direction,{backgroundColor:dark?'#3A2E24':'#FFF8ED'}]}><Ionicons name="search-outline" size={20} color={muted}/><TextInput value={search} onChangeText={setSearch} placeholder={text('Search by name or email','ابحث بالاسم أو البريد')} placeholderTextColor={muted} accessibilityLabel={text('Search providers','البحث عن مزود خدمة')} style={{flex:1,color:ink,fontSize:14,minHeight:48,textAlign:isArabic?'right':'left'}}/></View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:20}}>{categories.map(c=><Button key={c.role} onPress={()=>setCategory(c.role)} accessibilityRole="button" accessibilityState={{selected:category===c.role}} style={{minHeight:42,paddingHorizontal:16,borderRadius:22,justifyContent:'center',backgroundColor:category===c.role?(dark?'#DDB47D':'#493020'):(dark?'#3A2E24':'#EAD8BF')}}><Text style={{color:category===c.role?(dark?'#35271D':'#FFF3E2'):ink,fontSize:13}}>{text(c.en,c.ar)}</Text></Button>)}</ScrollView>
  {loading?<ActivityIndicator color={muted}/>:error?<View style={styles.card}><PanelFill radius={22}/><Text style={{color:ink,lineHeight:24}}>{error==='session'?text('Session expired. Sign out and sign in again.','انتهت الجلسة. سجّل الخروج ثم ادخل مجددًا.'):text('Could not load providers. Pull down to retry.','تعذّر تحميل المزودين. اسحب لأسفل للمحاولة مجددًا.')}</Text></View>:filtered.length===0?<View style={styles.card}><PanelFill radius={22}/><Ionicons name="people-outline" size={30} color={muted}/><Text style={{color:ink,fontSize:16,marginTop:12}}>{text('No providers found','لا يوجد مزودو خدمة')}</Text><Text style={{color:muted,lineHeight:22,marginTop:6}}>{text('Accounts will appear here when registered in MOTEXA.','تظهر الحسابات هنا بعد تسجيلها في MOTEXA.')}</Text></View>:filtered.map(p=><View key={p.id} style={[styles.card,{backgroundColor:dark?'#362A21':'#FFF8ED'}]}><View style={[direction,{alignItems:'center',gap:12}]}><View style={{width:46,height:46,borderRadius:15,backgroundColor:dark?'#654B31':'#E4C8A1',alignItems:'center',justifyContent:'center'}}><Ionicons name={p.role==='MECHANIC'?'construct-outline':p.role==='PARTS_PROVIDER'?'cube-outline':'car-outline'} size={22} color={dark?'#F5D2A1':'#624126'}/></View><View style={{flex:1}}><Text style={{color:ink,fontSize:16,fontWeight:'600',textAlign:isArabic?'right':'left'}}>{p.fullName}</Text><Text style={{color:muted,fontSize:12,marginTop:4,textAlign:isArabic?'right':'left'}}>{text(categories.find(c=>c.role===p.role)?.en||p.role,categories.find(c=>c.role===p.role)?.ar||p.role)}</Text></View></View><Text selectable style={{color:muted,fontSize:13,marginTop:14,writingDirection:'ltr'}}>{p.email}</Text><View style={[direction,{flexWrap:'wrap',gap:8,marginTop:14}]}><Text style={{color:ink,fontSize:12}}>{text('Account: ','الحساب: ')}{status(p.status)}</Text>{p.mechanicProfile&&<Text style={{color:muted,fontSize:12}}>{text('Verification: ','الاعتماد: ')}{status(p.mechanicProfile.verificationStatus)}</Text>}</View></View>)}
 </ScrollView></View>;
}
const styles=StyleSheet.create({summary:{paddingVertical:22,borderRadius:24,overflow:'hidden',marginBottom:20},search:{alignItems:'center',gap:10,borderRadius:17,paddingHorizontal:14,marginBottom:14},card:{padding:18,borderRadius:22,overflow:'hidden',marginBottom:12}});
