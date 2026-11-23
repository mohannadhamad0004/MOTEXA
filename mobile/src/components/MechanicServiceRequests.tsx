import WorkshopLocationEditor from './WorkshopLocationEditor';
import WorkshopJourney from './WorkshopJourney';
import {useCallback,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text,HeroReveal} from './MotexaVisual';
import Pressable from './MotionPressable';
import {MechanicButton,MechanicField,MechanicNote,useMechanicTheme} from './MechanicUI';
import {WorkspaceSheet} from './MechanicWorkspaceUI';
import MotexaDialog from './MotexaDialog';
import {mechanicApi,MechanicApiError} from './mechanic-api';

type RequestItem={id:string;title:string;description:string;mode:string;vehicle:string;contactNumber:string;address:string;status:string;version:number;decisionNote:string|null;createdAt:string;customer:{fullName:string}};
export type RequestFeed={requests:RequestItem[];counts:Record<string,number>;limit:number};
export function useServiceRequests(enabled:boolean){
 const [data,setData]=useState<RequestFeed|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{
  if(!enabled)return;setLoading(true);setError('');
  try{const result=await mechanicApi<RequestFeed>('/api/service-requests/mechanic');if(!Array.isArray(result.requests)||!result.counts||typeof result.counts!=='object')throw Error('Invalid service request response. Retry.');setData(result);return result;}catch(e){setData(null);setError(e instanceof Error?e.message:'Could not load service requests.');}finally{setLoading(false);}
 },[enabled]);
 useFocusEffect(useCallback(()=>{if(enabled)void load();},[enabled,load]));
 return {data:enabled?data:null,loading,error:enabled?error:'',load};
}
export default function MechanicServiceRequests({feed}:{feed:ReturnType<typeof useServiceRequests>}){
 const m=useMechanicTheme(),t=m.t,[filter,setFilter]=useState('new'),[selected,setSelected]=useState<RequestItem|null>(null),[action,setAction]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const operating=useRef(false);
 const stages:Record<string,[string,string]>={NEW:['New request','طلب جديد'],ACCEPTED:['Accepted','مقبول'],IN_PROGRESS:['In progress','قيد التنفيذ'],COMPLETED:['Completed','مكتمل'],DECLINED:['Declined','تم الاعتذار'],CANCELLED:['Cancelled','ملغى']};
 const status=(value:string)=>stages[value]?t(...stages[value]):value;
 const visible=feed.data?.requests.filter(r=>filter==='new'?r.status==='NEW':filter==='active'?['ACCEPTED','IN_PROGRESS'].includes(r.status):['COMPLETED','DECLINED','CANCELLED'].includes(r.status))??[];
 const text={fontSize:13,lineHeight:25,color:m.ink,textAlign:m.align},small={fontSize:11,lineHeight:23,color:m.muted,textAlign:m.align};
 async function perform(){if(!selected||operating.current)return;operating.current=true;setBusy(true);setError('');try{
  const result=await mechanicApi<{request:RequestItem}>('/api/service-requests/'+selected.id+'/action','POST',{action,version:selected.version,note});
  setAction('');setSelected(result.request);setSuccess(t('Request updated successfully.','تم تحديث الطلب بنجاح.'));await feed.load();
 }catch(e){setAction('');setError(e instanceof MechanicApiError&&e.code==='MECHANIC_BUSY'?t('Complete your current accepted or in-progress service first. This request remains waiting.','أكمل خدمتك المقبولة أو الجارية أولًا. هذا الطلب ما زال بانتظار الرد.'):e instanceof Error?e.message:t('Update failed. Retry.','تعذّر التحديث. حاول مجددًا.'));const current=await feed.load();const refreshed=current?.requests.find(r=>r.id===selected.id);if(refreshed)setSelected(refreshed);}finally{operating.current=false;setBusy(false);}}
 return <View style={{gap:18}}><WorkshopLocationEditor/>
  <View style={{flexDirection:m.row,gap:6,borderBottomWidth:1,borderColor:m.border}}>{[{key:'new',label:t('New','الجديدة')},{key:'active',label:t('Active','الجارية')},{key:'closed',label:t('Closed','السابقة')}].map(item=><Pressable focusVisibleOnly key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected:filter===item.key}} aria-selected={filter===item.key} onPress={()=>setFilter(item.key)} style={{flex:1,minHeight:48,borderBottomWidth:filter===item.key?2:0,borderColor:m.ink,alignItems:'center',justifyContent:'center'}}><Text style={{...text,fontSize:12,fontWeight:filter===item.key?'600':'400'}}>{item.label}</Text></Pressable>)}</View>
  {!!feed.error&&<MechanicNote error>{feed.error}</MechanicNote>}
  {feed.loading&&!feed.data?<Text style={small}>{t('Loading service requests…','جارٍ تحميل طلبات الخدمة…')}</Text>:!feed.error&&feed.data&&!visible.length?<View style={{paddingVertical:35,gap:12,alignItems:'center'}}><Ionicons name="car-sport-outline" size={43} color={m.muted}/><Text style={{...text,fontSize:19,fontWeight:'600',textAlign:'center'}}>{filter==='new'?t('Ready for your first request.','جاهز لاستقبال أول طلب.'):t('No requests in this section.','لا توجد طلبات في هذا القسم.')}</Text><Text style={{...small,textAlign:'center'}}>{t('Customer service requests appear here with their vehicle and service details.','تظهر طلبات العملاء هنا مع تفاصيل السيارة والخدمة المطلوبة.')}</Text></View>:null}
  {visible.map((item,i)=><HeroReveal key={item.id} delay={Math.min(i*40,160)}><Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={t('Open request: ','فتح الطلب: ')+item.title} onPress={()=>{setSelected(item);setNote('');setError('');setSuccess('');}} style={{paddingVertical:19,borderBottomWidth:1,borderColor:m.border,gap:10}}><View style={{flexDirection:m.row,gap:10,alignItems:'center'}}><View style={{width:42,height:42,borderRadius:15,backgroundColor:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name={item.mode==='WORKSHOP'?'storefront-outline':item.mode==='ON_SITE'?'navigate-outline':'chatbubbles-outline'} size={21} color={m.muted}/></View><View style={{flex:1,gap:3}}><Text style={{...text,fontSize:16,fontWeight:'600'}}>{item.title}</Text><Text style={small}>{item.customer.fullName+' · '+item.vehicle}</Text></View><Ionicons name={m.ar?'chevron-back':'chevron-forward'} size={18} color={m.muted}/></View><View style={{flexDirection:m.row,justifyContent:'space-between',gap:10}}><Text style={small}>{status(item.status)}</Text><Text style={small}>{new Date(item.createdAt).toLocaleDateString(m.ar?'ar':'en')}</Text></View></Pressable></HeroReveal>)}
  {!!feed.data&&feed.data.requests.length===feed.data.limit&&<Text style={small}>{t('Showing the latest 100 requests.','تظهر أحدث 100 طلب.')}</Text>}
  <MechanicButton secondary busy={feed.loading} label={t('Refresh requests','تحديث الطلبات')} onPress={()=>void feed.load()}/>
  <WorkspaceSheet visible={!!selected} title={t('Service request','طلب الخدمة')} onClose={()=>{if(!busy){setSelected(null);setAction('');}}}>
   {selected&&<><Text style={{...text,fontSize:22,lineHeight:34,fontWeight:'600'}}>{selected.title}</Text><Text style={small}>{status(selected.status)}</Text><View style={{gap:14,paddingVertical:15,borderTopWidth:1,borderBottomWidth:1,borderColor:m.border}}>{[[t('Customer','العميل'),selected.customer.fullName],[t('Vehicle','السيارة'),selected.vehicle],[t('Contact number','رقم التواصل'),selected.contactNumber],[t('Service details','تفاصيل الخدمة'),selected.description],...(selected.address?[[t('Service address','عنوان الخدمة'),selected.address]]:[]),...(selected.decisionNote?[[t('Decision note','ملاحظة القرار'),selected.decisionNote]]:[])].map(([label,value])=><View key={label} style={{gap:3}}><Text style={small}>{label}</Text><Text selectable style={text}>{value}</Text></View>)}</View>
   {!!error&&<MechanicNote error>{error}</MechanicNote>}{!!success&&<Text accessibilityLiveRegion="polite" style={small}>{success}</Text>}
   {selected.status==='NEW'&&<>{!!feed.data&&((feed.data.counts.ACCEPTED||0)+(feed.data.counts.IN_PROGRESS||0)>0)&&<MechanicNote>{t('Complete your current accepted or in-progress service first. This request remains waiting.','أكمل خدمتك المقبولة أو الجارية أولًا. هذا الطلب ما زال بانتظار الرد.')}</MechanicNote>}<MechanicButton disabled={!!feed.data&&((feed.data.counts.ACCEPTED||0)+(feed.data.counts.IN_PROGRESS||0)>0)} busy={busy} label={t('Accept request','قبول الطلب')} onPress={()=>setAction('ACCEPT')}/><MechanicField label={t('Reason if declining','سبب الاعتذار عند الرفض')} value={note} onChangeText={setNote} maxLength={500} multiline editable={!busy}/><MechanicButton secondary busy={busy} label={t('Decline request','الاعتذار عن الطلب')} onPress={()=>{if(note.trim().length<3){setError(t('Add a short reason before declining.','أضف سببًا مختصرًا قبل الاعتذار.'));return;}setAction('DECLINE');}}/></>}
   {selected.mode==='WORKSHOP'&&selected.status==='ACCEPTED'&&<WorkshopJourney requestId={selected.id} mechanic/>}
   {selected.status==='ACCEPTED'&&<MechanicButton busy={busy} label={t('Start service','بدء الخدمة')} onPress={()=>setAction('START')}/>}
   {selected.status==='IN_PROGRESS'&&<MechanicButton busy={busy} label={t('Complete service','إنهاء الخدمة')} onPress={()=>setAction('COMPLETE')}/>}
   </>}
  </WorkspaceSheet>
  <MotexaDialog visible={!!action} icon="construct-outline" title={t('Confirm request update','تأكيد تحديث الطلب')} message={t('The customer will receive an in-app update.','سيصل تحديث للعميل داخل التطبيق.')} confirmText={t('Confirm','تأكيد')} cancelText={t('Cancel','إلغاء')} onCancel={()=>{if(!busy)setAction('');}} onConfirm={()=>void perform()}/>
 </View>;
}
