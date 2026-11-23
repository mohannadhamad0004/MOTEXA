import OwnerServicePortal from './OwnerServicePortal';
import OwnerPreviewNavigator from './OwnerPreviewNavigator';
import WorkshopJourneyPreview from './WorkshopJourneyPreview';
import OwnerLoading from './OwnerLoading';
import {OwnerButton as MechanicButton} from './OwnerControls';
import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,View} from 'react-native';
import {router,useFocusEffect,useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import CustomerType from './CustomerType';
import OwnerWorkspacePage from './OwnerWorkspacePage';
import {Text} from './MotexaVisual';
import {MechanicNote,useMechanicTheme} from './MechanicUI';
import FloatingRoleTabs from './FloatingRoleTabs';
import CustomerServiceDock from './CustomerServiceDock';
import CustomerServiceModes from './CustomerServiceModes';
import CustomerJourneyMotion from './CustomerJourneyMotion';
import CustomerRoadBackdrop from './CustomerRoadBackdrop';
import CustomerAccount from './CustomerAccount';
import CustomerRequests from './CustomerRequests';
import OwnerHome from './OwnerHome';
import OwnerGarage from './OwnerGarage';
import {OwnerIconButton} from './OwnerUI';
import {OwnerMechanicDirectory,OwnerMechanicProfile} from './OwnerMechanics';
import OwnerBooking,{OwnerRequestSent,type OwnerBookingValues} from './OwnerBooking';
import {vehicleName,type OwnerVehicle,type OwnerVehicleInput,type OwnerMechanic,type OwnerRequest,type OwnerAccount,type OwnerTransport} from './OwnerTypes';
import {mechanicApi,MechanicApiError} from './mechanic-api';
import {createCustomerPreviewApi} from './customer-preview-api';
import * as Store from './SessionStore';
import Pressable from './MotionPressable';

type Page='home'|'garage'|'requests'|'account'|'modes'|'mechanics'|'profile'|'request'|'review'|'submitted'|'soon'|'preview-map';
const key=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
const initialBooking:OwnerBookingValues={title:'',description:'',phone:'',address:''};

export default function OwnerWorkspace({previewOnly=false}:{previewOnly?:boolean}){return previewOnly?<CustomerType><Workspace preview/></CustomerType>:<CustomerType><Workspace preview={false}/></CustomerType>;}
function Workspace({preview}:{preview:boolean}){
 const m=useMechanicTheme(),t=m.t;const [demo]=useState(()=>preview?createCustomerPreviewApi(m.ar):null),api:OwnerTransport=demo||mechanicApi;
 const {screen}=useLocalSearchParams<{screen?:string}>();
 const [garageDetails,setGarageDetails]=useState(false);
 const [soonKey,setSoonKey]=useState<'ai'|'parts'|'towing'>('ai');
 const [page,setPage]=useState<Page>(preview&&screen==='garage'?'garage':'home'),[account,setAccount]=useState<OwnerAccount>({fullName:'',phoneNumber:null,email:''}),[vehicles,setVehicles]=useState<OwnerVehicle[]>([]),[selectedId,setSelectedId]=useState(''),[requests,setRequests]=useState<OwnerRequest[]>([]);
 const [loaded,setLoaded]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[authError,setAuthError]=useState(false),[focused,setFocused]=useState(true),[paused,setPaused]=useState(false),[expanded,setExpanded]=useState(false);
 const [mode,setMode]=useState('WORKSHOP'),[city,setCity]=useState(''),[mechanics,setMechanics]=useState<OwnerMechanic[]>([]),[searching,setSearching]=useState(false),[searched,setSearched]=useState(false),[professional,setProfessional]=useState<OwnerMechanic|null>(null),[booking,setBooking]=useState<OwnerBookingValues>(initialBooking),[lastSent,setLastSent]=useState<OwnerRequest|null>(null),[cancelId,setCancelId]=useState('');

 const operating=useRef(false),pendingLoad=useRef(false),loadEpoch=useRef(0),searchEpoch=useRef(0),firstLoaded=useRef(false),carKey=useRef({body:'',id:''}),requestKey=useRef({body:'',id:''});
 const vehicle=vehicles.find(v=>v.id===selectedId)||vehicles.find(v=>v.isActive)||vehicles[0];
 const message=(e:unknown)=>{if(e instanceof MechanicApiError){if(e.status===401)return t('Your session expired. Sign in to continue.','انتهت جلستك. سجّل الدخول للمتابعة.');if(e.status===403)return t('This action is unavailable. Refresh and review your selection.','هذا الإجراء غير متاح. حدّث البيانات وراجع اختيارك.');if(e.status===404)return t('This item is no longer available. Refresh and choose again.','هذا الخيار لم يعد متاحًا. حدّث الصفحة واختر مجددًا.');if(e.status===409)return t('The details changed. Refresh and review them before retrying.','تغيّرت البيانات. حدّثها وراجعها قبل إعادة المحاولة.');if(e.status===400)return t('Review the required details and try again.','راجع البيانات المطلوبة وحاول مجددًا.');}return t('Could not connect. Your saved data remains in your account. Try again.','تعذر الاتصال. بياناتك المحفوظة باقية بحسابك. حاول مجددًا.');};
 function report(e:unknown){setError(message(e));if(e instanceof MechanicApiError&&e.status===401)setAuthError(true);}
 const load=useCallback(async()=>{
  if(pendingLoad.current)return;pendingLoad.current=true;const epoch=++loadEpoch.current;setLoading(true);
  try{const me=await api<{user:{role:string}}>('/api/auth/me');if(me.user.role!=='CUSTOMER')throw new MechanicApiError('Car owner account required.',403);const [a,v,r]=await Promise.all([api<{account:OwnerAccount}>('/api/customer/account'),api<{vehicles:OwnerVehicle[]}>('/api/customer/vehicles'),api<{requests:OwnerRequest[]}>('/api/service-requests/customer')]);if(epoch!==loadEpoch.current)return;setAccount(a.account);setVehicles(v.vehicles);setSelectedId((v.vehicles.find(v=>v.isActive)||v.vehicles[0])?.id||'');setRequests(r.requests);setBooking(old=>({...old,phone:old.phone||a.account.phoneNumber||''}));if(!preview&&!firstLoaded.current&&!v.vehicles.length)setPage('garage');firstLoaded.current=true;setLoaded(true);setAuthError(false);setError('');}
  catch(e){if(epoch===loadEpoch.current){setError(e instanceof MechanicApiError&&e.status===401?'SESSION_EXPIRED':e instanceof MechanicApiError&&e.status===403?'OWNER_ACCOUNT_REQUIRED':'LOAD_FAILED');if(e instanceof MechanicApiError&&[401,403].includes(e.status))setAuthError(true);}}
  finally{pendingLoad.current=false;if(epoch===loadEpoch.current)setLoading(false);}
 },[api,preview]);
 useFocusEffect(useCallback(()=>{setFocused(true);void load();return()=>{setFocused(false);loadEpoch.current++;searchEpoch.current++;};},[load]));
 useEffect(()=>{if(!focused||busy||preview||!loaded||!['home','requests'].includes(page))return;const timer=setInterval(()=>{if(AppState.currentState!=='background')void load();},15000),sub=AppState.addEventListener('change',state=>{if(state==='active')void load();});return()=>{clearInterval(timer);sub.remove();};},[focused,busy,preview,loaded,page,load]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(timer);},[notice]);
 async function previewStep(next:string){
  if(!preview)return;
  if(next==='signup'||next==='login'){router.push({pathname:next==='signup'?'/auth/signup':'/auth/login',params:{selectedRole:'customer'}});return;}
  if(next==='first-car'){setVehicles([]);setRequests([]);setSelectedId('');go('garage');return;}
  const sampleRequests=await api<{requests:OwnerRequest[]}>('/api/service-requests/customer');setRequests(sampleRequests.requests);const saved=await api<{vehicles:OwnerVehicle[]}>('/api/customer/vehicles');setVehicles(saved.vehicles);setSelectedId(saved.vehicles.find(v=>v.isActive)?.id||saved.vehicles[0]?.id||'');
  if(['profile','request','review','mechanics'].includes(next)){const result=await api<{mechanics:OwnerMechanic[]}>('/api/customer/mechanics?mode=WORKSHOP');setMode('WORKSHOP');setMechanics(result.mechanics);setSearched(true);setProfessional(result.mechanics[0]||null);setBooking({title:t('Engine inspection — sample','فحص المحرك — مثال'),description:t('Sample details for reviewing the request form.','تفاصيل تجريبية لمراجعة نموذج الطلب.'),phone:'0599999999',address:''});}
  if(next==='submitted'){const result=await api<{requests:OwnerRequest[]}>('/api/service-requests/customer');setLastSent({...result.requests[0],status:'NEW'});}
  go(next as Page);
 }
 function go(next:Page){setGarageDetails(false);searchEpoch.current++;setSearching(false);setExpanded(false);setCancelId('');setError('');setNotice('');setPage(next);}
 async function perform<T,>(task:()=>Promise<T>):Promise<T>{if(operating.current)throw Error(t('Wait for the current action.','انتظر اكتمال الإجراء الحالي.'));operating.current=true;setBusy(true);setError('');try{return await task();}catch(e){if(e instanceof MechanicApiError&&e.status===401)setAuthError(true);if(e instanceof MechanicApiError&&e.status===409)void load();throw new Error(message(e));}finally{operating.current=false;setBusy(false);}}
 async function selectVehicle(v:OwnerVehicle){await perform(async()=>{const data=await api<{vehicle:OwnerVehicle}>('/api/customer/vehicles/'+v.id+'/select','POST',{});setVehicles(old=>old.map(car=>car.id===data.vehicle.id?data.vehicle:{...car,isActive:false}));setSelectedId(data.vehicle.id);});}
 async function addVehicle(values:OwnerVehicleInput){const body=JSON.stringify(values);if(carKey.current.body!==body)carKey.current={body,id:key()};await perform(async()=>{const data=await api<{vehicle:OwnerVehicle}>('/api/customer/vehicles','POST',{...values,clientVehicleId:carKey.current.id});setVehicles(old=>[...old.filter(v=>v.id!==data.vehicle.id).map(v=>({...v,isActive:false})),data.vehicle]);setSelectedId(data.vehicle.id);carKey.current={body:'',id:''};go('home');setNotice(t('Your car is saved. Open the service launcher to begin.','تم حفظ سيارتك. افتح زر الخدمات للبدء.'));});}
 async function updateVehicle(v:OwnerVehicle,values:OwnerVehicleInput){await perform(async()=>{const data=await api<{vehicle:OwnerVehicle}>('/api/customer/vehicles/'+v.id,'PATCH',{...values,version:v.version});setVehicles(old=>old.map(car=>car.id===v.id?data.vehicle:car));setNotice(t('Vehicle details saved.','تم حفظ بيانات السيارة.'));});}
 async function removeVehicle(v:OwnerVehicle){await perform(async()=>{const data=await api<{vehicles:OwnerVehicle[]}>('/api/customer/vehicles/'+v.id,'DELETE',{version:v.version});setVehicles(data.vehicles);setSelectedId((data.vehicles.find(v=>v.isActive)||data.vehicles[0])?.id||'');setNotice(t('The vehicle was removed from your garage. Existing requests are unchanged.','تمت إزالة السيارة من سياراتك. الطلبات السابقة محفوظة.'));});}
 async function find(next=mode){const epoch=++searchEpoch.current;setSearching(true);setSearched(false);setMechanics([]);setError('');try{const data=await api<{mechanics:OwnerMechanic[]}>('/api/customer/mechanics?mode='+next+'&city='+encodeURIComponent(city.trim()));if(epoch===searchEpoch.current){setMechanics(data.mechanics);setSearched(true);}}catch(e){if(epoch===searchEpoch.current)report(e);}finally{if(epoch===searchEpoch.current)setSearching(false);}}
 function beginService(previous?:OwnerRequest){if(previous){setMode(previous.mode);setBooking({title:previous.title,description:previous.description||'',phone:previous.contactNumber||account.phoneNumber||'',address:previous.address||''});const oldVehicle=vehicles.find(v=>v.id===previous.vehicleId);if(oldVehicle&&oldVehicle.id!==vehicle?.id){void selectVehicle(oldVehicle).then(()=>go('modes')).catch(e=>setError(e.message));return;}}if(!vehicle){go('garage');return;}go('modes');}
 async function openProfile(p:OwnerMechanic){try{await perform(async()=>{const data=await api<{mechanic:OwnerMechanic}>('/api/customer/mechanics/'+p.userId+'?mode='+mode);setProfessional(data.mechanic);go('profile');});}catch(e){setError(e instanceof Error?e.message:message(e));}}
 function review(){if(!vehicle||!professional){setError(t('Choose your vehicle and mechanic first.','اختَر السيارة والميكانيكي أولًا.'));return;}if(booking.title.trim().length<3||booking.description.trim().length<5||!/^\+?[\d\s()-]{8,30}$/.test(booking.phone.trim())||(mode==='ON_SITE'&&booking.address.trim().length<3)){setError(t('Complete the title, problem description, valid phone and visit address when required.','أكمل عنوان الطلب ووصف المشكلة ورقم تواصل صحيح، وعنوان الزيارة عند الحاجة.'));return;}go('review');}
 async function send(){if(!vehicle||!professional)return;const values={mechanicId:professional.userId,vehicleId:vehicle.id,vehicle:vehicleName(vehicle),mode,title:booking.title.trim(),description:booking.description.trim(),contactNumber:booking.phone.trim(),address:mode==='ON_SITE'?booking.address.trim():''},body=JSON.stringify(values);if(requestKey.current.body!==body)requestKey.current={body,id:key()};try{await perform(async()=>{const data=await api<{request:OwnerRequest}>('/api/service-requests','POST',{...values,clientRequestId:requestKey.current.id});setRequests(old=>[data.request,...old.filter(r=>r.id!==data.request.id)]);setLastSent(data.request);requestKey.current={body:'',id:''};setBooking({...initialBooking,phone:account.phoneNumber||''});go('submitted');});}catch(e){setError(e instanceof Error?e.message:message(e));}}
 async function cancel(r:OwnerRequest){try{await perform(async()=>{const data=await api<{request:OwnerRequest}>('/api/service-requests/'+r.id+'/cancel','POST',{version:r.version});setRequests(old=>old.map(v=>v.id===r.id?data.request:v));setCancelId('');});}catch(e){setCancelId('');setError(e instanceof Error?e.message:message(e));}}
 const back=()=>go(page==='review'?'request':page==='request'?'profile':page==='profile'?'mechanics':page==='mechanics'?'modes':page==='submitted'?'requests':'home');
 const activeTab=['home','garage','requests','account'].includes(page)?page:'home';
 const displayError=error==='SESSION_EXPIRED'?t('Your session expired. Sign in to continue.','انتهت جلستك. سجّل الدخول للمتابعة.'):error==='OWNER_ACCOUNT_REQUIRED'?t('Sign in with a car owner account.','سجّل الدخول بحساب مالك مركبة.'):error==='LOAD_FAILED'?t('Could not load your saved journey. Try again.','تعذر تحميل بيانات رحلتك المحفوظة. حاول مجددًا.'):error;
 return <OwnerWorkspacePage scrollKey={page} title="" presentation="workspace" refreshing={loading} onRefresh={()=>void load()} backdrop={<CustomerRoadBackdrop paused={paused||!focused||['garage','request','review','account'].includes(page)}/>} contentOverlay={expanded?<Pressable accessibilityRole="button" accessibilityLabel={t('Close service menu','إغلاق قائمة الخدمات')} onPress={()=>setExpanded(false)} style={{position:'absolute',inset:0,zIndex:20,backgroundColor:m.dark?'#100A07B5':'#EADAC48A'}}/>:undefined} footer={loaded&&!authError?<>{page==='submitted'&&lastSent&&<View style={{paddingBottom:12}}><MechanicButton label={t('Track my request','متابعة طلبي')} onPress={()=>go('requests')} disabled={busy}/></View>}{page==='home'&&expanded&&<CustomerServiceDock expanded={expanded} onToggle={()=>{if(!busy)setExpanded(v=>!v);}} onMechanic={()=>{if(!busy)beginService();}} onSoon={service=>{if(busy)return;setSoonKey(service);go('soon');}}/>}<View testID="owner-navigation"><FloatingRoleTabs selected={activeTab} onSelect={v=>{if(!busy)go(v as Page);}} items={[{key:'home',icon:'home-outline',label:t('Home','الرئيسية')},{key:'garage',icon:'car-sport-outline',label:t('My cars','سياراتي')},{key:'requests',icon:'navigate-outline',label:t('My requests','طلباتي')},{key:'account',icon:'person-outline',label:t('Account','حسابي')}]}/></View></>:undefined}>
  {preview&&<OwnerPreviewNavigator current={page==='garage'&&!vehicles.length?'first-car':page} onSelect={v=>void previewStep(v).catch(report)}/>}
  {loaded&&!authError&&page!=='home'&&!['garage','requests','account'].includes(page)&&<View style={{paddingTop:13,flexDirection:m.row,alignItems:'center',justifyContent:'space-between'}}><OwnerIconButton disabled={busy} icon={m.ar?'arrow-forward':'arrow-back'} label={t('Back','رجوع')} onPress={back}/><Text style={{fontSize:9,letterSpacing:1.5,color:m.muted}}>MOTEXA / SERVICE</Text></View>}
  {!!displayError&&<View style={{paddingTop:15}}><MechanicNote error>{displayError}</MechanicNote></View>}{!!notice&&<View style={{paddingTop:13}}><MechanicNote>{notice}</MechanicNote></View>}
  {authError?<View style={{gap:19,paddingVertical:30}}><Ionicons name="lock-closed-outline" size={32} color={m.bronze}/><MechanicButton label={t('Sign in','تسجيل الدخول')} onPress={()=>router.replace({pathname:'/auth/login',params:{selectedRole:'customer'}})}/></View>:!loaded?<View style={{gap:22,paddingVertical:40}}>{loading?<OwnerLoading/>:<MechanicButton label={t('Try again','إعادة المحاولة')} onPress={()=>void load()}/>}</View>:<CustomerJourneyMotion key={page}>
   {preview&&page==='preview-map'&&<WorkshopJourneyPreview/>}
   {page==='home'&&<OwnerHome onVehicleDetails={()=>{go('garage');setGarageDetails(true);}} vehicles={vehicles} busy={busy} onSelectVehicle={selectVehicle} onService={service=>{setSoonKey(service);go('soon');}} name={account.fullName} vehicle={vehicle} requests={requests} paused={paused||!focused} onToggleMotion={()=>setPaused(v=>!v)} onMechanic={()=>beginService()} onServices={()=>vehicle?setExpanded(true):go('garage')} onGarage={()=>go('garage')} onRequests={()=>go('requests')}/>}
   {page==='garage'&&<OwnerGarage initialDetails={garageDetails} key={preview?(vehicle?.id||'empty'):'garage'} vehicles={vehicles} selected={vehicle} busy={busy} paused={paused||!focused} onSelect={selectVehicle} onAdd={addVehicle} onUpdate={updateVehicle} onRemove={removeVehicle} onUse={()=>beginService()}/>}
   {page==='modes'&&<CustomerServiceModes initialMode={mode} vehicle={vehicle?vehicleName(vehicle):undefined} paused={paused||!focused} onChoose={value=>{setMode(value);go('mechanics');void find(value);}}/>}
   {page==='mechanics'&&<OwnerMechanicDirectory onMode={value=>{setMode(value);void find(value);}} mode={mode} city={city} onCity={setCity} items={mechanics} searching={searching} searched={searched} busy={busy} onSearch={()=>void find()} onChangeMode={()=>go('modes')} onOpen={p=>void openProfile(p)}/>}
   {page==='profile'&&professional&&<OwnerMechanicProfile mechanic={professional} mode={mode} busy={busy} paused={paused||!focused} onRequest={()=>go('request')}/>}
   {(page==='request'||page==='review')&&vehicle&&professional&&<OwnerBooking paused={paused||!focused} vehicles={vehicles} onSelectVehicle={selectVehicle} vehicle={vehicle} mechanic={professional} mode={mode} values={booking} onChange={setBooking} busy={busy} onReview={review} onSend={()=>void send()} review={page==='review'} onEdit={()=>go('request')}/>}
   {page==='submitted'&&lastSent&&<OwnerRequestSent request={lastSent}/>}
   {page==='requests'&&<CustomerRequests preview={preview} paused={paused||!focused} requests={requests} loading={loading} busy={busy} cancelId={cancelId} onRefresh={()=>void load()} onFind={beginService} onAskCancel={setCancelId} onKeep={()=>setCancelId('')} onCancel={r=>void cancel(r)}/>}
   {page==='account'&&<CustomerAccount vehicle={vehicle} name={account.fullName} email={account.email} phone={account.phoneNumber||''} vehicleCount={vehicles.length} requestCount={requests.length} onGarage={()=>go('garage')} onRequests={()=>go('requests')} onSave={async(fullName,phoneNumber)=>{await perform(async()=>{const data=await api<{account:OwnerAccount}>('/api/customer/account','PATCH',{fullName,phoneNumber});setAccount(data.account);setBooking(old=>({...old,phone:phoneNumber}));});}} onSignOut={()=>{if(preview){go('home');return;}void Store.deleteItemAsync('motexa_access_token').then(()=>router.replace('/choose-role')).catch(report);}}/>}
   {page==='soon'&&<OwnerServicePortal service={soonKey} onBack={()=>go('home')} onMechanic={()=>beginService()}/>}
  </CustomerJourneyMotion>}
 </OwnerWorkspacePage>;
}
