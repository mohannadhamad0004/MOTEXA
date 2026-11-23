import {useCallback,useRef,useState,type ReactNode} from 'react';
import {Image,Modal,ScrollView,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router,useFocusEffect} from 'expo-router';
import {useFonts} from 'expo-font';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Pressable from './MotionPressable';
import {Text,HeroReveal} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import BrandMonogram from './BrandMonogram';
import * as Session from './SessionStore';

export type SuperAdminSummary={administrators:number;mechanics:number;pendingMechanics:number;pendingInvitations:number;partsProviders?:number;towProviders?:number;suspendedAdministrators?:number;expiredInvitations?:number};
type Activity={id:string;action:string;createdAt:string;actorName:string|null;subjectName:string|null;permission:string|null};
type ActivityPage={activity:Activity[];nextCursor:string|null};
async function readActivity(cursor?:string,signal?:AbortSignal,scope='all'):Promise<ActivityPage>{
 const request=new AbortController(),cancel=()=>request.abort();
 signal?.addEventListener('abort',cancel);
 if(signal?.aborted)request.abort();
 const timeout=setTimeout(cancel,15000);
 try{
  const token=await Session.getItemAsync('motexa_access_token'),base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');
  if(!token||!base||request.signal.aborted)throw new Error('Activity unavailable');
  const response=await fetch(base+'/api/admin-management/activity?limit=6&scope='+scope+(cursor?'&cursor='+encodeURIComponent(cursor):''),{headers:{Authorization:'Bearer '+token},signal:request.signal});
  if(!response.ok)throw new Error('Activity unavailable');
  const data=await response.json();
  if(!data.success||!Array.isArray(data.activity))throw new Error('Invalid activity response');
  return data;
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}

const departments=[
 {role:'MECHANIC',en:'Mechanics',ar:'الميكانيكيون',icon:'construct-outline',count:'mechanics',photo:require('../../assets/images/department-workshop-mathias.jpg')},
 {role:'PARTS_PROVIDER',en:'Spare parts',ar:'قطع الغيار',icon:'cube-outline',count:'partsProviders',photo:require('../../assets/images/department-tires-tuccera.jpg')},
 {role:'TOW_PROVIDER',en:'Towing',ar:'الونشات',icon:'car-outline',count:'towProviders',photo:require('../../assets/images/department-tow-zoshua.jpg')},
] as const;

/** Platform oversight only. Department reviews remain in their existing workspaces. */
export default function SuperAdminControlCenter({summary,loading,failed,refreshKey,children}:{summary:SuperAdminSummary|null;loading:boolean;failed:boolean;refreshKey:number;children?:ReactNode}){
 const m=useMechanicTheme(),{width}=useWindowDimensions();
 const [fontsReady]=useFonts({MotexaControlScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaControlArabic:require('../../assets/fonts/Tajawal-Medium.ttf'),MotexaControlNumber:require('../../assets/fonts/GFSDidot-Regular.ttf')});
 const [activity,setActivity]=useState<Activity[]>([]),[next,setNext]=useState<string|null>(null),[activityBusy,setActivityBusy]=useState(true),[activityError,setActivityError]=useState(false),[moreBusy,setMoreBusy]=useState(false),[retry,setRetry]=useState(0);
 const [section,setSection]=useState<'overview'|'departments'|'activity'|'roadmap'>('overview');
 const [menuOpen,setMenuOpen]=useState(false);
 const insets=useSafeAreaInsets();
 const [expandedEvent,setExpandedEvent]=useState<string|null>(null);
 const [scope,setScope]=useState<'administrators'|'mechanics'|'parts'|'towing'|'all'>('all');
 const generation=useRef(0),moreController=useRef<AbortController|null>(null),moreLock=useRef(false);
 useFocusEffect(useCallback(()=>{
  if(section!=='activity')return;
  const current=++generation.current,controller=new AbortController();setActivityBusy(true);setActivityError(false);setMoreBusy(false);moreLock.current=false;
  void readActivity(undefined,controller.signal,scope).then(data=>{if(generation.current===current){setActivity(data.activity);setNext(data.nextCursor);}}).catch(()=>{if(!controller.signal.aborted&&generation.current===current){setActivity([]);setNext(null);setActivityError(true);}}).finally(()=>{if(generation.current===current)setActivityBusy(false);});
  return()=>{generation.current++;controller.abort();moreController.current?.abort();};
 // These explicit counters invalidate the first page on refresh and Retry.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[refreshKey,retry,section,scope]));
 async function loadEarlier(){
  if(!next||moreLock.current)return;moreLock.current=true;setMoreBusy(true);const current=generation.current,controller=new AbortController();moreController.current=controller;
  try{const data=await readActivity(next,controller.signal,scope);if(current===generation.current){setActivity(old=>[...old,...data.activity.filter(item=>!old.some(previous=>previous.id===item.id))]);setNext(data.nextCursor);setActivityError(false);}}
  catch{if(!controller.signal.aborted&&current===generation.current)setActivityError(true);}
  finally{if(current===generation.current){moreLock.current=false;setMoreBusy(false);}}
 }
 const titleFont=fontsReady?(m.ar?'MotexaControlArabic':'MotexaControlScript'):undefined;
 const count=(value:number|undefined)=>loading?'…':failed||value===undefined?'—':String(value);
 const goAccounts=()=>router.push('/admin/admin-management');
 function eventTitle(action:string){const labels:Record<string,[string,string]>={ADMIN_PROFILE_UPDATED:['Administrator profile updated','تحديث ملف أدمن'],ADMIN_INVITATION_CREATED:['Administrator invited','إنشاء دعوة أدمن'],ADMIN_INVITATION_ACCEPTED:['Administrator activated','تفعيل حساب أدمن'],ADMIN_INVITATION_REVOKED:['Invitation revoked','إلغاء دعوة أدمن'],ADMIN_INVITATION_DELIVERY_FAILED:['Invitation delivery failed','تعذّر إرسال الدعوة'],ADMIN_ACCOUNT_SUSPENDED:['Administrator suspended','تعليق حساب أدمن'],ADMIN_ACCOUNT_REACTIVATED:['Administrator reactivated','إعادة تفعيل أدمن']};const mechanicLabels:Record<string,[string,string]>={MECHANIC_QUESTION_CREATED:['Assessment question added','إضافة سؤال تقييم'],MECHANIC_QUESTION_UPDATED:['Assessment question updated','تعديل سؤال تقييم'],MECHANIC_QUESTION_APPROVED:['Assessment question approved','اعتماد سؤال تقييم'],MECHANIC_QUESTION_DISABLED:['Assessment question disabled','تعطيل سؤال تقييم'],MECHANIC_TEST_ASSIGNED:['Assessment assigned','تعيين تقييم مهني'],MECHANIC_TEST_SUBMITTED:['Assessment answers submitted','إرسال إجابات التقييم'],MECHANIC_TEST_REVIEWED:['Assessment reviewed','مراجعة التقييم'],MECHANIC_DOCUMENT_REVIEWED:['Document review updated','تحديث مراجعة مستند'],MECHANIC_DOCUMENT_VIEWED:['Document opened','فتح مستند']};const label=labels[action]??mechanicLabels[action];return label?m.t(...label):action.startsWith('MECHANIC_')?m.t('Mechanic workflow updated','تحديث في إجراءات الميكانيكيين'):m.t('Administrator activity','عملية إدارية');}
 function eventIcon(action:string):keyof typeof Ionicons.glyphMap{return action.includes('FAILED')?'alert-circle-outline':action.includes('SUSPENDED')?'pause-outline':action.includes('REVOKED')?'close-outline':action.includes('INVITATION_CREATED')?'mail-outline':action.startsWith('MECHANIC_')?'construct-outline':'checkmark-outline';}
 return <View style={{gap:13,marginTop:8}}>
  <View style={{flexDirection:m.row,alignItems:'center',gap:12,padding:5,paddingRight:12,borderRadius:25,borderWidth:1,borderColor:m.border,backgroundColor:m.surface}}>
   <Pressable accessibilityRole="button" accessibilityLabel={m.t('Workspace menu','قائمة مساحة العمل')} accessibilityState={{expanded:menuOpen}} onPress={()=>setMenuOpen(true)} style={{width:48,height:48,borderRadius:17,borderWidth:1,borderColor:m.border,backgroundColor:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name="grid-outline" size={21} color={m.ink}/></Pressable>
   <View style={{flex:1}}><Text style={{fontSize:9,lineHeight:17,letterSpacing:m.ar?0:1,color:m.muted,textAlign:m.align}}>{m.t('CONTROL CENTER','مركز التحكّم')}</Text><Text accessibilityRole="header" style={{fontSize:14,lineHeight:23,fontWeight:'600',color:m.ink,textAlign:m.align}}>{section==='overview'?m.t('Platform overview','نظرة عامة على المنصّة'):section==='departments'?m.t('Departments','الأقسام'):section==='activity'?m.t('Activity history','سجل العمليات'):m.t('Platform roadmap','تطوير المنصّة')}</Text></View>
   <View style={{width:7,height:7,borderRadius:4,backgroundColor:failed?'#B7684A':m.muted}}/>
  </View>
  <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={()=>setMenuOpen(false)}>
   <View style={{flex:1,flexDirection:m.row}}>
    <Pressable accessibilityRole="button" accessibilityLabel={m.t('Close workspace menu','إغلاق قائمة مساحة العمل')} onPress={()=>setMenuOpen(false)} style={{position:'absolute',top:0,bottom:0,left:0,right:0,backgroundColor:'#160F0BB3'}}/>
    <View accessibilityViewIsModal style={{width:Math.min(324,width-36),height:'100%',paddingTop:insets.top+18,paddingBottom:insets.bottom+16,paddingHorizontal:20,backgroundColor:m.dark?'#30231BF5':'#FFF7EAF5',borderColor:m.border,borderRightWidth:m.ar?0:1,borderLeftWidth:m.ar?1:0}}>
     <BrandMonogram size={300} style={{top:90,left:-30,opacity:.035}}/>
     <View style={{flexDirection:m.row,alignItems:'center',gap:10,marginBottom:20}}><View style={{flex:1}}><Text style={{fontSize:16,lineHeight:25,letterSpacing:3,color:m.ink}}>MOTEXA</Text><Text style={{fontSize:10,lineHeight:20,color:m.muted,textAlign:m.align}}>{m.t('SUPER ADMIN / WORKSPACE','السوبر أدمن / مساحة العمل')}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={m.t('Close menu','إغلاق القائمة')} onPress={()=>setMenuOpen(false)} style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:m.border}}><Ionicons name="close-outline" size={22} color={m.ink}/></Pressable></View>
     <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{gap:7,paddingBottom:20}}>
      <Text style={{fontFamily:titleFont,fontSize:m.ar?27:38,lineHeight:49,color:m.ink,textAlign:m.align,marginBottom:9}}>{m.t('One clear perspective.','إدارة برؤية واضحة.')}</Text>
      {([{key:'overview',en:'Overview',ar:'نظرة عامة',icon:'grid-outline'},{key:'departments',en:'Departments',ar:'الأقسام',icon:'layers-outline'},{key:'activity',en:'Activity history',ar:'سجل العمليات',icon:'pulse-outline'}] as const).map(item=><Pressable key={item.key} accessibilityRole="button" accessibilityLabel={m.ar?item.ar:item.en} accessibilityState={{selected:section===item.key}} onPress={()=>{setSection(item.key);setMenuOpen(false);}} style={{flexDirection:m.row,alignItems:'center',gap:13,minHeight:66,paddingVertical:9,paddingHorizontal:14,borderRadius:22,backgroundColor:section===item.key?m.soft:'transparent'}}><Ionicons name={item.icon} size={21} color={m.muted}/><Text style={{flex:1,fontFamily:titleFont,fontSize:m.ar?21:27,lineHeight:m.ar?34:38,fontWeight:'400',color:m.ink,textAlign:m.align}}>{m.ar?item.ar:item.en}</Text>{section===item.key&&<View style={{width:5,height:5,borderRadius:3,backgroundColor:m.muted}}/>}</Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel={m.t('Administrators & permissions','الأدمن والصلاحيات')} onPress={()=>{setMenuOpen(false);goAccounts();}} style={{flexDirection:m.row,alignItems:'center',gap:13,minHeight:66,paddingVertical:9,paddingHorizontal:14}}><Ionicons name="shield-checkmark-outline" size={21} color={m.muted}/><Text style={{flex:1,fontFamily:titleFont,fontSize:m.ar?21:27,lineHeight:m.ar?34:38,fontWeight:'400',color:m.ink,textAlign:m.align}}>{m.t('Administrators & permissions','الأدمن والصلاحيات')}</Text><Ionicons name={m.ar?'chevron-back':'chevron-forward'} size={16} color={m.muted}/></Pressable>
      {([{en:'Service requests',ar:'طلبات الخدمات',icon:'clipboard-outline',route:'/admin/(tabs)/requests'},{en:'Your account',ar:'حسابك الشخصي',icon:'person-circle-outline',route:'/admin/profile'}] as const).map(link=><Pressable key={link.route} accessibilityRole="button" accessibilityLabel={m.ar?link.ar:link.en} onPress={()=>{setMenuOpen(false);router.push(link.route);}} style={{flexDirection:m.row,alignItems:'center',gap:13,minHeight:66,paddingVertical:9,paddingHorizontal:14}}><Ionicons name={link.icon} size={21} color={m.muted}/><Text style={{flex:1,fontFamily:titleFont,fontSize:m.ar?21:27,lineHeight:m.ar?34:38,fontWeight:'400',color:m.ink,textAlign:m.align}}>{m.ar?link.ar:link.en}</Text><Ionicons name={m.ar?'chevron-back':'chevron-forward'} size={16} color={m.muted}/></Pressable>)}
      <View style={{height:1,backgroundColor:m.border,marginVertical:13}}/>
      <Pressable accessibilityRole="button" accessibilityLabel={m.t('Platform roadmap','تطوير المنصّة')} onPress={()=>{setSection('roadmap');setMenuOpen(false);}} style={{minHeight:66,paddingVertical:9,paddingHorizontal:14,flexDirection:m.row,alignItems:'center',gap:13,borderRadius:22,backgroundColor:section==='roadmap'?m.soft:'transparent'}}><Ionicons name="trail-sign-outline" size={21} color={m.muted}/><View style={{flex:1}}><Text style={{fontFamily:titleFont,fontSize:m.ar?21:27,lineHeight:m.ar?34:38,fontWeight:'400',color:m.ink,textAlign:m.align}}>{m.t('Platform roadmap','تطوير المنصّة')}</Text><Text style={{fontSize:10,lineHeight:20,color:m.muted,textAlign:m.align}}>{m.t('Owners · Requests · Payments','المستخدمون · الطلبات · الدفع')}</Text></View></Pressable>
     </ScrollView>
     <Text style={{fontSize:11,lineHeight:22,color:m.muted,textAlign:m.align,borderTopWidth:1,borderColor:m.border,paddingTop:13}}>{m.t('Platform oversight. Department operations remain in their own workspaces.','إشراف شامل على المنصّة، مع مساحة عمل مستقلة لكل قسم.')}</Text>
    </View>
   </View>
  </Modal>
  {section==='roadmap'&&<View style={{padding:17,borderWidth:1,borderColor:m.border,borderRadius:28,backgroundColor:m.surface,gap:13}}>
   <Text accessibilityRole="header" style={{fontFamily:titleFont,fontSize:m.ar?27:35,lineHeight:46,color:m.ink,textAlign:m.align}}>{m.t('Built one journey at a time.','كل رحلة، بخطوات متكاملة.')}</Text>
   <Text style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{m.t('These modules are planned, not live. They will appear in operational reporting after their real workflows are implemented.','هذه الوحدات مخطّطة وليست مفعّلة. ستظهر ضمن التقارير التشغيلية بعد بناء إجراءاتها الفعلية.')}</Text>
   {([{en:'Car owner journey',ar:'رحلة صاحب السيارة',descEn:'Service discovery, selection and booking.',descAr:'اكتشاف الخدمة واختيارها والحجز.',icon:'person-outline'},{en:'Service lifecycle',ar:'دورة طلب الخدمة',descEn:'Assignment, progress, completion and disputes.',descAr:'إسناد الطلب ومتابعته وإتمامه ومعالجة النزاعات.',icon:'git-branch-outline'},{en:'Payments & settlements',ar:'الدفع والتسويات',descEn:'Payment verification, refunds and provider settlements.',descAr:'التحقق من الدفع والاسترداد وتسويات مزودي الخدمات.',icon:'card-outline'}] as const).map(item=><View key={item.en} style={{paddingVertical:13,borderTopWidth:1,borderColor:m.border,flexDirection:m.row,gap:11}}><Ionicons name={item.icon} size={23} color={m.muted}/><View style={{flex:1,gap:4}}><Text style={{fontSize:14,lineHeight:24,fontWeight:'600',color:m.ink,textAlign:m.align}}>{m.ar?item.ar:item.en}</Text><Text style={{fontSize:12,lineHeight:22,color:m.muted,textAlign:m.align}}>{m.ar?item.descAr:item.descEn}</Text><Text style={{fontSize:10,lineHeight:20,color:m.muted,textAlign:m.align}}>{m.t('PLANNED / NOT ACTIVE','مخطّط / غير مفعّل')}</Text></View></View>)}
  </View>}
  {section==='overview'&&children}
  {section==='departments'&&
  <View>
   <View style={{flexDirection:m.row,alignItems:'center',gap:10,marginBottom:11}}><Text accessibilityRole="header" style={{flex:1,fontFamily:titleFont,fontSize:m.ar?25:33,lineHeight:43,color:m.ink,textAlign:m.align}}>{m.t('Every department, connected.','أقسام المنصّة.')}</Text><Ionicons name={m.ar?'arrow-back':'arrow-forward'} size={19} color={m.muted}/></View>
   <Text style={{fontSize:11,lineHeight:20,color:m.muted,textAlign:m.align,marginBottom:9}}>{m.t('Three departments. One connected platform.','ثلاثة أقسام، ضمن منصّة واحدة.')}</Text>
   <View style={{gap:14}}>
    {departments.map((department,index)=><HeroReveal key={department.role} delay={index*55}><Pressable accessibilityRole="button" accessibilityLabel={m.t('Open '+department.en,'فتح قسم '+department.ar)} onPress={()=>router.push({pathname:'/admin/(tabs)/providers',params:{category:department.role}})} style={({pressed})=>({minHeight:164,padding:10,borderRadius:74,overflow:'hidden',borderWidth:1,borderColor:m.border,backgroundColor:m.surface,opacity:pressed?.86:1,flexDirection:m.row})}>
     <View style={{width:87,height:132,alignSelf:'center',overflow:'hidden',borderRadius:46,borderWidth:1,borderColor:m.border,backgroundColor:m.soft}}><Image accessible={false} source={department.photo} resizeMode="cover" style={{position:'absolute',width:'100%',height:'100%'}}/></View>
     <View style={{flex:1,minWidth:0,paddingVertical:9,paddingHorizontal:10,justifyContent:'space-between',gap:8}}>
      <View><Text style={{fontSize:9,lineHeight:17,letterSpacing:1,color:m.muted,textAlign:m.align}}>{'0'+(index+1)+' / MOTEXA'}</Text><Text style={{fontSize:16,lineHeight:26,fontWeight:'600',color:m.ink,textAlign:m.align}}>{m.ar?department.ar:department.en}</Text><Text style={{fontSize:11,lineHeight:20,color:m.muted,textAlign:m.align}}>{department.role==='MECHANIC'?m.t('Workshops & automotive expertise','الورش وخبرات صيانة السيارات'):department.role==='PARTS_PROVIDER'?m.t('Automotive parts specialists','مزودو قطع السيارات'):m.t('Recovery & roadside assistance','الونشات والمساعدة على الطريق')}</Text></View>
      <View style={{flexDirection:m.row,alignItems:'center',gap:7}}><Text style={{fontFamily:fontsReady?'MotexaControlNumber':undefined,fontSize:29,lineHeight:37,color:m.ink}}>{count(summary?.[department.count])}</Text><Text style={{flex:1,fontSize:10,lineHeight:18,color:m.muted,textAlign:m.align}}>{m.t('accounts','حسابات')}</Text><View style={{width:29,height:29,borderRadius:15,borderWidth:1,borderColor:m.border,alignItems:'center',justifyContent:'center'}}><Ionicons name={m.ar?'arrow-back':'arrow-forward'} size={16} color={m.muted}/></View></View>
     </View>
    </Pressable></HeroReveal>)}
   </View> </View>}
  {section==='overview'&&<View style={{backgroundColor:m.dark?'#35291FCC':'#FFFAF1CC',borderRadius:29,borderWidth:1,borderColor:m.border,padding:17,overflow:'hidden'}}>
   <BrandMonogram size={170} style={{top:-18,left:-40,opacity:.025}}/>
   <Text accessibilityRole="header" style={{fontFamily:titleFont,fontSize:m.ar?25:32,lineHeight:42,color:m.ink,textAlign:m.align,marginBottom:8}}>{m.t('On your radar.','تحت المتابعة.')}</Text>
   {([{label:m.t('Pending invitations','دعوات بانتظار التفعيل'),value:summary?.pendingInvitations,icon:'mail-outline'},{label:m.t('Suspended administrators','حسابات أدمن معلّقة'),value:summary?.suspendedAdministrators,icon:'pause-outline'},{label:m.t('Expired invitations','دعوات منتهية الصلاحية'),value:summary?.expiredInvitations,icon:'time-outline'}] as const).map((item,index)=><Pressable key={item.icon} accessibilityRole="button" accessibilityLabel={item.label} onPress={goAccounts} style={{flexDirection:m.row,alignItems:'center',gap:10,minHeight:51,paddingVertical:8,borderTopWidth:index?1:0,borderColor:m.border}}><Ionicons name={item.icon} size={18} color={m.muted}/><Text style={{flex:1,fontSize:12,lineHeight:22,color:m.ink,textAlign:m.align}}>{item.label}</Text><Text style={{fontSize:20,lineHeight:29,color:m.ink}}>{count(item.value)}</Text><Ionicons name={m.ar?'chevron-back':'chevron-forward'} size={15} color={m.muted}/></Pressable>)}
   <Pressable accessibilityRole="button" accessibilityLabel={m.t('Manage administrators','إدارة الأدمن')} onPress={goAccounts} style={{minHeight:46,borderRadius:23,marginTop:10,backgroundColor:m.soft,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13,lineHeight:23,color:m.ink}}>{m.t('Manage administrators','إدارة الأدمن')}</Text></Pressable>
  </View>}
  {section==='activity'&&<View style={{borderWidth:1,borderColor:m.border,borderRadius:29,padding:17,backgroundColor:m.surface}}>
   <View style={{flexDirection:m.row,alignItems:'center',gap:10}}><Text accessibilityRole="header" style={{flex:1,fontFamily:titleFont,fontSize:m.ar?25:32,lineHeight:43,color:m.ink,textAlign:m.align}}>{m.t('A record of every step.','سجلّ خطوات الإدارة.')}</Text><Ionicons name="pulse-outline" size={21} color={m.muted}/></View>
   <Text style={{fontSize:11,lineHeight:20,color:m.muted,textAlign:m.align,marginBottom:12}}>{m.t('Recorded operations across platform departments.','العمليات الموثّقة عبر أقسام المنصّة.')}</Text>
   <View accessibilityRole="tablist" style={{flexDirection:m.row,flexWrap:'wrap',gap:7,marginBottom:13}}>{([{key:'all',en:'All',ar:'الكل'},{key:'administrators',en:'Admins',ar:'الأدمن'},{key:'mechanics',en:'Mechanics',ar:'الميكانيكيون'},{key:'parts',en:'Spare parts',ar:'قطع الغيار'},{key:'towing',en:'Towing',ar:'الونشات'}] as const).map(filter=><Pressable key={filter.key} accessibilityRole="tab" accessibilityState={{selected:scope===filter.key}} onPress={()=>setScope(filter.key)} style={{minWidth:76,flexGrow:1,paddingHorizontal:10,minHeight:44,borderRadius:28,borderWidth:1,borderColor:m.border,alignItems:'center',justifyContent:'center',backgroundColor:scope===filter.key?m.soft:'transparent'}}><Text style={{fontSize:11,lineHeight:20,color:m.ink}}>{m.ar?filter.ar:filter.en}</Text></Pressable>)}</View>
   <Text style={{fontSize:11,lineHeight:21,color:m.muted,textAlign:m.align,marginBottom:10}}>{m.t('Read-only history: what happened, who performed it and when. Earlier actions may not have been recorded.','سجل للقراءة فقط: ماذا حدث، ومن نفّذه، ومتى. بعض العمليات القديمة قد لا تكون مسجّلة.')}</Text>
   {activityBusy?<Text accessibilityLiveRegion="polite" style={{color:m.muted,lineHeight:24,textAlign:m.align}}>{m.t('Loading activity…','جارٍ تحميل السجل…')}</Text>:<>
    {!activity.length&&!activityError&&<Text style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{m.t('No recorded events in this category. Only implemented workflows produce records; this does not mean the department has no accounts.','لا توجد عمليات موثّقة ضمن هذا التصنيف. التسجيل مرتبط بالإجراءات المنفّذة فعليًا، ولا يعني عدم وجود حسابات في القسم.')}</Text>}
    {activity.map((event,index)=>{
     const date=new Date(event.createdAt),day=date.toLocaleDateString(m.ar?'ar':'en',{weekday:'long',year:'numeric',month:'short',day:'numeric'}),previous=index?new Date(activity[index-1].createdAt).toLocaleDateString(m.ar?'ar':'en',{weekday:'long',year:'numeric',month:'short',day:'numeric'}):null,expanded=expandedEvent===event.id;
     return <View key={event.id}>
      {day!==previous&&<Text accessibilityRole="header" style={{fontSize:11,lineHeight:23,color:m.muted,textAlign:m.align,marginTop:16,marginBottom:8}}>{day}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={eventTitle(event.action)} accessibilityState={{expanded}} aria-expanded={expanded} onPress={()=>setExpandedEvent(expanded?null:event.id)} style={{flexDirection:m.row,gap:11,paddingVertical:14,borderTopWidth:1,borderColor:m.border}}>
       <View style={{alignItems:'center',gap:7}}><View style={{width:34,height:34,borderRadius:17,backgroundColor:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name={eventIcon(event.action)} size={17} color={m.muted}/></View><View style={{width:1,flex:1,minHeight:12,backgroundColor:m.border}}/></View>
       <View style={{flex:1,minWidth:0,gap:5}}><Text style={{fontSize:13,lineHeight:23,fontWeight:'600',color:m.ink,textAlign:m.align}}>{eventTitle(event.action)}</Text>{!!event.subjectName&&<Text style={{fontSize:12,lineHeight:22,color:m.muted,textAlign:m.align}}>{m.t('Account: ','الحساب: ')+event.subjectName}</Text>}
        <View style={{flexDirection:m.row,gap:8,alignItems:'center'}}><Text style={{flex:1,fontSize:10,lineHeight:20,color:m.muted,textAlign:m.align}}>{date.toLocaleTimeString(m.ar?'ar':'en',{hour:'2-digit',minute:'2-digit'})}</Text><Text style={{fontSize:10,lineHeight:20,color:m.muted}}>{expanded?m.t('Less','أقل'):m.t('Details','التفاصيل')}</Text><Ionicons name={expanded?'chevron-up':'chevron-down'} size={13} color={m.muted}/></View>
        {expanded&&<View style={{padding:11,gap:5,borderRadius:15,backgroundColor:m.soft,marginTop:5}}><Text style={{fontSize:11,lineHeight:21,color:m.ink,textAlign:m.align}}>{m.t('Performed by: ','نفّذه: ')+(event.actorName??m.t('Not recorded','غير مسجّل'))}</Text><Text style={{fontSize:10,lineHeight:21,color:m.muted,textAlign:m.align}}>{date.toLocaleString(m.ar?'ar':'en',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</Text><Text selectable style={{fontSize:9,lineHeight:18,color:m.muted,textAlign:m.align}}>{m.t('Reference: ','المرجع: ')+event.id}</Text></View>}
       </View>
      </Pressable>
     </View>;
    })}
    {activityError&&<Text accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{m.t('Activity could not be loaded.','تعذّر تحميل سجل العمليات.')}</Text>}
    {(activityError||next)&&<Pressable accessibilityRole="button" disabled={moreBusy} accessibilityState={{disabled:moreBusy}} onPress={()=>{if(activity.length&&next)void loadEarlier();else setRetry(value=>value+1);}} style={{minHeight:46,marginTop:10,borderWidth:1,borderColor:m.border,borderRadius:23,padding:11,alignItems:'center',justifyContent:'center',backgroundColor:m.soft}}><Text style={{fontSize:12,lineHeight:22,color:m.ink}}>{moreBusy?m.t('Loading…','جارٍ التحميل…'):activityError?m.t('Retry activity','إعادة تحميل السجل'):m.t('Load earlier activity','عرض عمليات أقدم')}</Text></Pressable>}
   </>}
  </View>}
 </View>;
}
