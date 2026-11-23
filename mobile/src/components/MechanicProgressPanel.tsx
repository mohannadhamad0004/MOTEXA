import {useCallback,useState} from 'react';
import {View} from 'react-native';
import {useFocusEffect,router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {MechanicCard,MechanicButton,MechanicNote,useMechanicTheme} from './MechanicUI';
import {mechanicApi,type MechanicProfile} from './mechanic-api';

type Progress={stage:string;action:string;submissionVersion:number;documents:{kind:string;uploaded:boolean;reviewed:boolean}[];assessment:{assigned:boolean;submitted:boolean;reviewed:boolean;passed:boolean};interview:{recorded:boolean;passed:boolean};canReceiveServices:boolean};
export default function MechanicProgressPanel({profile,onEdit,compact=false,recordOnly=false}:{profile:MechanicProfile;onEdit:()=>void;compact?:boolean;recordOnly?:boolean}){
 const m=useMechanicTheme();const [expanded,setExpanded]=useState(false);const [data,setData]=useState<Progress|null>(null),[failed,setFailed]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useFocusEffect(useCallback(()=>{let active=true;setLoading(true);setFailed(false);void mechanicApi<{progress:Progress}>('/api/mechanics/me/progress').then(result=>{if(active)setData(result.progress);}).catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 // The profile response and Retry explicitly refresh this read-only projection.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[profile,retry]));
 const copy:Record<string,[string,string,string,string]>={
  DRAFT:['Prepare your application','جهّز طلبك','Complete your profile and required documents before submitting.','استكمل بياناتك والوثائق المطلوبة قبل الإرسال.'],
  NEEDS_COMPLETION:['A few details need you','طلبك يحتاج استكمالًا','Read the administrator’s notes below, update your information and resubmit.','اقرأ ملاحظات الأدمن أدناه، وحدّث المعلومات ثم أعد الإرسال.'],
  ADMIN_REVIEW:['Your application is with us','طلبك عند فريق المراجعة','Your administrator is reviewing the file and will arrange the next assessment step.','الأدمن يراجع ملفك ويحدّد الخطوة التالية للتقييم.'],
  TAKE_TEST:['Your assessment is ready','تقييمك جاهز للإجابة','Open your professional assessment and answer the assigned questions.','افتح التقييم المهني وأجب عن الأسئلة المعيّنة لك.'],
  TEST_REVIEW:['Answers received','تم استلام إجاباتك','Your answers are waiting for the administrator’s professional review.','إجاباتك بانتظار المراجعة المهنية من الأدمن.'],
  ASSESSMENT_RECORDED:['Assessment result recorded','تم تسجيل نتيجة التقييم','Open the review workspace to read the feedback and discuss your next step.','افتح مساحة المراجعة لقراءة الملاحظات ومناقشة خطوتك التالية.'],
  INTERVIEW_SCHEDULED:['Confirm your interview','أكد موعد مقابلتك','Your administrator scheduled an interview. Review the appointment and confirm attendance.','حدّد الأدمن موعد المقابلة. راجع التفاصيل وأكد الحضور.'],
  INTERVIEW_CONFIRMED:['Your interview is confirmed','تم تأكيد موعدك','Attend the appointment. Your administrator records the outcome afterward.','احضر المقابلة في موعدها، ثم يسجّل الأدمن النتيجة.'],
  INTERVIEW_REVIEW:['Professional review continues','المراجعة المهنية مستمرة','Your test has been reviewed. The administrator still needs to record the interview outcome.','تمت مراجعة اختبارك، وما زال يلزم تسجيل نتيجة المقابلة من الأدمن.'],
  AWAITING_DECISION:['Awaiting the final decision','بانتظار القرار النهائي','The recorded assessment is complete. Approval remains an administrator decision.','التقييم المسجّل مكتمل؛ اعتماد الطلب يبقى قرارًا من الأدمن.'],
  APPROVED:['You are approved','تم اعتمادك','Your professional application is approved. Your service access is enabled.','تم اعتماد طلبك المهني وتفعيل صلاحية استقبال الخدمات.'],
  REJECTED:['A decision needs your attention','راجع قرار الطلب','Read the review notes and contact the administrator if you need clarification.','اقرأ ملاحظات القرار وتواصل مع الأدمن إذا احتجت توضيحًا.'],
  SUSPENDED:['Service access is paused','استقبال الخدمات متوقف','Your services are suspended. Review the notes and contact your administrator.','خدماتك معلّقة؛ راجع الملاحظات وتواصل مع الأدمن.'],
  ACCOUNT_BLOCKED:['Account access is restricted','وصول الحساب مقيّد','Your account is not active. Contact the platform administrator.','حسابك غير مفعّل. تواصل مع مسؤول المنصّة.'],
 };
 const title=copy[data?.stage??'ADMIN_REVIEW']??copy.ADMIN_REVIEW;
 const content=<><View style={{flexDirection:m.row,alignItems:'center',gap:9}}><View style={{width:39,height:43,borderRadius:15,backgroundColor:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name={data?.canReceiveServices?'shield-checkmark-outline':'git-branch-outline'} size={22} color={m.muted}/></View><Text accessibilityRole="header" style={{fontSize:19,lineHeight:30,fontWeight:'600',color:m.ink,textAlign:m.align,flex:1}}>{recordOnly?m.t('Review milestones','مراحل الاعتماد'):profile.verificationStatus==='VERIFIED'?m.t('Verification summary','ملخص الاعتماد'):m.t('Your next step','خطوتك التالية')}</Text></View>
  {!!profile.reviewNotes&&<MechanicNote>{profile.reviewNotes}</MechanicNote>}
  {!recordOnly&&!!profile.submittedAt&&<Text style={{fontSize:10,lineHeight:21,color:m.muted,textAlign:m.align}}>{m.t('Submitted: ','تاريخ التقديم: ')+new Date(profile.submittedAt).toLocaleString(m.ar?'ar':'en')}</Text>}
  {loading?<Text accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{m.t('Checking your current application…','جارٍ التحقق من وضع طلبك…')}</Text>:failed||!data?<><MechanicNote error>{m.t('Progress could not be refreshed. Your saved application has not changed.','تعذّر تحديث المتابعة. طلبك المحفوظ لم يتغيّر.')}</MechanicNote><MechanicButton secondary label={m.t('Retry progress','إعادة تحميل المتابعة')} onPress={()=>setRetry(value=>value+1)}/>{profile.verificationStatus==='NEEDS_COMPLETION'&&<MechanicButton label={m.t('Complete requested changes','استكمال المطلوب')} onPress={onEdit}/>}<MechanicButton secondary label={m.t('Open test & administrator conversation','فتح الاختبار ومحادثة الأدمن')} onPress={()=>router.push('/mechanic/review')}/></>:<>
   {!recordOnly&&<View style={{paddingVertical:8,gap:7}}><Text style={{fontSize:18,lineHeight:29,color:m.ink,fontWeight:'600',textAlign:m.align}}>{m.t(title[0],title[1])}</Text><Text style={{fontSize:12,lineHeight:24,color:m.muted,textAlign:m.align}}>{m.t(title[2],title[3])}</Text><Text style={{fontSize:10,lineHeight:21,color:m.muted,textAlign:m.align}}>{m.t('Submission version ','نسخة الطلب ')+data.submissionVersion}</Text></View>}
   {(!compact||expanded)&&<View style={{gap:0,position:'relative'}}><View pointerEvents="none" style={{position:'absolute',top:26,bottom:35,width:1,left:m.ar?undefined:14,right:m.ar?14:undefined,backgroundColor:m.border}}/>{[
    {en:'Application received',ar:'استلام الطلب',done:!!profile.submittedAt,detail:m.t('Saved and submitted for review','محفوظ ومرسل للمراجعة')},
    {en:'Document review',ar:'مراجعة الوثائق',done:data.documents.length>0&&data.documents.every(d=>d.reviewed),detail:data.documents.filter(d=>d.reviewed).length+'/'+data.documents.length+' '+m.t('current documents reviewed','وثائق حالية تمت مراجعتها')},
    {en:'Professional assessment',ar:'التقييم المهني',done:data.assessment.passed,detail:data.assessment.reviewed?m.t('Result recorded in the review workspace','النتيجة مسجّلة في مساحة المراجعة'):data.assessment.submitted?m.t('Answers submitted · awaiting review','الإجابات مرسلة · بانتظار المراجعة'):data.assessment.assigned?m.t('Waiting for your answers','بانتظار إجاباتك'):m.t('No test currently assigned','لا يوجد اختبار معيّن حاليًا')},
    {en:'Professional interview',ar:'المقابلة المهنية',done:data.interview.passed,detail:data.interview.recorded?m.t('Outcome recorded','النتيجة مسجّلة'):m.t('Awaiting the administrator','بانتظار الأدمن')},
    {en:'Final approval',ar:'الاعتماد النهائي',done:data.canReceiveServices,detail:data.canReceiveServices?m.t('Professional access approved','تم اعتماد الوصول المهني'):m.t('Only the administrator can approve','الاعتماد من الأدمن فقط')},
   ].map((item,index)=><View key={item.en} style={{flexDirection:m.row,gap:12,paddingVertical:12,borderTopWidth:0,borderColor:m.border}}><View style={{width:29,height:29,borderRadius:15,borderWidth:1,borderColor:m.border,backgroundColor:item.done?m.soft:m.surface,alignItems:'center',justifyContent:'center'}}>{item.done?<Ionicons name="checkmark" size={15} color={m.muted}/>:<Text style={{fontSize:10,color:m.muted}}>{index+1}</Text>}</View><View style={{flex:1,gap:2}}><Text style={{fontSize:13,lineHeight:23,fontWeight:'600',color:m.ink,textAlign:m.align}}>{m.t(item.en,item.ar)}</Text><Text style={{fontSize:11,lineHeight:21,color:m.muted,textAlign:m.align}}>{item.detail}</Text></View></View>)}</View>}
   {compact&&<MechanicButton secondary label={expanded?m.t('Hide verification steps','إخفاء مراحل الاعتماد'):m.t('View verification steps','عرض مراحل الاعتماد')} onPress={()=>setExpanded(v=>!v)}/>}
   {!recordOnly&&<>{data.action==='EDIT'?<MechanicButton label={m.t('Complete requested changes','استكمال المطلوب')} onPress={onEdit}/>:data.action==='OPEN_REVIEW'?<MechanicButton label={data.stage==='TAKE_TEST'?m.t('Answer your assessment','الإجابة عن التقييم'):m.t('Open test & administrator conversation','فتح الاختبار ومحادثة الأدمن')} onPress={()=>router.push('/mechanic/review')}/>:null}
   {!data.canReceiveServices&&data.action!=='OPEN_REVIEW'&&data.stage!=='ACCOUNT_BLOCKED'&&<MechanicButton secondary label={m.t('Open test & administrator conversation','فتح الاختبار ومحادثة الأدمن')} onPress={()=>router.push('/mechanic/review')}/>}</>}

  </>}
 </>;
 return recordOnly?<View style={{gap:13}}>{content}</View>:<MechanicCard>{content}</MechanicCard>;
}
