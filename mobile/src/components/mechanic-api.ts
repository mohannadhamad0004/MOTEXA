import { api } from "../core/config/api";
import { MECHANIC_SKILLS } from "../features/mechanics/mechanicsService";
import { SKILL_AR } from "../features/mechanics/mechanicBits";
export type MechanicDocument={id:string;kind:string;fileName:string;mimeType:string;size:number};
export type MechanicProfile={id:string;userId:string;city:string;phoneNumber:string;specializations:string[];yearsOfExperience:number|null;experienceSummary:string;offersWorkshop:boolean;offersOnSite:boolean;offersOnline:boolean;workshopName:string;workshopAddress:string;coverageAreas:string[];verificationStatus:string;submittedAt:string|null;submissionVersion:number;reviewNotes:string|null;interviewResult:string|null;interviewNotes:string|null;canReceiveServices:boolean;documents:MechanicDocument[];user:{fullName:string;email:string;status:string};history:{id:string;action:string;createdAt:string;details:{notes?:string}|null}[]};
/** The shared api() client (token refresh, server errors in the app language); routes keep their "/api/..." form. */
export const mechanicApi=<T=any>(route:string,method='GET',body?:unknown)=>api<T>(method,route.replace(/^\/api(?=\/)/,''),body);
/** The one skill list (same keys as the catalog and backend/src/mechanicSkills.ts): [key, English, Arabic]. */
export const mechanicSpecializations=MECHANIC_SKILLS.map(k=>[k,k,SKILL_AR[k]??k] as const);
