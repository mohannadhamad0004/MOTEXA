type Profile={verificationStatus:string;submittedAt:Date|null;submissionVersion:number;offersWorkshop:boolean;interviewResult:string|null;interviewScheduledAt?:Date|null;interviewConfirmedAt?:Date|null;user:{status:string};documents:{id:string;kind:string;storageKey:string}[]};
type Test={submissionVersion:number;attempt:number;submittedAt:Date|null;reviewedAt:Date|null;assessment:string|null};
type Review={documentId:string;storageKey:string};
/** Read-only projection. Never changes or replaces existing approval policy. */
export function mechanicProgress(profile:Profile,tests:Test[],reviews:Review[]){
 const required=['IDENTITY','CERTIFICATE',...(profile.offersWorkshop?['WORKSHOP_PROOF']:[])];
 const documents=required.map(kind=>{const document=profile.documents.find(d=>d.kind===kind);return{kind,uploaded:!!document,reviewed:!!document&&reviews.some(r=>r.documentId===document.id&&r.storageKey===document.storageKey)};});
 const current=tests.filter(t=>t.submissionVersion===profile.submissionVersion).sort((a,b)=>b.attempt-a.attempt)[0];
 const reviewed=!!current?.reviewedAt,passed=reviewed&&current?.assessment==='PASSED';
 let stage='ADMIN_REVIEW',action='OPEN_REVIEW';
 if(profile.verificationStatus==='DRAFT'||!profile.submittedAt){stage='DRAFT';action='EDIT';}
 else if(profile.verificationStatus==='NEEDS_COMPLETION'){stage='NEEDS_COMPLETION';action='EDIT';}
 else if(profile.verificationStatus==='REJECTED'){stage='REJECTED';}
 else if(profile.verificationStatus==='SUSPENDED'){stage='SUSPENDED';}
 else if(profile.verificationStatus==='VERIFIED'){stage='APPROVED';action='NONE';}
 else if(current&&!current.submittedAt){stage='TAKE_TEST';}
 else if(current&&!reviewed){stage='TEST_REVIEW';}
 else if(current&&reviewed&&!passed){stage='ASSESSMENT_RECORDED';}
 else if(profile.interviewResult==='FAILED'){stage='ASSESSMENT_RECORDED';}
 else if(profile.interviewResult==='PASSED'&&(!current||passed)){stage='AWAITING_DECISION';}
 else if(current&&passed&&profile.interviewScheduledAt){stage=profile.interviewConfirmedAt?'INTERVIEW_CONFIRMED':'INTERVIEW_SCHEDULED';}
 else if(current&&passed){stage='INTERVIEW_REVIEW';}
 const blocked=profile.user.status!=='ACTIVE';
 if(blocked){stage='ACCOUNT_BLOCKED';action='NONE';}
 return{stage,action,submissionVersion:profile.submissionVersion,documents,assessment:{assigned:!!current,submitted:!!current?.submittedAt,reviewed,passed},interview:{recorded:!!profile.interviewResult,passed:profile.interviewResult==='PASSED'},canReceiveServices:profile.verificationStatus==='VERIFIED'&&!blocked};
}
