import {useState} from 'react';
import {Text} from './MotexaVisual';
import {MechanicField,MechanicChoice,MechanicButton,MechanicNote,useMechanicTheme} from './MechanicUI';
import MechanicInterviewAppointment from './MechanicInterviewAppointment';
import {mechanicApi,type MechanicProfile} from './mechanic-api';
import {interviewInstant} from './interview-date';

export default function MechanicInterviewScheduler({profile,onSaved}:{profile:MechanicProfile;onSaved:()=>Promise<unknown>}){
 const m=useMechanicTheme();
 const [date,setDate]=useState(''),[time,setTime]=useState(''),[method,setMethod]=useState('ONLINE'),[location,setLocation]=useState(''),[simulation,setSimulation]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 async function schedule(){setBusy(true);setError('');try{
  let scheduledAt:string;try{scheduledAt=interviewInstant(date.trim(),time.trim());}catch{throw Error(m.t('Enter a valid date YYYY-MM-DD and time HH:mm.','أدخل تاريخًا صحيحًا YYYY-MM-DD ووقتًا HH:mm.'));}
  if(method!=='ONLINE'&&location.trim().length<3)throw Error(m.t('Add the interview location, meeting link or contact.','أضف مكان المقابلة أو رابط اللقاء أو جهة الاتصال.'));

  await mechanicApi('/api/mechanics/admin/'+profile.userId+'/interview/schedule','POST',{scheduledAt,method,createZoom:method==='ONLINE',expectedScheduleId:profile.interviewScheduleId??null,location:location.trim(),timeZone:zone,simulation,submissionVersion:profile.submissionVersion});
  await onSaved();
 }catch(e){setError(e instanceof Error?e.message:m.t('Scheduling failed. Retry.','تعذّرت الجدولة. حاول مجددًا.'));}finally{setBusy(false);}}
 return <>
  <MechanicInterviewAppointment profile={profile} readOnly/>
  {profile.verificationStatus==='PENDING'&&<>
   <Text accessibilityRole="header" style={{fontSize:17,lineHeight:28,color:m.ink,fontWeight:'600',textAlign:m.align}}>{profile.interviewScheduleId?m.t('Change interview appointment','تغيير موعد المقابلة'):m.t('Arrange an interview','تحديد موعد المقابلة')}</Text>
   <Text style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{m.t('The mechanic receives an in-app notification and confirms attendance.','يصل للميكانيكي إشعار داخل التطبيق ليؤكد حضوره.')}</Text>
   <MechanicField label={m.t('Interview date (YYYY-MM-DD)','تاريخ المقابلة (YYYY-MM-DD)')} placeholder="2026-11-15" value={date} onChangeText={setDate} editable={!busy} autoCapitalize="none"/>
   <MechanicField label={m.t('Interview time (HH:mm, 24-hour)','وقت المقابلة (HH:mm، 24 ساعة)')} placeholder="16:30" value={time} onChangeText={setTime} editable={!busy}/>
   <Text style={{fontSize:11,lineHeight:22,color:m.muted,textAlign:m.align}}>{m.t('Time zone of this device: ','المنطقة الزمنية لهذا الجهاز: ')+zone}</Text>
   {[['IN_PERSON','In person','حضوري'],['ONLINE','Online meeting','لقاء أونلاين'],['PHONE','Phone call','مكالمة هاتفية']].map(([value,en,ar])=><MechanicChoice key={value} label={m.t(en,ar)} selected={method===value} onPress={()=>setMethod(value)} disabled={busy}/>)}
   {method!=='ONLINE'&&<MechanicField label={method==='IN_PERSON'?m.t('Interview address','عنوان المقابلة'):m.t('Phone contact','رقم الاتصال')} value={location} onChangeText={setLocation} editable={!busy} multiline/>}
   {method==='ONLINE'&&<MechanicNote>{m.t('A 30-minute Zoom meeting will be created automatically. The mechanic receives the participant link inside the app and confirms attendance.','سيُنشأ اجتماع Zoom مدته 30 دقيقة تلقائيًا. يصل رابط الانضمام للميكانيكي داخل التطبيق ليؤكد حضوره.')}</MechanicNote>}
   <MechanicChoice label={m.t('Simulation appointment — project testing','موعد محاكاة — لاختبار المشروع')} selected={simulation} onPress={()=>setSimulation(v=>!v)} disabled={busy}/>
   {simulation&&<MechanicNote>{m.t('Recorded as a simulation. After the mechanic confirms, you can test the outcome without waiting for the scheduled time.','سيُحفظ كموعد محاكاة. بعد تأكيد الميكانيكي يمكنك تجربة تسجيل النتيجة دون انتظار الوقت المحدد.')}</MechanicNote>}
   {!!profile.interviewScheduleId&&<MechanicNote>{m.t('Changing the appointment clears its previous confirmation and interview result.','تغيير الموعد يلغي تأكيده ونتيجة المقابلة السابقة.')}</MechanicNote>}
   {!!error&&<MechanicNote error>{error}</MechanicNote>}
   <MechanicButton label={method==='ONLINE'?m.t('Create Zoom & send invitation','إنشاء Zoom وإرسال الدعوة'):m.t('Send interview appointment','إرسال موعد المقابلة')} busy={busy} onPress={()=>void schedule()}/>
  </>}
 </>;
}
