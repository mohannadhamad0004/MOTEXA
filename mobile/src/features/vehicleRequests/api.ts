import {api} from "../../core/config/api";
import type {Submission} from "../vehicle3d/api";
export type VehicleRequest=Submission&{taxonomyState?:string;vehicle3dMissing?:boolean;demandCount?:number;submissionId:string;requestedMake:string;requestedModel:string;requestedYear:number;requestedGeneration:string|null;trim:string|null;notes:string|null;requestStatus:string;initialReviewState:string;initialReviewNotes:string|null;consentAt:string|null};
export const requestPath=(admin=false)=>admin?"/admin/parts/vehicle-requests":"/catalog/vehicle-requests";
export const vehicleRequests={
 list:async(admin=false)=>(await api<{requests:VehicleRequest[]}>("GET",requestPath(admin))).requests,
 get:async(id:string,admin=false)=>(await api<{request:VehicleRequest}>("GET",`${requestPath(admin)}/${id}`)).request,
 create:async(body:unknown)=>(await api<{request:VehicleRequest}>("POST",requestPath(),body)).request,
 edit:(id:string,body:unknown)=>api("PATCH",`${requestPath()}/${id}`,body),
 photo:(id:string,view:string,dataBase64:string)=>api("PUT",`${requestPath()}/${id}/photos/${view}`,{dataBase64}),
 submit:(id:string)=>api("POST",`${requestPath()}/${id}/submit`,{consent:true}),
 correct:(id:string,body:unknown)=>api("PATCH",`${requestPath(true)}/${id}`,body),
 action:(id:string,action:string,body:unknown={})=>api("POST",`${requestPath(true)}/${id}/${action}`,body),
};
export const requestLabels:Record<string,readonly[string,string]>={DRAFT:["Add details and four photos","أضف التفاصيل وأربع صور"],PENDING_REVIEW:["Pending Parts Admin review","بانتظار مراجعة إدارة قطع الغيار"],REJECTED:["Rejected","مرفوض"],APPROVED_FOR_GENERATION:["Approved — waiting for 3D generation","معتمد — بانتظار إنشاء النموذج"],GENERATING:["Generating 3D model","جارٍ إنشاء النموذج ثلاثي الأبعاد"],PREPARING:["Preparing model","جارٍ تجهيز النموذج"],READY_FOR_FINAL_REVIEW:["Ready for review","جاهز للمراجعة"],FINAL_REVIEW:["Final review","المراجعة النهائية"],PUBLISHED:["Published","منشور"],GENERATION_FAILED:["Generation failed","تعذّر إنشاء النموذج"]};
