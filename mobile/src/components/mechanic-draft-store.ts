export interface DraftStorage {
 getItemAsync(key:string):Promise<string|null>;
 setItemAsync(key:string,value:string):Promise<void>;
 deleteItemAsync(key:string):Promise<void>;
}
export type MechanicDraftForm={city:string;phoneNumber:string;specializations:string[];yearsOfExperience:string;experienceSummary:string;offersWorkshop:boolean;offersOnSite:boolean;offersOnline:boolean;workshopName:string;workshopAddress:string;coverageAreas:string};
export type MechanicDraft={version:1;form:MechanicDraftForm;step:number;profileId:string;submissionVersion:number};
// Serialize storage access. A head swap commits a new generation only after all chunks exist.
// 400 UTF-16 units fit comfortably below SecureStore's per-entry limit, including Arabic.
export function createMechanicDraftStore(storage:DraftStorage){
 let queue:Promise<unknown>=Promise.resolve();
 function serial<T>(work:()=>Promise<T>):Promise<T>{const next=queue.then(work,work);queue=next.catch(()=>{});return next;}
 const key=(userId:string)=>'motexa_mechanic_draft_'+encodeURIComponent(userId);
 async function head(base:string){const raw=await storage.getItemAsync(base);if(!raw)return null;const h=JSON.parse(raw);if(![0,1].includes(h.slot)||!Number.isInteger(h.count)||h.count<1||h.count>100)throw Error('Invalid draft index');return h as {slot:number;count:number};}
 return {
  read(userId:string){return serial(async()=>{try{const base=key(userId),h=await head(base);if(!h)return null;let raw='';for(let i=0;i<h.count;i++){const chunk=await storage.getItemAsync(base+'_'+h.slot+'_'+i);if(chunk===null)return null;raw+=chunk;}const d=JSON.parse(raw);return d.version===1&&Number.isInteger(d.step)&&d.step>=0&&d.step<=3&&d.form&&typeof d.profileId==='string'?d as MechanicDraft:null;}catch{return null;}});},
  write(userId:string,draft:MechanicDraft){return serial(async()=>{const base=key(userId);let previous=null;try{previous=await head(base);}catch{}const slot=previous?.slot===0?1:0,raw=JSON.stringify(draft),chunks:string[]=[];for(let i=0;i<raw.length;){let end=Math.min(i+400,raw.length);if(end<raw.length&&raw.charCodeAt(end-1)>=0xD800&&raw.charCodeAt(end-1)<=0xDBFF)end--;chunks.push(raw.slice(i,end));i=end;}for(let i=0;i<chunks.length;i++)await storage.setItemAsync(base+'_'+slot+'_'+i,chunks[i]);await storage.setItemAsync(base,JSON.stringify({slot,count:chunks.length}));if(previous)for(let i=0;i<previous.count;i++)await storage.deleteItemAsync(base+'_'+previous.slot+'_'+i).catch(()=>{});});},
  clear(userId:string){return serial(async()=>{const base=key(userId);let h=null;try{h=await head(base);}catch{}await storage.deleteItemAsync(base);if(h)for(let i=0;i<h.count;i++)await storage.deleteItemAsync(base+'_'+h.slot+'_'+i).catch(()=>{});});},
 };
}
export function draftStageLimit(form:MechanicDraftForm,documents:{kind:string}[]){
 if(!form.city.trim()||!form.phoneNumber.trim()||!form.specializations.length||!form.experienceSummary.trim()||form.yearsOfExperience.trim()===''||!Number.isInteger(Number(form.yearsOfExperience))||Number(form.yearsOfExperience)<0)return 0;
 if((!form.offersWorkshop&&!form.offersOnSite&&!form.offersOnline)||(form.offersWorkshop&&(!form.workshopName.trim()||!form.workshopAddress.trim()))||(form.offersOnSite&&!form.coverageAreas.split(/[,،]/).some(v=>v.trim())))return 1;
 if(!['IDENTITY','CERTIFICATE',...(form.offersWorkshop?['WORKSHOP_PROOF']:[])].every(kind=>documents.some(d=>d.kind===kind)))return 2;
 return 3;
}
