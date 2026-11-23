import * as Linking from 'expo-linking';
import {useState} from 'react';
import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {MechanicCard,MechanicButton,MechanicNote,useMechanicTheme} from './MechanicUI';
import {mechanicApi,type MechanicProfile} from './mechanic-api';
import {interviewWhen,interviewJoinUrl} from './interview-date';

export default function MechanicInterviewAppointment({profile,onUpdated,readOnly=false}:{profile:MechanicProfile;onUpdated?:(profile:MechanicProfile)=>void;readOnly?:boolean}){
 const m=useMechanicTheme(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!profile.interviewScheduleId||!profile.interviewScheduledAt)return null;
 const joinUrl=profile.interviewMethod==='ONLINE'?interviewJoinUrl(profile.interviewLocation):null;
 const method=profile.interviewMethod==='IN_PERSON'?m.t('In person','حضوري'):profile.interviewMethod==='ONLINE'?m.t('Online meeting','لقاء أونلاين'):m.t('Phone call','مكالمة هاتفية');
 return <MechanicCard>
  <View style={{flexDirection:m.row,alignItems:'center',gap:10}}><View style={{width:44,height:44,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:m.soft}}><Ionicons name="calendar-outline" size={23} color={m.muted}/></View><Text accessibilityRole="header" style={{flex:1,fontSize:18,lineHeight:29,color:m.ink,textAlign:m.align,fontWeight:'600'}}>{m.t('Your interview appointment','موعد المقابلة المهنية')}</Text></View>
  {profile.interviewSimulation&&<MechanicNote>{m.t('SIMULATION · Project testing appointment','محاكاة · موعد تجريبي لاختبار المشروع')}</MechanicNote>}
  <Text style={{fontSize:18,lineHeight:30,color:m.ink,textAlign:m.align}}>{interviewWhen(profile.interviewScheduledAt,m.ar,profile.interviewTimeZone)}</Text>
  <Text style={{fontSize:11,lineHeight:21,color:m.muted,textAlign:m.align}}>{profile.interviewTimeZone||''}</Text>
  <Text style={{fontSize:13,lineHeight:24,color:m.ink,textAlign:m.align}}>{method+' · '+(profile.interviewLocation||'')}</Text>
  <Text accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{profile.interviewConfirmedAt?m.t('Attendance confirmed for this appointment.','تم تأكيد الحضور لهذا الموعد.'):m.t('Please confirm attendance. A changed appointment requires a new confirmation.','يرجى تأكيد الحضور. تغيير الموعد يتطلب تأكيدًا جديدًا.')}</Text>
  {!!joinUrl&&<MechanicButton secondary label={m.t('Open interview meeting','فتح رابط المقابلة')} onPress={()=>{setError('');void Linking.openURL(joinUrl).catch(()=>setError(m.t('Could not open the meeting link on this device.','تعذّر فتح رابط المقابلة على هذا الجهاز.')));}}/>}
  {!!error&&<MechanicNote error>{error}</MechanicNote>}
  {!readOnly&&!profile.interviewConfirmedAt&&profile.verificationStatus==='PENDING'&&<MechanicButton label={m.t('Confirm interview attendance','تأكيد حضور المقابلة')} busy={busy} onPress={()=>{setBusy(true);setError('');void mechanicApi<{profile:MechanicProfile}>('/api/mechanics/me/interview/confirm','POST',{scheduleId:profile.interviewScheduleId,submissionVersion:profile.submissionVersion}).then(data=>onUpdated?.(data.profile)).catch(e=>setError(e instanceof Error?e.message:m.t('Confirmation failed. Retry.','تعذّر التأكيد. حاول مجددًا.'))).finally(()=>setBusy(false));}}/>}
 </MechanicCard>;
}
