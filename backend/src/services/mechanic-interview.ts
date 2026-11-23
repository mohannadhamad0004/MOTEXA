import type {Prisma} from '../generated/prisma/client.js';
type InterviewProfile={id:string;interviewResult:string|null;interviewedAt:Date|null;interviewedById:string|null;submittedAt:Date|null;interviewScheduleId?:string|null;interviewScheduledAt?:Date|null;interviewConfirmedAt?:Date|null;interviewSimulation?:boolean};
/** Old assessment side effects are not evidence of an interview. A dedicated audit
 * event must match the recorded actor, outcome, and the current submission/time. */
export async function hasRecordedInterview(client:Pick<Prisma.TransactionClient,'auditLog'>,profile:InterviewProfile){
 if(!profile.interviewedAt||!profile.interviewedById||!['PASSED','FAILED'].includes(profile.interviewResult??''))return false;
 if(profile.interviewScheduleId&&(!profile.interviewConfirmedAt||(!profile.interviewSimulation&&profile.interviewScheduledAt&&profile.interviewScheduledAt.getTime()>Date.now())))return false;
 const since=new Date(Math.max(profile.interviewedAt.getTime(),profile.submittedAt?.getTime()??0));
 return !!await client.auditLog.findFirst({where:{targetId:profile.id,actorId:profile.interviewedById,action:'MECHANIC_INTERVIEW_'+profile.interviewResult,createdAt:{gte:since}},select:{id:true}});
}
