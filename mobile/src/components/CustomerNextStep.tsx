import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {MechanicButton,useMechanicTheme} from './MechanicUI';
type Request={title:string;status:string;mechanic:{fullName:string};decisionNote:string|null};
export default function CustomerNextStep({hasCar,request,onGarage,onServices,onRequests}:{hasCar:boolean;request?:Request;onGarage:()=>void;onServices:()=>void;onRequests:()=>void}){
 const m=useMechanicTheme(),stage=['NEW','ACCEPTED','IN_PROGRESS','COMPLETED'].indexOf(request?.status||''),active=stage>=0;
 const statuses:Record<string,[string,string]>={NEW:['Awaiting mechanic response','بانتظار رد الميكانيكي'],ACCEPTED:['Your request is accepted','تم قبول طلبك'],IN_PROGRESS:['Your service is in progress','الخدمة قيد التنفيذ'],COMPLETED:['Your service is complete','اكتملت الخدمة'],DECLINED:['The mechanic declined this request','الميكانيكي اعتذر عن الطلب'],CANCELLED:['This request was cancelled','تم إلغاء الطلب']};
 return <View style={{paddingVertical:23,gap:13}}><View style={{flexDirection:m.row,alignItems:'center',gap:8}}><View style={{width:5,height:5,borderRadius:3,backgroundColor:'#AC7F4C'}}/><Text style={{fontSize:10,letterSpacing:1.5,color:m.muted}}>{m.t('YOUR NEXT STEP','خطوتك الجاية')}</Text></View>
  <Text style={{fontSize:21,lineHeight:34,fontWeight:'600',color:m.ink,textAlign:m.align}}>{request?m.t(...(statuses[request.status]||['Your request','طلبك'])):hasCar?m.t('Your car is ready. What do you need?','سيارتك جاهزة. شو بتحتاج اليوم؟'):m.t('Let’s get to know your car.','خلّينا نتعرّف على سيارتك.')}</Text>
  <Text style={{fontSize:12,lineHeight:25,color:m.muted,textAlign:m.align}}>{request?request.title+' · '+request.mechanic.fullName:hasCar?m.t('Open the round service button below. Choose a mechanic, then the service type that suits you.','افتح زر الخدمات الدائري بالأسفل، واختَر ميكانيكي ثم نوع الخدمة اللي بناسبك.'):m.t('Add the make, model and year once. We’ll use them for your next requests.','أضف الشركة والموديل وسنة الصنع مرة، وبنستخدمها بطلباتك الجاية.')}</Text>
  {active&&<View style={{flexDirection:m.row,paddingVertical:9}}>{[['Sent','أُرسل'],['Accepted','مقبول'],['In progress','قيد التنفيذ'],['Done','مكتمل']].map(([en,ar],i)=><View key={en} style={{flex:1,gap:7,alignItems:'center'}}><View style={{height:3,width:'90%',borderRadius:2,backgroundColor:i<=stage?'#AC7F4C':m.border}}/><Text style={{fontSize:9,lineHeight:20,color:i<=stage?m.ink:m.muted}}>{m.t(en,ar)}</Text></View>)}</View>}
  {request?.decisionNote&&<Text style={{fontSize:12,lineHeight:25,color:m.muted,textAlign:m.align}}>{request.decisionNote}</Text>}
  {request?<MechanicButton secondary label={m.t('Follow my request','متابعة طلبي')} onPress={onRequests}/>:!hasCar?<MechanicButton label={m.t('Add my first car','إضافة سيارتي الأولى')} onPress={onGarage}/>:<View style={{flexDirection:m.row,alignItems:'center',gap:7}}><Ionicons name="shield-checkmark-outline" size={17} color={m.muted}/><Text style={{fontSize:11,color:m.muted}}>{m.t('Approved providers · Your choice','مزودون معتمدون · والاختيار إلك')}</Text></View>}
 </View>;
}
