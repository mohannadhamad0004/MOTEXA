import {useRef,useState} from 'react';
import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {MechanicButton,MechanicChoice,MechanicField,MechanicNote,useMechanicTheme} from './MechanicUI';
import {workflow,type Question,type ProfessionalTest} from './mechanic-workflow-api';
import {interviewInstant} from './interview-date';
import type {MechanicProfile} from './mechanic-api';

export default function MechanicAssessmentPackage({profile,latest,questionIds,questions,onSuggested,onSent}:{profile:MechanicProfile;latest?:ProfessionalTest;questionIds:string[];questions:Question[];onSuggested:(ids:string[])=>Promise<void>;onSent:()=>Promise<unknown>}){
 const m=useMechanicTheme(),t=m.t;
 const [initial]=useState(()=>new Date(Date.now()+3600000));
 const [date,setDate]=useState(()=>initial.getFullYear()+'-'+String(initial.getMonth()+1).padStart(2,'0')+'-'+String(initial.getDate()).padStart(2,'0'));
 const [time,setTime]=useState(()=>String(initial.getHours()).padStart(2,'0')+':'+String(initial.getMinutes()).padStart(2,'0'));
 const [method,setMethod]=useState('IN_PERSON'),[location,setLocation]=useState(''),[simulation,setSimulation]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const operating=useRef(false),zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 async function suggest(){if(operating.current)return;operating.current=true;setBusy(true);setError('');try{const data=await workflow<{questions:{id:string}[];submissionVersion:number}>('/applications/'+profile.userId+'/question-suggestions');if(data.submissionVersion!==profile.submissionVersion)throw Error(t('The application changed. Refresh it.','تغيّر الطلب. حدّث الصفحة.'));if(data.questions.length!==2)throw Error(t('Add two approved active questions for this specialty to the question bank.','أضف سؤالين فعّالين ومعتمدين لهذا التخصص في بنك الأسئلة.'));await onSuggested(data.questions.map(q=>q.id));}catch(e){setError(e instanceof Error?e.message:t('Could not suggest questions.','تعذر اقتراح الأسئلة.'));}finally{operating.current=false;setBusy(false);}}
 async function send(){if(operating.current||sent)return;operating.current=true;setBusy(true);setError('');let delivered=false;try{
  if(questionIds.length!==2)throw Error(t('Select two questions or use specialty suggestions.','اختر سؤالين أو استخدم اقتراحات التخصص.'));
  let scheduledAt:string;try{scheduledAt=interviewInstant(date.trim(),time.trim());}catch{throw Error(t('Enter a valid interview date and time.','أدخل تاريخ ووقت مقابلة صحيحين.'));}
  if(method!=='ONLINE'&&location.trim().length<3)throw Error(t('Add the interview address.','أضف عنوان المقابلة.'));
  const questionRevisions=Object.fromEntries(questionIds.map(id=>[id,questions.find(q=>q.id===id)?.revision]));
  if(Object.values(questionRevisions).some(v=>!v))throw Error(t('Refresh the selected questions before sending.','حدّث الأسئلة المختارة قبل الإرسال.'));
  await workflow('/applications/'+profile.userId+'/assessment-package','POST',{questionIds,questionRevisions,submissionVersion:profile.submissionVersion,expectedTestId:latest?.id??null,expectedScheduleId:profile.interviewScheduleId??null,scheduledAt,timeZone:zone,method,location:location.trim(),simulation,createZoom:method==='ONLINE'});
  delivered=true;setSent(true);await onSent();
 }catch(e){setError(delivered?t('Package sent. Refresh the application to see it; do not resend.','تم إرسال الحزمة. حدّث الطلب لعرضها ولا تعِد الإرسال.'):e instanceof Error?e.message:t('Could not send the package.','تعذر إرسال الحزمة.'));}finally{operating.current=false;setBusy(false);}}
 return <View style={{gap:14,paddingVertical:17,borderTopWidth:1,borderColor:m.border}}>
  <View style={{flexDirection:m.row,alignItems:'center',gap:9}}><Ionicons name="layers-outline" size={22} color={m.muted}/><Text accessibilityRole="header" style={{fontSize:19,lineHeight:30,color:m.ink,fontWeight:'600',textAlign:m.align,flex:1}}>{t('One assessment package','حزمة تقييم واحدة')}</Text></View>
  <Text style={{fontSize:12,lineHeight:25,color:m.muted,textAlign:m.align}}>{t('Prepare two questions and the interview together. The mechanic answers and confirms the appointment in one workspace; you return for the final review.','جهّز السؤالين وموعد المقابلة معًا. يجيب الميكانيكي ويؤكد الموعد من مساحة واحدة، ثم تعود أنت للمراجعة النهائية.')}</Text>
  <MechanicButton secondary label={t('Suggest questions for this specialty','اقتراح أسئلة حسب التخصص')} busy={busy} disabled={sent} onPress={()=>void suggest()}/>
  <Text style={{fontSize:11,lineHeight:23,color:m.muted,textAlign:m.align}}>{t('Suggestions use approved active questions from your bank. Review the selected prompts above before sending.','الاقتراحات من الأسئلة الفعّالة والمعتمدة في بنكك. راجع نص السؤالين المختارين أعلاه قبل الإرسال.')}</Text>
  <View style={{gap:9,paddingVertical:13,borderTopWidth:1,borderBottomWidth:1,borderColor:m.border}}><Text style={{fontSize:12,lineHeight:24,color:m.ink,fontWeight:'600',textAlign:m.align}}>{t('Questions to send','الأسئلة التي ستُرسل')+' · '+questionIds.length+'/2'}</Text>{questionIds.map((id,index)=><Text key={id} style={{fontSize:12,lineHeight:25,color:m.ink,textAlign:m.align}}>{(index+1)+'. '+(questions.find(q=>q.id===id)?.prompt??t('Refresh the question bank.','حدّث بنك الأسئلة.'))}</Text>)}</View>
  <View style={{flexDirection:m.row,gap:9}}>{[['IN_PERSON','In person','حضوري'],['ONLINE','Zoom','عبر Zoom']].map(([value,en,ar])=><View key={value} style={{flex:1}}><MechanicChoice label={t(en,ar)} selected={method===value} disabled={busy||sent} onPress={()=>setMethod(value)}/></View>)}</View>
  <MechanicField label={t('Package interview date (YYYY-MM-DD)','تاريخ مقابلة الحزمة (YYYY-MM-DD)')} value={date} onChangeText={setDate} editable={!busy&&!sent}/>
  <MechanicField label={t('Package interview time (HH:mm)','وقت مقابلة الحزمة (HH:mm)')} value={time} onChangeText={setTime} editable={!busy&&!sent}/>
  <Text style={{fontSize:10,lineHeight:22,color:m.muted,textAlign:m.align}}>{zone}</Text>
  {method==='IN_PERSON'?<MechanicField label={t('Package interview address','عنوان مقابلة الحزمة')} value={location} onChangeText={setLocation} editable={!busy&&!sent}/>:<MechanicNote>{t('Zoom creates the participant link automatically when the project account is connected.','يُنشأ رابط Zoom تلقائيًا بعد ربط حساب المشروع.')}</MechanicNote>}
  <MechanicChoice label={t('Test appointment — allow an early simulated outcome','موعد تجريبي — السماح بتجربة النتيجة دون انتظار')} selected={simulation} onPress={()=>setSimulation(v=>!v)} disabled={busy||sent}/>
  {simulation&&<Text style={{fontSize:11,lineHeight:23,color:m.muted,textAlign:m.align}}>{t('The appointment and outcome remain explicitly recorded as simulation.','يُسجَّل الموعد والنتيجة بوضوح كمحاكاة في النظام.')}</Text>}
  {!!error&&<MechanicNote error>{error}</MechanicNote>}
  {sent&&<Text accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:24,color:m.ink}}>{t('Assessment package sent.','تم إرسال حزمة التقييم.')}</Text>}
  <MechanicButton label={t('Send questions & interview together','إرسال الأسئلة والموعد معًا')} busy={busy} disabled={sent||questionIds.length!==2} onPress={()=>void send()}/>
 </View>;
}
