import MechanicServiceRequests,{useServiceRequests} from './MechanicServiceRequests';
import {useMechanicFonts} from './MechanicType';
import {useRef,useState} from 'react';
import {View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Text,HeroReveal} from './MotexaVisual';
import {MechanicPage,MechanicButton,MechanicNote,useMechanicTheme} from './MechanicUI';
import FloatingRoleTabs from './FloatingRoleTabs';
import MechanicProfessionalProfile from './MechanicProfessionalProfile';
import MechanicAccountHome from './MechanicAccountHome';
import Pressable from './MotionPressable';
import MechanicProgressPanel from './MechanicProgressPanel';
import MechanicInterviewAppointment from './MechanicInterviewAppointment';
import MotexaDialog from './MotexaDialog';
import * as Store from './SessionStore';
import {mechanicApi,type MechanicProfile} from './mechanic-api';

type Notice={id:string;title:string;body:string;readAt:string|null;createdAt:string};
/** Current server approval controls the workspace. No synthetic bookings or metrics. */
export default function MechanicAccountSpace({profile,notices,busy,error,onRefresh,onUpdated,onEdit}:{profile:MechanicProfile;notices:Notice[];busy:boolean;error:string;onRefresh:()=>Promise<void>;onUpdated:(p:MechanicProfile)=>void;onEdit:()=>void}){
 const m=useMechanicTheme(),[page,setPage]=useState('home'),[working,setWorking]=useState(false),[failure,setFailure]=useState(''),[logout,setLogout]=useState(false),[interviewOpen,setInterviewOpen]=useState(false),[unreadOnly,setUnreadOnly]=useState(false),[noticeAck,setNoticeAck]=useState('');
 const operating=useRef(false);
 const fonts=useMechanicFonts();
 const approved=profile.verificationStatus==='VERIFIED'&&profile.canReceiveServices&&profile.user.status==='ACTIVE';
 const feed=useServiceRequests(approved);
 const t=m.t,unread=notices.filter(n=>!n.readAt).length;
 const heading={fontFamily:fonts?(m.ar?'MechanicArabicBold':'MechanicEditorial'):undefined,fontSize:m.ar?28:38,lineHeight:m.ar?43:49,color:m.ink,textAlign:m.align};
 const body={fontSize:13,lineHeight:25,color:m.muted,textAlign:m.align};
 const section={fontSize:19,lineHeight:30,color:m.ink,fontWeight:'600' as const,textAlign:m.align};
 async function run(fn:()=>Promise<void>){if(operating.current)return;operating.current=true;setWorking(true);setFailure('');try{await fn();}catch(e){setFailure(e instanceof Error?e.message:t('Please try again.','حاول مجددًا.'));}finally{operating.current=false;setWorking(false);}}
 const activity=(action:string)=>{
  const names:Record<string,[string,string]>={MECHANIC_ASSESSMENT_PACKAGE_SENT:['Assessment package sent','تم إرسال حزمة التقييم'],MECHANIC_SUBMITTED:['Application submitted','تم إرسال طلب الاعتماد'],MECHANIC_APPROVED:['Application approved','تم اعتماد الطلب'],MECHANIC_REJECTED:['Application rejected','تم رفض الطلب'],MECHANIC_INTERVIEW_SCHEDULED:['Interview scheduled','تم تحديد المقابلة'],MECHANIC_INTERVIEW_CONFIRMED:['Attendance confirmed','تم تأكيد الحضور'],MECHANIC_INTERVIEW_PASSED:['Interview completed','تم اجتياز المقابلة'],MECHANIC_INTERVIEW_FAILED:['Interview outcome recorded','تم تسجيل نتيجة المقابلة'],MECHANIC_NEEDS_COMPLETION:['Additional details requested','طُلب استكمال البيانات'],MECHANIC_SUSPENDED:['Service access suspended','تم تعليق الخدمات']};
  const copy=names[action];return copy?t(copy[0],copy[1]):t('Application record updated','تم تحديث سجل الطلب');
 };
 const title=page==='home'?(approved?(t('The service desk.','مساحة العمل.')):t('Your application, in focus.','طلبك، خطوة بخطوة.')):page==='requests'?t('Service requests.','طلبات الخدمة.'):page==='profile'?t('Your professional profile.','ملفك المهني.'):page==='notifications'?t('Your updates.','آخر المستجدات.'):t('Verification record.','سجل الاعتماد.');
 return <MechanicPage title={page} presentation="workspace" onRefresh={()=>void run(async()=>{await onRefresh();await feed.load();})} refreshing={working||busy} footer={<FloatingRoleTabs tabSemantics items={[{key:'home',icon:'home-outline',label:approved?t('Home','الرئيسية'):t('Application','متابعة الطلب')},...(approved?[{key:'requests',icon:'receipt-outline' as const,label:t('Requests','الطلبات')}]:[]),{key:'profile',icon:'person-outline',label:t('My profile','ملفي')},{key:'notifications',icon:'notifications-outline',label:t('Updates','الإشعارات')},{key:'history',icon:'shield-checkmark-outline',label:t('Verification','الاعتماد')}]} selected={page} onSelect={setPage}/>}>
  <HeroReveal key={page} style={{gap:20,paddingTop:14}}>
   <View style={{flexDirection:m.row,alignItems:'center',gap:8}}><Ionicons name={approved?'shield-checkmark-outline':'git-branch-outline'} size={16} color={m.muted}/><Text style={{fontSize:10,lineHeight:22,letterSpacing:m.ar?0:1.5,color:m.muted,flex:1,textAlign:m.align}}>{approved?t('MOTEXA / MECHANIC WORKSPACE','MOTEXA / مساحة الميكانيكي'):t('MOTEXA / APPLICATION TRACKING','MOTEXA / متابعة طلب الاعتماد')}</Text></View>
   {page!=='profile'&&<View style={{gap:4}}><Text accessibilityRole="header" style={heading}>{title}</Text>{page==='home'&&<Text style={body}>{t('Welcome, ','أهلًا، ')+profile.user.fullName}</Text>}</View>}
   {!!(failure||error)&&<MechanicNote error>{failure||error}</MechanicNote>}
   {page==='home'&&<>
    {approved?<>
     <MechanicAccountHome profile={profile} notices={notices} busy={busy||working} onProfile={()=>setPage('profile')} onUpdates={()=>setPage('notifications')} onRequests={()=>setPage('requests')} feed={feed} onRefresh={()=>void run(async()=>{await onRefresh();await feed.load();})}/>
    </>:<><MechanicProgressPanel profile={profile} onEdit={onEdit} compact/><MechanicInterviewAppointment profile={profile} onUpdated={onUpdated}/></>}
    {!approved&&<><View style={{gap:12,paddingVertical:12}}><Text style={section}>{t('Stay connected.','ابقَ على تواصل.')}</Text><MechanicButton secondary label={t('Administrator conversation','محادثة الأدمن')} onPress={()=>router.push('/mechanic/review?tab=conversation')}/><MechanicButton secondary label={t('Updates','الإشعارات')+(unread?' · '+unread:'')} onPress={()=>setPage('notifications')}/></View>
    <MechanicButton secondary label={t('Refresh account','تحديث الحساب')} busy={busy||working} onPress={()=>void run(onRefresh)}/></>}
   </>}
   {page==='requests'&&(approved?<MechanicServiceRequests feed={feed}/>:<MechanicNote>{t('Requests are available after approval.','تتاح الطلبات بعد الاعتماد.')}</MechanicNote>)}
   {page==='profile'&&<>
    <MechanicProfessionalProfile profile={profile}/>
    <View style={{flexDirection:m.row,gap:14,paddingTop:16,borderTopWidth:1,borderColor:m.border}}>{[{label:t('Contact the administrator','التواصل مع الأدمن'),icon:'chatbubbles-outline' as const,action:()=>router.push('/mechanic/review?tab=conversation')},{label:t('Sign out','تسجيل الخروج'),icon:'log-out-outline' as const,action:()=>setLogout(true)}].map(item=><Pressable focusVisibleOnly key={item.icon} accessibilityRole="button" accessibilityLabel={item.label} onPress={item.action} style={{flex:1,minHeight:48,flexDirection:m.row,gap:7,alignItems:'center',justifyContent:'center'}}><Ionicons name={item.icon} size={17} color={m.muted}/><Text style={{fontSize:11,lineHeight:22,color:m.ink,textAlign:m.align}}>{item.label}</Text></Pressable>)}</View>
   </>}
   {page==='notifications'&&<>
    <View style={{flexDirection:m.row,backgroundColor:m.soft,padding:4,borderRadius:19,gap:4}}>{[{value:false,label:t('All updates','كل الإشعارات')},{value:true,label:t('Unread','غير المقروءة')}].map(item=><Pressable focusVisibleOnly key={String(item.value)} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{selected:unreadOnly===item.value}} onPress={()=>{setUnreadOnly(item.value);setNoticeAck('');}} style={{flex:1,minHeight:43,borderRadius:15,backgroundColor:unreadOnly===item.value?m.surface:'transparent',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:12,lineHeight:23,fontWeight:unreadOnly===item.value?'600':'400',color:unreadOnly===item.value?m.ink:m.muted}}>{item.label}{item.value?' · '+unread:''}</Text></Pressable>)}</View>

    <View style={{flexDirection:m.row,alignItems:'center',gap:10,paddingBottom:12,borderBottomWidth:1,borderColor:m.border}}><Text style={{...body,flex:1}}>{unread?unread+' '+t('unread updates','إشعارات غير مقروءة'):t('You are all caught up.','اطّلعت على كل المستجدات.')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('Refresh updates','تحديث الإشعارات')} disabled={working||busy} onPress={()=>void run(onRefresh)} style={{width:44,height:44,borderRadius:15,backgroundColor:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name="refresh-outline" size={19} color={m.muted}/></Pressable></View>
    {!!noticeAck&&<View accessibilityLiveRegion="polite" style={{flexDirection:m.row,alignItems:'center',gap:7}}><Ionicons name="checkmark-circle-outline" size={16} color={m.muted}/><Text style={{...body,fontSize:12}}>{noticeAck}</Text></View>}
    {notices.filter(n=>!unreadOnly||!n.readAt).length?notices.filter(n=>!unreadOnly||!n.readAt).map((n,index)=><HeroReveal key={n.id} delay={Math.min(index*45,180)} style={{flexDirection:m.row,gap:12,paddingVertical:17,borderBottomWidth:1,borderColor:m.border}}><View style={{width:38,height:38,borderRadius:13,backgroundColor:n.readAt?m.surface:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name={n.readAt?'notifications-outline':'notifications'} size={19} color={m.muted}/></View><View style={{flex:1,gap:7}}><Text style={{...section,fontSize:14,lineHeight:24}}>{n.title}</Text><Text style={{...body,fontSize:12,lineHeight:23}}>{n.body}</Text><View style={{flexDirection:m.row,alignItems:'center',gap:6,flexWrap:'wrap'}}><Text style={{...body,fontSize:10,flex:1}}>{new Date(n.createdAt).toLocaleString(m.ar?'ar':'en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</Text>{!n.readAt&&<Pressable accessibilityRole="button" accessibilityLabel={t('Mark as read','تعليم كمقروء')} disabled={working} onPress={()=>void run(async()=>{await mechanicApi('/api/mechanics/notifications/'+n.id+'/read','POST',{});await onRefresh();setNoticeAck(t('Marked as read','تم تعليم الإشعار كمقروء'));})} style={{minHeight:44,paddingHorizontal:5,justifyContent:'center'}}><Text style={{fontSize:11,color:m.ink,fontWeight:'600'}}>{t('Mark as read','تعليم كمقروء')}</Text></Pressable>}</View></View></HeroReveal>):<MechanicNote>{unreadOnly?t('No unread updates.','لا توجد إشعارات غير مقروءة.'):t('New account updates will appear here.','ستظهر مستجدات حسابك هنا.')}</MechanicNote>}
   </>}
   {page==='history'&&<><Text style={body}>{approved?t('Your completed verification is kept here for reference.','تحتفظ هذه الصفحة بمراحل اعتمادك المكتملة للرجوع إليها.'):t('Follow the recorded steps of your verification.','تابع الخطوات المسجّلة لاعتماد ملفك.')}</Text><MechanicProgressPanel profile={profile} onEdit={onEdit} recordOnly/>{!!profile.interviewScheduleId&&<View style={{gap:10}}><Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={t('Interview record','سجل المقابلة')} accessibilityState={{expanded:interviewOpen}} aria-expanded={interviewOpen} onPress={()=>setInterviewOpen(v=>!v)} style={{flexDirection:m.row,alignItems:'center',gap:10,padding:17,borderRadius:22,borderWidth:1,borderColor:m.border,backgroundColor:m.surface,minHeight:64}}><Ionicons name="calendar-outline" size={20} color={m.muted}/><Text style={{...section,fontSize:14,flex:1}}>{t('Interview record','سجل المقابلة')}</Text><Ionicons name={interviewOpen?'chevron-up':'chevron-down'} size={17} color={m.muted}/></Pressable>{interviewOpen&&<HeroReveal><MechanicInterviewAppointment profile={profile} readOnly/></HeroReveal>}</View>}{profile.history.length>0&&<View style={{gap:13,paddingVertical:16,borderTopWidth:1,borderColor:m.border}}><Text style={section}>{t('Account activity','نشاط الحساب')}</Text>{profile.history.map(event=><View key={event.id} style={{paddingVertical:8,gap:4,borderTopWidth:1,borderColor:m.border}}><Text style={body}>{new Date(event.createdAt).toLocaleString(m.ar?'ar':'en')}</Text><Text style={{...body,fontSize:11}}>{activity(event.action)}</Text></View>)}</View>}</>}
  </HeroReveal>
  <MotexaDialog visible={logout} icon="log-out-outline" title={t('Sign out?','تسجيل الخروج؟')} message={t('Your saved account information will be here when you return.','ستجد معلومات حسابك المحفوظة عند العودة.')} confirmText={t('Sign out','تسجيل الخروج')} cancelText={t('Stay here','البقاء هنا')} onCancel={()=>setLogout(false)} onConfirm={()=>void run(async()=>{await Store.deleteItemAsync('motexa_access_token');router.replace('/');})}/>
 </MechanicPage>;
}
